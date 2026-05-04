import type { Tables, TablesInsert, TablesUpdate } from "@/lib/db-types";

// =============================================================
// Tablas — atajos sobre los types generados por `supabase gen types`.
// =============================================================

export type WebhookConfig = Tables<"vw_configs">;
export type WebhookConfigInsert = TablesInsert<"vw_configs">;
export type WebhookConfigUpdate = TablesUpdate<"vw_configs">;

export type WebhookExecution = Tables<"vw_executions">;
export type WebhookExecutionInsert = TablesInsert<"vw_executions">;
export type WebhookExecutionUpdate = TablesUpdate<"vw_executions">;

// =============================================================
// Status enums — la columna `status` es TEXT en la DB para flexibilidad,
// pero acá lo modelamos como union para tener autocomplete y exhaustividad
// en el código TypeScript.
// =============================================================

export const WEBHOOK_CONFIG_STATUSES = [
  "pending_handler",
  "active",
  "paused",
  "archived",
] as const;
export type WebhookConfigStatus = (typeof WEBHOOK_CONFIG_STATUSES)[number];

export const WEBHOOK_EXECUTION_STATUSES = [
  "received",
  "pending",
  "processing",
  "completed",
  "completed_with_warning",
  "failed",
  "skipped_duplicate",
  "skipped_paused",
] as const;
export type WebhookExecutionStatus = (typeof WEBHOOK_EXECUTION_STATUSES)[number];

// =============================================================
// Step — entrada del array `steps` en vw_executions.
// JSONB en DB, tipado acá para los handlers y la UI del timeline.
// =============================================================

export type StepStatus = "info" | "success" | "warn" | "error";

export interface Step {
  ts: string;            // ISO timestamp
  name: string;          // identificador corto del paso
  status: StepStatus;
  message?: string;      // texto humano
  data?: unknown;        // payload arbitrario para inspección
}
