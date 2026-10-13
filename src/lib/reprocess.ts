import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createStepLogger } from "@/lib/step-logger";
import { runHandler } from "@/lib/webhook-runner";
import type { WebhookConfig } from "@/types/webhook";

/**
 * Drenados en curso, por slug. Railway corre una sola instancia de
 * `next start`, así que basta con memoria del proceso; con varias réplicas
 * esto tendría que vivir en DB. Va en `globalThis` porque Next puede cargar
 * este módulo más de una vez (un bundle por ruta) y la página que muestra el
 * estado tiene que ver el mismo Set que la action que drena.
 */
const g = globalThis as typeof globalThis & { __vwDraining?: Set<string> };
const draining = (g.__vwDraining ??= new Set<string>());

export function isDraining(slug: string): boolean {
  return draining.has(slug);
}

/** Pide al drenado en curso que pare al terminar la ejecución actual. */
export function stopDraining(slug: string): void {
  draining.delete(slug);
}

/**
 * Procesa las ejecuciones que quedaron `skipped_paused` mientras el webhook
 * estuvo pausado, de la más vieja a la más nueva y de una en una.
 *
 * En serie a propósito: los handlers que pegan a APIs con rate limit (Odoo)
 * ya reciben 429 con una sola cola, y procesar en orden de llegada deja los
 * folios de Odoo en orden cronológico. Lo que llegue mientras drena (si sigue
 * pausado) entra al final de la misma cola.
 *
 * Cada ejecución se reclama con un UPDATE condicional (skipped_paused →
 * received): si otra cosa ya la tomó, el UPDATE no devuelve fila y se salta.
 */
export async function drainSkipped(
  config: WebhookConfig,
  limit = Number.POSITIVE_INFINITY
): Promise<void> {
  if (draining.has(config.slug)) return;
  draining.add(config.slug);

  const sb = createServiceRoleClient();
  let processed = 0;

  try {
    while (processed < limit && draining.has(config.slug)) {
      const { data: next, error } = await sb
        .from("vw_executions")
        .select("id")
        .eq("webhook_slug", config.slug)
        .eq("status", "skipped_paused")
        .order("received_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw new Error(`drainSkipped lookup: ${error.message}`);
      if (!next) break;

      const { data: claimed } = await sb
        .from("vw_executions")
        .update({ status: "received" })
        .eq("id", next.id)
        .eq("status", "skipped_paused")
        .select("id")
        .maybeSingle();
      if (!claimed) continue;

      await createStepLogger(sb, next.id).step(
        "reprocess",
        "info",
        "Reprocesada desde el dashboard (había llegado con el webhook pausado)"
      );
      await runHandler(next.id, config);
      processed++;
    }
  } finally {
    draining.delete(config.slug);
  }
}
