import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  createDispatchPixPayment,
  checkDispatchPayment,
} from "@/lib/call.functions";
import { Button } from "@/components/ui/button";
import { Copy, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/pay/$sessionId")({
  component: PayPage,
  head: () => ({
    meta: [
      { title: "Continuar compra" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

type PaymentInfo = {
  paymentId: string;
  configured: boolean;
  amountCents: number;
  status: string;
  qrCode?: string;
  qrCodeBase64?: string;
  ticketUrl?: string;
};

function PayPage() {
  const { sessionId } = Route.useParams();
  const [info, setInfo] = useState<PaymentInfo | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "paid" | "error">(
    "loading",
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const createdRef = useRef(false);

  const createFn = useServerFn(createDispatchPixPayment);
  const checkFn = useServerFn(checkDispatchPayment);

  const start = useCallback(async () => {
    if (createdRef.current) return;
    createdRef.current = true;
    try {
      const res = (await createFn({ data: { sessionId } })) as PaymentInfo;
      setInfo(res);
      if (res.status === "approved") setStatus("paid");
      else setStatus("ready");
    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : "Erro ao gerar Pix");
      setStatus("error");
    }
  }, [createFn, sessionId]);

  useEffect(() => {
    start();
  }, [start]);

  // Poll for payment status
  useEffect(() => {
    if (!info || status !== "ready" || !info.configured) return;
    const iv = setInterval(async () => {
      try {
        const res = (await checkFn({ data: { paymentId: info.paymentId } })) as {
          status: string;
        };
        if (res.status === "approved") {
          setStatus("paid");
          clearInterval(iv);
        }
      } catch (err) {
        console.error("check dispatch payment", err);
      }
    }, 5000);
    return () => clearInterval(iv);
  }, [info, status, checkFn]);

  const handleCopy = () => {
    if (!info?.qrCode) return;
    navigator.clipboard.writeText(info.qrCode);
    setCopied(true);
    toast.success("Chave Pix copiada");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#080a0d] px-4 py-8 text-white">
      <div className="mx-auto flex max-w-md flex-col items-center">
        <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 text-xl font-black text-black">
          7
        </div>
        <h1 className="text-2xl font-bold">Continuar minha compra</h1>
        <p className="mt-1 text-center text-sm text-white/60">
          Pague com Pix e receba tudo aqui no Telegram na hora.
        </p>

        {status === "loading" ? (
          <div className="mt-10 flex items-center gap-2 text-white/70">
            <Loader2 className="h-5 w-5 animate-spin" /> Gerando Pix…
          </div>
        ) : null}

        {status === "error" ? (
          <div className="mt-8 w-full rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-center">
            <p className="text-sm text-red-200">
              {errorMsg ?? "Não foi possível gerar o Pix agora."}
            </p>
            <Button
              onClick={() => {
                createdRef.current = false;
                setStatus("loading");
                start();
              }}
              className="mt-3 bg-white/10 hover:bg-white/15"
              size="sm"
            >
              Tentar de novo
            </Button>
          </div>
        ) : null}

        {status === "ready" && info ? (
          <div className="mt-6 w-full rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-center">
              <div className="text-xs uppercase tracking-wider text-white/45">
                Total
              </div>
              <div className="text-3xl font-black text-emerald-400">
                {formatBRL(info.amountCents)}
              </div>
            </div>

            {!info.configured ? (
              <p className="mt-4 rounded-xl bg-amber-500/10 p-3 text-center text-xs text-amber-200">
                Pagamento ainda não configurado no painel. Peça pro admin ativar
                o Mercado Pago.
              </p>
            ) : (
              <>
                {info.qrCodeBase64 ? (
                  <img
                    src={`data:image/png;base64,${info.qrCodeBase64}`}
                    alt="QR Code Pix"
                    className="mx-auto mt-4 h-56 w-56 rounded-xl bg-white p-2"
                  />
                ) : null}

                {info.qrCode ? (
                  <div className="mt-4">
                    <div className="mb-1 text-xs text-white/60">
                      Ou copie o Pix Copia e Cola:
                    </div>
                    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 p-3">
                      <div className="min-w-0 flex-1 truncate font-mono text-xs text-white/70">
                        {info.qrCode}
                      </div>
                      <Button
                        onClick={handleCopy}
                        size="sm"
                        className="shrink-0 bg-emerald-500 text-black hover:bg-emerald-400"
                      >
                        {copied ? (
                          <>
                            <Check className="mr-1 h-4 w-4" /> Copiado
                          </>
                        ) : (
                          <>
                            <Copy className="mr-1 h-4 w-4" /> Copiar
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : null}

                <p className="mt-4 text-center text-xs text-white/50">
                  Aguardando pagamento… assim que cair, esta tela avisa
                  automaticamente.
                </p>
              </>
            )}
          </div>
        ) : null}

        {status === "paid" ? (
          <div className="mt-8 w-full rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-black">
              <Check className="h-6 w-6" />
            </div>
            <div className="text-lg font-bold">Pagamento confirmado!</div>
            <p className="mt-1 text-sm text-emerald-100/80">
              Pronto. Volte pro Telegram — sua modelo já foi avisada 💋
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
