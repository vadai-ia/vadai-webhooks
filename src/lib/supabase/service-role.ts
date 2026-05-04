import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db-types";

/**
 * Cliente Supabase con service_role key — bypassa RLS.
 *
 * Sólo usar en código server-only que necesite escribir/leer sin sesión
 * de usuario (típicamente: el endpoint público /in/[token] y el runner
 * de handlers en background).
 *
 * NUNCA exponer al cliente.
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase service-role client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
