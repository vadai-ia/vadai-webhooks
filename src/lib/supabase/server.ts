import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/db-types";

/**
 * Cliente Supabase para uso en server components, route handlers y server actions.
 * Lee/escribe cookies del request actual para mantener la sesión del usuario.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // En Server Components puro, set() lanza. Lo ignoramos: el refresh
          // de tokens se completa luego en el proxy o en una server action.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // noop
          }
        },
      },
    }
  );
}
