"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { drainSkipped, stopDraining } from "@/lib/reprocess";
import { createClient } from "@/lib/supabase/server";
import {
  WEBHOOK_CONFIG_STATUSES,
  type WebhookConfigStatus,
} from "@/types/webhook";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const RESERVED_SLUGS = new Set(["new", "admin", "docs"]);

function generateToken(): string {
  return "wh_" + crypto.randomUUID().replace(/-/g, "");
}

export async function createWebhook(formData: FormData) {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  const clientName = String(formData.get("client_name") ?? "").trim() || null;
  const description =
    String(formData.get("description") ?? "").trim() || null;
  const slugInput = String(formData.get("slug") ?? "").trim();

  if (!name) {
    redirect("/dashboard/new?error=name");
  }

  const slug = slugify(slugInput || name);
  if (!slug) {
    redirect("/dashboard/new?error=slug");
  }
  // Rutas estáticas bajo /dashboard: un webhook con estos slugs quedaría
  // tapado por ellas y su detalle sería inalcanzable.
  if (RESERVED_SLUGS.has(slug)) {
    redirect("/dashboard/new?error=slug-taken");
  }

  const token = generateToken();

  const { error } = await sb
    .from("vw_configs")
    .insert({
      slug,
      token,
      name,
      client_name: clientName,
      description,
      handler_slug: slug,
      status: "pending_handler",
      created_by: user.id,
    })
    .select("slug")
    .single();

  if (error) {
    console.error("[createWebhook]", error);
    if (error.code === "23505") {
      // unique_violation (slug or token collision)
      redirect("/dashboard/new?error=slug-taken");
    }
    redirect("/dashboard/new?error=insert");
  }

  revalidatePath("/dashboard");
  redirect(`/dashboard/${slug}?created=1`);
}

export async function updateWebhookStatus(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const nextStatus = String(formData.get("status") ?? "") as WebhookConfigStatus;

  if (!slug) throw new Error("Missing slug");
  if (!WEBHOOK_CONFIG_STATUSES.includes(nextStatus)) {
    throw new Error(`Invalid status: ${nextStatus}`);
  }

  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await sb
    .from("vw_configs")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("slug", slug);

  if (error) {
    console.error("[updateWebhookStatus]", error);
    throw new Error("Failed to update status");
  }

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/${slug}`);
}

/**
 * Arranca en background el drenado de ejecuciones `skipped_paused`.
 * `limit` opcional para probar con pocas antes de soltar todo.
 */
export async function reprocessSkipped(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const limitRaw = Number(formData.get("limit") ?? 0);
  if (!slug) throw new Error("Missing slug");

  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");

  // Leído con la sesión del usuario: si no está en la allowlist, RLS no
  // devuelve el config y no arrancamos nada.
  const { data: config } = await sb
    .from("vw_configs")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (!config) throw new Error(`Webhook not found: ${slug}`);

  after(async () => {
    try {
      await drainSkipped(config, limitRaw > 0 ? limitRaw : undefined);
    } catch (e) {
      console.error("[drainSkipped] uncaught", e);
    }
  });

  revalidatePath(`/dashboard/${slug}`);
}

export async function stopReprocess(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  if (!slug) throw new Error("Missing slug");

  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");

  // Mismo gate de allowlist vía RLS que reprocessSkipped.
  const { data: config } = await sb
    .from("vw_configs")
    .select("slug")
    .eq("slug", slug)
    .maybeSingle();
  if (!config) throw new Error(`Webhook not found: ${slug}`);

  stopDraining(slug);
  revalidatePath(`/dashboard/${slug}`);
}

export async function signOut() {
  const sb = await createClient();
  await sb.auth.signOut();
  redirect("/login");
}
