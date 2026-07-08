
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS paradise_api_key text,
  ADD COLUMN IF NOT EXISTS telegram_bot_token text;

CREATE OR REPLACE FUNCTION public.app_get_runtime_credentials()
RETURNS TABLE(paradise_api_key text, telegram_bot_token text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.paradise_api_key, s.telegram_bot_token
  FROM public.settings s
  WHERE s.id = 1;
$$;

GRANT EXECUTE ON FUNCTION public.app_get_runtime_credentials() TO anon, authenticated, service_role;
