CREATE TABLE IF NOT EXISTS public.telegram_contacts (
  chat_id bigint PRIMARY KEY,
  user_id bigint,
  username text,
  first_name text,
  phone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.telegram_contacts TO service_role;

ALTER TABLE public.telegram_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage telegram contacts" ON public.telegram_contacts;
CREATE POLICY "Service role can manage telegram contacts"
ON public.telegram_contacts
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP TRIGGER IF EXISTS update_telegram_contacts_updated_at ON public.telegram_contacts;
CREATE TRIGGER update_telegram_contacts_updated_at
BEFORE UPDATE ON public.telegram_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();