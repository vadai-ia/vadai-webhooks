-- ============================================================
-- VADAI Webhooks Service — Schema
-- ============================================================
-- Tablas para el servicio centralizado de webhooks.
-- Prefijo `vw_` (vadai-webhooks) para namespaciar dentro del
-- proyecto Supabase compartido de VADAI AGENCIA.
--
-- Pegar este archivo completo en el SQL Editor de Supabase:
--   https://supabase.com/dashboard/project/ukgbklhmjbniffssacjm/sql/new
-- ============================================================


-- ============================================================
-- 1. CONFIGURACIÓN DE WEBHOOKS
-- ============================================================
CREATE TABLE vw_configs (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT         UNIQUE NOT NULL,        -- legible: 'genco-odoo'
  token           TEXT         UNIQUE NOT NULL,        -- secreto, en la URL

  name            TEXT         NOT NULL,
  client_name     TEXT,
  description     TEXT,

  status          TEXT         NOT NULL DEFAULT 'pending_handler',
                  -- 'pending_handler' | 'active' | 'paused' | 'archived'

  handler_slug    TEXT,                                 -- normalmente igual al slug
  config          JSONB        DEFAULT '{}'::jsonb,

  created_by      UUID         REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ  DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX vw_configs_token_idx ON vw_configs(token);
CREATE INDEX vw_configs_slug_idx  ON vw_configs(slug);


-- ============================================================
-- 2. EJECUCIONES
-- ============================================================
CREATE TABLE vw_executions (
  id                BIGSERIAL    PRIMARY KEY,
  webhook_config_id UUID         REFERENCES vw_configs(id) ON DELETE CASCADE,
  webhook_slug      TEXT         NOT NULL,

  -- Input
  received_at        TIMESTAMPTZ  DEFAULT NOW(),
  source_ip          TEXT,
  user_agent         TEXT,
  headers            JSONB,
  payload            JSONB        NOT NULL,
  payload_size_bytes INTEGER,

  -- Processing
  status            TEXT         NOT NULL DEFAULT 'received',
                    -- 'received' | 'pending' (sin handler) | 'processing'
                    -- 'completed' | 'completed_with_warning'
                    -- 'failed' | 'skipped_duplicate' | 'skipped_paused'
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  duration_ms       INTEGER,

  -- Steps internos (timeline)
  steps             JSONB        DEFAULT '[]'::jsonb,

  -- Result / Error
  result_summary    JSONB,
  error_message     TEXT,
  error_stack       TEXT,

  -- Idempotencia
  idempotency_key   TEXT,

  created_at        TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX vw_executions_received_idx ON vw_executions(received_at DESC);
CREATE INDEX vw_executions_status_idx   ON vw_executions(status);
CREATE INDEX vw_executions_slug_idx     ON vw_executions(webhook_slug);
CREATE INDEX vw_executions_idemp_idx    ON vw_executions(webhook_slug, idempotency_key)
  WHERE idempotency_key IS NOT NULL;


-- ============================================================
-- 3. ALLOWLIST de usuarios autorizados
-- ============================================================
-- Reemplaza el filtro por dominio (@vadai.com.mx). Para dar acceso a
-- alguien:
--   1. Crear el usuario en Authentication → Users (Supabase dashboard)
--   2. Insertar su email aquí: INSERT INTO vw_allowed_users (email) VALUES (...)
-- ============================================================
CREATE TABLE vw_allowed_users (
  email      TEXT         PRIMARY KEY,
  added_at   TIMESTAMPTZ  DEFAULT NOW(),
  added_by   UUID         REFERENCES auth.users(id),
  notes      TEXT
);

ALTER TABLE vw_allowed_users ENABLE ROW LEVEL SECURITY;

-- Cualquier usuario autenticado puede ver SU PROPIO row.
CREATE POLICY "self_can_read_own_access" ON vw_allowed_users
  FOR SELECT TO authenticated
  USING (email = (auth.jwt() ->> 'email'));


-- ============================================================
-- 4. RLS — usuarios en la allowlist
-- ============================================================
ALTER TABLE vw_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allowed_users_all" ON vw_configs
  FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'email') IN (SELECT email FROM vw_allowed_users))
  WITH CHECK ((auth.jwt() ->> 'email') IN (SELECT email FROM vw_allowed_users));

ALTER TABLE vw_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allowed_users_read" ON vw_executions
  FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'email') IN (SELECT email FROM vw_allowed_users));

-- El endpoint /in/[token] usa service_role_key que bypassa RLS
-- para insertar/actualizar `vw_executions` sin sesión de usuario.


-- ============================================================
-- 5. TABLAS POR HANDLER — auxiliares
-- ============================================================
-- Cada handler que necesite tablas de mapeo / config las crea con prefijo
-- `vw_<slug>_*` para mantener namespace limpio dentro del proyecto Supabase
-- compartido. Las migraciones viven en supabase/migrations/.
--
-- Inventario actual:
--   - vw_genco_company_mapping       (handler genco-soft-odoo)
--   - vw_genco_payment_method_map    (handler genco-soft-odoo)
--
-- Schema completo en cada migración (ver migrations/0002_genco_mapping_tables.sql).
