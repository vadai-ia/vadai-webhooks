import type { OdooJsonRpcResponse } from "./types";

/**
 * Cliente JSON-RPC para Odoo.
 *
 * Diseño:
 * - Una instancia por handler call. Cachea `uid` adentro para evitar
 *   re-autenticar entre llamadas, pero NO se comparte entre requests.
 * - Multi-empresa: si pasas `companyId` a `executeKw`, inyectamos
 *   `allowed_company_ids: [companyId]` y `default_company_id: companyId`
 *   en `kwargs.context`. Esto evita que Odoo use la company default del
 *   user (que puede ser cualquiera) y mande la operación a la empresa
 *   equivocada — pasa fácil porque varios cálculos derivan de
 *   `self.env.company`.
 * - URL: aceptamos cualquier path después del host (ej. `/odoo`, `/web`)
 *   y normalizamos al `/jsonrpc` desde la raíz, que es el endpoint
 *   real para JSON-RPC en todas las versiones de Odoo.
 * - Retry:
 *     · 5xx y errores de red → 3 intentos con 1s/4s/16s
 *     · 429 (rate limit, común en Odoo SaaS) → 3 intentos con 5s/15s/45s,
 *       o usando el `Retry-After` del response si viene
 *     · Otros 4xx y errores aplicativos de Odoo → no retry
 */
export interface OdooClient {
  authenticate(): Promise<number>;

  executeKw<T = unknown>(
    model: string,
    method: string,
    args: unknown[],
    kwargs?: Record<string, unknown>,
    companyId?: number
  ): Promise<T>;
}

interface OdooConfig {
  url: string;
  db: string;
  user: string;
  apiKey: string;
}

const RETRY_DELAYS_MS = [1000, 4000, 16000];
const RATE_LIMIT_DELAYS_MS = [5000, 15000, 45000];

class OdooClientImpl implements OdooClient {
  private uid: number | null = null;
  private requestId = 0;
  private readonly endpoint: string;

  constructor(private readonly config: OdooConfig) {
    // new URL().origin descarta cualquier path, query o fragment.
    // Si el usuario puso "https://genco1.odoo.com/odoo", queda
    // "https://genco1.odoo.com" → endpoint final "/jsonrpc".
    this.endpoint = `${new URL(config.url).origin}/jsonrpc`;
  }

  async authenticate(): Promise<number> {
    if (this.uid !== null) return this.uid;

    const result = await this.rpc<number | false>({
      service: "common",
      method: "authenticate",
      args: [this.config.db, this.config.user, this.config.apiKey, {}],
    });

    if (!result) {
      throw new Error("Odoo authenticate failed: invalid credentials");
    }
    this.uid = result;
    return result;
  }

  async executeKw<T = unknown>(
    model: string,
    method: string,
    args: unknown[],
    kwargs: Record<string, unknown> = {},
    companyId?: number
  ): Promise<T> {
    const uid = await this.authenticate();

    const finalKwargs: Record<string, unknown> = { ...kwargs };
    if (companyId !== undefined) {
      const baseCtx = (kwargs.context as Record<string, unknown> | undefined) ?? {};
      finalKwargs.context = {
        ...baseCtx,
        allowed_company_ids: [companyId],
        default_company_id: companyId,
      };
    }

    return this.rpc<T>({
      service: "object",
      method: "execute_kw",
      args: [
        this.config.db,
        uid,
        this.config.apiKey,
        model,
        method,
        args,
        finalKwargs,
      ],
    });
  }

  private async rpc<T>(params: {
    service: string;
    method: string;
    args: unknown[];
  }): Promise<T> {
    const body = JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params,
      id: ++this.requestId,
    });

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(this.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });

        // 429: rate limit. Odoo SaaS lo aplica de forma agresiva.
        // Backoff largo (segundos), respetando Retry-After si viene.
        if (res.status === 429) {
          const retryAfter = parseRetryAfter(res.headers.get("Retry-After"));
          lastError = new Error("Odoo HTTP 429 (rate limited)");
          if (attempt < 2) {
            const wait = retryAfter ?? RATE_LIMIT_DELAYS_MS[attempt];
            await new Promise((r) => setTimeout(r, wait));
            continue;
          }
          throw lastError;
        }

        // Otros 4xx: problema de cliente, no reintentar.
        if (res.status >= 400 && res.status < 500) {
          const text = await safeText(res);
          throw new Error(`Odoo HTTP ${res.status}: ${text}`);
        }

        // 5xx: transitorio, reintentar.
        if (res.status >= 500) {
          lastError = new Error(`Odoo HTTP ${res.status}`);
          await this.maybeBackoff(attempt);
          continue;
        }

        const json = (await res.json()) as OdooJsonRpcResponse<T>;
        if (json.error) {
          // Error aplicativo de Odoo: no reintentar (data inválida o
          // permisos). Damos prioridad al mensaje del traceback porque
          // suele ser más descriptivo.
          const msg =
            json.error.data?.message ??
            json.error.data?.name ??
            json.error.message ??
            "unknown";
          throw new Error(`Odoo error: ${msg}`);
        }
        if (json.result === undefined) {
          throw new Error("Odoo response missing result");
        }
        return json.result;
      } catch (err) {
        // Errores aplicativos / 4xx: re-throw inmediato sin retry.
        if (err instanceof Error) {
          if (
            err.message.startsWith("Odoo error:") ||
            err.message.startsWith("Odoo HTTP 4")
          ) {
            throw err;
          }
        }
        lastError = err as Error;
        await this.maybeBackoff(attempt);
      }
    }

    throw lastError ?? new Error("Odoo RPC failed after 3 attempts");
  }

  private async maybeBackoff(attempt: number): Promise<void> {
    if (attempt < RETRY_DELAYS_MS.length - 1) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
    }
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return "<no body>";
  }
}

/**
 * Retry-After viene en segundos (numérico) o como fecha HTTP. Sólo
 * manejamos el caso numérico — es lo que Odoo manda cuando lo manda.
 * Tope a 60s para que un valor enorme no congele al usuario.
 */
function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.min(seconds, 60) * 1000;
}

export function createOdooClient(): OdooClient {
  const url = process.env.ODOO_URL;
  const db = process.env.ODOO_DB;
  const user = process.env.ODOO_USER;
  const apiKey = process.env.ODOO_API_KEY;
  if (!url || !db || !user || !apiKey) {
    throw new Error(
      "Odoo client requires ODOO_URL, ODOO_DB, ODOO_USER, ODOO_API_KEY env vars"
    );
  }
  return new OdooClientImpl({ url, db, user, apiKey });
}
