CREATE OR REPLACE FUNCTION public.app_get_due_dispatches(_now timestamptz DEFAULT now())
RETURNS TABLE(id uuid, dispatch_reason text, telegram_chat_id bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cs.id, cs.dispatch_reason, cs.telegram_chat_id
  FROM public.call_sessions cs
  WHERE cs.dispatch_scheduled_at IS NOT NULL
    AND cs.dispatch_scheduled_at <= _now
  ORDER BY cs.dispatch_scheduled_at ASC
  LIMIT 50;
$$;

CREATE OR REPLACE FUNCTION public.app_clear_dispatch_queue(_session_id uuid, _clear_reason boolean DEFAULT true)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.call_sessions
  SET dispatch_scheduled_at = NULL,
      dispatch_reason = CASE WHEN _clear_reason THEN NULL ELSE dispatch_reason END
  WHERE id = _session_id;
$$;

CREATE OR REPLACE FUNCTION public.app_get_free_duration()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(free_duration_seconds, 40)
  FROM public.settings
  WHERE id = 1;
$$;

CREATE OR REPLACE FUNCTION public.app_get_abandoned_dispatches(_cutoff timestamptz)
RETURNS TABLE(id uuid, free_ended_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cs.id, cs.free_ended_at
  FROM public.call_sessions cs
  WHERE cs.telegram_chat_id IS NOT NULL
    AND COALESCE(cs.has_paid, false) = false
    AND cs.dispatch_hangup_sent_at IS NULL
    AND cs.dispatch_no_payment_sent_at IS NULL
    AND cs.dispatch_post_payment_sent_at IS NULL
    AND cs.dispatch_scheduled_at IS NULL
    AND cs.created_at <= _cutoff
  ORDER BY cs.created_at ASC
  LIMIT 50;
$$;

GRANT EXECUTE ON FUNCTION public.app_get_due_dispatches(timestamptz) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_clear_dispatch_queue(uuid, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_get_free_duration() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_get_abandoned_dispatches(timestamptz) TO anon, authenticated;