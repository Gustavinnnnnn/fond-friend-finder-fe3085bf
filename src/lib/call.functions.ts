import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

// Public data only: returns signed media URLs for the private media bucket.
export const getCallSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("settings")
    .select(
      "model_name, model_photo_url, video_url, free_duration_seconds, price_cents, offer_title, offer_subtitle, contact_url",
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
    const { data: signed, error: signError } = await supabaseAdmin.storage
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
  .inputValidator((data: { consent: boolean }) =>
    z.object({ consent: z.boolean() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userAgent = getRequestHeader("user-agent") ?? null;
    const cf = getRequestHeader("cf-connecting-ip");
    const fwd = getRequestHeader("x-forwarded-for");
    const real = getRequestHeader("x-real-ip");
    const ip = cf || fwd?.split(",")[0]?.trim() || real || null;
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

    const { data: row, error } = await supabaseAdmin
      .from("call_sessions")
      .insert({
        status: "started",
        user_agent: userAgent,
        ip,
        consent_recording: data.consent,
        geo_city: geo?.city ?? null,
        geo_region: geo?.region ?? null,
        geo_country: geo?.country ?? null,
        geo_lat: geo?.lat ?? null,
        geo_lng: geo?.lng ?? null,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return { sessionId: row.id as string };
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("call_sessions")
      .update({
        geo_lat: data.lat,
        geo_lng: data.lng,
        geo_accuracy: data.accuracy,
      })
      .eq("id", data.sessionId);
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cleanExt = data.ext.replace(/[^a-z0-9]/gi, "") || "webm";
    const path = `recordings/${data.sessionId}-${Date.now()}.${cleanExt}`;
    const { data: signed, error } = await supabaseAdmin.storage
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("call_sessions")
      .update({ recording_path: data.path })
      .eq("id", data.sessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


// ---------- Mark free call ended ----------
export const endFreeCall = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionId: string }) =>
    z.object({ sessionId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("call_sessions")
      .update({ status: "free_ended", free_ended_at: new Date().toISOString() })
      .eq("id", data.sessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Mark call completed ----------
export const completeCall = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionId: string }) =>
    z.object({ sessionId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("call_sessions")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", data.sessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Create Pix Payment ----------
export const createPixPayment = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionId: string }) =>
    z.object({ sessionId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Read price from settings
    const { data: settings, error: sErr } = await supabaseAdmin
      .from("settings")
      .select("price_cents")
      .eq("id", 1)
      .single();
    if (sErr) throw new Error(sErr.message);
    const amountCents = settings.price_cents ?? 3000;
    const amountReais = amountCents / 100;

    const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;

    // If Mercado Pago is not configured, return a placeholder record
    if (!token) {
      const { data: payment, error: pErr } = await supabaseAdmin
        .from("payments")
        .insert({
          session_id: data.sessionId,
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
      };
    }

    // Call Mercado Pago Pix API
    const idempotencyKey = crypto.randomUUID();
    const res = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        transaction_amount: Number(amountReais.toFixed(2)),
        description: "Continuar chamada de vídeo",
        payment_method_id: "pix",
        payer: {
          email: `lead-${data.sessionId.slice(0, 8)}@call.app`,
          first_name: "Lead",
          last_name: "Call",
        },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("Mercado Pago create error", res.status, errBody);
      throw new Error(`Falha ao gerar Pix (${res.status})`);
    }

    const mp = (await res.json()) as {
      id: number;
      status: string;
      point_of_interaction?: {
        transaction_data?: {
          qr_code?: string;
          qr_code_base64?: string;
          ticket_url?: string;
        };
      };
    };
    const tx = mp.point_of_interaction?.transaction_data ?? {};

    const { data: payment, error: pErr } = await supabaseAdmin
      .from("payments")
      .insert({
        session_id: data.sessionId,
        provider: "mercadopago",
        provider_payment_id: String(mp.id),
        amount_cents: amountCents,
        status: mp.status ?? "pending",
        qr_code: tx.qr_code ?? null,
        qr_code_base64: tx.qr_code_base64 ?? null,
        ticket_url: tx.ticket_url ?? null,
      })
      .select("id")
      .single();
    if (pErr) throw new Error(pErr.message);

    return {
      configured: true as const,
      paymentId: payment.id as string,
      amountCents,
      qrCode: tx.qr_code ?? "",
      qrCodeBase64: tx.qr_code_base64 ?? "",
      ticketUrl: tx.ticket_url ?? "",
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

    // Already approved locally
    if (payment.status === "approved") {
      return { status: "approved" as const };
    }

    const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!token || !payment.provider_payment_id) {
      return { status: payment.status };
    }

    // Ask MP for current status
    const res = await fetch(
      `https://api.mercadopago.com/v1/payments/${payment.provider_payment_id}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      const err = await res.text();
      console.error("MP get error", res.status, err);
      return { status: payment.status };
    }
    const mp = (await res.json()) as { status: string };

    if (mp.status !== payment.status) {
      await supabaseAdmin
        .from("payments")
        .update({ status: mp.status })
        .eq("id", payment.id);

      if (mp.status === "approved" && payment.session_id) {
        await supabaseAdmin
          .from("call_sessions")
          .update({ status: "paid", paid_at: new Date().toISOString(), has_paid: true })
          .eq("id", payment.session_id);
      }
    }

    return { status: mp.status };
  });
