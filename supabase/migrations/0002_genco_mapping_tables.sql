-- ============================================================
-- Migration 0002 — GENCO mapping tables
-- ============================================================
-- Crea las tablas auxiliares que el handler `genco-soft-odoo` usa para:
--   1. Resolver IdEmpresa de Software Restaurant → IDs reales de Odoo
--      (`vw_genco_company_mapping`)
--   2. Mapear `Pagos[].FormaPago` (string libre del POS) → field del
--      mapping que apunta al journal correcto en Odoo
--      (`vw_genco_payment_method_map`)
--
-- Pegar en https://supabase.com/dashboard/project/ukgbklhmjbniffssacjm/sql/new
--
-- Después de correr esta migración:
--   - El admin page /admin/odoo-discover (próximo commit) lista los IDs
--     que faltan (company_id, journals, taxes).
--   - Corres UPDATE para llenar los placeholders 0 con los IDs reales.
-- ============================================================


-- ─── 1. Mapping IdEmpresa POS → IDs Odoo ────────────────────────────────
CREATE TABLE vw_genco_company_mapping (
  id_empresa            VARCHAR(50)  PRIMARY KEY,    -- ej. 'Haisushi_1'
  company_id            INTEGER      NOT NULL,        -- res.company.id
  partner_id            INTEGER      NOT NULL,        -- res.partner PUBLICO EN GENERAL
  fallback_product_id   INTEGER      NOT NULL,        -- product.product "Concepto sin código"
  sale_journal_id       INTEGER      NOT NULL,
  cash_journal_id       INTEGER      NOT NULL,
  card_journal_id       INTEGER      NOT NULL,
  bank_journal_id       INTEGER      NOT NULL,
  vales_journal_id      INTEGER,                       -- opcional
  tax_iva_16_id         INTEGER      NOT NULL,
  tax_iva_0_id          INTEGER      NOT NULL,
  is_active             BOOLEAN      DEFAULT TRUE,
  notes                 TEXT,
  created_at            TIMESTAMPTZ  DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  DEFAULT NOW()
);

ALTER TABLE vw_genco_company_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allowed_users_read_company_mapping" ON vw_genco_company_mapping
  FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'email') IN (SELECT email FROM vw_allowed_users));


-- ─── 2. Mapping FormaPago string → journal field name ───────────────────
CREATE TABLE vw_genco_payment_method_map (
  forma_pago     VARCHAR(50)  PRIMARY KEY,            -- 'EFECTIVO', 'TARJETA', etc
  journal_field  VARCHAR(50)  NOT NULL,                -- nombre de columna en company_mapping
  notes          TEXT
);

ALTER TABLE vw_genco_payment_method_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allowed_users_read_payment_map" ON vw_genco_payment_method_map
  FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'email') IN (SELECT email FROM vw_allowed_users));

INSERT INTO vw_genco_payment_method_map (forma_pago, journal_field) VALUES
  ('EFECTIVO',           'cash_journal_id'),
  ('TARJETA',            'card_journal_id'),
  ('TARJETA DE CREDITO', 'card_journal_id'),
  ('TARJETA DE DEBITO',  'card_journal_id'),
  ('TC',                 'card_journal_id'),
  ('TD',                 'card_journal_id'),
  ('TRANSFERENCIA',      'bank_journal_id'),
  ('SPEI',               'bank_journal_id'),
  ('VALES',              'vales_journal_id'),
  ('VALE',               'vales_journal_id');


-- ─── 3. Seed inicial Haisushi_1 ─────────────────────────────────────────
-- ⚠️ Los campos marcados con `0` son PLACEHOLDERS pendientes del
-- discovery contra Odoo. El handler los valida (`> 0`) y rechaza la venta
-- con un error claro si están sin llenar — es seguro tener la fila
-- incompleta mientras llegamos a esa parte.
--
-- Después del discovery, ejecutar:
--
--   UPDATE vw_genco_company_mapping SET
--     company_id       = <real>,
--     sale_journal_id  = <real>,
--     cash_journal_id  = <real>,
--     card_journal_id  = <real>,
--     bank_journal_id  = <real>,
--     vales_journal_id = <real o NULL>,
--     tax_iva_16_id    = <real>,
--     tax_iva_0_id     = <real>,
--     notes            = 'Sucursal piloto - mayo 2026',
--     updated_at       = NOW()
--   WHERE id_empresa = 'Haisushi_1';
INSERT INTO vw_genco_company_mapping (
  id_empresa,
  company_id,
  partner_id,
  fallback_product_id,
  sale_journal_id,
  cash_journal_id,
  card_journal_id,
  bank_journal_id,
  vales_journal_id,
  tax_iva_16_id,
  tax_iva_0_id,
  notes
) VALUES (
  'Haisushi_1',
  0,        -- ⚠️ company_id          → discovery
  267,      -- ✓ partner_id PUBLICO EN GENERAL
  1085,     -- ✓ fallback_product_id "Concepto sin código"
  0,        -- ⚠️ sale_journal_id     → discovery
  0,        -- ⚠️ cash_journal_id     → discovery
  0,        -- ⚠️ card_journal_id     → discovery
  0,        -- ⚠️ bank_journal_id     → discovery
  NULL,     -- vales no se usa hoy
  0,        -- ⚠️ tax_iva_16_id       → discovery
  0,        -- ⚠️ tax_iva_0_id        → discovery
  'Sucursal piloto - PENDIENTE LLENAR IDs (company, journals, taxes)'
);
