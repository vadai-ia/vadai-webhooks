import { NextResponse, after, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { runHandler } from "@/lib/webhook-runner";
import type { WebhookExecutionStatus } from "@/types/webhook";

export const dynamic = "force-dynamic";

/**
 * Endpoint universal de ingestión.
 *
 *   POST /in/[token]
 *
 * - 404 si el token no existe
 * - 410 si el webhook está archivado
 * - 400 si el body no es JSON válido
 * - 200 + { ok, execution_id, status } en cualquier otro caso
 *
 * Si el config está active, dispara `runHandler` en background con `after()`
 * para responder inmediato al cliente externo y procesar después.
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

  // 6. Si está active, procesar en background — respondemos ya
  if (config.status === "active") {
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
