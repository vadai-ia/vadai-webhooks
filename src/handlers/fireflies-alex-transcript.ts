import { z } from "zod";
import {
  createOdooClientFromConfig,
  type OdooClient,
} from "@/lib/odoo/client";
import { createFirefliesClient } from "@/lib/fireflies/client";
import type { FirefliesTranscript } from "@/lib/fireflies/types";
import { createOpenAIClient } from "@/lib/openai/client";
import type {
  AIClassification,
  CandidateProject,
} from "@/lib/openai/types";
import type { WebhookHandler, HandlerResult } from "./_types";

// =============================================================
// Schema del payload — webhook de Fireflies
// =============================================================
//
// Fireflies manda SOLO punteros, no el contenido. El transcript + summary +
// action items se piden después a la GraphQL API (ver lib/fireflies/client).

const PayloadSchema = z
  .object({
    meetingId: z.string().min(1),
    eventType: z.string().optional(),
    clientReferenceId: z.string().optional(),
  })
  .passthrough();

type Payload = z.infer<typeof PayloadSchema>;

const TZ = "America/Mexico_City";

// Confianza mínima para aceptar el proyecto que eligió la IA. Por debajo de
// esto el item se manda a Inbox aunque la IA haya sugerido un proyecto.
const CONFIDENCE_THRESHOLD = 0.4;

// Tope de días para una entrega tentativa (defensa ante un offset disparatado).
const MAX_DEADLINE_DAYS = 90;
const DEFAULT_DEADLINE_DAYS = 7;

// =============================================================
// Parser de summary.action_items (string markdown de Fireflies)
// =============================================================
//
// Formato típico (agrupado por responsable):
//   **Ana López**
//   Enviar la propuesta al cliente (10:24)
//   **Luis Pérez**
//   Revisar el presupuesto (22:15)
//
// El parser es tolerante: si el formato cambia a una lista plana, igual
// produce un item por línea con assignee=null.

interface ParsedActionItem {
  assignee: string | null;
  text: string;
  /** Segundos desde el inicio de la grabación, si el item traía timestamp. */
  timestampSec: number | null;
}

function hmsToSeconds(hms: string): number {
  const parts = hms.split(":").map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

function parseActionItems(raw: string | null): ParsedActionItem[] {
  if (!raw) return [];
  const items: ParsedActionItem[] = [];
  let currentAssignee: string | null = null;

  for (const rawLine of raw.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    // Header de responsable: "**Nombre**" (o "**Nombre**:") en su propia línea.
    const bold = line.match(/^\*\*(.+?)\*\*:?$/);
    if (bold) {
      currentAssignee = bold[1].trim();
      continue;
    }

    // Header sin bold: "Nombre:" corto, sin más texto en la línea.
    const colon = line.match(/^([^:]{1,40}):$/);
    if (colon) {
      currentAssignee = colon[1].trim();
      continue;
    }

    // Item de acción: quitar viñeta inicial y extraer timestamp final.
    let text = line.replace(/^[-*•·]\s*/, "").trim();
    let timestampSec: number | null = null;
    const ts = text.match(/\((\d{1,2}:\d{2}(?::\d{2})?)\)\s*$/);
    if (ts) {
      timestampSec = hmsToSeconds(ts[1]);
      text = text.slice(0, ts.index).trim();
    }
    text = text.replace(/\*\*/g, "").trim();
    if (!text) continue;

    items.push({ assignee: currentAssignee, text, timestampSec });
  }

  return items;
}

// =============================================================
// Helpers de fecha / formato
// =============================================================

function formatMeetingDate(ms: number | null): string | null {
  if (!ms) return null;
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: TZ,
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(ms));
}

/**
 * Fecha de entrega tentativa = fecha de la reunión (o hoy si falta) + offset
 * días, clampeado a [0, MAX_DEADLINE_DAYS]. Devuelve "YYYY-MM-DD" en TZ MX
 * (formato que Odoo espera para un campo Date).
 */
function computeDeadline(meetingMs: number | null, offsetDays: number): string {
  const base = meetingMs ?? Date.now();
  const days = Math.min(
    Math.max(Math.round(Number.isFinite(offsetDays) ? offsetDays : DEFAULT_DEADLINE_DAYS), 0),
    MAX_DEADLINE_DAYS
  );
  const ms = base + days * 86_400_000;
  // en-CA formatea como YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

interface DescriptionParts {
  item: ParsedActionItem;
  t: FirefliesTranscript;
  dateStr: string | null;
  deadline: string;
  routedTo: "project" | "inbox" | "private";
  projectLabel: string;
  confidence: number | null;
  reasoning: string | null;
  aiDegraded: boolean;
}

function buildTaskDescription(d: DescriptionParts): string {
  const parts: string[] = [];
  parts.push(
    `<p><strong>Reunión:</strong> ${escapeHtml(d.t.title ?? "(sin título)")}` +
      (d.dateStr ? ` — ${escapeHtml(d.dateStr)}` : "") +
      `</p>`
  );
  parts.push(
    `<p><strong>Responsable (Fireflies):</strong> ${escapeHtml(
      d.item.assignee ?? "—"
    )}</p>`
  );
  parts.push(
    `<p><strong>Entrega tentativa:</strong> ${escapeHtml(d.deadline)}</p>`
  );

  // Clasificación de la IA.
  if (d.aiDegraded) {
    parts.push(
      `<p><strong>Clasificación:</strong> IA no disponible — enviado a ` +
        `${escapeHtml(d.projectLabel)} para clasificar a mano.</p>`
    );
  } else if (d.routedTo === "project") {
    const conf =
      d.confidence != null ? ` (confianza ${Math.round(d.confidence * 100)}%)` : "";
    parts.push(
      `<p><strong>Proyecto (IA):</strong> ${escapeHtml(d.projectLabel)}${conf}` +
        (d.reasoning ? ` — ${escapeHtml(d.reasoning)}` : "") +
        `</p>`
    );
  } else {
    parts.push(
      `<p><strong>Sin proyecto con confianza</strong> → ${escapeHtml(
        d.projectLabel
      )}` +
        (d.reasoning ? ` (IA: ${escapeHtml(d.reasoning)})` : "") +
        `</p>`
    );
  }

  parts.push(
    `<p><strong>Action item original:</strong> ${escapeHtml(d.item.text)}</p>`
  );

  if (d.t.transcript_url) {
    const url =
      d.item.timestampSec != null
        ? `${d.t.transcript_url}?t=${d.item.timestampSec}`
        : d.t.transcript_url;
    const label =
      d.item.timestampSec != null
        ? `Ver momento (${Math.floor(d.item.timestampSec / 60)}:${String(
            d.item.timestampSec % 60
          ).padStart(2, "0")})`
        : "Ver transcript";
    parts.push(`<p><a href="${escapeHtml(url)}">${escapeHtml(label)}</a></p>`);
  }
  if (d.t.meeting_link) {
    parts.push(
      `<p><a href="${escapeHtml(d.t.meeting_link)}">Link de la reunión</a></p>`
    );
  }
  return parts.join("");
}

// =============================================================
// Cliente Odoo VADAI (tenant interno — credenciales ODOO_VADAI_*)
// =============================================================

function createVadaiOdooClient(): OdooClient {
  const url = process.env.ODOO_VADAI_URL;
  const db = process.env.ODOO_VADAI_DB;
  const user = process.env.ODOO_VADAI_USER;
  const apiKey = process.env.ODOO_VADAI_API_KEY;
  if (!url || !db || !user || !apiKey) {
    throw new Error(
      "fireflies-alex-transcript requires ODOO_VADAI_URL, ODOO_VADAI_DB, " +
        "ODOO_VADAI_USER, ODOO_VADAI_API_KEY env vars"
    );
  }
  return createOdooClientFromConfig({ url, db, user, apiKey });
}

/** Proyectos candidatos: los "LEVANTIA - <cliente>" activos. */
async function fetchLevantiaProjects(
  odoo: OdooClient
): Promise<CandidateProject[]> {
  const match = process.env.FIREFLIES_LEVANTIA_MATCH || "LEVANTIA";
  return odoo.executeKw<CandidateProject[]>(
    "project.project",
    "search_read",
    [
      [
        ["name", "ilike", match],
        ["active", "=", true],
      ],
    ],
    { fields: ["id", "name"], order: "name asc" }
  );
}

/** Proyecto Inbox de triage (por nombre). null si no existe. */
async function resolveInboxProjectId(
  odoo: OdooClient
): Promise<number | null> {
  const name = process.env.FIREFLIES_INBOX_PROJECT || "Inbox";
  const found = await odoo.executeKw<Array<{ id: number }>>(
    "project.project",
    "search_read",
    [[["name", "=", name]]],
    { fields: ["id"], limit: 1 }
  );
  return found.length > 0 ? found[0].id : null;
}

async function findOrCreateTag(
  odoo: OdooClient,
  name: string
): Promise<number> {
  const found = await odoo.executeKw<Array<{ id: number }>>(
    "project.tags",
    "search_read",
    [[["name", "=", name]]],
    { fields: ["id"], limit: 1 }
  );
  if (found.length > 0) return found[0].id;
  return odoo.executeKw<number>("project.tags", "create", [{ name }]);
}

/** Tasks que ya llevan el tag de este meeting (en cualquier proyecto). */
async function tasksWithTag(
  odoo: OdooClient,
  tagId: number
): Promise<number[]> {
  const found = await odoo.executeKw<Array<{ id: number }>>(
    "project.task",
    "search_read",
    [[["tag_ids", "in", [tagId]]]],
    { fields: ["id"] }
  );
  return found.map((t) => t.id);
}

async function searchUserIdByEmail(
  odoo: OdooClient,
  email: string
): Promise<number | null> {
  const found = await odoo.executeKw<Array<{ id: number }>>(
    "res.users",
    "search_read",
    [
      [
        "|",
        ["login", "=ilike", email],
        ["partner_id.email", "=ilike", email],
      ],
    ],
    { fields: ["id"], limit: 1 }
  );
  return found.length > 0 ? found[0].id : null;
}

/**
 * Resuelve el responsable de un action item a un res.users de Odoo.
 *   1. Si el nombre matchea un attendee → busca por su email.
 *   2. Si no, busca res.users por `name ilike`.
 *   3. Si nada matchea → null (el caller cae al fallback).
 * Cachea por nombre dentro de la ejecución.
 */
async function resolveUserId(
  odoo: OdooClient,
  assignee: string | null,
  attendeeEmailByName: Map<string, string>,
  cache: Map<string, number | null>
): Promise<number | null> {
  if (!assignee) return null;
  const key = assignee.toLowerCase();
  if (cache.has(key)) return cache.get(key) ?? null;

  let userId: number | null = null;

  const email = attendeeEmailByName.get(key);
  if (email) {
    userId = await searchUserIdByEmail(odoo, email);
  }

  if (userId == null) {
    const found = await odoo.executeKw<Array<{ id: number }>>(
      "res.users",
      "search_read",
      [[["name", "ilike", assignee]]],
      { fields: ["id"], limit: 1 }
    );
    if (found.length > 0) userId = found[0].id;
  }

  cache.set(key, userId);
  return userId;
}

/**
 * Usuario fallback para items sin responsable identificable.
 * `FIREFLIES_FALLBACK_USER_EMAIL` si está set y resuelve; si no, el uid del
 * usuario de la API (ODOO_VADAI_USER).
 */
async function resolveFallbackUserId(odoo: OdooClient): Promise<number> {
  const email = process.env.FIREFLIES_FALLBACK_USER_EMAIL;
  if (email) {
    const id = await searchUserIdByEmail(odoo, email);
    if (id != null) return id;
  }
  return odoo.authenticate();
}

// =============================================================
// Handler
// =============================================================

interface CreatedTask {
  task_id: number;
  title: string;
  original_text: string;
  assignee: string | null;
  user_id: number;
  matched_user: boolean;
  routed_to: "project" | "inbox" | "private";
  project_id: number | false;
  project_label: string;
  date_deadline: string;
  confidence: number | null;
}

interface FailedTask {
  text: string;
  error: string;
}

export const handler: WebhookHandler<Payload> = {
  slug: "fireflies-alex-transcript",
  description:
    "Webhook de Fireflies: guarda el resumen de la reunión y, con un agente " +
    "OpenAI, clasifica cada action item dentro de los proyectos " +
    "'LEVANTIA - <cliente>' del Odoo de VADAI, redacta un título claro y " +
    "propone una fecha de entrega. Lo no clasificable va a Inbox.",
  schema: PayloadSchema,

  // Reintentos de Fireflies sobre el mismo meeting → skipped_duplicate.
  getIdempotencyKey: (p) => p.meetingId,

  async process(payload, ctx): Promise<HandlerResult> {
    await ctx.logger.step("handler_start", "info", null, {
      meeting_id: payload.meetingId,
      event_type: payload.eventType ?? null,
    });

    // Solo procesamos eventos de transcripción completa.
    if (payload.eventType && !/transcription/i.test(payload.eventType)) {
      await ctx.logger.step(
        "evento_ignorado",
        "warn",
        `eventType '${payload.eventType}' no es de transcripción — skip`,
        { event_type: payload.eventType }
      );
      return {
        summary: { skipped: true, event_type: payload.eventType },
        warning: true,
      };
    }

    // 1. Traer transcript + summary desde Fireflies.
    const ff = createFirefliesClient();
    const t = await ff.getTranscript(payload.meetingId);
    const dateStr = formatMeetingDate(t.date);
    await ctx.logger.step("fireflies_fetched", "success", t.title ?? null, {
      title: t.title,
      date: dateStr,
      duration_min: t.duration,
      participants: t.participants?.length ?? 0,
    });

    // 2. Parsear action items.
    const rawActionItems = t.summary?.action_items ?? null;
    const items = parseActionItems(rawActionItems);
    await ctx.logger.step(
      "action_items_parsed",
      "info",
      `${items.length} action items`,
      { count: items.length }
    );

    // 3. Odoo: tag de idempotencia + chequeo de duplicados.
    const odoo = createVadaiOdooClient();
    const tagName = `FF:${payload.meetingId}`;
    const tagId = await findOrCreateTag(odoo, tagName);

    const existing = await tasksWithTag(odoo, tagId);
    if (existing.length > 0) {
      await ctx.logger.step(
        "odoo_dup_check",
        "warn",
        `Ya existen ${existing.length} tasks para este meeting`,
        { task_ids: existing }
      );
      return {
        summary: {
          meeting_id: payload.meetingId,
          title: t.title,
          skipped_existing_tasks: existing,
        },
        warning: true,
      };
    }

    // Sin action items: cerramos en completed con 0 tareas.
    const baseSummary: Record<string, unknown> = {
      meeting_id: payload.meetingId,
      title: t.title,
      date: t.date ? new Date(t.date).toISOString() : null,
      date_legible: dateStr,
      duration_min: t.duration,
      meeting_link: t.meeting_link,
      transcript_url: t.transcript_url,
      organizer_email: t.organizer_email ?? t.host_email,
      participants: t.participants ?? [],
      overview: t.summary?.overview ?? null,
      keywords: t.summary?.keywords ?? null,
      bullet_gist: t.summary?.bullet_gist ?? null,
      action_items_raw: rawActionItems,
      odoo_tag: tagName,
    };

    if (items.length === 0) {
      await ctx.logger.step(
        "sin_action_items",
        "info",
        "La reunión no generó action items"
      );
      return {
        summary: { ...baseSummary, tasks_created: [], tasks_failed: [] },
      };
    }

    // 4. Contexto Odoo: proyectos LEVANTIA candidatos + Inbox.
    const candidates = await fetchLevantiaProjects(odoo);
    const candidateById = new Map(candidates.map((c) => [c.id, c.name]));
    const inboxId = await resolveInboxProjectId(odoo);
    await ctx.logger.step(
      "odoo_contexto",
      candidates.length > 0 ? "success" : "warn",
      `${candidates.length} proyectos LEVANTIA candidatos`,
      {
        candidates: candidates.map((c) => c.name),
        inbox_project_id: inboxId,
      }
    );

    // Attendees → contexto para la IA y mapa nombre→email para responsables.
    const attendeeEmailByName = new Map<string, string>();
    const attendees: string[] = [];
    for (const a of t.meeting_attendees ?? []) {
      if (a.displayName) attendees.push(a.displayName);
      else if (a.email) attendees.push(a.email);
      if (a.displayName && a.email) {
        attendeeEmailByName.set(a.displayName.toLowerCase(), a.email);
      }
    }
    if (attendees.length === 0 && t.participants) {
      attendees.push(...t.participants);
    }

    // 5. Clasificar con OpenAI. Si falta la API key → failed (reintentable).
    //    Si OpenAI cae en runtime → modo degradado (todo a Inbox).
    const classifications = new Map<number, AIClassification>();
    let aiDegraded = false;
    let aiError: string | null = null;
    try {
      const openai = createOpenAIClient();
      const results = await openai.classifyActionItems({
        meeting: {
          title: t.title,
          date: dateStr,
          overview: t.summary?.overview ?? null,
          attendees,
        },
        candidateProjects: candidates,
        actionItems: items.map((it, index) => ({
          index,
          assignee: it.assignee,
          text: it.text,
        })),
      });
      for (const r of results) classifications.set(r.index, r);
      await ctx.logger.step(
        "ai_classified",
        "success",
        `${results.length} items clasificados`,
        { count: results.length }
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Falta de credenciales = misconfig → propagamos como failed.
      if (msg.includes("OPENAI_API_KEY")) throw err;
      aiDegraded = true;
      aiError = msg;
      await ctx.logger.step(
        "ai_degraded",
        "warn",
        `OpenAI falló — modo degradado, todo a Inbox: ${msg}`
      );
    }

    const fallbackUserId = await resolveFallbackUserId(odoo);
    const userCache = new Map<string, number | null>();

    // 6. Crear una task por action item.
    const created: CreatedTask[] = [];
    const failed: FailedTask[] = [];

    for (const [index, item] of items.entries()) {
      try {
        const cls = classifications.get(index);

        // Resolver proyecto destino.
        const aiProjectId = cls?.project_id ?? null;
        const confident =
          aiProjectId != null &&
          candidateById.has(aiProjectId) &&
          (cls?.confidence ?? 0) >= CONFIDENCE_THRESHOLD;

        let projectId: number | false;
        let routedTo: CreatedTask["routed_to"];
        let projectLabel: string;
        if (confident) {
          projectId = aiProjectId as number;
          routedTo = "project";
          projectLabel = candidateById.get(projectId) ?? `#${projectId}`;
        } else if (inboxId != null) {
          projectId = inboxId;
          routedTo = "inbox";
          projectLabel = process.env.FIREFLIES_INBOX_PROJECT || "Inbox";
        } else {
          projectId = false;
          routedTo = "private";
          projectLabel = "Tarea privada (sin proyecto)";
        }

        const title = (cls?.title?.trim() || item.text).slice(0, 250);
        const deadline = computeDeadline(
          t.date,
          cls?.deadline_offset_days ?? DEFAULT_DEADLINE_DAYS
        );

        const matchedUserId = await resolveUserId(
          odoo,
          item.assignee,
          attendeeEmailByName,
          userCache
        );
        const userId = matchedUserId ?? fallbackUserId;

        const vals: Record<string, unknown> = {
          name: title,
          user_ids: [[6, 0, [userId]]],
          tag_ids: [[6, 0, [tagId]]],
          date_deadline: deadline,
          description: buildTaskDescription({
            item,
            t,
            dateStr,
            deadline,
            routedTo,
            projectLabel,
            confidence: cls?.confidence ?? null,
            reasoning: cls?.reasoning ?? null,
            aiDegraded,
          }),
        };
        if (projectId !== false) vals.project_id = projectId;

        const taskId = await odoo.executeKw<number>("project.task", "create", [
          vals,
        ]);

        created.push({
          task_id: taskId,
          title,
          original_text: item.text,
          assignee: item.assignee,
          user_id: userId,
          matched_user: matchedUserId != null,
          routed_to: routedTo,
          project_id: projectId,
          project_label: projectLabel,
          date_deadline: deadline,
          confidence: cls?.confidence ?? null,
        });
        await ctx.logger.step(
          "task_created",
          routedTo === "project" ? "success" : "warn",
          `${title} → ${projectLabel}`,
          {
            task_id: taskId,
            routed_to: routedTo,
            project_id: projectId,
            date_deadline: deadline,
            assignee: item.assignee,
            user_id: userId,
            confidence: cls?.confidence ?? null,
          }
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        failed.push({ text: item.text, error: msg });
        await ctx.logger.step("task_failed", "error", msg, {
          text: item.text,
        });
      }
    }

    const summary: Record<string, unknown> = {
      ...baseSummary,
      ai_degraded: aiDegraded,
      ai_error: aiError,
      levantia_candidates: candidates,
      inbox_project_id: inboxId,
      total_action_items: items.length,
      tasks_created: created,
      tasks_failed: failed,
    };

    // Todos los items fallaron al crear → failed (reintentable).
    if (created.length === 0) {
      throw new Error(
        `Todos los ${items.length} action items fallaron al crear en Odoo: ` +
          failed.map((f) => f.error).join(" | ")
      );
    }

    // Warning si: hubo fallos, la IA cayó, o no había proyectos LEVANTIA
    // (todo terminó en Inbox y conviene que Alex lo note).
    const warning =
      failed.length > 0 || aiDegraded || candidates.length === 0;
    return { summary, warning };
  },
};
