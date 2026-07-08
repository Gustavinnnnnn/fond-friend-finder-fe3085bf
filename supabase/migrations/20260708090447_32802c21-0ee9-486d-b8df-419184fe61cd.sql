-- Extensões para cron + HTTP
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 1. Ampliar tabela settings
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS start_photo_url text,
  ADD COLUMN IF NOT EXISTS start_video_url text,
  ADD COLUMN IF NOT EXISTS start_message text NOT NULL DEFAULT 'Oi amor 💋 Bem-vindo(a)! Aperta o botão aqui embaixo pra a gente entrar na chamada agora.',
  ADD COLUMN IF NOT EXISTS start_button_text text NOT NULL DEFAULT '📞 Entrar na chamada',
  ADD COLUMN IF NOT EXISTS mini_app_url text,
  ADD COLUMN IF NOT EXISTS dispatch_copy_hangup text NOT NULL DEFAULT 'Oi! 💋 Vi que você desligou a chamada em {cidade}/{estado}. Tô te mandando o vídeo aqui, dá play 👇 Quando quiser continuar, é só tocar no botão abaixo.',
  ADD COLUMN IF NOT EXISTS dispatch_copy_no_payment text NOT NULL DEFAULT 'Ei, ainda tô te esperando 😘 Vi que você não finalizou o pagamento. Tô te mandando o vídeo da nossa chamada em {cidade}/{estado}. Quando quiser voltar pra mim, é só tocar aqui 👇',
  ADD COLUMN IF NOT EXISTS dispatch_copy_post_payment text NOT NULL DEFAULT 'Amei nossa chamada 💖 Tô te mandando o vídeo pra você guardar. Quando quiser mais, é só tocar no botão 👇';

-- 2. Ampliar tabela call_sessions
ALTER TABLE public.call_sessions
  ADD COLUMN IF NOT EXISTS payment_button_shown_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispatch_scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispatch_reason text,
  ADD COLUMN IF NOT EXISTS dispatch_hangup_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispatch_no_payment_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispatch_post_payment_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_call_sessions_dispatch_scheduled
  ON public.call_sessions (dispatch_scheduled_at)
  WHERE dispatch_scheduled_at IS NOT NULL;

-- 3. Agendamento pg_cron: chama o endpoint que processa disparos pendentes
DO $$
DECLARE
  existing_jobid bigint;
BEGIN
  SELECT jobid INTO existing_jobid FROM cron.job WHERE jobname = 'process-pending-dispatches';
  IF existing_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(existing_jobid);
  END IF;
END $$;

SELECT cron.schedule(
  'process-pending-dispatches',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--02757c43-9d59-4dc3-86e6-03d5e9b1fefc-dev.lovable.app/api/public/hooks/process-dispatches',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxreXFnaHNwam5kYnFia3B1dXhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0OTA1MTYsImV4cCI6MjA5OTA2NjUxNn0.I90rNFIgonxLHVc_Mh6trlfTOnZ8giHPQHkwT0Jx_xo"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);