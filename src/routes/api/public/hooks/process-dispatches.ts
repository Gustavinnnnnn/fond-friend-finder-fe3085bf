import { createFileRoute } from "@tanstack/react-router";
import { dispatchToLead, type DispatchReason } from "@/lib/telegram.server";

// Runs on a schedule (pg_cron). Picks up sessions whose dispatch is due and fires them.
// Also catches abandoned sessions (browser closed → hangup never called client-side).
export const Route = createFileRoute("/api/public/hooks/process-dispatches")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const nowIso = new Date().toISOString();

        // 1) Explicitly scheduled dispatches that are due
        const { data: scheduled, error } = await supabaseAdmin
          .from("call_sessions")
          .select("id, dispatch_reason, dispatch_scheduled_at, telegram_chat_id")
          .not("dispatch_scheduled_at", "is", null)
          .lte("dispatch_scheduled_at", nowIso)
          .limit(50);
        if (error) {
          console.error("process-dispatches query error", error);
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        const results: Array<{ id: string; ok: boolean; reason?: string }> = [];
        for (const row of scheduled ?? []) {
          const reason = row.dispatch_reason as DispatchReason | null;
          if (!reason || !row.telegram_chat_id) {
            await supabaseAdmin
              .from("call_sessions")
              .update({ dispatch_scheduled_at: null, dispatch_reason: null })
              .eq("id", row.id);
            continue;
          }
          try {
            const res = await dispatchToLead(row.id, reason);
            results.push({ id: row.id, ...res });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`dispatch ${row.id} failed`, msg);
            results.push({ id: row.id, ok: false, reason: msg });
            await supabaseAdmin
              .from("call_sessions")
              .update({ dispatch_scheduled_at: null })
              .eq("id", row.id);
          }
        }

        // 2) Catch-all for abandoned sessions (user closed the tab without hitting hangup).
        //    Any Telegram-linked session older than 5 min that never got a dispatch and never paid
        //    gets one now, based on how far it progressed.
        const { data: settings } = await supabaseAdmin
          .from("settings")
          .select("free_duration_seconds")
          .eq("id", 1)
          .single();
        const freeSec = settings?.free_duration_seconds ?? 40;
        const cutoffIso = new Date(Date.now() - (freeSec + 180) * 1000).toISOString();

        const { data: abandoned } = await supabaseAdmin
          .from("call_sessions")
          .select("id, free_ended_at, created_at")
          .not("telegram_chat_id", "is", null)
          .eq("has_paid", false)
          .is("dispatch_hangup_sent_at", null)
          .is("dispatch_no_payment_sent_at", null)
          .is("dispatch_post_payment_sent_at", null)
          .is("dispatch_scheduled_at", null)
          .lte("created_at", cutoffIso)
          .limit(50);

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
