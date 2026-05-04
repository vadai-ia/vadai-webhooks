-- ============================================================
-- Migration 0001 — Switch from email-domain auth to allowlist table
-- ============================================================
-- Antes:
--   RLS = `auth.jwt() ->> 'email' LIKE '%@vadai.com.mx'`
--   Auth = magic link cualquier email del dominio
--
-- Después:
--   RLS = `auth.jwt() ->> 'email' IN (SELECT email FROM vw_allowed_users)`
--   Auth = email + password (usuario debe existir en auth.users
--          Y estar en vw_allowed_users)
--
-- Pegar este archivo en el SQL Editor del proyecto Supabase compartido:
--   https://supabase.com/dashboard/project/ukgbklhmjbniffssacjm/sql/new
-- ============================================================


-- ─── Tabla allowlist ────────────────────────────────────────────────────
CREATE TABLE vw_allowed_users (
  email      TEXT         PRIMARY KEY,
  added_at   TIMESTAMPTZ  DEFAULT NOW(),
  added_by   UUID         REFERENCES auth.users(id),
  notes      TEXT
);

ALTER TABLE vw_allowed_users ENABLE ROW LEVEL SECURITY;

-- Cualquier usuario autenticado puede ver SU PROPIO row (útil para
-- mostrar "tu email está autorizado" en la UI si en algún momento queremos).
CREATE POLICY "self_can_read_own_access" ON vw_allowed_users
  FOR SELECT TO authenticated
  USING (email = (auth.jwt() ->> 'email'));

-- El INSERT/UPDATE/DELETE de la allowlist se hace desde el SQL Editor
-- (o con service_role). Sin policy = nadie autenticado puede modificarla.


-- ─── Reemplazar policies viejas en vw_configs ───────────────────────────
DROP POLICY IF EXISTS "vadai_users_all" ON vw_configs;

CREATE POLICY "allowed_users_all" ON vw_configs
  FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'email') IN (SELECT email FROM vw_allowed_users))
  WITH CHECK ((auth.jwt() ->> 'email') IN (SELECT email FROM vw_allowed_users));


-- ─── Reemplazar policies viejas en vw_executions ────────────────────────
DROP POLICY IF EXISTS "vadai_users_read" ON vw_executions;

CREATE POLICY "allowed_users_read" ON vw_executions
  FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'email') IN (SELECT email FROM vw_allowed_users));


-- ─── Seed: primer admin ─────────────────────────────────────────────────
-- Este email debe existir también en auth.users (créalo desde
-- Authentication → Users → Add user en el dashboard de Supabase).
INSERT INTO vw_allowed_users (email, notes)
VALUES ('vadai.agencia.ai@gmail.com', 'Initial admin')
ON CONFLICT (email) DO NOTHING;
