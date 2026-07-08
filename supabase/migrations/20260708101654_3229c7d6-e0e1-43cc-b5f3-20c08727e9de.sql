UPDATE public.settings
SET
  dispatch_button_text = '💳 Liberar meu acesso agora',
  dispatch_copy_hangup = 'Ei, sumiu de mim tão rápido? 😏\n\nEu vi que a chamada caiu antes da gente terminar. Gravei esse pedacinho pra você lembrar de mim.\n\n📍 Você apareceu aí por {cidade}/{estado}\n📲 Seu contato: {telefone}\n\nSe quiser continuar de onde parou, toca no botão aqui embaixo que eu já libero tudo pra você 💋',
  dispatch_copy_no_payment = 'Amor, ficou faltando só confirmar o Pix 😘\n\nEu já deixei tudo pronto pra você continuar comigo. O vídeo tá aqui e o acesso libera rapidinho depois do pagamento.\n\n📍 {cidade}/{estado}\n👤 {modelo}\n\nToca no botão e finaliza agora pra não perder 💋',
  dispatch_copy_post_payment = 'Pagamento confirmado, amor 💖\n\nAmei nossa chamada. Tô te mandando o vídeo pra você guardar e, quando quiser repetir, é só me chamar de novo.\n\n📍 {cidade}/{estado}\n📲 {telefone}\n\nVolta pra mim quando quiser 😘'
WHERE id = 1;