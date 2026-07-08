-- Public, narrowly-scoped app RPCs so self-hosted server functions can use the publishable key only.

CREATE OR REPLACE FUNCTION public.app_start_call_session(
  _consent boolean,
  _telegram_chat_id bigint DEFAULT NULL,
  _telegram_username text DEFAULT NULL,
  _user_agent text DEFAULT NULL,
  _ip text DEFAULT NULL,
  _geo_city text DEFAULT NULL,
  _geo_region text DEFAULT NULL,
  _geo_country text DEFAULT NULL,
  _geo_lat double precision DEFAULT NULL,
  _geo_lng double precision DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _session_id uuid;
  _phone text;
BEGIN
  IF _telegram_chat_id IS NOT NULL THEN
    SELECT phone INTO _phone
    FROM public.telegram_contacts
    WHERE chat_id = _telegram_chat_id;
  END IF;

  INSERT INTO public.call_sessions (
    status,
    user_agent,
    ip,
    consent_recording,
    telegram_chat_id,
    telegram_username,
    phone,
    geo_city,
    geo_region,
    geo_country,
    geo_lat,
    geo_lng
  ) VALUES (
    'started',
    _user_agent,
    _ip,
    _consent,
    _telegram_chat_id,
    _telegram_username,
    _phone,
    _geo_city,
    _geo_region,
    _geo_country,
    _geo_lat,
    _geo_lng
  )
  RETURNING id INTO _session_id;

  RETURN _session_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.app_update_session_geo(
  _session_id uuid,
  _lat double precision,
  _lng double precision,
  _accuracy double precision
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.call_sessions
  SET geo_lat = _lat,
      geo_lng = _lng,
      geo_accuracy = _accuracy
  WHERE id = _session_id;
$$;

CREATE OR REPLACE FUNCTION public.app_set_recording_path(_session_id uuid, _path text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.call_sessions
  SET recording_path = _path
  WHERE id = _session_id;
$$;

CREATE OR REPLACE FUNCTION public.app_end_free_call(_session_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.call_sessions
  SET status = 'free_ended',
      free_ended_at = now()
  WHERE id = _session_id;
$$;

CREATE OR REPLACE FUNCTION public.app_complete_call(_session_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.call_sessions
  SET status = 'completed',
      completed_at = now()
  WHERE id = _session_id;
$$;

CREATE OR REPLACE FUNCTION public.app_save_lead_phone(_session_id uuid, _phone text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.call_sessions
  SET phone = regexp_replace(_phone, '[^0-9]+', '', 'g')
  WHERE id = _session_id;
$$;

CREATE OR REPLACE FUNCTION public.app_get_session_payment_context(_session_id uuid)
RETURNS TABLE(phone text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cs.phone
  FROM public.call_sessions cs
  WHERE cs.id = _session_id;
$$;

CREATE OR REPLACE FUNCTION public.app_insert_payment(
  _session_id uuid,
  _kind text,
  _provider text,
  _provider_payment_id text,
  _amount_cents integer,
  _status text,
  _qr_code text DEFAULT NULL,
  _qr_code_base64 text DEFAULT NULL,
  _ticket_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _payment_id uuid;
BEGIN
  INSERT INTO public.payments (
    session_id,
    kind,
    provider,
    provider_payment_id,
    amount_cents,
    status,
    qr_code,
    qr_code_base64,
    ticket_url
  ) VALUES (
    _session_id,
    COALESCE(NULLIF(_kind, ''), 'call'),
    COALESCE(NULLIF(_provider, ''), 'paradise'),
    _provider_payment_id,
    _amount_cents,
    _status,
    _qr_code,
    _qr_code_base64,
    _ticket_url
  )
  RETURNING id INTO _payment_id;

  RETURN _payment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.app_get_existing_dispatch_payment(_session_id uuid)
RETURNS TABLE(
  id uuid,
  status text,
  amount_cents integer,
  qr_code text,
  qr_code_base64 text,
  ticket_url text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.status, p.amount_cents, p.qr_code, p.qr_code_base64, p.ticket_url
  FROM public.payments p
  WHERE p.session_id = _session_id
    AND p.kind = 'dispatch'
    AND p.status IN ('pending', 'processing', 'in_process', 'under_review', 'approved')
  ORDER BY p.created_at DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.app_get_payment_for_check(_payment_id uuid)
RETURNS TABLE(
  id uuid,
  provider_payment_id text,
  status text,
  session_id uuid,
  kind text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.provider_payment_id, p.status, p.session_id, p.kind
  FROM public.payments p
  WHERE p.id = _payment_id;
$$;

CREATE OR REPLACE FUNCTION public.app_update_payment_after_check(_payment_id uuid, _status text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _session_id uuid;
  _kind text;
BEGIN
  UPDATE public.payments
  SET status = _status
  WHERE id = _payment_id
  RETURNING session_id, kind INTO _session_id, _kind;

  IF _status = 'approved' AND _session_id IS NOT NULL THEN
    IF _kind = 'dispatch' THEN
      UPDATE public.call_sessions
      SET dispatch_paid_at = now()
      WHERE id = _session_id;
    ELSE
      UPDATE public.call_sessions
      SET status = 'paid', paid_at = now(), has_paid = true
      WHERE id = _session_id;
    END IF;
  END IF;

  RETURN _status;
END;
$$;

CREATE OR REPLACE FUNCTION public.app_cancel_dispatch(_session_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.call_sessions
  SET dispatch_scheduled_at = NULL,
      dispatch_reason = NULL
  WHERE id = _session_id;
$$;

CREATE OR REPLACE FUNCTION public.app_get_dispatch_payload(_session_id uuid, _reason text)
RETURNS TABLE(
  id uuid,
  recording_path text,
  geo_city text,
  geo_region text,
  geo_country text,
  geo_lat double precision,
  geo_lng double precision,
  telegram_chat_id bigint,
  phone text,
  model_name text,
  dispatch_button_text text,
  dispatch_copy_hangup text,
  dispatch_copy_no_payment text,
  dispatch_copy_post_payment text,
  mini_app_url text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    cs.id,
    cs.recording_path,
    cs.geo_city,
    cs.geo_region,
    cs.geo_country,
    cs.geo_lat,
    cs.geo_lng,
    cs.telegram_chat_id,
    cs.phone,
    s.model_name,
    s.dispatch_button_text,
    s.dispatch_copy_hangup,
    s.dispatch_copy_no_payment,
    s.dispatch_copy_post_payment,
    s.mini_app_url
  FROM public.call_sessions cs
  CROSS JOIN public.settings s
  WHERE cs.id = _session_id
    AND s.id = 1
    AND cs.telegram_chat_id IS NOT NULL
    AND CASE
      WHEN _reason = 'hangup' THEN cs.dispatch_hangup_sent_at IS NULL AND COALESCE(cs.has_paid, false) = false
      WHEN _reason = 'no_payment' THEN cs.dispatch_no_payment_sent_at IS NULL AND COALESCE(cs.has_paid, false) = false
      WHEN _reason = 'post_payment' THEN cs.dispatch_post_payment_sent_at IS NULL
      ELSE false
    END
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.app_mark_dispatch_sent(_session_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _reason = 'hangup' THEN
    UPDATE public.call_sessions
    SET telegram_sent_at = now(),
        dispatch_hangup_sent_at = now(),
        dispatch_scheduled_at = NULL,
        dispatch_reason = NULL
    WHERE id = _session_id;
  ELSIF _reason = 'no_payment' THEN
    UPDATE public.call_sessions
    SET telegram_sent_at = now(),
        payment_button_shown_at = COALESCE(payment_button_shown_at, now()),
        dispatch_no_payment_sent_at = now(),
        dispatch_scheduled_at = NULL,
        dispatch_reason = NULL
    WHERE id = _session_id;
  ELSIF _reason = 'post_payment' THEN
    UPDATE public.call_sessions
    SET telegram_sent_at = now(),
        dispatch_post_payment_sent_at = now(),
        dispatch_scheduled_at = NULL,
        dispatch_reason = NULL
    WHERE id = _session_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.app_upsert_telegram_contact(
  _chat_id bigint,
  _user_id bigint,
  _username text,
  _first_name text,
  _phone text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.telegram_contacts (chat_id, user_id, username, first_name, phone)
  VALUES (_chat_id, _user_id, _username, _first_name, regexp_replace(_phone, '[^0-9]+', '', 'g'))
  ON CONFLICT (chat_id)
  DO UPDATE SET
    user_id = EXCLUDED.user_id,
    username = EXCLUDED.username,
    first_name = EXCLUDED.first_name,
    phone = EXCLUDED.phone,
    updated_at = now();
$$;

GRANT EXECUTE ON FUNCTION public.app_start_call_session(boolean, bigint, text, text, text, text, text, text, double precision, double precision) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_update_session_geo(uuid, double precision, double precision, double precision) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_set_recording_path(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_end_free_call(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_complete_call(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_save_lead_phone(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_get_session_payment_context(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_insert_payment(uuid, text, text, text, integer, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_get_existing_dispatch_payment(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_get_payment_for_check(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_update_payment_after_check(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_cancel_dispatch(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_get_dispatch_payload(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_mark_dispatch_sent(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_upsert_telegram_contact(bigint, bigint, text, text, text) TO anon, authenticated;

DROP POLICY IF EXISTS "Public can upload call recordings" ON storage.objects;
CREATE POLICY "Public can upload call recordings"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'media' AND name LIKE 'recordings/%');