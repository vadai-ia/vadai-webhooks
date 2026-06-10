import type { WebhookHandler } from "./_types";
import { handler as gencoSoftOdoo } from "./genco-soft-odoo";
import { handler as vadaiCumpleanos } from "./vadai-cumpleanos";
import { handler as firefliesAlexTranscript } from "./fireflies-alex-transcript";

/**
 * Registro central de handlers.
 *
 * Para agregar uno nuevo:
 *   1. Crear src/handlers/mi-handler.ts exportando un WebhookHandler
 *   2. Importarlo aquí
 *   3. Agregar [handler.slug, handler] al Map
 *
 * El runner lo busca por `config.handler_slug` (default: igual al slug del webhook).
 */
export const handlers = new Map<string, WebhookHandler<unknown>>([
  [gencoSoftOdoo.slug, gencoSoftOdoo as WebhookHandler<unknown>],
  [vadaiCumpleanos.slug, vadaiCumpleanos as WebhookHandler<unknown>],
  [firefliesAlexTranscript.slug, firefliesAlexTranscript as WebhookHandler<unknown>],
]);
