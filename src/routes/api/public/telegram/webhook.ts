import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";
import {
  deriveTelegramWebhookSecret,
  sendPlainMessage,
  sendStartWelcome,
} from "@/lib/telegram.server";

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number };
    from?: { id: number; username?: string; first_name?: string };
    text?: string;
    contact?: { phone_number?: string; user_id?: number; first_name?: string };
  };
};

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const TELEGRAM_API_KEY = process.env.TELEGRAM_API_KEY || process.env.TELEGRAM_BOT_TOKEN;
        if (!TELEGRAM_API_KEY) {
          return new Response("TELEGRAM_BOT_TOKEN not configured", { status: 500 });
        }
        const expected = deriveTelegramWebhookSecret(TELEGRAM_API_KEY);
        const actual = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
        if (!safeEqual(actual, expected)) {
          return new Response("Unauthorized", { status: 401 });
        }

        let update: TelegramUpdate;
        try {
          update = (await request.json()) as TelegramUpdate;
        } catch {
          return new Response("Bad Request", { status: 400 });
        }

        const message = update.message;
        if (!message?.chat?.id || !message.from?.id) {
          return Response.json({ ok: true, ignored: true });
        }

        const text = (message.text ?? "").trim();
        const chatId = message.chat.id;

        if (message.contact?.phone_number) {
          try {
            const { createBackendClient } = await import("@/lib/backend-public.server");
            const supabase = createBackendClient();
            await (supabase as any).rpc("app_upsert_telegram_contact", {
              _chat_id: chatId,
              _user_id: message.contact.user_id ?? message.from.id,
              _username: message.from.username ?? null,
              _first_name: message.contact.first_name ?? message.from.first_name ?? null,
              _phone: message.contact.phone_number,
            });
            await sendPlainMessage(chatId, "Perfeito, salvei seu contato 💋");
          } catch (err) {
            console.error("save telegram contact failed", err);
          }
          return Response.json({ ok: true });
        }

        // Any /start (with or without payload) triggers the welcome flow
        if (/^\/start(\b|$)/i.test(text)) {
          try {
            await sendStartWelcome(chatId);
          } catch (err) {
            console.error("sendStartWelcome failed", err);
            await sendPlainMessage(chatId, "Oi! Tive um problema aqui, tenta de novo em instantes 💋");
          }
          return Response.json({ ok: true });
        }

        return Response.json({ ok: true });
      },
    },
  },
});
