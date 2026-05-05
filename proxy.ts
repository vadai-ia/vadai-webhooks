import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Next.js 16 reemplaza `middleware.ts` por `proxy.ts`.
 * Aquí refrescamos la sesión de Supabase y gateamos rutas privadas.
 *
 * Públicas: /in/*, /login, /auth/*, archivos estáticos.
 * Privadas: el resto (principalmente /dashboard/*).
 */
export async function proxy(request: NextRequest) {
  // ─── HTTP → HTTPS upgrade ────────────────────────────────────────────────
  // Railway termina TLS en su edge y nos pasa `x-forwarded-proto`. Si llegó
  // por http, redirigimos a la misma URL en https. 308 (no 301) preserva el
  // método HTTP — crítico para POST a /in/[token] desde clientes externos.
  // En local dev el header no existe, así que no hay redirect.
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const host = request.headers.get("host");
  if (forwardedProto === "http" && host) {
    const httpsUrl = new URL(
      request.nextUrl.pathname + request.nextUrl.search,
      `https://${host}`
    );
    return NextResponse.redirect(httpsUrl, 308);
  }

  // ─── HSTS ────────────────────────────────────────────────────────────────
  // Le decimos al browser que esta hostname es HTTPS-only por 1 año. Tras
  // el primer hit en https, cualquier futura request que el usuario teclee
  // como http (o links viejos cacheados, bookmarks) la upgrade-a el browser
  // automáticamente sin pegarle al server. Sólo lo seteamos sobre HTTPS —
  // browsers ignoran el header si llega por http (es regla de seguridad).
  const isHttps = forwardedProto === "https";
  const addHsts = (res: NextResponse): NextResponse => {
    if (isHttps) {
      res.headers.set("Strict-Transport-Security", "max-age=31536000");
    }
    return res;
  };

  // Response que iremos mutando con las cookies que escriba @supabase/ssr.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Importante: getUser() valida el JWT contra el server, no se confía en la cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic =
    path.startsWith("/in/") ||
    path === "/login" ||
    path.startsWith("/auth/");

  if (!user && !isPublic) {
    const loginUrl = new URL("/login", request.url);
    return addHsts(NextResponse.redirect(loginUrl));
  }

  return addHsts(response);
}

export const config = {
  // Excluir assets estáticos y rutas internas de Next del proxy.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
