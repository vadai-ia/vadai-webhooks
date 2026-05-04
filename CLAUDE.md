# CLAUDE.md — VADAI Webhooks Service

## Contexto

**vadai-webhooks** es un servicio centralizado de VADAI (agencia mexicana de IA y automatización) que permite crear webhooks dinámicamente desde un frontend interno y procesarlos con handlers escritos en código.

Replica el patrón de N8N pero con backend custom en TypeScript: la lógica de cada webhook se escribe en código, no en un editor visual.

## Filosofía VADAI aplicable

- Arquitectura limpia sobre atajos
- Iteración paso a paso (no saltar adelante)
- Capa 1 (core) antes que Capa 2 (handlers)
- Lo más simple que funcione gana sobre lo elaborado
- Documentar el "por qué", no el "qué"
- Honestidad técnica: si algo no funciona, decirlo directo

## Stack (FINAL — no agregar dependencias sin discutirlo)

- Next.js 15 App Router (modo `next start`, no serverless)
- TypeScript estricto
- Supabase (Postgres + Auth) — solo `@supabase/supabase-js` y `@supabase/ssr`
- Tailwind + shadcn/ui (dark theme VADAI)
- Zod (solo en handlers)
- pnpm
- Deploy: Railway

**SIN:** Drizzle, Prisma, BullMQ, Redis, nanoid, Realtime de Supabase (al inicio).
Cuando algo de esto se necesite de verdad, lo discutimos antes de agregar.

## Modelo de dominio

> **Importante:** este servicio comparte el proyecto Supabase de VADAI (`ukgbklhmjbniffssacjm`) con otros sistemas. Por eso las tablas usan prefijo **`vw_`** (vadai-webhooks). Schema completo en [`supabase/schema.sql`](./supabase/schema.sql).

### `vw_configs`
Cada webhook tiene `slug` (legible) y `token` (secreto, va en la URL).
Status:
- `pending_handler` — URL recibe pero aún no hay handler en código
- `active` — recibe + procesa
- `paused` — recibe pero descarta sin procesar
- `archived` — URL responde 410

### `vw_executions`
Cada payload entrante crea una row. Status del processing:
- `received` (default al insert si va a procesarse)
- `pending` (sin handler, queda en cola)
- `processing` (handler corriendo)
- `completed` / `completed_with_warning`
- `failed`
- `skipped_duplicate` / `skipped_paused`

Campo `steps` JSONB: array de `{ ts, name, status, message?, data? }`.

## Endpoint universal

`/in/[token]/route.ts` recibe TODOS los webhooks. NUNCA crear endpoints específicos por cliente. Si alguien sugiere `/api/webhooks/genco/odoo`, NO. Solo `/in/[token]`.

## Patrón de Handler

```ts
// src/handlers/[slug].ts
import type { WebhookHandler } from './_types';
import { z } from 'zod';

const Schema = z.object({ /* shape */ });

export const handler: WebhookHandler<z.infer<typeof Schema>> = {
  slug: 'mi-webhook',
  description: 'Lo que hace',
  schema: Schema,
  getIdempotencyKey: (p) => `${p.id}`,
  async process(payload, ctx) {
    await ctx.logger.step('start', 'info', 'Iniciando');
    // ... lógica
    return { summary: { /* ... */ } };
  }
};
```

Y en `_registry.ts`:
```ts
import { handler as miHandler } from './mi-handler';
export const handlers = new Map([[miHandler.slug, miHandler]]);
```

## Convenciones

- Archivos: kebab-case
- Componentes: PascalCase
- Tablas: snake_case con prefijo `vw_` (proyecto Supabase compartido con otros sistemas VADAI)
- Path alias: `@/*`
- Imports: built-in → external → @/lib → @/components → relative
- Zero `any` implícito
- Errores: persistir en DB, NO solo console.log
- Logs en handlers: solo `ctx.logger.step()`, nunca console.log

## Branding visual

```ts
// tailwind.config.ts colors
vadai: {
  cyan:        '#00b8e6',
  'cyan-light': '#0dd3f5',
  navy:        '#05080f',
  'navy-mid':  '#111827',
  'navy-light': '#0a1020',
  text:        '#f0f4f8',
  muted:       '#8899aa',
  success:     '#34d399',
  warning:     '#fbbf24',
  error:       '#f87171',
}
```

- Dark mode siempre
- Sans: Inter / Mono: JetBrains Mono
- Iconos: lucide-react
- Sin gradientes

## shadcn componentes

button, card, table, badge, dialog, dropdown-menu, input, label, sonner, tabs, scroll-area, separator, skeleton, sheet, alert, form, textarea, switch

## Páginas

### `/dashboard`
Cards de cada webhook. Stats por card: status, último payload, count últimas 24h.
Botón "Nuevo Webhook" prominente.

### `/dashboard/new`
Form: nombre, slug (auto desde nombre), cliente, descripción.
Submit → genera `token = 'wh_' + crypto.randomUUID().replace(/-/g, '')`.
Redirige a `/dashboard/[slug]?created=true` con modal mostrando la URL.

### `/dashboard/[slug]`
- Header: nombre, URL copiable, status, botones (Pause/Activate/Edit/Archive)
- Tabla ejecuciones: timestamp, status badge, duration, idempotency_key, link
- Filtros: status, rango de fechas
- Paginación con `range()` de Supabase (50 por página)
- Refresh manual (botón) + polling cada 5s mientras la pestaña está activa

### `/dashboard/[slug]/[execId]`
Tres secciones:

**Input:** received_at, source_ip, user_agent, payload_size, payload (JSON viewer collapsable), headers (JSON viewer collapsable)

**Processing:** status badge, started_at, completed_at, duration_ms, idempotency_key

**Timeline:** renderizar `steps[]` como lista vertical con icon de status (✓/⚠/✗/·), timestamp relativo, name, message, y data expandible.

Si `status='failed'`: card de error con `error_message` y `error_stack` collapsable, botón "Reintentar".

## Auth

- Middleware redirige a `/login` si no hay sesión
- Magic link Supabase Auth
- Validar dominio antes de enviar magic link: solo `@vadai.com.mx`
- Endpoints `/in/*` son públicos (sin auth de usuario)

## Lo que NO se hace

- Realtime de Supabase al inicio (polling es suficiente para empezar)
- Triggers SQL (manejar en código JS)
- Funciones SQL custom (lo mismo)
- Procesamiento síncrono >1s (siempre `after()` para handlers)
- Exponer service_role_key al cliente
- Crear endpoints específicos por cliente (solo `/in/[token]`)
- Agregar dependencias sin razón concreta

## Cómo me hablas

Soy Alejandro, fundador de VADAI.
- Sin preámbulos
- En español
- Si la respuesta es obvia, asume default y avanza
- Pregunta máximo 2-3 cosas críticas a la vez
- Pushback honesto si crees que algo está mal pensado
- Iteración paso a paso, sin saltar adelante
- Detente al final de cada fase para que valide

## Tareas iniciales (ORDEN ESTRICTO)

### Fase 1 — Core MVP (sin handlers)
1. `pnpm create next-app vadai-webhooks --ts --tailwind --app --src-dir --import-alias "@/*"`
2. Tailwind config con paleta VADAI
3. `pnpm add @supabase/supabase-js @supabase/ssr zod lucide-react sonner class-variance-authority clsx tailwind-merge`
4. `pnpm dlx shadcn@latest init` + componentes listados
5. `lib/supabase/{server,client,service-role}.ts`
6. `lib/db-types.ts` (generado con `supabase gen types`)
7. `types/webhook.ts`
8. `lib/step-logger.ts`
9. `lib/webhook-runner.ts` (sin handlers todavía, registry vacío)
10. `handlers/_types.ts` y `handlers/_registry.ts`
11. `app/in/[token]/route.ts`
12. `app/login/page.tsx` y `app/auth/callback/route.ts`
13. `middleware.ts`
14. `app/dashboard/layout.tsx` (sidebar VADAI)
15. `app/dashboard/page.tsx` (lista webhooks)
16. `app/dashboard/new/page.tsx` (crear)
17. `app/dashboard/[slug]/page.tsx` (lista ejecuciones)
18. `app/dashboard/[slug]/[execId]/page.tsx` (detalle con timeline)
19. README + variables de entorno documentadas
20. **STOP. Smoke test antes de Fase 2.**

### Fase 2 — Deploy
21. Push a GitHub
22. Railway: deploy + custom domain + env vars
23. Smoke test desde producción con curl
24. **STOP. Validar que crear webhook + recibir POST + ver en dashboard funciona end-to-end.**

### Fase 3 — Primer handler real
25. Crear `handlers/genco-odoo.ts` con specs en `docs/genco-odoo-spec.md`
26. Registrar en `_registry.ts`
27. Cambiar status del webhook config a `active` desde el frontend
28. Validar con payload real

## Validaciones pre-commit

- [ ] `pnpm tsc --noEmit` sin errores
- [ ] `pnpm lint` sin warnings
- [ ] Sin `any` implícitos
- [ ] Errores se persisten a DB
- [ ] Variables nuevas en `.env.example`
