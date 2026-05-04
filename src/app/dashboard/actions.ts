"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
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

export async function signOut() {
  const sb = await createClient();
  await sb.auth.signOut();
  redirect("/login");
}
