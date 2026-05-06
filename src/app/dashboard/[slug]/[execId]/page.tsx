import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { JsonViewer } from "@/components/dashboard/json-viewer";
import { Timeline } from "@/components/dashboard/timeline";
import type { Step } from "@/types/webhook";

export const dynamic = "force-dynamic";

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

export default async function ExecutionDetailPage({
  params,
}: {
  params: Promise<{ slug: string; execId: string }>;
}) {
  const { slug, execId } = await params;
  const execIdNum = Number(execId);
  if (!Number.isFinite(execIdNum)) notFound();

  const sb = await createClient();
  const { data: exec, error } = await sb
    .from("vw_executions")
    .select("*")
    .eq("id", execIdNum)
    .eq("webhook_slug", slug)
    .maybeSingle();

  if (error) {
    return (
      <div className="rounded-md border border-vadai-error/30 bg-vadai-error/10 p-4 text-sm text-vadai-error">
        Error: {error.message}
      </div>
    );
  }
  if (!exec) notFound();

  const steps = (exec.steps as Step[] | null) ?? [];

  return (
    <div className="space-y-6">
      <Link
        href={`/dashboard/${slug}`}
        className="inline-flex items-center gap-1.5 text-sm text-vadai-muted hover:text-vadai-text transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Ejecuciones de {slug}
      </Link>

      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-vadai-text">
          Ejecución #{exec.id}
        </h1>
        <StatusBadge status={exec.status} />
      </div>

      {/* Input */}
      <Section title="Input">
        <Grid>
          <Field label="Recibido" value={fmtDateTime(exec.received_at)} mono />
          <Field
            label="Source IP"
            value={exec.source_ip ?? "—"}
            mono
          />
          <Field
            label="User Agent"
            value={exec.user_agent ?? "—"}
            mono
          />
          <Field
            label="Tamaño payload"
            value={
              exec.payload_size_bytes
                ? `${exec.payload_size_bytes} B`
                : "—"
            }
          />
        </Grid>

        <div className="mt-4 space-y-3">
          <JsonViewer label="Payload" value={exec.payload} defaultOpen />
          <JsonViewer label="Headers" value={exec.headers ?? {}} />
        </div>
      </Section>

      {/* Processing */}
      <Section title="Processing">
        <Grid>
          <Field
            label="Iniciado"
            value={fmtDateTime(exec.started_at)}
            mono
          />
          <Field
            label="Completado"
            value={fmtDateTime(exec.completed_at)}
            mono
          />
          <Field label="Duración" value={fmtDuration(exec.duration_ms)} />
          <Field
            label="Idempotency key"
            value={exec.idempotency_key ?? "—"}
            mono
          />
        </Grid>

        {exec.result_summary && (
          <div className="mt-4">
            <JsonViewer
              label="Result summary"
              value={exec.result_summary}
              defaultOpen
            />
          </div>
        )}
      </Section>

      {/* Error (si aplica) */}
      {exec.status === "failed" && (
        <Section title="Error" tone="error">
          {exec.error_message && (
            <p className="text-sm text-vadai-error font-medium">
              {exec.error_message}
            </p>
          )}
          {exec.error_stack && (
            <pre className="mt-3 max-h-72 overflow-auto rounded-md border border-vadai-error/20 bg-vadai-error/5 p-3 text-xs font-mono text-vadai-text">
              {exec.error_stack}
            </pre>
          )}
        </Section>
      )}

      {/* Timeline */}
      <Section title="Timeline">
        <Timeline steps={steps} />
      </Section>
    </div>
  );
}

function Section({
  title,
  tone = "default",
  children,
}: {
  title: string;
  tone?: "default" | "error";
  children: React.ReactNode;
}) {
  const border =
    tone === "error" ? "border-vadai-error/30" : "border-vadai-navy-light";
  return (
    <section
      className={`rounded-lg border ${border} bg-vadai-navy-mid p-5 space-y-1`}
    >
      <h2 className="text-sm font-medium text-vadai-text">{title}</h2>
      <div className="pt-3">{children}</div>
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-vadai-muted">
        {label}
      </p>
      <p
        className={`mt-1 text-sm text-vadai-text ${mono ? "font-mono" : ""} truncate`}
      >
        {value}
      </p>
    </div>
  );
}
