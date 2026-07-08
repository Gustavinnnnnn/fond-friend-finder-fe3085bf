import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- Dashboard stats ----------
export const getDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError) throw new Error(roleError.message);
    if (!isAdmin) throw new Error("Forbidden");
    const { data: sessions, error: sErr } = await context.supabase
      .from("call_sessions")
      .select(
        "id, status, created_at, free_ended_at, paid_at, completed_at, ip, user_agent, geo_lat, geo_lng, geo_accuracy, geo_city, geo_region, geo_country, consent_recording, recording_path, has_paid, telegram_chat_id, telegram_username, telegram_sent_at, phone, dispatch_hangup_sent_at, dispatch_no_payment_sent_at, dispatch_post_payment_sent_at, dispatch_scheduled_at, dispatch_reason",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (sErr) throw new Error(sErr.message);

    const { data: payments, error: pErr } = await context.supabase
      .from("payments")
      .select("id, session_id, amount_cents, status, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (pErr) throw new Error(pErr.message);

    const total = sessions?.length ?? 0;
    const answered = (sessions ?? []).filter(
      (s) => s.status !== "started" || s.free_ended_at,
    ).length;
    const paid = (sessions ?? []).filter((s) => s.has_paid).length;
    const unpaid = total - paid;
    const revenueCents = (payments ?? [])
      .filter((p) => p.status === "approved")
      .reduce((acc, p) => acc + (p.amount_cents ?? 0), 0);

    return {
      stats: { total, answered, paid, unpaid, revenueCents },
      sessions: sessions ?? [],
      payments: payments ?? [],
    };
  });

export const getAdminSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError) throw new Error(roleError.message);
    if (!isAdmin) throw new Error("Forbidden");
    const { data, error } = await context.supabase
      .from("settings")
      .select(
        "model_name, model_photo_url, video_url, free_duration_seconds, price_cents, dispatch_price_cents, offer_title, offer_subtitle, contact_url, telegram_bot_username, telegram_copy_template, telegram_purchase_url, start_photo_url, start_video_url, start_message, start_button_text, mini_app_url, dispatch_button_text, dispatch_copy_hangup, dispatch_copy_no_payment, dispatch_copy_post_payment, paradise_api_key, telegram_bot_token",
      )
      .eq("id", 1)
      .single();
    if (error) throw new Error(error.message);

    const signMedia = async (value: string | null) => {
      if (!value) return null;
      if (value.startsWith("http")) return value;
      const { data: signed, error: signError } = await context.supabase.storage
        .from("media")
        .createSignedUrl(value, 60 * 60 * 6);
      if (signError) return value;
      return signed.signedUrl;
    };

    return {
      ...data,
      model_photo_preview_url: await signMedia(data.model_photo_url),
      video_preview_url: await signMedia(data.video_url),
      start_photo_preview_url: await signMedia(data.start_photo_url),
      start_video_preview_url: await signMedia(data.start_video_url),
    };
  });

export const updateAdminSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        model_name: z.string().min(1).max(80),
        model_photo_url: z.string().nullable(),
        video_url: z.string().nullable(),
        free_duration_seconds: z.number().int().min(1).max(3600),
        price_cents: z.number().int().min(0).max(1000000),
        dispatch_price_cents: z.number().int().min(0).max(1000000),
        offer_title: z.string().min(1).max(120),
        offer_subtitle: z.string().min(1).max(240),
        contact_url: z.string().nullable(),
        telegram_bot_username: z.string().max(64).nullable(),
        telegram_purchase_url: z.string().max(500).nullable(),
        start_photo_url: z.string().nullable(),
        start_video_url: z.string().nullable(),
        start_message: z.string().min(1).max(4000),
        start_button_text: z.string().min(1).max(64),
        mini_app_url: z.string().max(500).nullable(),
        dispatch_button_text: z.string().min(1).max(64),
        dispatch_copy_hangup: z.string().min(1).max(4000),
        dispatch_copy_no_payment: z.string().min(1).max(4000),
        dispatch_copy_post_payment: z.string().min(1).max(4000),
        paradise_api_key: z.string().max(500).nullable(),
        telegram_bot_token: z.string().max(500).nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError) throw new Error(roleError.message);
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await context.supabase
      .from("settings")
      .update(data)
      .eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getAdminMediaUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { kind: "video" | "photo" | "start_photo" | "start_video"; ext: string }) =>
      z
        .object({
          kind: z.enum(["video", "photo", "start_photo", "start_video"]),
          ext: z.string().max(10),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError) throw new Error(roleError.message);
    if (!isAdmin) throw new Error("Forbidden");
    const isVideo = data.kind === "video" || data.kind === "start_video";
    const cleanExt = data.ext.replace(/[^a-z0-9]/gi, "") || (isVideo ? "mp4" : "jpg");
    const path = `${data.kind}/${Date.now()}-${crypto.randomUUID()}.${cleanExt}`;
    const { data: signed, error } = await context.supabase.storage
      .from("media")
      .createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, token: signed.token };
  });

// ---------- Signed URL to view a recording ----------
export const getRecordingUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { path: string }) =>
    z.object({ path: z.string() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError) throw new Error(roleError.message);
    if (!isAdmin) throw new Error("Forbidden");
    const { data: signed, error } = await context.supabase.storage
      .from("media")
      .createSignedUrl(data.path, 60 * 60);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });
