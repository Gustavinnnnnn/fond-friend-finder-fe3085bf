import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: SupabaseClient; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}


// Bootstrap: current signed-in user claims admin if no admin exists yet.
export const claimAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("claim_first_admin");
    if (error) throw new Error(error.message);
    return { becameAdmin: Boolean(data) };
  });

// ---------- Dashboard stats ----------
export const getDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: sessions, error: sErr } = await supabaseAdmin
      .from("call_sessions")
      .select(
        "id, status, created_at, free_ended_at, paid_at, completed_at, ip, user_agent, geo_lat, geo_lng, geo_city, geo_region, geo_country, consent_recording, recording_path, has_paid",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (sErr) throw new Error(sErr.message);

    const { data: payments, error: pErr } = await supabaseAdmin
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

// ---------- Signed URL to view a recording ----------
export const getRecordingUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { path: string }) =>
    z.object({ path: z.string() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data: signed, error } = await supabaseAdmin.storage
      .from("media")
      .createSignedUrl(data.path, 60 * 60);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });
