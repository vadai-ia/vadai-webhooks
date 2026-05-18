import { NextResponse, after, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { runHandler } from "@/lib/webhook-runner";
import type { WebhookExecutionStatus } from "@/types/webhook";

export const dynamic = "force-dynamic";

/**
 * Endpoint universal de ingestión.
 *
 *   POST /in/[token]
 *   POST /in/[token]?sync=1
 *
 * - 404 si el token no existe
 * - 410 si el webhook está archivado
 * - 400 si el body no es JSON válido
 * - 200 + { ok, execution_id, status } en async (default)
 * - 200 + { ok, execution_id, status, result, error? } en sync
 *
 * Modos:
 *   - Async (default): si está active, dispara `runHandler` en background
 *     con `after()` y responde el ack al toque. Pensado para integraciones
 *     fire-and-forget tipo POS donde quien dispara no necesita la salida.
 *   - Sync (`?sync=1`): espera al handler y devuelve el `result_summary`
 *     en el response. Pensado para flujos N8N/Make donde los pasos
 *     siguientes consumen la salida del handler.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const sb = createServiceRoleClient();

  // 1. Lookup config
  const { data: config, error: lookupErr } = await sb
    .from("vw_configs")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (lookupErr) {
    console.error("[/in/:token] lookup error", lookupErr);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
  if (!config) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }
  if (config.status === "archived") {
    return NextResponse.json({ error: "Gone" }, { status: 410 });
  }

  // 2. Capturar payload
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // 3. Metadata del request
  const headers = Object.fromEntries(req.headers);
  const sourceIP =
    headers["x-forwarded-for"]?.split(",")[0]?.trim() ??
    headers["x-real-ip"] ??
    null;
  const payloadStr = JSON.stringify(payload);

  // 4. Status inicial según el config
  const initialStatus: WebhookExecutionStatus =
    config.status === "paused"
      ? "skipped_paused"
      : config.status === "pending_handler"
      ? "pending"
      : "received";

  // 5. Insertar la ejecución
  const { data: exec, error: insertErr } = await sb
    .from("vw_executions")
    .insert({
      webhook_config_id: config.id,
      webhook_slug: config.slug,
      payload: payload as never, // JSONB acepta cualquier JSON serializable
      headers,
      source_ip: sourceIP,
      user_agent: headers["user-agent"] ?? null,
      payload_size_bytes: payloadStr.length,
      status: initialStatus,
    })
    .select("id")
    .single();

  if (insertErr || !exec) {
    console.error("[/in/:token] insert failed", insertErr);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }

  // 6. ¿Sync o async?
  // `?sync=1` (o sync=true) hace que esperemos al handler y devolvamos
  // el result_summary. Si el config no está active no hay nada que esperar.
  const syncParam = req.nextUrl.searchParams.get("sync");
  const wantsSync = syncParam === "1" || syncParam === "true";

  if (config.status === "active") {
    if (wantsSync) {
      try {
        await runHandler(exec.id, config);
      } catch (e) {
        console.error("[runHandler] uncaught (sync)", e);
      }

      // Releemos la row: runHandler ya persistió status/result_summary/error.
      const { data: finalRow } = await sb
        .from("vw_executions")
        .select("status, result_summary, error_message")
        .eq("id", exec.id)
        .single();

      return NextResponse.json(
        {
          ok: finalRow?.status === "completed" ||
              finalRow?.status === "completed_with_warning" ||
              finalRow?.status === "skipped_duplicate",
          execution_id: exec.id,
          status: finalRow?.status ?? "unknown",
          result: finalRow?.result_summary ?? null,
          error: finalRow?.error_message ?? null,
        },
        { status: 200 }
      );
    }

    after(async () => {
      try {
        await runHandler(exec.id, config);
      } catch (e) {
        console.error("[runHandler] uncaught", e);
      }
    });
  }

  return NextResponse.json(
    { ok: true, execution_id: exec.id, status: initialStatus },
    { status: 200 }
  );
}
