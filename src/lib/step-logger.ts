import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/db-types";
import type { Step, StepStatus } from "@/types/webhook";

/**
 * Crea un logger ligado a una ejecución específica.
 *
 * Append es read-modify-write sobre la columna `steps` JSONB.
 * Es seguro porque cada ejecución es procesada por un único handler
 * a la vez (after() es secuencial dentro del request).
 */
export function createStepLogger(
  sb: SupabaseClient<Database>,
  execId: number
) {
  return {
    async step(
      name: string,
      status: StepStatus,
      message?: string | null,
      data?: unknown
    ): Promise<void> {
      const newStep: Step = {
        ts: new Date().toISOString(),
        name,
        status,
        message: message ?? undefined,
        data,
      };

      const { data: row } = await sb
        .from("vw_executions")
        .select("steps")
        .eq("id", execId)
        .single();

      const currentSteps = (row?.steps as Step[] | null) ?? [];

      // El tipo Step contiene `data?: unknown` que no calza con el Json
      // estricto generado por Supabase; sabemos que el handler nos pasa
      // valores serializables, así que cast al borde.
      const nextSteps = [...currentSteps, newStep] as unknown as Json;

      await sb
        .from("vw_executions")
        .update({ steps: nextSteps })
        .eq("id", execId);
    },
  };
}

export type StepLogger = ReturnType<typeof createStepLogger>;
