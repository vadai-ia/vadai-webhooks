import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createOdooClient } from "@/lib/odoo/client";
import type {
  OdooCompany,
  OdooJournal,
  OdooTax,
  OdooPartnerLite,
  OdooProductLite,
} from "@/lib/odoo/types";

export const dynamic = "force-dynamic";

/**
 * Admin page para descubrir IDs de Odoo necesarios para llenar
 * `vw_genco_company_mapping` después de la migración 0002.
 *
 * Uso:
 *   1. Sin params → lista todas las companies. Click en una.
 *   2. ?company_id=N → muestra journals + taxes de esa company y partners
 *      que matchean "PUBLICO" para confirmar el partner_id.
 *   3. Copia los IDs y corre el UPDATE en Supabase (snippet al final).
 */
export default async function OdooDiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ company_id?: string }>;
}) {
  const sp = await searchParams;
  const selectedCompanyId = sp.company_id ? Number(sp.company_id) : null;

  let companies: OdooCompany[] = [];
  let journals: OdooJournal[] = [];
  let taxes: OdooTax[] = [];
  let partners: OdooPartnerLite[] = [];
  let fallbackProduct: OdooProductLite | null = null;
  let errorMsg: string | null = null;

  try {
    const odoo = createOdooClient();

    companies = await odoo.executeKw<OdooCompany[]>(
      "res.company",
      "search_read",
      [[]],
      { fields: ["id", "name"], order: "id" }
    );

    if (selectedCompanyId !== null) {
      // Secuencial a propósito: Odoo SaaS rate-limita ráfagas paralelas
      // con HTTP 429. Vamos en serie y dejamos que el cliente haga retry
      // si pega rate limit en alguna llamada.
      //
      // Filter por company_id = N OR company_id = false. En Odoo, los
      // journals/taxes "compartidos" tienen company_id = false y son
      // utilizables por todas las companies — para nuestro mapping nos
      // sirven igual que los company-specific.
      journals = await odoo.executeKw<OdooJournal[]>(
        "account.journal",
        "search_read",
        [
          [
            "|",
            ["company_id", "=", selectedCompanyId],
            ["company_id", "=", false],
          ],
        ],
        {
          fields: ["id", "name", "code", "type", "company_id"],
          order: "type, name",
        },
        selectedCompanyId
      );
      taxes = await odoo.executeKw<OdooTax[]>(
        "account.tax",
        "search_read",
        [
          [
            "&",
            ["type_tax_use", "=", "sale"],
            "|",
            ["company_id", "=", selectedCompanyId],
            ["company_id", "=", false],
          ],
        ],
        {
          fields: ["id", "name", "amount", "type_tax_use", "company_id"],
          order: "amount desc, name",
        },
        selectedCompanyId
      );
      partners = await odoo.executeKw<OdooPartnerLite[]>(
        "res.partner",
        "search_read",
        [[["name", "ilike", "publico"]]],
        { fields: ["id", "name"], limit: 10 },
        selectedCompanyId
      );
      const prod = await odoo.executeKw<OdooProductLite[]>(
        "product.product",
        "search_read",
        [[["id", "=", 1085]]],
        { fields: ["id", "name", "default_code"] },
        selectedCompanyId
      );
      fallbackProduct = prod[0] ?? null;
    }
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err);
  }

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-vadai-muted hover:text-vadai-text transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Dashboard
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-vadai-text">
          Odoo Discovery
        </h1>
        <p className="mt-1 text-sm text-vadai-muted">
          Descubrir IDs reales de Odoo para llenar{" "}
          <code className="font-mono text-vadai-text">
            vw_genco_company_mapping
          </code>
          .
        </p>
      </div>

      {errorMsg && (
        <div className="rounded-md border border-vadai-error/30 bg-vadai-error/10 p-4 text-sm text-vadai-error">
          <p className="font-medium">Error conectando a Odoo</p>
          <pre className="mt-2 whitespace-pre-wrap font-mono text-xs">
            {errorMsg}
          </pre>
          <p className="mt-3 text-vadai-muted">
            Verifica que <code className="font-mono">ODOO_URL</code>,{" "}
            <code className="font-mono">ODOO_DB</code>,{" "}
            <code className="font-mono">ODOO_USER</code> y{" "}
            <code className="font-mono">ODOO_API_KEY</code> estén bien
            seteadas en{" "}
            {process.env.NODE_ENV === "production"
              ? "Railway"
              : ".env.local"}
            .
          </p>
        </div>
      )}

      {/* ─── Companies ─────────────────────────────────────────────── */}
      {companies.length > 0 && (
        <Section title="Companies">
          <Table
            headers={["ID", "Nombre", ""]}
            rows={companies.map((c) => [
              <code key="id" className="font-mono text-vadai-text">
                {c.id}
              </code>,
              c.name,
              <Link
                key="link"
                href={`/dashboard/admin/odoo-discover?company_id=${c.id}`}
                className={`text-xs ${
                  selectedCompanyId === c.id
                    ? "text-vadai-cyan-light font-medium"
                    : "text-vadai-cyan hover:text-vadai-cyan-light"
                }`}
              >
                {selectedCompanyId === c.id ? "✓ seleccionada" : "Ver IDs →"}
              </Link>,
            ])}
          />
        </Section>
      )}

      {/* ─── Detalles por company ──────────────────────────────────── */}
      {selectedCompanyId !== null && !errorMsg && (
        <>
          <Section
            title={`Journals utilizables desde company ${selectedCompanyId}`}
          >
            <p className="text-xs text-vadai-muted mb-3">
              Incluye journals propios de la company + journals compartidos
              (<code>company_id = false</code>). La columna <code>Company</code>{" "}
              te dice cuáles son cuáles.
            </p>
            {journals.length === 0 ? (
              <Empty>
                No hay journals utilizables — ni propios ni compartidos.
                Verifica que el chart of accounts esté instalado para esta
                company.
              </Empty>
            ) : (
              <Table
                headers={["ID", "Tipo", "Código", "Nombre", "Company"]}
                rows={journals.map((j) => [
                  <code key="id" className="font-mono text-vadai-text">
                    {j.id}
                  </code>,
                  <Badge key="t" tone={journalToneFor(j.type)}>
                    {j.type}
                  </Badge>,
                  <code key="c" className="font-mono text-vadai-muted">
                    {j.code}
                  </code>,
                  j.name,
                  ownerCell(j.company_id, selectedCompanyId),
                ])}
              />
            )}
          </Section>

          <Section
            title={`Taxes (sale) utilizables desde company ${selectedCompanyId}`}
          >
            <p className="text-xs text-vadai-muted mb-3">
              Incluye taxes propios + compartidos. Misma lógica que los
              journals.
            </p>
            {taxes.length === 0 ? (
              <Empty>
                No hay taxes de venta utilizables — ni propios ni compartidos.
              </Empty>
            ) : (
              <Table
                headers={["ID", "Amount", "Nombre", "Company"]}
                rows={taxes.map((t) => [
                  <code key="id" className="font-mono text-vadai-text">
                    {t.id}
                  </code>,
                  <span key="a" className="font-mono text-vadai-text">
                    {t.amount}%
                  </span>,
                  t.name,
                  ownerCell(t.company_id, selectedCompanyId),
                ])}
              />
            )}
          </Section>

          <Section title="Partner PUBLICO EN GENERAL">
            {partners.length === 0 ? (
              <Empty>
                No se encontraron partners con nombre que contenga
                &ldquo;publico&rdquo;.
              </Empty>
            ) : (
              <Table
                headers={["ID", "Nombre"]}
                rows={partners.map((p) => [
                  <code key="id" className="font-mono text-vadai-text">
                    {p.id}
                  </code>,
                  p.name,
                ])}
              />
            )}
            <p className="mt-2 text-xs text-vadai-muted">
              El que ya está en el mapping es <code>267</code> — confirma
              acá que existe y el nombre te hace sentido.
            </p>
          </Section>

          <Section title="Producto fallback (id=1085)">
            {fallbackProduct ? (
              <Table
                headers={["ID", "Default code", "Nombre"]}
                rows={[
                  [
                    <code key="id" className="font-mono text-vadai-text">
                      {fallbackProduct.id}
                    </code>,
                    <code key="c" className="font-mono text-vadai-muted">
                      {fallbackProduct.default_code || "—"}
                    </code>,
                    fallbackProduct.name,
                  ],
                ]}
              />
            ) : (
              <Empty>No existe el producto id=1085. Revisar.</Empty>
            )}
          </Section>

          <Section title="SQL UPDATE — copiá, edita IDs, corre">
            <pre className="overflow-auto rounded-md border border-vadai-navy-light bg-vadai-navy-light/30 p-4 text-xs font-mono text-vadai-text leading-relaxed">
              {`UPDATE vw_genco_company_mapping SET
  company_id       = ${selectedCompanyId},
  sale_journal_id  = <ID journal type=sale>,
  cash_journal_id  = <ID journal type=cash>,
  card_journal_id  = <ID journal tarjetas (cash o bank)>,
  bank_journal_id  = <ID journal type=bank>,
  vales_journal_id = NULL,
  tax_iva_16_id    = <ID tax amount=16>,
  tax_iva_0_id     = <ID tax amount=0>,
  notes            = 'Sucursal piloto - mayo 2026',
  updated_at       = NOW()
WHERE id_empresa = 'Haisushi_1';`}
            </pre>
          </Section>
        </>
      )}
    </div>
  );
}

// ─── UI helpers (locales, no vale la pena un componente compartido) ───

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-vadai-navy-light bg-vadai-navy-mid p-5">
      <h2 className="text-sm font-medium text-vadai-text mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-vadai-muted italic">{children}</p>;
}

function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-vadai-muted">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, ri) => (
            <tr
              key={ri}
              className="border-t border-vadai-navy-light/50 hover:bg-vadai-navy-light/20"
            >
              {cells.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 text-vadai-text">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "cyan" | "muted" | "warning" | "success";
}) {
  const cls = {
    cyan: "bg-vadai-cyan/15 text-vadai-cyan border-vadai-cyan/30",
    muted: "bg-vadai-muted/15 text-vadai-muted border-vadai-muted/30",
    warning: "bg-vadai-warning/15 text-vadai-warning border-vadai-warning/30",
    success: "bg-vadai-success/15 text-vadai-success border-vadai-success/30",
  }[tone];
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {children}
    </span>
  );
}

function journalToneFor(
  type: string
): "cyan" | "muted" | "warning" | "success" {
  switch (type) {
    case "sale":
      return "success";
    case "cash":
      return "cyan";
    case "bank":
      return "warning";
    default:
      return "muted";
  }
}

/**
 * Renderiza el "owner" de un journal o tax: pintamos diferente si es propio
 * de la company seleccionada vs compartido vs de otra company.
 */
function ownerCell(
  companyField: [number, string] | false,
  selectedCompanyId: number
): React.ReactNode {
  if (companyField === false) {
    return (
      <Badge tone="muted">compartido</Badge>
    );
  }
  const [ownerId, ownerName] = companyField;
  if (ownerId === selectedCompanyId) {
    return <Badge tone="success">{ownerName}</Badge>;
  }
  return <Badge tone="warning">{ownerName} (id={ownerId})</Badge>;
}
