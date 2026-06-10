import type {
  FirefliesTranscript,
  GraphQLResponse,
} from "./types";

/**
 * Cliente GraphQL para Fireflies.
 *
 * Diseño (espejo del cliente Odoo):
 * - Una instancia por handler call. Sin estado compartido entre requests.
 * - Endpoint fijo: https://api.fireflies.ai/graphql con `Authorization: Bearer`.
 * - Retry:
 *     · 5xx y errores de red → 3 intentos con 1s/4s/16s
 *     · 429 (rate limit) → 3 intentos con 5s/15s/45s, respetando `Retry-After`
 *     · 4xx y errores GraphQL (data inválida / not found) → no retry
 */
export interface FirefliesClient {
  getTranscript(meetingId: string): Promise<FirefliesTranscript>;
}

const ENDPOINT = "https://api.fireflies.ai/graphql";
const RETRY_DELAYS_MS = [1000, 4000, 16000];
const RATE_LIMIT_DELAYS_MS = [5000, 15000, 45000];

const TRANSCRIPT_QUERY = `
  query Transcript($id: String!) {
    transcript(id: $id) {
      id
      title
      date
      duration
      meeting_link
      transcript_url
      organizer_email
      host_email
      participants
      meeting_attendees { displayName email }
      summary {
        overview
        action_items
        keywords
        bullet_gist
        shorthand_bullet
        short_summary
      }
    }
  }
`;

class FirefliesClientImpl implements FirefliesClient {
  constructor(private readonly apiKey: string) {}

  async getTranscript(meetingId: string): Promise<FirefliesTranscript> {
    const json = await this.gql<{ transcript: FirefliesTranscript | null }>(
      TRANSCRIPT_QUERY,
      { id: meetingId }
    );
    if (!json.transcript) {
      throw new Error(
        `Fireflies: transcript '${meetingId}' no existe o sin acceso`
      );
    }
    return json.transcript;
  }

  private async gql<T>(
    query: string,
    variables: Record<string, unknown>
  ): Promise<T> {
    const body = JSON.stringify({ query, variables });
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body,
        });

        // 429: rate limit. Backoff largo, respetando Retry-After si viene.
        if (res.status === 429) {
          const retryAfter = parseRetryAfter(res.headers.get("Retry-After"));
          lastError = new Error("Fireflies HTTP 429 (rate limited)");
          if (attempt < 2) {
            await sleep(retryAfter ?? RATE_LIMIT_DELAYS_MS[attempt]);
            continue;
          }
          throw lastError;
        }

        // 401/403: credenciales — no reintentar.
        if (res.status === 401 || res.status === 403) {
          throw new Error(
            `Fireflies HTTP ${res.status}: API key inválida o sin permisos`
          );
        }

        // Otros 4xx: problema de cliente, no reintentar.
        if (res.status >= 400 && res.status < 500) {
          throw new Error(`Fireflies HTTP ${res.status}: ${await safeText(res)}`);
        }

        // 5xx: transitorio, reintentar.
        if (res.status >= 500) {
          lastError = new Error(`Fireflies HTTP ${res.status}`);
          await this.maybeBackoff(attempt);
          continue;
        }

        const json = (await res.json()) as GraphQLResponse<T>;
        if (json.errors && json.errors.length > 0) {
          // Errores GraphQL (validación, not_found, permisos) → no retry.
          const msg = json.errors.map((e) => e.message).join("; ");
          throw new Error(`Fireflies GraphQL error: ${msg}`);
        }
        if (json.data === undefined) {
          throw new Error("Fireflies response missing data");
        }
        return json.data;
      } catch (err) {
        // 4xx / errores GraphQL: re-throw inmediato sin retry.
        if (err instanceof Error) {
          if (
            err.message.startsWith("Fireflies GraphQL error:") ||
            err.message.startsWith("Fireflies HTTP 4")
          ) {
            throw err;
          }
        }
        lastError = err as Error;
        await this.maybeBackoff(attempt);
      }
    }

    throw lastError ?? new Error("Fireflies GraphQL failed after 3 attempts");
  }

  private async maybeBackoff(attempt: number): Promise<void> {
    if (attempt < RETRY_DELAYS_MS.length - 1) {
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return "<no body>";
  }
}

/** Retry-After numérico (segundos), tope 60s. Ignora el formato fecha. */
function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.min(seconds, 60) * 1000;
}

/** Factory por env var `FIREFLIES_API_KEY`. */
export function createFirefliesClient(): FirefliesClient {
  const apiKey = process.env.FIREFLIES_API_KEY;
  if (!apiKey) {
    throw new Error("Fireflies client requires FIREFLIES_API_KEY env var");
  }
  return new FirefliesClientImpl(apiKey);
}
