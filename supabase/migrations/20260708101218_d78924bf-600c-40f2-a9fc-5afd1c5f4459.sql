ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS dispatch_button_text text NOT NULL DEFAULT '💳 Liberar meu acesso agora';

UPDATE public.settings
SET dispatch_button_text = COALESCE(NULLIF(dispatch_button_text, ''), '💳 Liberar meu acesso agora')
WHERE id = 1;