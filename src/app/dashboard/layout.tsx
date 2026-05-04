import Link from "next/link";
import { Webhook } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-vadai-navy-light bg-vadai-navy-mid/40 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-vadai-text hover:text-vadai-cyan transition-colors"
          >
            <Webhook className="h-5 w-5 text-vadai-cyan" />
            <span className="font-semibold tracking-tight">VADAI Webhooks</span>
          </Link>

          <div className="flex items-center gap-3 text-sm">
            <span className="text-vadai-muted hidden sm:inline">
              {user?.email}
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-md border border-vadai-navy-light px-2.5 py-1 text-vadai-muted hover:text-vadai-text hover:border-vadai-cyan/40 transition-colors"
              >
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-7xl px-6 py-8">
        {children}
      </main>
    </div>
  );
}
