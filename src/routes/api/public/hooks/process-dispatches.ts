import { createFileRoute } from "@tanstack/react-router";
import { dispatchToLead, type DispatchReason } from "@/lib/telegram.server";

// Runs on a schedule (pg_cron). Picks up sessions whose dispatch is due and fires them.
// Also catches abandoned sessions (browser closed → hangup never called client-side).
export const Route = createFileRoute("/api/public/hooks/process-dispatches")({
  server: {
    handlers: {
      POST: async () => {
        const { createBackendClient } = await import("@/lib/backend-public.server");
        const supabase = createBackendClient();
        const nowIso = new Date().toISOString();

        // 1) Explicitly scheduled dispatches that are due
        const { data: scheduled, error } = await (supabase as any).rpc("app_get_due_dispatches", {
          _now: nowIso,
        });
        if (error) {
          console.error("process-dispatches query error", error);
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        const results: Array<{ id: string; ok: boolean; reason?: string }> = [];
        for (const row of scheduled ?? []) {
          const reason = row.dispatch_reason as DispatchReason | null;
          if (!reason || !row.telegram_chat_id) {
            await (supabase as any).rpc("app_clear_dispatch_queue", {
              _session_id: row.id,
              _clear_reason: true,
            });
            continue;
          }
          try {
            const res = await dispatchToLead(row.id, reason);
            results.push({ id: row.id, ...res });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`dispatch ${row.id} failed`, msg);
            results.push({ id: row.id, ok: false, reason: msg });
            await (supabase as any).rpc("app_clear_dispatch_queue", {
              _session_id: row.id,
              _clear_reason: false,
            });
          }
        }

        // 2) Catch-all for abandoned sessions (user closed the tab without hitting hangup).
        //    Any Telegram-linked session older than 5 min that never got a dispatch and never paid
        //    gets one now, based on how far it progressed.
        const { data: freeSecValue } = await (supabase as any).rpc("app_get_free_duration");
        const freeSec = typeof freeSecValue === "number" ? freeSecValue : 40;
        const cutoffIso = new Date(Date.now() - (freeSec + 180) * 1000).toISOString();

        const { data: abandoned } = await (supabase as any).rpc("app_get_abandoned_dispatches", {
          _cutoff: cutoffIso,
        });

        for (const row of abandoned ?? []) {
          const reason: DispatchReason = row.free_ended_at ? "no_payment" : "hangup";
          try {
            const res = await dispatchToLead(row.id, reason);
            results.push({ id: row.id, ...res });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`abandoned dispatch ${row.id} failed`, msg);
            results.push({ id: row.id, ok: false, reason: msg });
          }
        }

        return Response.json({ ok: true, processed: results.length, results });
      },
    },
  },
});
