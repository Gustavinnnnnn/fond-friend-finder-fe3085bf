// Reads the Paradise and Telegram credentials configured by the admin panel,
// with fallback to environment variables. Server-only.
import { createBackendClient } from "@/lib/backend-public.server";

let cache: { at: number; paradise: string | null; telegram: string | null } | null = null;
const TTL_MS = 30_000;

async function loadFromDb(): Promise<{ paradise: string | null; telegram: string | null }> {
  try {
    const supabase = createBackendClient();
    const { data, error } = await (supabase as any).rpc("app_get_runtime_credentials");
    if (error) {
      console.warn("app_get_runtime_credentials failed", error);
      return { paradise: null, telegram: null };
    }
    const row = Array.isArray(data) ? data[0] : data;
    return {
      paradise: (row?.paradise_api_key as string | null) ?? null,
      telegram: (row?.telegram_bot_token as string | null) ?? null,
    };
  } catch (err) {
    console.warn("runtime creds load failed", err);
    return { paradise: null, telegram: null };
  }
}

async function getCreds(): Promise<{ paradise: string | null; telegram: string | null }> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) {
    return { paradise: cache.paradise, telegram: cache.telegram };
  }
  const fresh = await loadFromDb();
  cache = { at: now, ...fresh };
  return fresh;
}

export function invalidateRuntimeCredentialsCache() {
  cache = null;
}

export async function getParadiseApiKey(): Promise<string | null> {
  const envKey = process.env.PARADISE_API_KEY?.trim();
  if (envKey) return envKey;
  const { paradise } = await getCreds();
  return paradise?.trim() || null;
}

export async function getTelegramBotToken(): Promise<string | null> {
  const envKey = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (envKey) return envKey;
  const { telegram } = await getCreds();
  return telegram?.trim() || null;
}
