import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/db-types";

/**
 * Cliente Supabase para client components.
 * La sesión vive en cookies (manejadas por @supabase/ssr).
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
