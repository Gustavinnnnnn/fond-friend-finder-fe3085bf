import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Public: save the lead's phone (best-effort collection on offer screen)
export const saveLeadPhone = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionId: string; phone: string }) =>
    z
      .object({
        sessionId: z.string().uuid(),
        phone: z.string().min(6).max(30),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { createBackendClient } = await import("@/lib/backend-public.server");
    const supabase = createBackendClient();
    const { error } = await (supabase as any).rpc("app_save_lead_phone", {
      _session_id: data.sessionId,
      _phone: data.phone,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Admin: manually re-dispatch a lead for a chosen reason
export const redispatchTelegram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { sessionId: string; reason?: "hangup" | "no_payment" | "post_payment" }) =>
      z
        .object({
          sessionId: z.string().uuid(),
          reason: z.enum(["hangup", "no_payment", "post_payment"]).default("hangup"),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (error) throw new Error(error.message);
    if (!isAdmin) throw new Error("Forbidden");
    const { dispatchToLead } = await import("@/lib/telegram.server");
    const res = await dispatchToLead(data.sessionId, data.reason);
    if (!res.ok) throw new Error(res.reason ?? "Falha no disparo");
    return { ok: true };
  });
