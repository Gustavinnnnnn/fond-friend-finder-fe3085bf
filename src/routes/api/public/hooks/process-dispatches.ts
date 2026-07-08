import { createFileRoute } from "@tanstack/react-router";
import { dispatchToLead, type DispatchReason } from "@/lib/telegram.server";

// Runs on a schedule (pg_cron). Picks up sessions whose dispatch is due and fires them.
export const Route = createFileRoute("/api/public/hooks/process-dispatches")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: rows, error } = await supabaseAdmin
          .from("call_sessions")
          .select("id, dispatch_reason, dispatch_scheduled_at, telegram_chat_id")
          .not("dispatch_scheduled_at", "is", null)
          .lte("dispatch_scheduled_at", new Date().toISOString())
          .limit(50);
        if (error) {
          console.error("process-dispatches query error", error);
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        const results: Array<{ id: string; ok: boolean; reason?: string }> = [];
        for (const row of rows ?? []) {
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
            // Clear so we don't loop forever on a permanent failure
            await supabaseAdmin
              .from("call_sessions")
              .update({ dispatch_scheduled_at: null })
              .eq("id", row.id);
          }
        }
        return Response.json({ ok: true, processed: results.length, results });
      },
    },
  },
});
