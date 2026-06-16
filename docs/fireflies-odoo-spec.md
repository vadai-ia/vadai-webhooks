# Handler `fireflies-alex-transcript` — spec

> Webhook de Fireflies → guarda el resumen de la reunión y un **agente OpenAI**
> clasifica cada action item dentro de los proyectos `LEVANTIA - <cliente>` del
> Odoo de VADAI, con título redactado y fecha de entrega tentativa.

## Flujo

```
Fireflies (meeting.summarized)
  │  POST /in/wh_…  { event, timestamp, meeting_id }
  ▼
runHandler → handler.process
  1. Normaliza payload + routea evento (procesa summarized; skip transcribed)
  2. GraphQL a Fireflies: transcript(id: meeting_id) → metadata + summary
  3. Parsea summary.action_items (string markdown) → items {assignee, text, timestamp}
  4. Odoo: proyectos candidatos LEVANTIA (name ilike) + proyecto Inbox + tag idempotencia
  5. OpenAI: por cada item → {project_id|null, title, deadline_offset_days, confidence, reasoning}
  6. Por item: resuelve proyecto (candidato válido | Inbox | privado), calcula
     date_deadline = fecha_reunión + offset, responsable (match nombre/email → fallback Alex),
     crea project.task con tag FF:<meetingId>
  7. result_summary = metadata + overview + clasificaciones + tasks creadas
```

El procesamiento corre en `after()` (vía `runHandler`); el POST responde 200 inmediato.

## Payload real y routing de eventos

Fireflies "Webhook 2.0" (User-Agent `Fireflies-Webhook/2.0`) manda **snake_case** y dispara
**dos webhooks por reunión**:

```json
{ "event": "meeting.transcribed",  "timestamp": 1781288348349, "meeting_id": "01KT…" }
{ "event": "meeting.summarized",   "timestamp": 1781288382228, "meeting_id": "01KT…" }
```

- `meeting.transcribed` → transcripción lista, summary aún no → **se saltea** (esperamos el summary).
- `meeting.summarized` → summary + action items listos → **se procesa**.
- `"Transcription completed"` (doc histórica / tests con curl) y un payload **sin `event`** también
  se procesan.

El schema acepta tanto `meeting_id`/`event` (real) como `meetingId`/`eventType` (doc/legacy) y
normaliza en `process`.

## Por qué un segundo fetch a Fireflies

El webhook **no trae el contenido**: solo el `meeting_id`. El transcript, el summary y los
action items se piden a la GraphQL API
(`https://api.fireflies.ai/graphql`, `Authorization: Bearer <FIREFLIES_API_KEY>`).

> El "MCP server" de Fireflies (`docs.fireflies.ai/mcp`) **no** sirve acá: es solo
> un buscador de su documentación (tool `SearchFireflies`), no una API de datos.

## GraphQL query (Fireflies)

```graphql
query Transcript($id: String!) {
  transcript(id: $id) {
    id title date duration meeting_link transcript_url
    organizer_email host_email participants
    meeting_attendees { displayName email }
    summary { overview action_items keywords bullet_gist shorthand_bullet short_summary }
  }
}
```

`summary.action_items` viene como **un string markdown** agrupado por responsable, con
timestamps `(MM:SS)`. El parser (`parseActionItems`) es tolerante a listas planas.

## Agente OpenAI (`lib/openai/client.ts`)

Chat Completions vía `fetch` (sin SDK), **Structured Outputs** (`response_format:
json_schema, strict`) + validación Zod, con 1 reintento de reparación. Por cada action item
devuelve:

| Campo | Qué es |
|-------|--------|
| `project_id` | id de un candidato LEVANTIA, o `null` si ninguno aplica con confianza |
| `title` | título claro, accionable, en español, empieza con verbo (~80 chars) |
| `deadline_offset_days` | días desde la reunión para la entrega (urgencia inferida; default 7) |
| `confidence` | 0–1 sobre la asignación de proyecto |
| `reasoning` | frase breve justificando el proyecto |

**Input:** `meeting {title, date, overview, attendees}`, `candidate_projects [{id, name}]`,
`action_items [{index, assignee, text}]`.

El handler revalida `project_id` contra el set de candidatos (defensa ante alucinación) y
aplica `CONFIDENCE_THRESHOLD = 0.4`: por debajo, el item va a Inbox aunque la IA sugiriera
proyecto.

## Odoo — modelo y campos

`project.task`:
- `name`: el `title` de la IA (fallback al texto original).
- `project_id`: proyecto LEVANTIA elegido | Inbox | omitido (tarea privada).
- `stage_id`: primera etapa del proyecto por `sequence` (respeta tu kanban); si el
  proyecto no tiene etapas, se crea una con `FIREFLIES_TASK_STAGE` (default "Por hacer").
  Sin esto, Odoo deja las tasks creadas por API en la columna "Ninguno".
- `user_ids`: `[[6,0,[userId]]]` (responsable resuelto o fallback Alex).
- `tag_ids`: `[[6,0,[tagId]]]` con el **nombre de la reunión** (legible, para filtrar).
- `date_deadline`: `YYYY-MM-DD` = fecha de reunión + offset (clamp 0–90 días).
- `description`: reunión + fecha + responsable + entrega + clasificación IA + texto original + links.

Proyectos candidatos: `project.project` con `['name','ilike', FIREFLIES_LEVANTIA_MATCH]` y
`active=true`. **No se crean proyectos.** Inbox: `project.project` con `name = FIREFLIES_INBOX_PROJECT`.

## Resolución de responsable (determinística, sin IA)

1. `meeting_attendees` da `displayName → email`. Match → `res.users` por `login`/`partner_id.email`.
2. Si no, `res.users` por `name ilike`.
3. Si nada → fallback (`FIREFLIES_FALLBACK_USER_EMAIL`, o el usuario de la API).

## Idempotencia

- **Runner**: `getIdempotencyKey = meetingId` → reintentos de Fireflies = `skipped_duplicate`.
- **Odoo**: el `meetingId` (ULID único) vive en la descripción de cada task (pie + link al
  transcript). Antes de crear, dedup por `description ilike <meetingId>`; si ya hay tasks, no
  recreo. El **tag visible es el nombre de la reunión** (solo para agrupar/filtrar, no para
  idempotencia).

## Status final / resiliencia

- 0 action items → `completed` (0 tareas).
- Todos los items creados OK → `completed`.
- Algún item falló al crear (pero no todos) → `completed_with_warning`.
- 0 proyectos LEVANTIA (todo a Inbox) → `completed_with_warning`.
- Falta `OPENAI_API_KEY` → `failed` (reintentable; misconfig que conviene notar).
- OpenAI cae en runtime → **modo degradado**: todo a Inbox con el texto original como título,
  `completed_with_warning` (no se pierden action items).
- Todos los items fallan al crear en Odoo → `failed` (throw, reintentable).

## Env vars

```
FIREFLIES_API_KEY=…                 # GraphQL de Fireflies (Settings → Developer)
FIREFLIES_LEVANTIA_MATCH=LEVANTIA   # filtro name ilike de proyectos candidatos
FIREFLIES_INBOX_PROJECT=Inbox       # proyecto de triage
FIREFLIES_FALLBACK_USER_EMAIL=      # responsable fallback (vacío = usuario de la API)
OPENAI_API_KEY=sk-…                 # agente clasificador
OPENAI_MODEL=gpt-4o                 # modelo con Structured Outputs
# Reusa el tenant Odoo de VADAI: ODOO_VADAI_URL/DB/USER/API_KEY
```

## Pendiente (hardening futuro)

- Verificar `x-hub-signature` (HMAC SHA-256) del webhook. Hoy el token en la URL ya autentica;
  verificar la firma requiere pasar headers + raw body al handler (cambio en `HandlerContext` +
  `/in/[token]`). Se difiere.
- Asignación de responsable por IA (hoy es determinística).
