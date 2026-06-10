import { z } from "zod";
import type {
  ClassifyInput,
  AIClassification,
  OpenAIChatResponse,
} from "./types";

/**
 * Cliente mínimo de OpenAI Chat Completions (vía `fetch`, sin SDK).
 *
 * Espejo del estilo de los clientes Odoo/Fireflies:
 * - Una instancia por handler call, sin estado compartido entre requests.
 * - Structured Outputs (`response_format: json_schema, strict`) para que la
 *   respuesta sea siempre un JSON con la forma esperada.
 * - Retry:
 *     · 5xx y errores de red → 3 intentos con 1s/4s/16s
 *     · 429 (rate limit) → 3 intentos con 5s/15s/45s, respetando `Retry-After`
 *     · 4xx (credenciales / request inválido) → no retry
 * - Validación Zod del contenido; 1 reintento de "reparación" si el modelo
 *   devolvió algo que no parsea.
 */
export interface OpenAIClient {
  classifyActionItems(input: ClassifyInput): Promise<AIClassification[]>;
}

const ENDPOINT = "https://api.openai.com/v1/chat/completions";
const RETRY_DELAYS_MS = [1000, 4000, 16000];
const RATE_LIMIT_DELAYS_MS = [5000, 15000, 45000];

// Validación del contenido devuelto por el modelo.
const ClassificationSchema = z.object({
  index: z.number().int(),
  project_id: z.number().int().nullable(),
  title: z.string().min(1),
  deadline_offset_days: z.number().int(),
  confidence: z.number(),
  reasoning: z.string(),
});
const ResponseSchema = z.object({
  items: z.array(ClassificationSchema),
});

// JSON Schema (strict) que le pedimos a OpenAI respetar.
const RESPONSE_JSON_SCHEMA = {
  name: "action_item_classification",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            index: { type: "integer" },
            project_id: { type: ["integer", "null"] },
            title: { type: "string" },
            deadline_offset_days: { type: "integer" },
            confidence: { type: "number" },
            reasoning: { type: "string" },
          },
          required: [
            "index",
            "project_id",
            "title",
            "deadline_offset_days",
            "confidence",
            "reasoning",
          ],
        },
      },
    },
    required: ["items"],
  },
} as const;

const SYSTEM_PROMPT = `Eres un asistente de la agencia mexicana VADAI que organiza los action items de sus reuniones (transcritas por Fireflies) dentro de proyectos de Odoo del cliente LEVANTIA.

Para CADA action item debes devolver:
1. project_id: el id de un proyecto de la lista "candidate_projects" que mejor corresponda según el cliente/tema de la reunión. Normalmente TODOS los items de una misma reunión van al mismo proyecto del cliente; solo difiere si un item claramente pertenece a otro. Si ninguno aplica con confianza razonable, devuelve null (el item irá a una bandeja "Inbox").
2. title: un título claro y accionable en español, conciso (máx ~80 caracteres), que empiece con un verbo en infinitivo (ej. "Enviar propuesta a cliente X", "Agendar reunión de seguimiento"). No incluyas el nombre del responsable ni timestamps.
3. deadline_offset_days: cuántos días después de la fecha de la reunión es la entrega tentativa, inferido de la urgencia mencionada ("hoy"→0, "mañana"→1, "esta semana"→5, "este mes"→25...). Si no hay ninguna señal de urgencia, usa 7. Entero entre 0 y 90.
4. confidence: 0 a 1, qué tan seguro estás de la asignación de proyecto.
5. reasoning: una frase breve justificando el proyecto elegido.

Responde SOLO con el JSON pedido, un objeto por cada action item, conservando su "index".`;

class OpenAIClientImpl implements OpenAIClient {
  constructor(
    private readonly apiKey: string,
    private readonly model: string
  ) {}

  async classifyActionItems(
    input: ClassifyInput
  ): Promise<AIClassification[]> {
    const userPrompt = JSON.stringify({
      meeting: input.meeting,
      candidate_projects: input.candidateProjects,
      action_items: input.actionItems,
    });

    // 1er intento + 1 reintento de reparación si el contenido no parsea.
    let lastParseError: string | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const messages: Array<{ role: string; content: string }> = [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ];
      if (attempt === 1 && lastParseError) {
        messages.push({
          role: "system",
          content: `Tu respuesta anterior no era válida (${lastParseError}). Devuelve únicamente el JSON con el esquema pedido.`,
        });
      }

      const content = await this.chat(messages);
      try {
        const json = JSON.parse(content);
        const parsed = ResponseSchema.parse(json);
        return parsed.items;
      } catch (err) {
        lastParseError = err instanceof Error ? err.message : String(err);
      }
    }

    throw new Error(
      `OpenAI devolvió un JSON inválido tras 2 intentos: ${lastParseError}`
    );
  }

  private async chat(
    messages: Array<{ role: string; content: string }>
  ): Promise<string> {
    const body = JSON.stringify({
      model: this.model,
      messages,
      temperature: 0.2,
      response_format: {
        type: "json_schema",
        json_schema: RESPONSE_JSON_SCHEMA,
      },
    });

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
          lastError = new Error("OpenAI HTTP 429 (rate limited)");
          if (attempt < 2) {
            await sleep(retryAfter ?? RATE_LIMIT_DELAYS_MS[attempt]);
            continue;
          }
          throw lastError;
        }

        // 4xx: credenciales / request inválido — no reintentar.
        if (res.status >= 400 && res.status < 500) {
          throw new Error(
            `OpenAI HTTP ${res.status}: ${await safeText(res)}`
          );
        }

        // 5xx: transitorio, reintentar.
        if (res.status >= 500) {
          lastError = new Error(`OpenAI HTTP ${res.status}`);
          await this.maybeBackoff(attempt);
          continue;
        }

        const json = (await res.json()) as OpenAIChatResponse;
        if (json.error) {
          throw new Error(`OpenAI error: ${json.error.message ?? "unknown"}`);
        }
        const content = json.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error("OpenAI response missing message content");
        }
        return content;
      } catch (err) {
        // 4xx / errores aplicativos: re-throw inmediato sin retry.
        if (err instanceof Error) {
          if (
            err.message.startsWith("OpenAI error:") ||
            err.message.startsWith("OpenAI HTTP 4")
          ) {
            throw err;
          }
        }
        lastError = err as Error;
        await this.maybeBackoff(attempt);
      }
    }

    throw lastError ?? new Error("OpenAI request failed after 3 attempts");
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

/** Retry-After numérico (segundos), tope 60s. */
function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.min(seconds, 60) * 1000;
}

/** Factory por env vars `OPENAI_API_KEY` y `OPENAI_MODEL` (default gpt-4o). */
export function createOpenAIClient(): OpenAIClient {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OpenAI client requires OPENAI_API_KEY env var");
  }
  const model = process.env.OPENAI_MODEL || "gpt-4o";
  return new OpenAIClientImpl(apiKey, model);
}
