import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

async function signIn(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/login?error=missing");
  }

  // 1. ¿Está autorizado? Lo checamos con service_role para no leakear info
  //    de "qué passwords son válidas para usuarios no autorizados".
  const sbSvc = createServiceRoleClient();
  const { data: allowed, error: allowErr } = await sbSvc
    .from("vw_allowed_users")
    .select("email")
    .eq("email", email)
    .maybeSingle();

  if (allowErr) {
    console.error("[login] allowlist check", allowErr);
    redirect("/login?error=internal");
  }
  if (!allowed) {
    redirect("/login?error=denied");
  }

  // 2. Password sign-in. La sesión se guarda en cookies vía @supabase/ssr.
  const sb = await createClient();
  const { error } = await sb.auth.signInWithPassword({ email, password });

  if (error) {
    console.error("[login] signInWithPassword", error.message);
    redirect("/login?error=invalid");
  }

  redirect("/dashboard");
}

const ERRORS: Record<string, string> = {
  missing: "Email y password son obligatorios.",
  denied: "Esta cuenta no tiene acceso autorizado.",
  invalid: "Email o password incorrectos.",
  internal: "Error interno. Inténtalo de nuevo.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const errMsg = params.error ? ERRORS[params.error] : null;

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm bg-vadai-navy-mid border border-vadai-navy-light rounded-xl p-8 shadow-xl">
        <h1 className="text-2xl font-semibold text-vadai-text">
          VADAI Webhooks
        </h1>
        <p className="mt-1 text-sm text-vadai-muted">
          Acceso restringido a usuarios autorizados.
        </p>

        {errMsg && (
          <div className="mt-6 text-sm text-vadai-error bg-vadai-error/10 border border-vadai-error/30 rounded-md px-3 py-2">
            {errMsg}
          </div>
        )}

        <form action={signIn} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm text-vadai-muted">Email</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="mt-1 w-full rounded-md bg-vadai-navy-light border border-vadai-navy-light px-3 py-2 text-vadai-text placeholder-vadai-muted focus:outline-none focus:ring-2 focus:ring-vadai-cyan"
            />
          </label>

          <label className="block">
            <span className="text-sm text-vadai-muted">Password</span>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-1 w-full rounded-md bg-vadai-navy-light border border-vadai-navy-light px-3 py-2 text-vadai-text placeholder-vadai-muted focus:outline-none focus:ring-2 focus:ring-vadai-cyan"
            />
          </label>

          <button
            type="submit"
            className="w-full rounded-md bg-vadai-cyan text-vadai-navy font-medium py-2 hover:bg-vadai-cyan-light transition-colors"
          >
            Entrar
          </button>
        </form>
      </div>
    </main>
  );
}
