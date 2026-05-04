# vadai-webhooks

Servicio centralizado de webhooks de VADAI. Permite crear webhooks dinámicamente desde un frontend interno, recibir payloads en URLs únicas, y procesarlos con handlers escritos en código TypeScript.

> Estado: **bootstrap inicial** — código aún no implementado. Ver [CLAUDE.md](./CLAUDE.md) para el plan completo.

## Stack

- Next.js 15 (App Router) + TypeScript
- Supabase (Postgres + Auth)
- Tailwind + shadcn/ui (dark VADAI)
- Zod (validación en handlers)
- Deploy: Railway · `webhooks.vadai.com.mx`

## Arquitectura en una frase

Un endpoint universal `POST /in/[token]` guarda cualquier payload entrante; un runner asíncrono lo despacha al handler registrado para ese slug; un dashboard muestra ejecuciones, payloads y timeline de pasos.

## Setup local

```bash
# 1. Clonar y entrar
git clone https://github.com/vadai-ia/vadai-webhooks.git
cd vadai-webhooks

# 2. Variables de entorno
cp .env.example .env.local
# Editar .env.local con las keys de Supabase

# 3. Dependencias (cuando exista package.json)
pnpm install

# 4. Dev server
pnpm dev
```

## Variables de entorno

Ver [.env.example](./.env.example). Se requieren:

| Variable | Descripción |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key (cliente) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-only, bypassa RLS) |
| `ALLOWED_EMAIL_DOMAIN` | Dominio permitido para login (`vadai.com.mx`) |
| `NEXT_PUBLIC_APP_URL` | URL pública de la app |

## Schema de DB

El SQL completo vive en [`supabase/schema.sql`](./supabase/schema.sql). Pegarlo en el SQL Editor del proyecto VADAI compartido en Supabase.

Tablas (prefijo `vw_` para namespaciar dentro del proyecto compartido):

- `vw_configs` — configuración de cada webhook (slug, token, status, handler)
- `vw_executions` — log de cada payload recibido + procesamiento

## Plan de implementación

Ver [CLAUDE.md](./CLAUDE.md) — fases ordenadas:

1. **Fase 1** — Core MVP (sin handlers): scaffold, auth, endpoint universal, dashboard
2. **Fase 2** — Deploy a Railway + smoke test
3. **Fase 3** — Primer handler real (GENCO Odoo)

Cada fase tiene un STOP para validar antes de avanzar.
