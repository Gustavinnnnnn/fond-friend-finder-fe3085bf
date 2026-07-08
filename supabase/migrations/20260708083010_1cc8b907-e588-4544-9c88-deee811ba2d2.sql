
ALTER TABLE public.call_sessions
  ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT,
  ADD COLUMN IF NOT EXISTS telegram_username TEXT,
  ADD COLUMN IF NOT EXISTS telegram_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS telegram_bot_username TEXT,
  ADD COLUMN IF NOT EXISTS telegram_copy_template TEXT NOT NULL DEFAULT
$$Oi! 💋
Vi que você tá em {cidade}/{estado}, tô te mandando o vídeo da nossa chamada aqui, dá uma olhada:

🎥 {video_link}

Quer continuar de onde a gente parou? É só tocar no botão aqui embaixo 👇$$,
  ADD COLUMN IF NOT EXISTS telegram_purchase_url TEXT;

CREATE INDEX IF NOT EXISTS idx_call_sessions_telegram_chat ON public.call_sessions(telegram_chat_id);
