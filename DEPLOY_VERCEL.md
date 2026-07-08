# Deploy na Vercel

## 1. Suba o projeto pra Vercel

1. Vá em https://vercel.com/new
2. Importe este repositório do GitHub
3. Framework preset: **Other** (o `vercel.json` já configura tudo)
4. Build Command: `bun run build`
5. Output Directory: `.output/public`

## 2. Variáveis de ambiente (Vercel → Settings → Environment Variables)

As variáveis do backend público já ficam no `vercel.json`. Para pagamento e Telegram funcionarem na Vercel, adicione só estas duas em **Production, Preview e Development**:

| Nome | Valor |
|---|---|
| `PARADISE_API_KEY` | sua chave `sk_...` da Paradise |
| `TELEGRAM_BOT_TOKEN` | token do @BotFather |

Opcional, mas recomendado quando estiver no seu domínio final:

| Nome | Valor |
|---|---|
| `APP_BASE_URL` | `https://SEU-DOMINIO.vercel.app` |

O app já leva estas variáveis públicas no `vercel.json`, então não precisa configurar banco manualmente:

| Nome | Valor |
|---|---|
| `SUPABASE_URL` | `https://lkyqghspjndbqbkpuuxm.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | (copia do `.env` do Lovable) |
| `VITE_SUPABASE_URL` | mesma coisa que `SUPABASE_URL` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | mesma coisa que `SUPABASE_PUBLISHABLE_KEY` |
| `VITE_SUPABASE_PROJECT_ID` | `lkyqghspjndbqbkpuuxm` |

## 3. Painel administrativo

- URL: `https://SEU-DOMINIO.vercel.app/auth`
- Use o e-mail e senha do admin que você já cadastrou no Lovable Cloud (mesma conta funciona, é o mesmo banco).
- Se ainda não tiver admin cadastrado, crie o usuário pelo painel do Lovable Cloud e me peça pra marcar ele como admin.

## 4. Webhook do Telegram

Depois do deploy, aponte o webhook do bot pra Vercel:

```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://SEU-DOMINIO.vercel.app/api/public/telegram/webhook&secret_token=<SECRET>
```

O `<SECRET>` precisa ser o segredo gerado a partir do token do bot. Se quiser, me peça que eu te passo o comando certinho sem expor token no chat.

## 5. Cron dos disparos (opcional)

Se quiser que disparos agendados rodem sozinhos, crie um Cron Job na Vercel:

- **Path**: `/api/public/hooks/process-dispatches`
- **Schedule**: `* * * * *` (a cada minuto)

Pronto, é só publicar.
