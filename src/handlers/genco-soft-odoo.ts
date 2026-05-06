import { z } from "zod";
import { createOdooClient, type OdooClient } from "@/lib/odoo/client";
import type {
  WebhookHandler,
  HandlerContext,
  HandlerResult,
} from "./_types";

// =============================================================
// Schema del payload — Software Restaurant POS
// =============================================================

const ImpuestoSchema = z.object({
  Impuesto: z.string(),
  Tasa: z.number(),
  Importe: z.number(),
});

const ConceptoSchema = z.object({
  IdProducto: z.string(),
  Descripcion: z.string(),
  Movimiento: z.number().int(),
  Cantidad: z.number(),
  PrecioUnitario: z.number(),
  ImporteSinImpuestos: z.number(),
  Descuento: z.number(),
  Impuestos: z.array(ImpuestoSchema).default([]),
});

const PagoSchema = z.object({
  FormaPago: z.string(),
  Importe: z.number(),
  Propina: z.number().default(0),
});

const VentaSchema = z.object({
  Estacion: z.string(),
  Almacen: z.string(),
  FechaVenta: z.string(),
  NumeroOrden: z.string(),
  IdCliente: z.string().optional().default(""),
  IdUsuario: z.string().nullable().default(null),
  Total: z.number(),
  Area: z.string().optional().default(""),
  Conceptos: z.array(ConceptoSchema).min(1),
  Pagos: z.array(PagoSchema).min(1),
});

const PayloadSchema = z.object({
  IdEmpresa: z.string().min(1),
  Ventas: z.array(VentaSchema).min(1),
});

type Payload = z.infer<typeof PayloadSchema>;
type Venta = z.infer<typeof VentaSchema>;
type Concepto = z.infer<typeof ConceptoSchema>;
type Pago = z.infer<typeof PagoSchema>;


// =============================================================
// Mapping de empresa (lectura desde vw_genco_company_mapping)
// =============================================================

interface CompanyMapping {
  id_empresa: string;
  company_id: number;
  partner_id: number;
  fallback_product_id: number;
  sale_journal_id: number;
  cash_journal_id: number;
  card_journal_id: number;
  bank_journal_id: number;
  vales_journal_id: number | null;
  tax_iva_16_id: number;
  tax_iva_0_id: number;
}

/** Campos que el handler exige `> 0` antes de operar. */
const REQUIRED_MAPPING_FIELDS = [
  "company_id",
  "partner_id",
  "fallback_product_id",
  "sale_journal_id",
  "cash_journal_id",
  "card_journal_id",
  "bank_journal_id",
  "tax_iva_16_id",
  "tax_iva_0_id",
] as const satisfies readonly (keyof CompanyMapping)[];


// =============================================================
// Helpers de cálculo
// =============================================================

function buildRef(idEmpresa: string, v: Venta): string {
  return `${idEmpresa}-${v.Estacion}-${v.NumeroOrden}`;
}

/**
 * Convierte el descuento absoluto del POS a porcentaje sobre `price_unit`
 * para Odoo.
 *
 * Caso especial — cortesía 100%: cuando `Descuento ≈ ImporteSinImpuestos`
 * (sin IVA cobrado), el cliente no paga nada. Si computamos el porcentaje
 * sobre el gross dará algo como 86% (porque 86% es lo que es el net del
 * gross con IVA 16% incluido), y la línea quedaría con un saldo de IVA
 * residual. Forzamos 100% en ese caso para que el line total sea 0.
 */
function computeDiscountPct(c: Concepto): number {
  const subtotalGross = c.PrecioUnitario * c.Cantidad;
  if (subtotalGross === 0) return 0;
  if (c.Descuento === 0) return 0;

  // Cortesía: descuento iguala al neto sin IVA.
  if (
    c.ImporteSinImpuestos > 0 &&
    Math.abs(c.Descuento - c.ImporteSinImpuestos) < 0.01
  ) {
    return 100;
  }

  // Descuento parcial: porcentaje sobre el gross.
  const pct = (c.Descuento / subtotalGross) * 100;
  // Redondeamos a 2 decimales; clamp a 100.
  return Math.min(Math.round(pct * 100) / 100, 100);
}

/**
 * Decide qué tax_id usar según los Impuestos del concepto.
 * Si hay IVA cobrado (Importe > 0) usa IVA 16%. Si no, IVA 0%.
 */
function selectTaxId(
  c: Concepto,
  mapping: CompanyMapping
): number {
  const tieneIVA = c.Impuestos.some(
    (i) => i.Tasa === 0.16 && i.Importe > 0
  );
  return tieneIVA ? mapping.tax_iva_16_id : mapping.tax_iva_0_id;
}

/**
 * Resuelve el journal_id para un pago. Primero busca el `forma_pago` exacto
 * en la tabla, luego intenta detectar por keyword (VISA, EFECTIVO, etc.),
 * y como último recurso cae a cash_journal_id con warning.
 */
async function resolveJournalForPayment(
  pago: Pago,
  mapping: CompanyMapping,
  ctx: HandlerContext
): Promise<{ journalId: number; method: string; fallback: boolean }> {
  const forma = pago.FormaPago.trim().toUpperCase();

  // 1. Lookup exacto en la tabla.
  const { data: row } = await ctx.sb
    .from("vw_genco_payment_method_map")
    .select("journal_field")
    .eq("forma_pago", forma)
    .maybeSingle();

  if (row?.journal_field) {
    const journalId = mapping[row.journal_field as keyof CompanyMapping];
    if (typeof journalId === "number" && journalId > 0) {
      return { journalId, method: row.journal_field, fallback: false };
    }
  }

  // 2. Detección por keyword sobre el string crudo del POS.
  // Útil para "VISA PLATINO", "TARJETA BANAMEX", "TRANSFERENCIA SPEI", etc.
  const cardKeywords = [
    "VISA",
    "MASTER",
    "MC",
    "AMEX",
    "AMERICAN",
    "CARNET",
    "DISCOVER",
    "DEBITO",
    "DÉBITO",
    "CREDITO",
    "CRÉDITO",
    "TARJETA",
    "TC",
    "TD",
  ];
  const bankKeywords = ["TRANSFER", "SPEI", "BANCO", "BANK", "DEPOSIT"];
  const cashKeywords = ["EFECTIVO", "CASH", "CONTADO"];
  const valesKeywords = ["VALE", "EDENRED", "SODEXO", "PLUXEE"];

  let field: keyof CompanyMapping | null = null;
  if (cashKeywords.some((k) => forma.includes(k))) field = "cash_journal_id";
  else if (cardKeywords.some((k) => forma.includes(k)))
    field = "card_journal_id";
  else if (bankKeywords.some((k) => forma.includes(k)))
    field = "bank_journal_id";
  else if (valesKeywords.some((k) => forma.includes(k)))
    field = "vales_journal_id";

  if (field) {
    const journalId = mapping[field];
    if (typeof journalId === "number" && journalId > 0) {
      return { journalId, method: field, fallback: false };
    }
  }

  // 3. Fallback final — cash con warning.
  await ctx.logger.step(
    "payment_method_fallback",
    "warn",
    `FormaPago '${pago.FormaPago}' desconocida — defaulteando a cash_journal_id`,
    { forma_pago: pago.FormaPago }
  );
  return {
    journalId: mapping.cash_journal_id,
    method: "cash_journal_id",
    fallback: true,
  };
}


// =============================================================
// Operaciones contra Odoo
// =============================================================

interface ResolvedProducts {
  byCode: Map<string, number>;
  fallbackId: number;
  created: { code: string; id: number }[];
  reused: { code: string; id: number }[];
}

async function resolveProducts(
  conceptos: Concepto[],
  odoo: OdooClient,
  mapping: CompanyMapping
): Promise<ResolvedProducts> {
  const codes = Array.from(
    new Set(
      conceptos
        .map((c) => c.IdProducto.trim())
        .filter((c) => c.length > 0)
    )
  );

  const byCode = new Map<string, number>();
  const reused: { code: string; id: number }[] = [];
  const created: { code: string; id: number }[] = [];

  if (codes.length > 0) {
    const found = await odoo.executeKw<
      Array<{ id: number; default_code: string | false }>
    >(
      "product.product",
      "search_read",
      [[["default_code", "in", codes]]],
      { fields: ["id", "default_code"] },
      mapping.company_id
    );
    for (const p of found) {
      if (p.default_code) {
        byCode.set(p.default_code, p.id);
        reused.push({ code: p.default_code, id: p.id });
      }
    }

    // Crear los faltantes uno por uno (linear; no paralelizar para no
    // generar duplicados ni saturar al rate-limit).
    for (const code of codes) {
      if (byCode.has(code)) continue;

      const concepto = conceptos.find((c) => c.IdProducto.trim() === code);
      if (!concepto) continue;

      const id = await odoo.executeKw<number>(
        "product.product",
        "create",
        [
          {
            name: concepto.Descripcion || code,
            default_code: code,
            list_price: concepto.PrecioUnitario,
            type: "consu",
            sale_ok: true,
            purchase_ok: false,
            // Compartido entre todas las companies — los productos no se
            // duplican por sucursal (decisión cerrada con el cliente).
            company_id: false,
            taxes_id: [[6, 0, [mapping.tax_iva_16_id]]],
          },
        ],
        {},
        mapping.company_id
      );
      byCode.set(code, id);
      created.push({ code, id });
    }
  }

  return { byCode, fallbackId: mapping.fallback_product_id, created, reused };
}

function buildInvoiceLines(
  conceptos: Concepto[],
  products: ResolvedProducts,
  mapping: CompanyMapping
): unknown[] {
  return conceptos.map((c) => {
    const code = c.IdProducto.trim();
    const productId =
      code.length > 0
        ? products.byCode.get(code) ?? products.fallbackId
        : products.fallbackId;

    const discount = computeDiscountPct(c);
    const taxId = selectTaxId(c, mapping);

    // x2many command [0, 0, values] = "create new line"
    return [
      0,
      0,
      {
        product_id: productId,
        name: c.Descripcion || code || "Concepto sin código",
        quantity: c.Cantidad,
        price_unit: c.PrecioUnitario,
        discount,
        tax_ids: [[6, 0, [taxId]]],
      },
    ];
  });
}


// =============================================================
// Procesamiento por venta individual
// =============================================================

interface VentaResult {
  ref: string;
  status: "completed" | "warning" | "skipped" | "failed";
  invoice_id?: number;
  error?: string;
  payload_total: number;
  odoo_total?: number;
  diff?: number;
  payments?: { forma: string; importe: number; journal_id: number }[];
  products_created?: number;
  products_reused?: number;
}

async function processVenta(
  payload: Payload,
  venta: Venta,
  odoo: OdooClient,
  ctx: HandlerContext
): Promise<VentaResult> {
  const ref = buildRef(payload.IdEmpresa, venta);
  const start = Date.now();

  try {
    // 1. Mapping de empresa
    const { data: mappingRow, error: mappingErr } = await ctx.sb
      .from("vw_genco_company_mapping")
      .select("*")
      .eq("id_empresa", payload.IdEmpresa)
      .eq("is_active", true)
      .maybeSingle();

    if (mappingErr) {
      throw new Error(
        `vw_genco_company_mapping query failed: ${mappingErr.message}`
      );
    }
    if (!mappingRow) {
      throw new Error(
        `No active mapping for IdEmpresa='${payload.IdEmpresa}'. ` +
          `Add a row in vw_genco_company_mapping.`
      );
    }

    // Validar que todos los IDs requeridos estén llenos (> 0).
    for (const f of REQUIRED_MAPPING_FIELDS) {
      const val = (mappingRow as unknown as Record<string, number>)[f];
      if (typeof val !== "number" || val <= 0) {
        throw new Error(
          `Mapping de '${payload.IdEmpresa}' incompleto: campo ${f}=${val}. ` +
            `Llena los IDs reales de Odoo en vw_genco_company_mapping.`
        );
      }
    }

    const mapping = mappingRow as unknown as CompanyMapping;

    await ctx.logger.step("mapping_resolved", "success", null, {
      ref,
      company_id: mapping.company_id,
    });

    // 2. Idempotencia: ¿ya existe una factura con este `ref` en Odoo?
    const existing = await odoo.executeKw<Array<{ id: number }>>(
      "account.move",
      "search_read",
      [
        [
          ["company_id", "=", mapping.company_id],
          ["ref", "=", ref],
        ],
      ],
      { fields: ["id"], limit: 1 },
      mapping.company_id
    );
    if (existing.length > 0) {
      await ctx.logger.step(
        "odoo_dup_check",
        "warn",
        `Invoice with ref already exists in Odoo`,
        { ref, existing_invoice_id: existing[0].id }
      );
      return {
        ref,
        status: "skipped",
        invoice_id: existing[0].id,
        payload_total: venta.Total,
      };
    }

    // 3. Resolver productos
    const products = await resolveProducts(venta.Conceptos, odoo, mapping);
    await ctx.logger.step("products_resolved", "success", null, {
      ref,
      reused: products.reused.length,
      created: products.created.length,
      created_list: products.created,
    });

    // 4. Construir invoice_line_ids
    const lines = buildInvoiceLines(venta.Conceptos, products, mapping);

    // 5. Crear factura en draft
    const invoiceId = await odoo.executeKw<number>(
      "account.move",
      "create",
      [
        {
          move_type: "out_invoice",
          company_id: mapping.company_id,
          partner_id: mapping.partner_id,
          journal_id: mapping.sale_journal_id,
          invoice_date: venta.FechaVenta.split("T")[0],
          ref,
          narration:
            `Ticket ${venta.NumeroOrden} | ${venta.Estacion} | ` +
            `${venta.Area || "—"} | Operador: ${venta.IdUsuario ?? "—"}`,
          l10n_mx_edi_cfdi_to_public: true,
          l10n_mx_edi_usage: "G03",
          invoice_line_ids: lines,
        },
      ],
      {},
      mapping.company_id
    );

    await ctx.logger.step("invoice_created", "success", null, {
      ref,
      invoice_id: invoiceId,
    });

    // 6. Validar tolerancia de totales
    const totals = await odoo.executeKw<
      Array<{ id: number; amount_total: number }>
    >(
      "account.move",
      "read",
      [[invoiceId]],
      { fields: ["amount_total"] },
      mapping.company_id
    );
    const odooTotal = totals[0]?.amount_total ?? 0;
    const diff = Math.abs(odooTotal - venta.Total);

    let toleranceWarning = false;
    if (diff > 5) {
      // Rechazar: rollback de la factura draft.
      await odoo.executeKw(
        "account.move",
        "unlink",
        [[invoiceId]],
        {},
        mapping.company_id
      );
      throw new Error(
        `Tolerance breach: diff=$${diff.toFixed(2)} ` +
          `(payload=$${venta.Total}, odoo=$${odooTotal}). Invoice ${invoiceId} unlinked.`
      );
    }
    if (diff >= 0.5) {
      toleranceWarning = true;
      await ctx.logger.step(
        "tolerance_check",
        "warn",
        `diff=$${diff.toFixed(2)} (payload=$${venta.Total}, odoo=$${odooTotal})`,
        { diff, payload_total: venta.Total, odoo_total: odooTotal }
      );
    } else {
      await ctx.logger.step(
        "tolerance_check",
        "success",
        `diff=$${diff.toFixed(2)}`,
        { diff, payload_total: venta.Total, odoo_total: odooTotal }
      );
    }

    // 7. Postear factura
    await odoo.executeKw(
      "account.move",
      "action_post",
      [[invoiceId]],
      {},
      mapping.company_id
    );
    await ctx.logger.step("invoice_posted", "success", null, {
      ref,
      invoice_id: invoiceId,
    });

    // 8. Registrar pagos (uno a uno)
    const paymentsLog: VentaResult["payments"] = [];
    for (const pago of venta.Pagos) {
      const { journalId, fallback } = await resolveJournalForPayment(
        pago,
        mapping,
        ctx
      );

      // a) Crear el wizard de payment.register con context que apunta
      //    al move que estamos pagando.
      const registerId = await odoo.executeKw<number>(
        "account.payment.register",
        "create",
        [
          {
            amount: pago.Importe,
            journal_id: journalId,
            payment_date: venta.FechaVenta.split("T")[0],
          },
        ],
        {
          context: {
            active_model: "account.move",
            active_ids: [invoiceId],
          },
        },
        mapping.company_id
      );

      // b) Disparar la creación del payment real.
      await odoo.executeKw(
        "account.payment.register",
        "action_create_payments",
        [[registerId]],
        {
          context: {
            active_model: "account.move",
            active_ids: [invoiceId],
          },
        },
        mapping.company_id
      );

      paymentsLog.push({
        forma: pago.FormaPago,
        importe: pago.Importe,
        journal_id: journalId,
      });
      await ctx.logger.step(
        "payment_registered",
        fallback ? "warn" : "success",
        `${pago.FormaPago} $${pago.Importe} → journal ${journalId}`,
        { ref, forma: pago.FormaPago, importe: pago.Importe, journal_id: journalId }
      );
    }

    return {
      ref,
      status: toleranceWarning ? "warning" : "completed",
      invoice_id: invoiceId,
      payload_total: venta.Total,
      odoo_total: odooTotal,
      diff,
      payments: paymentsLog,
      products_created: products.created.length,
      products_reused: products.reused.length,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await ctx.logger.step("venta_failed", "error", msg, {
      ref,
      duration_ms: Date.now() - start,
    });
    return { ref, status: "failed", error: msg, payload_total: venta.Total };
  }
}


// =============================================================
// Handler exportado
// =============================================================

export const handler: WebhookHandler<Payload> = {
  slug: "genco-soft-odoo",
  description:
    "Software Restaurant POS → Odoo: crea factura cliente por venta, " +
    "registra pagos. Multi-empresa via vw_genco_company_mapping.",
  schema: PayloadSchema,

  /**
   * Idempotency key = todos los refs del payload, ordenados y joined.
   * Si Software Restaurant reenvía el mismo POST (timeout, retry), el runner
   * lo detecta y skipea sin tocar Odoo. La idempotencia por venta individual
   * la maneja el doble check contra account.move.ref dentro de processVenta.
   */
  getIdempotencyKey(payload) {
    return payload.Ventas
      .map((v) => buildRef(payload.IdEmpresa, v))
      .sort()
      .join("|");
  },

  async process(payload, ctx): Promise<HandlerResult> {
    await ctx.logger.step("handler_start", "info", null, {
      id_empresa: payload.IdEmpresa,
      n_ventas: payload.Ventas.length,
    });

    const odoo = createOdooClient();
    const results: VentaResult[] = [];

    // Procesamos las ventas en serie. Si el payload trae N ventas y una falla,
    // las demás continúan (decisión cerrada con el cliente). El status final
    // de la execution se consolida abajo según el mix de resultados.
    for (const venta of payload.Ventas) {
      const r = await processVenta(payload, venta, odoo, ctx);
      results.push(r);
    }

    const successes = results.filter((r) => r.status === "completed");
    const warnings = results.filter((r) => r.status === "warning");
    const skipped = results.filter((r) => r.status === "skipped");
    const failed = results.filter((r) => r.status === "failed");

    const summary: Record<string, unknown> = {
      id_empresa: payload.IdEmpresa,
      total_ventas: results.length,
      completed: successes.length,
      with_warning: warnings.length,
      skipped_duplicate: skipped.length,
      failed: failed.length,
      results: results.map((r) => ({
        ref: r.ref,
        status: r.status,
        invoice_id: r.invoice_id,
        error: r.error,
        odoo_total: r.odoo_total,
        diff: r.diff,
      })),
    };

    // Status consolidation per Q4 (acordado en el chat de planning):
    //   - Todas failed     → throw (runner marca status=failed)
    //   - Mix con failures → return warning=true (completed_with_warning)
    //   - Sólo warnings/tolerancia → return warning=true
    //   - Todo OK → return warning=false (completed)
    if (failed.length === results.length) {
      const errors = failed.map((f) => `${f.ref}: ${f.error}`).join(" | ");
      throw new Error(`All ${failed.length} ventas failed. ${errors}`);
    }

    const hasAnyWarning = warnings.length > 0 || failed.length > 0;
    return { summary, warning: hasAnyWarning };
  },
};
