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
-- 3. RLS — solo usuarios @vadai.com.mx
-- ============================================================
ALTER TABLE vw_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vadai_users_all" ON vw_configs
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'email' LIKE '%@vadai.com.mx')
  WITH CHECK (auth.jwt() ->> 'email' LIKE '%@vadai.com.mx');

ALTER TABLE vw_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vadai_users_read" ON vw_executions
  FOR SELECT TO authenticated
  USING (auth.jwt() ->> 'email' LIKE '%@vadai.com.mx');

-- El endpoint /in/[token] usa service_role_key que bypassa RLS
-- para insertar/actualizar `vw_executions` sin sesión de usuario.
