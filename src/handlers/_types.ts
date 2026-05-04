import type { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db-types";
import type { StepLogger } from "@/lib/step-logger";
import type { WebhookConfig } from "@/types/webhook";

export interface HandlerContext {
  logger: StepLogger;
  sb: SupabaseClient<Database>;
  config: WebhookConfig;
  executionId: number;
}

export interface HandlerResult {
  /** Resumen estructurado del resultado, persistido en vw_executions.result_summary. */
  summary: Record<string, unknown>;
  /** Si true, status final será 'completed_with_warning' en vez de 'completed'. */
  warning?: boolean;
}

export interface WebhookHandler<TPayload = unknown> {
  slug: string;
  description: string;
  schema: z.ZodType<TPayload>;
  /** Si retorna string, se usa para detectar y descartar duplicados. */
  getIdempotencyKey?: (payload: TPayload) => string | null;
  process: (payload: TPayload, ctx: HandlerContext) => Promise<HandlerResult>;
}
