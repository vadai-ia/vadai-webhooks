import type { WebhookHandler } from "./_types";
import { handler as gencoSoftOdoo } from "./genco-soft-odoo";

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
]);
