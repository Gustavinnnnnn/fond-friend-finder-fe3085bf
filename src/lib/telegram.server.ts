// Server-only helper for Telegram dispatches. Never import in client code.
import { createHash } from "crypto";
import { getTelegramBotToken } from "@/lib/runtime-credentials.server";

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
  const TELEGRAM_BOT_TOKEN = await getTelegramBotToken();
  if (TELEGRAM_BOT_TOKEN) {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
  dispatch_button_text: string;
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
  const { createBackendClient } = await import("@/lib/backend-public.server");
  const supabase = createBackendClient();
  const { data, error } = await supabase.storage.from("media").createSignedUrl(path, expiresSec);
  if (error) return null;
  return data.signedUrl;
}

function copyFor(reason: DispatchReason, settings: SettingsRow): string {
  if (reason === "hangup") return settings.dispatch_copy_hangup;
  if (reason === "no_payment") return settings.dispatch_copy_no_payment;
  return settings.dispatch_copy_post_payment;
}

export async function dispatchToLead(
  sessionId: string,
  reason: DispatchReason,
): Promise<{ ok: boolean; reason?: string }> {
  const { createBackendClient } = await import("@/lib/backend-public.server");
  const supabase = createBackendClient();

  const { data: rows, error: sErr } = await (supabase as any).rpc("app_get_dispatch_payload", {
    _session_id: sessionId,
    _reason: reason,
  });
  const payload = Array.isArray(rows) ? rows[0] : null;
  if (sErr || !payload) return { ok: false, reason: "sessão não encontrada" };
  const session: SessionRow = {
    id: payload.id,
    recording_path: payload.recording_path,
    geo_city: payload.geo_city,
    geo_region: payload.geo_region,
    geo_country: payload.geo_country,
    geo_lat: payload.geo_lat,
    geo_lng: payload.geo_lng,
    telegram_chat_id: payload.telegram_chat_id,
    phone: payload.phone,
  };
  if (!session.telegram_chat_id) return { ok: false, reason: "lead sem telegram_chat_id" };

  const settings: SettingsRow = {
    model_name: payload.model_name,
    dispatch_button_text: payload.dispatch_button_text,
    dispatch_copy_hangup: payload.dispatch_copy_hangup,
    dispatch_copy_no_payment: payload.dispatch_copy_no_payment,
    dispatch_copy_post_payment: payload.dispatch_copy_post_payment,
    start_photo_url: null,
    start_video_url: null,
    start_message: "",
    start_button_text: "",
    mini_app_url: payload.mini_app_url,
  };

  const chatId = session.telegram_chat_id;

  // Always use our own internal Pix checkout page instead of an external URL,
  // so the "Continuar minha compra" button opens QR + copia-e-cola directly.
  const explicitBase = process.env.APP_BASE_URL?.trim();
  const miniAppBase = (() => {
    if (!settings.mini_app_url) return null;
    try {
      return new URL(settings.mini_app_url).origin;
    } catch {
      return null;
    }
  })();
  const baseUrl = explicitBase || miniAppBase || "https://fond-friend-finder.lovable.app";
  const purchaseUrl = `${baseUrl}/pay/${session.id}`;

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
        console.warn("sendVideo failed; document fallback disabled by product requirement", err);
      }
    }
  }

  // 3. Main copy with purchase button
  const buttonText = settings.dispatch_button_text?.trim() || "💳 Liberar meu acesso agora";
  const replyMarkup = purchaseUrl
    ? { inline_keyboard: [[{ text: buttonText, url: purchaseUrl }]] }
    : undefined;

  await tgCall("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });

  await (supabase as any).rpc("app_mark_dispatch_sent", {
    _session_id: sessionId,
    _reason: reason,
  });

  return { ok: true };
}

// Called on /start: send welcome media + message + WebApp button to open the call
export async function sendStartWelcome(chatId: number): Promise<void> {
  const { createBackendClient } = await import("@/lib/backend-public.server");
  const supabase = createBackendClient();
  const { data: settings } = await supabase
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

  await tgCall("sendMessage", {
    chat_id: chatId,
    text: "Se quiser, compartilha seu WhatsApp pra eu te achar mais fácil depois 💋",
    reply_markup: {
      keyboard: [[{ text: "📲 Compartilhar WhatsApp", request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  });
}

export async function sendPlainMessage(chatId: number, text: string): Promise<void> {
  await tgCall("sendMessage", { chat_id: chatId, text });
}
