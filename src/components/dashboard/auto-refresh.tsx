"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Refresca el server component padre cada `intervalMs` mientras la pestaña
 * está visible. Usado para mantener al día las listas de ejecuciones sin
 * meter Realtime de Supabase (todavía).
 */
export function AutoRefresh({ intervalMs = 5000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    function start() {
      stop();
      timer = setInterval(() => router.refresh(), intervalMs);
    }
    function stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }

    function onVisibility() {
      if (document.visibilityState === "visible") {
        start();
      } else {
        stop();
      }
    }

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, intervalMs]);

  return null;
}
