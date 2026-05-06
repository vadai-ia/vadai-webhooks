import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { CopyButton } from "@/components/dashboard/copy-button";
import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import { updateWebhookStatus } from "../actions";
import type { WebhookConfigStatus } from "@/types/webhook";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-MX", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "America/Mexico_City",
  });
}

function fmtDuration(ms: number | null): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export default async function WebhookDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ created?: string; page?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const offset = (page - 1) * PAGE_SIZE;

  const sb = await createClient();

  const { data: config, error: cfgErr } = await sb
    .from("vw_configs")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (cfgErr) {
    return (
      <div className="rounded-md border border-vadai-error/30 bg-vadai-error/10 p-4 text-sm text-vadai-error">
        Error: {cfgErr.message}
      </div>
    );
  }
  if (!config) notFound();

  const { data: executions, count } = await sb
    .from("vw_executions")
    .select(
      "id, received_at, status, duration_ms, idempotency_key, payload_size_bytes",
      { count: "exact" }
    )
    .eq("webhook_slug", slug)
    .order("received_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const fullUrl = `${appUrl}/in/${config.token}`;

  return (
    <div className="space-y-6">
      <AutoRefresh intervalMs={5000} />

      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-vadai-muted hover:text-vadai-text transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Webhooks
        </Link>
      </div>

      {sp.created && (
        <div className="rounded-md border border-vadai-success/30 bg-vadai-success/10 px-4 py-3 text-sm text-vadai-success">
          Webhook creado. Copia la URL de abajo y compártela con quien tenga
          que enviarte payloads.
        </div>
      )}

      {/* Header */}
      <div className="rounded-lg border border-vadai-navy-light bg-vadai-navy-mid p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-vadai-text">
                {config.name}
              </h1>
              <StatusBadge status={config.status} />
            </div>
            <p className="mt-1 text-sm font-mono text-vadai-muted">
              {config.slug}
            </p>
            {config.client_name && (
              <p className="mt-1 text-sm text-vadai-muted">
                Cliente: <span className="text-vadai-text">{config.client_name}</span>
              </p>
            )}
            {config.description && (
              <p className="mt-2 text-sm text-vadai-muted max-w-2xl">
                {config.description}
              </p>
            )}
          </div>
          <StatusActions
            slug={config.slug}
            currentStatus={config.status as WebhookConfigStatus}
          />
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide text-vadai-muted">
            URL de ingestión (POST)
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <code className="flex-1 truncate rounded-md bg-vadai-navy-light/40 border border-vadai-navy-light px-3 py-2 text-sm font-mono text-vadai-text">
              {fullUrl}
            </code>
            <CopyButton value={fullUrl} label="Copiar URL" />
          </div>
        </div>
      </div>

      {/* Executions */}
      <div className="rounded-lg border border-vadai-navy-light bg-vadai-navy-mid">
        <div className="flex items-center justify-between px-5 py-3 border-b border-vadai-navy-light">
          <div>
            <h2 className="text-sm font-medium text-vadai-text">
              Ejecuciones
            </h2>
            <p className="text-xs text-vadai-muted">
              {count ?? 0} totales · página {page} de {totalPages}
            </p>
          </div>
          <RefreshHint />
        </div>

        {(executions?.length ?? 0) === 0 ? (
          <div className="p-12 text-center text-sm text-vadai-muted">
            Aún no hay ejecuciones para este webhook.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-vadai-muted bg-vadai-navy-light/30">
                <tr>
                  <th className="px-5 py-2 font-medium">Recibido</th>
                  <th className="px-5 py-2 font-medium">Status</th>
                  <th className="px-5 py-2 font-medium">Duración</th>
                  <th className="px-5 py-2 font-medium">Tamaño</th>
                  <th className="px-5 py-2 font-medium">Idempotency</th>
                  <th className="px-5 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {(executions ?? []).map((e) => (
                  <tr
                    key={e.id}
                    className="border-t border-vadai-navy-light/50 hover:bg-vadai-navy-light/20"
                  >
                    <td className="px-5 py-2.5 font-mono text-xs text-vadai-text">
                      {fmtDateTime(e.received_at)}
                    </td>
                    <td className="px-5 py-2.5">
                      <StatusBadge status={e.status} />
                    </td>
                    <td className="px-5 py-2.5 text-vadai-muted">
                      {fmtDuration(e.duration_ms)}
                    </td>
                    <td className="px-5 py-2.5 text-vadai-muted">
                      {e.payload_size_bytes
                        ? `${e.payload_size_bytes} B`
                        : "—"}
                    </td>
                    <td className="px-5 py-2.5 font-mono text-xs text-vadai-muted truncate max-w-[160px]">
                      {e.idempotency_key ?? "—"}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <Link
                        href={`/dashboard/${config.slug}/${e.id}`}
                        className="text-vadai-cyan hover:text-vadai-cyan-light text-xs"
                      >
                        Ver →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-vadai-navy-light text-xs">
            {page > 1 ? (
              <Link
                href={`/dashboard/${config.slug}?page=${page - 1}`}
                className="text-vadai-cyan hover:text-vadai-cyan-light"
              >
                ← Anterior
              </Link>
            ) : (
              <span />
            )}
            {page < totalPages ? (
              <Link
                href={`/dashboard/${config.slug}?page=${page + 1}`}
                className="text-vadai-cyan hover:text-vadai-cyan-light"
              >
                Siguiente →
              </Link>
            ) : (
              <span />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function RefreshHint() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-vadai-muted">
      <RefreshCw className="h-3.5 w-3.5" />
      Auto-refresh 5s
    </span>
  );
}

function StatusActions({
  slug,
  currentStatus,
}: {
  slug: string;
  currentStatus: WebhookConfigStatus;
}) {
  // Acciones permitidas según status actual.
  const can = {
    activate: currentStatus !== "active" && currentStatus !== "archived",
    pause: currentStatus === "active",
    archive: currentStatus !== "archived",
  };

  return (
    <div className="flex items-center gap-2 shrink-0">
      {can.activate && (
        <ActionForm slug={slug} status="active" label="Activar" tone="cyan" />
      )}
      {can.pause && (
        <ActionForm slug={slug} status="paused" label="Pausar" tone="muted" />
      )}
      {can.archive && (
        <ActionForm
          slug={slug}
          status="archived"
          label="Archivar"
          tone="muted"
        />
      )}
    </div>
  );
}

function ActionForm({
  slug,
  status,
  label,
  tone,
}: {
  slug: string;
  status: WebhookConfigStatus;
  label: string;
  tone: "cyan" | "muted";
}) {
  const cls =
    tone === "cyan"
      ? "bg-vadai-cyan text-vadai-navy hover:bg-vadai-cyan-light"
      : "border border-vadai-navy-light text-vadai-muted hover:text-vadai-text hover:border-vadai-cyan/40";

  return (
    <form action={updateWebhookStatus}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="status" value={status} />
      <button
        type="submit"
        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${cls}`}
      >
        {label}
      </button>
    </form>
  );
}
