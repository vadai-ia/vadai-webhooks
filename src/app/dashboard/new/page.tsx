import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createWebhook } from "../actions";

const ERRORS: Record<string, string> = {
  name: "El nombre es obligatorio.",
  slug: "El slug resultante es inválido.",
  "slug-taken": "Ya existe un webhook con ese slug.",
  insert: "No pudimos crear el webhook. Intenta de nuevo.",
};

export default async function NewWebhookPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const errMsg = params.error ? ERRORS[params.error] : null;

  return (
    <div className="max-w-xl">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-vadai-muted hover:text-vadai-text transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-vadai-text">
        Nuevo webhook
      </h1>
      <p className="mt-1 text-sm text-vadai-muted">
        Se generará una URL única (<span className="font-mono">/in/wh_…</span>) y
        el webhook arrancará en estado{" "}
        <span className="font-mono">pending_handler</span> hasta que
        registremos un handler en código.
      </p>

      {errMsg && (
        <div className="mt-6 rounded-md border border-vadai-error/30 bg-vadai-error/10 px-3 py-2 text-sm text-vadai-error">
          {errMsg}
        </div>
      )}

      <form action={createWebhook} className="mt-6 space-y-4">
        <Field
          label="Nombre"
          hint="Para mostrar en el dashboard. Ej: 'GENCO Odoo facturación'."
        >
          <input
            name="name"
            type="text"
            required
            maxLength={120}
            className="w-full rounded-md bg-vadai-navy-light border border-vadai-navy-light px-3 py-2 text-vadai-text placeholder-vadai-muted focus:outline-none focus:ring-2 focus:ring-vadai-cyan"
            placeholder="GENCO Odoo facturación"
          />
        </Field>

        <Field
          label="Slug"
          hint="Identificador en URL. Si lo dejas vacío se genera del nombre. Solo a-z, 0-9 y guiones."
        >
          <input
            name="slug"
            type="text"
            maxLength={60}
            pattern="[a-z0-9-]*"
            className="w-full rounded-md bg-vadai-navy-light border border-vadai-navy-light px-3 py-2 text-vadai-text font-mono placeholder-vadai-muted focus:outline-none focus:ring-2 focus:ring-vadai-cyan"
            placeholder="genco-odoo"
          />
        </Field>

        <Field label="Cliente" hint="Opcional.">
          <input
            name="client_name"
            type="text"
            maxLength={120}
            className="w-full rounded-md bg-vadai-navy-light border border-vadai-navy-light px-3 py-2 text-vadai-text placeholder-vadai-muted focus:outline-none focus:ring-2 focus:ring-vadai-cyan"
            placeholder="GENCO"
          />
        </Field>

        <Field
          label="Descripción"
          hint="Opcional. Notas internas: qué hace este webhook, quién lo usa."
        >
          <textarea
            name="description"
            rows={3}
            maxLength={500}
            className="w-full rounded-md bg-vadai-navy-light border border-vadai-navy-light px-3 py-2 text-vadai-text placeholder-vadai-muted focus:outline-none focus:ring-2 focus:ring-vadai-cyan resize-none"
            placeholder="Recibe ventas de Odoo y crea facturas en…"
          />
        </Field>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            className="rounded-md bg-vadai-cyan px-4 py-2 text-sm font-medium text-vadai-navy hover:bg-vadai-cyan-light transition-colors"
          >
            Crear webhook
          </button>
          <Link
            href="/dashboard"
            className="text-sm text-vadai-muted hover:text-vadai-text transition-colors"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-vadai-text">{label}</span>
      {hint && <span className="block text-xs text-vadai-muted mt-0.5">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
