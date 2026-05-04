import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/dashboard/status-badge";

export const dynamic = "force-dynamic";

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `hace ${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min}m`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `hace ${days}d`;
  return d.toLocaleDateString("es-MX", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function DashboardPage() {
  const sb = await createClient();

  const { data: configs, error } = await sb
    .from("vw_configs")
    .select("id, slug, name, client_name, status, created_at")
    .neq("status", "archived")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="rounded-md border border-vadai-error/30 bg-vadai-error/10 p-4 text-sm text-vadai-error">
        Error cargando webhooks: {error.message}
      </div>
    );
  }

  // Stats por webhook: count últimas 24h y último timestamp.
  // Lo hacemos en una sola query agrupando manualmente (suficiente a esta escala).
  const slugs = (configs ?? []).map((c) => c.slug);
  // eslint-disable-next-line react-hooks/purity -- request-time window for "last 24h"; page is force-dynamic.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const stats = new Map<
    string,
    { count24h: number; lastReceivedAt: string | null }
  >();

  if (slugs.length > 0) {
    const { data: recent } = await sb
      .from("vw_executions")
      .select("webhook_slug, received_at")
      .in("webhook_slug", slugs)
      .gte("received_at", since);

    for (const slug of slugs) stats.set(slug, { count24h: 0, lastReceivedAt: null });
    for (const row of recent ?? []) {
      const s = stats.get(row.webhook_slug);
      if (!s) continue;
      s.count24h += 1;
      if (
        row.received_at &&
        (s.lastReceivedAt === null || row.received_at > s.lastReceivedAt)
      ) {
        s.lastReceivedAt = row.received_at;
      }
    }

    // Para webhooks sin actividad en 24h, traemos el último de todos los tiempos.
    const inactiveSlugs = slugs.filter(
      (s) => (stats.get(s)?.lastReceivedAt ?? null) === null
    );
    if (inactiveSlugs.length > 0) {
      const { data: lastEver } = await sb
        .from("vw_executions")
        .select("webhook_slug, received_at")
        .in("webhook_slug", inactiveSlugs)
        .order("received_at", { ascending: false })
        .limit(inactiveSlugs.length * 1);
      const seen = new Set<string>();
      for (const row of lastEver ?? []) {
        if (seen.has(row.webhook_slug)) continue;
        const s = stats.get(row.webhook_slug);
        if (s && row.received_at) {
          s.lastReceivedAt = row.received_at;
          seen.add(row.webhook_slug);
        }
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-vadai-text">Webhooks</h1>
          <p className="text-sm text-vadai-muted mt-1">
            {(configs?.length ?? 0)} configurado
            {(configs?.length ?? 0) !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/dashboard/new"
          className="inline-flex items-center gap-2 rounded-md bg-vadai-cyan px-4 py-2 text-sm font-medium text-vadai-navy hover:bg-vadai-cyan-light transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nuevo webhook
        </Link>
      </div>

      {(configs?.length ?? 0) === 0 ? (
        <div className="rounded-lg border border-dashed border-vadai-navy-light p-12 text-center">
          <p className="text-vadai-muted">
            Aún no hay webhooks. Crea el primero.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(configs ?? []).map((c) => {
            const stat = stats.get(c.slug) ?? {
              count24h: 0,
              lastReceivedAt: null,
            };
            return (
              <Link
                key={c.id}
                href={`/dashboard/${c.slug}`}
                className="group rounded-lg border border-vadai-navy-light bg-vadai-navy-mid p-4 hover:border-vadai-cyan/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-medium text-vadai-text truncate group-hover:text-vadai-cyan transition-colors">
                      {c.name}
                    </h2>
                    <p className="text-xs font-mono text-vadai-muted truncate mt-0.5">
                      {c.slug}
                    </p>
                  </div>
                  <StatusBadge status={c.status} />
                </div>

                {c.client_name && (
                  <p className="text-xs text-vadai-muted mt-3">
                    Cliente:{" "}
                    <span className="text-vadai-text">{c.client_name}</span>
                  </p>
                )}

                <div className="mt-4 flex items-center justify-between text-xs text-vadai-muted">
                  <span>
                    <span className="text-vadai-text font-medium">
                      {stat.count24h}
                    </span>{" "}
                    en 24h
                  </span>
                  <span>último: {formatRelative(stat.lastReceivedAt)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
