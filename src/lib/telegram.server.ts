// Server-only helper for Telegram dispatches. Never import in client code.
import { createHash } from "crypto";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not configured`);
  return v;
}

export function deriveTelegramWebhookSecret(telegramApiKey: string): string {
  return createHash("sha256")
    .update(`telegram-webhook:${telegramApiKey}`)
    .digest("base64url");
}

export async function tgCall<T = unknown>(
  method: string,
  body: Record<string, unknown>,
): Promise<T> {
  const LOVABLE_API_KEY = requireEnv("LOVABLE_API_KEY");
  const TELEGRAM_API_KEY = requireEnv("TELEGRAM_API_KEY");
  const res = await fetch(`${GATEWAY_URL}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TELEGRAM_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Telegram ${method} failed [${res.status}]: ${text}`);
    throw new Error(`Telegram ${method} failed: ${text}`);
  }
  const json = JSON.parse(text) as { ok: boolean; result?: T; description?: string };
  if (!json.ok) {
    console.error(`Telegram ${method} !ok: ${json.description}`);
    throw new Error(json.description ?? `Telegram ${method} failed`);
  }
  return json.result as T;
}

export type DispatchReason = "hangup" | "no_payment" | "post_payment";

type SessionRow = {
  id: string;
  recording_path: string | null;
  geo_city: string | null;
  geo_region: string | null;
  geo_country: string | null;
  geo_lat: number | null;
  geo_lng: number | null;
  telegram_chat_id: number | null;
  phone: string | null;
};

type SettingsRow = {
  model_name: string;
  telegram_purchase_url: string | null;
  dispatch_copy_hangup: string;
  dispatch_copy_no_payment: string;
  dispatch_copy_post_payment: string;
  start_photo_url: string | null;
  start_video_url: string | null;
  start_message: string;
  start_button_text: string;
  mini_app_url: string | null;
};

async function signedUrl(path: string, expiresSec: number): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.storage.from("media").createSignedUrl(path, expiresSec);
  if (error) return null;
  return data.signedUrl;
}

function copyFor(reason: DispatchReason, settings: SettingsRow): string {
  if (reason === "hangup") return settings.dispatch_copy_hangup;
  if (reason === "no_payment") return settings.dispatch_copy_no_payment;
  return settings.dispatch_copy_post_payment;
}

function sentColumnFor(reason: DispatchReason): string {
  if (reason === "hangup") return "dispatch_hangup_sent_at";
  if (reason === "no_payment") return "dispatch_no_payment_sent_at";
  return "dispatch_post_payment_sent_at";
}

export async function dispatchToLead(
  sessionId: string,
  reason: DispatchReason,
): Promise<{ ok: boolean; reason?: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: session, error: sErr } = await supabaseAdmin
    .from("call_sessions")
    .select(
      "id, recording_path, geo_city, geo_region, geo_country, geo_lat, geo_lng, telegram_chat_id, phone",
    )
    .eq("id", sessionId)
    .single<SessionRow>();
  if (sErr || !session) return { ok: false, reason: "sessão não encontrada" };
  if (!session.telegram_chat_id) return { ok: false, reason: "lead sem telegram_chat_id" };

  const { data: settings, error: setErr } = await supabaseAdmin
    .from("settings")
    .select(
      "model_name, telegram_purchase_url, dispatch_copy_hangup, dispatch_copy_no_payment, dispatch_copy_post_payment, start_photo_url, start_video_url, start_message, start_button_text, mini_app_url",
    )
    .eq("id", 1)
    .single<SettingsRow>();
  if (setErr || !settings) return { ok: false, reason: "configurações não encontradas" };

  const chatId = session.telegram_chat_id;
  const purchaseUrl = settings.telegram_purchase_url?.trim() || "";

  const text = copyFor(reason, settings)
    .replaceAll("{cidade}", session.geo_city ?? "sua cidade")
    .replaceAll("{estado}", session.geo_region ?? "")
    .replaceAll("{pais}", session.geo_country ?? "")
    .replaceAll("{modelo}", settings.model_name ?? "")
    .replaceAll("{telefone}", session.phone ?? "")
    .replaceAll("{compra_link}", purchaseUrl);

  // 1. Send location (map pin, if we have coords)
  if (session.geo_lat != null && session.geo_lng != null) {
    try {
      await tgCall("sendLocation", {
        chat_id: chatId,
        latitude: session.geo_lat,
        longitude: session.geo_lng,
      });
    } catch (err) {
      console.warn("sendLocation failed", err);
    }
  }

  // 2. Send the actual recorded video as a Telegram video (not a link)
  if (session.recording_path) {
    const url = await signedUrl(session.recording_path, 60 * 60 * 24);
    if (url) {
      try {
        await tgCall("sendVideo", {
          chat_id: chatId,
          video: url,
          caption: `Gravação da chamada — ${session.geo_city ?? ""} ${session.geo_region ? "/ " + session.geo_region : ""}`.trim(),
          supports_streaming: true,
        });
      } catch (err) {
        console.warn("sendVideo failed, falling back to document", err);
        try {
          await tgCall("sendDocument", { chat_id: chatId, document: url });
        } catch (e2) {
          console.error("sendDocument fallback failed", e2);
        }
      }
    }
  }

  // 3. Main copy with purchase button
  const replyMarkup = purchaseUrl
    ? { inline_keyboard: [[{ text: "💳 Continuar minha compra", url: purchaseUrl }]] }
    : undefined;

  await tgCall("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });

  const now = new Date().toISOString();
  const patch: Record<string, string | null> = {
    telegram_sent_at: now,
    dispatch_scheduled_at: null,
    dispatch_reason: null,
  };
  patch[sentColumnFor(reason)] = now;
  await supabaseAdmin
    .from("call_sessions")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(patch as any)
    .eq("id", sessionId);

  return { ok: true };
}

// Called on /start: send welcome media + message + WebApp button to open the call
export async function sendStartWelcome(chatId: number): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: settings } = await supabaseAdmin
    .from("settings")
    .select("start_photo_url, start_video_url, start_message, start_button_text, mini_app_url")
    .eq("id", 1)
    .single<SettingsRow>();
  if (!settings) return;

  const resolveMedia = async (value: string | null): Promise<string | null> => {
    if (!value) return null;
    if (value.startsWith("http")) return value;
    return await signedUrl(value, 60 * 60 * 24);
  };

  const photo = await resolveMedia(settings.start_photo_url);
  const video = await resolveMedia(settings.start_video_url);

  if (photo) {
    try {
      await tgCall("sendPhoto", { chat_id: chatId, photo });
    } catch (err) {
      console.warn("sendPhoto (start) failed", err);
    }
  }

  if (video) {
    try {
      await tgCall("sendVideo", { chat_id: chatId, video, supports_streaming: true });
    } catch (err) {
      console.warn("sendVideo (start) failed", err);
    }
  }

  const miniAppUrl = settings.mini_app_url?.trim();
  const buttonText = settings.start_button_text?.trim() || "📞 Entrar na chamada";
  const message = settings.start_message?.trim() || "Bem-vindo(a)!";

  const replyMarkup = miniAppUrl
    ? { inline_keyboard: [[{ text: buttonText, web_app: { url: miniAppUrl } }]] }
    : undefined;

  await tgCall("sendMessage", {
    chat_id: chatId,
    text: message,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

export async function sendPlainMessage(chatId: number, text: string): Promise<void> {
  await tgCall("sendMessage", { chat_id: chatId, text });
}
