import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const ALLOWED_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN ?? "vadai.com.mx";

async function sendMagicLink(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
    redirect(`/login?error=domain`);
  }

  const sb = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const { error } = await sb.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${appUrl}/auth/callback`,
    },
  });

  if (error) {
    console.error("[login] signInWithOtp", error);
    redirect(`/login?error=send`);
  }

  redirect(`/login?sent=1`);
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm bg-vadai-navy-mid border border-vadai-navy-light rounded-xl p-8 shadow-xl">
        <h1 className="text-2xl font-semibold text-vadai-text">
          VADAI Webhooks
        </h1>
        <p className="mt-1 text-sm text-vadai-muted">
          Acceso restringido a <span className="font-mono">@{ALLOWED_DOMAIN}</span>
        </p>

        {params.sent && (
          <div className="mt-6 text-sm text-vadai-success bg-vadai-success/10 border border-vadai-success/30 rounded-md px-3 py-2">
            Te enviamos un magic link. Revisa tu correo.
          </div>
        )}

        {params.error === "domain" && (
          <div className="mt-6 text-sm text-vadai-error bg-vadai-error/10 border border-vadai-error/30 rounded-md px-3 py-2">
            Sólo correos @{ALLOWED_DOMAIN} están permitidos.
          </div>
        )}

        {params.error === "send" && (
          <div className="mt-6 text-sm text-vadai-error bg-vadai-error/10 border border-vadai-error/30 rounded-md px-3 py-2">
            No pudimos enviar el correo. Inténtalo de nuevo.
          </div>
        )}

        <form action={sendMagicLink} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm text-vadai-muted">Email</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder={`tu.nombre@${ALLOWED_DOMAIN}`}
              className="mt-1 w-full rounded-md bg-vadai-navy-light border border-vadai-navy-light px-3 py-2 text-vadai-text placeholder-vadai-muted focus:outline-none focus:ring-2 focus:ring-vadai-cyan"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-md bg-vadai-cyan text-vadai-navy font-medium py-2 hover:bg-vadai-cyan-light transition-colors"
          >
            Enviar magic link
          </button>
        </form>
      </div>
    </main>
  );
}
