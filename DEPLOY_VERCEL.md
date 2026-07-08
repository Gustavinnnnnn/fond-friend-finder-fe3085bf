# Deploy na Vercel

## 1. Suba o projeto pra Vercel

1. Vá em https://vercel.com/new
2. Importe este repositório do GitHub
3. Framework preset: **Other** (o `vercel.json` já configura tudo)
4. Build Command: `bun run build`
5. Output Directory: `.output/public`

## 2. Variáveis de ambiente (Vercel → Settings → Environment Variables)

Adicione **todas** essas variáveis em Production, Preview e Development:

| Nome | Valor |
|---|---|
| `SUPABASE_URL` | `https://lkyqghspjndbqbkpuuxm.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | (copia do `.env` do Lovable) |
| `VITE_SUPABASE_URL` | mesma coisa que `SUPABASE_URL` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | mesma coisa que `SUPABASE_PUBLISHABLE_KEY` |
| `VITE_SUPABASE_PROJECT_ID` | `lkyqghspjndbqbkpuuxm` |
| `PARADISE_API_KEY` | seu `sk_...` da Paradise |
| `TELEGRAM_BOT_TOKEN` | token do @BotFather |

## 3. Painel administrativo

- URL: `https://SEU-DOMINIO.vercel.app/auth`
- Use o e-mail e senha do admin que você já cadastrou no Lovable Cloud (mesma conta funciona, é o mesmo banco).
- Se ainda não tem admin cadastrado, crie um em **Lovable Cloud → Users → Add user** e depois rode no SQL editor:

```sql
insert into public.user_roles (user_id, role)
values ('<id-do-usuario>', 'admin');
```

## 4. Webhook do Telegram

Depois do deploy, aponte o webhook do bot pra Vercel:

```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://SEU-DOMINIO.vercel.app/api/public/telegram/webhook
```

## 5. Cron dos disparos (opcional)

Se quiser que disparos agendados rodem sozinhos, crie um Cron Job na Vercel:

- **Path**: `/api/public/hooks/process-dispatches`
- **Schedule**: `* * * * *` (a cada minuto)

Pronto, é só publicar.
