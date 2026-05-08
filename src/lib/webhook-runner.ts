import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createStepLogger } from "@/lib/step-logger";
import { handlers } from "@/handlers/_registry";
import type { Json } from "@/lib/db-types";
import type { WebhookConfig } from "@/types/webhook";

/**
 * Procesa una ejecución de webhook ya insertada en vw_executions.
 *
 * Llamado desde `after()` en /in/[token] cuando el config está active.
 * Resuelve el handler, valida idempotencia y schema, ejecuta, y persiste
 * resultado o error.
 */
export async function runHandler(
  execId: number,
  config: WebhookConfig
): Promise<void> {
  const sb = createServiceRoleClient();
  const start = Date.now();

  // Marcar processing
  await sb
    .from("vw_executions")
    .update({ status: "processing", started_at: new Date().toISOString() })
    .eq("id", execId);

  // Resolver handler
  const handlerSlug = config.handler_slug ?? config.slug;
  const handler = handlers.get(handlerSlug);

  if (!handler) {
    await sb
      .from("vw_executions")
      .update({
        status: "failed",
        error_message: `No handler registered for slug: ${handlerSlug}`,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - start,
      })
      .eq("id", execId);
    return;
  }

  // Cargar payload
  const { data: exec } = await sb
    .from("vw_executions")
    .select("payload")
    .eq("id", execId)
    .single();

  if (!exec) return;

  const logger = createStepLogger(sb, execId);
  let idempKey: string | null = null;

  try {
    // Idempotencia
    idempKey = handler.getIdempotencyKey?.(exec.payload) ?? null;

    if (idempKey) {
      const { data: dup } = await sb
        .from("vw_executions")
        .select("id")
        .eq("webhook_slug", config.slug)
        .eq("idempotency_key", idempKey)
        .eq("status", "completed")
        .neq("id", execId)
        .limit(1)
        .maybeSingle();

      if (dup) {
        await logger.step(
          "idempotency",
          "warn",
          `Duplicate of execution ${dup.id}`,
          { duplicate_of: dup.id }
        );
        await sb
          .from("vw_executions")
          .update({
            status: "skipped_duplicate",
            idempotency_key: idempKey,
            completed_at: new Date().toISOString(),
            duration_ms: Date.now() - start,
          })
          .eq("id", execId);
        return;
      }
    }

    // Validación de schema
    const parsed = handler.schema.safeParse(exec.payload);
    if (!parsed.success) {
      await logger.step("validation", "error", "Schema validation failed", {
        errors: parsed.error.issues,
      });
      await sb
        .from("vw_executions")
        .update({
          status: "failed",
          error_message: "Invalid payload schema",
          idempotency_key: idempKey,
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - start,
        })
        .eq("id", execId);
      return;
    }

    // Procesar
    const result = await handler.process(parsed.data, {
      logger,
      sb,
      config,
      executionId: execId,
    });

    await sb
      .from("vw_executions")
      .update({
        status: result.warning ? "completed_with_warning" : "completed",
        result_summary: result.summary as unknown as Json,
        idempotency_key: idempKey,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - start,
      })
      .eq("id", execId);
  } catch (err) {
    const error = err as Error;
    await logger.step("error", "error", error.message);
    await sb
      .from("vw_executions")
      .update({
        status: "failed",
        error_message: error.message,
        error_stack: error.stack ?? null,
        idempotency_key: idempKey,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - start,
      })
      .eq("id", execId);
  }
}
