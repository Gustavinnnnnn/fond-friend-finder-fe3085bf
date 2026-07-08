import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  getAdminMediaUploadUrl,
  getAdminSettings,
  getDashboard,
  getRecordingUrl,
  updateAdminSettings,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { toast } from "sonner";
import {
  Upload,
  LogOut,
  Copy,
  ExternalLink,
  MapPin,
  Smartphone,
  Play,
  DollarSign,
  Phone,
  CheckCircle2,
  XCircle,
  LayoutDashboard,
  Users,
  CreditCard,
  Settings as SettingsIcon,
  Globe2,
  RefreshCw,
} from "lucide-react";

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

type AdminSettingsResponse = Settings & {
  model_photo_preview_url: string | null;
  video_preview_url: string | null;
};

type Session = {
  id: string;
  status: string;
  created_at: string;
  free_ended_at: string | null;
  paid_at: string | null;
  completed_at: string | null;
  ip: string | null;
  user_agent: string | null;
  geo_lat: number | null;
  geo_lng: number | null;
  geo_accuracy: number | null;
  geo_city: string | null;
  geo_region: string | null;
  geo_country: string | null;
  consent_recording: boolean;
  recording_path: string | null;
  has_paid: boolean;
};

type Payment = {
  id: string;
  session_id: string | null;
  amount_cents: number;
  status: string;
  created_at: string;
};

type Stats = {
  total: number;
  answered: number;
  paid: number;
  unpaid: number;
  revenueCents: number;
};

type Section = "dashboard" | "leads" | "payments" | "locations" | "settings";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
  head: () => ({
    meta: [
      { title: "Painel admin" },
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

function detectDevice(ua: string | null) {
  if (!ua) return "Desconhecido";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Macintosh|Mac OS/i.test(ua)) return "macOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "Outro";
}

function AdminPage() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"video" | "photo" | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [section, setSection] = useState<Section>("dashboard");
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);

  const dashboardFn = useServerFn(getDashboard);
  const recordingUrlFn = useServerFn(getRecordingUrl);
  const getSettingsFn = useServerFn(getAdminSettings);
  const updateSettingsFn = useServerFn(updateAdminSettings);
  const uploadUrlFn = useServerFn(getAdminMediaUploadUrl);

  useEffect(() => {
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return;
      const { data: roleRows, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userRes.user.id)
        .eq("role", "admin");
      if (error) {
        toast.error("Não foi possível verificar o acesso admin.");
        setIsAdmin(false);
        return;
      }
      setIsAdmin(!!(roleRows && roleRows.length > 0));
    })();
  }, []);

  const loadDashboard = useCallback(async () => {
    try {
      const res = await dashboardFn({});
      setStats(res.stats);
      setSessions(res.sessions as Session[]);
      setPayments(res.payments as Payment[]);
    } catch (err) {
      console.error(err);
    }
  }, [dashboardFn]);

  const loadSettings = useCallback(async () => {
    try {
      const data = (await getSettingsFn({})) as AdminSettingsResponse;
      setSettings({
        model_name: data.model_name,
        model_photo_url: data.model_photo_url,
        video_url: data.video_url,
        free_duration_seconds: data.free_duration_seconds,
        price_cents: data.price_cents,
        offer_title: data.offer_title,
        offer_subtitle: data.offer_subtitle,
        contact_url: data.contact_url,
      });
      setPhotoPreviewUrl(data.model_photo_preview_url);
      setVideoPreviewUrl(data.video_preview_url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao carregar configurações";
      toast.error(msg);
    }
  }, [getSettingsFn]);

  useEffect(() => {
    if (!isAdmin) return;
    loadSettings();
    loadDashboard();
    const iv = setInterval(loadDashboard, 15000);
    return () => clearInterval(iv);
  }, [isAdmin, loadDashboard, loadSettings]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await updateSettingsFn({
        data: {
        model_name: settings.model_name,
        model_photo_url: settings.model_photo_url,
        video_url: settings.video_url,
        free_duration_seconds: settings.free_duration_seconds,
        price_cents: settings.price_cents,
        offer_title: settings.offer_title,
        offer_subtitle: settings.offer_subtitle,
        contact_url: settings.contact_url,
        },
      });
      await loadSettings();
      toast.success("Configurações salvas");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (file: File, kind: "video" | "photo") => {
    setUploading(kind);
    try {
      const ext = file.name.split(".").pop() || (kind === "video" ? "mp4" : "jpg");
      const { path, token } = await uploadUrlFn({ data: { kind, ext } });
      const { error } = await supabase.storage
        .from("media")
        .uploadToSignedUrl(path, token, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const localPreview = URL.createObjectURL(file);
      if (kind === "video") {
        setSettings((prev) => (prev ? { ...prev, video_url: path } : prev));
        setVideoPreviewUrl(localPreview);
      } else {
        setSettings((prev) => (prev ? { ...prev, model_photo_url: path } : prev));
        setPhotoPreviewUrl(localPreview);
      }
      toast.success(`${kind === "video" ? "Vídeo" : "Foto"} enviado. Clique em Salvar.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro no upload";
      toast.error(msg);
    } finally {
      setUploading(null);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  const openRecording = async (path: string) => {
    try {
      const { url } = await recordingUrlFn({ data: { path } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao abrir gravação";
      toast.error(msg);
    }
  };

  const callLink =
    typeof window !== "undefined" ? `${window.location.origin}/call` : "/call";

  const paidSessions = useMemo(() => sessions.filter((s) => s.has_paid), [sessions]);
  const unpaidSessions = useMemo(() => sessions.filter((s) => !s.has_paid), [sessions]);
  const locatedSessions = useMemo(
    () => sessions.filter((s) => s.geo_lat != null && s.geo_lng != null),
    [sessions],
  );

  if (isAdmin === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950 text-white">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-emerald-500" />
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-950 p-6 text-center text-white">
        <div className="text-lg font-semibold">Sem permissão</div>
        <div className="max-w-sm text-sm text-white/60">
          Sua conta não é admin.
        </div>
        <Button variant="outline" onClick={handleSignOut}>
          Sair
        </Button>
      </div>
    );
  }

  const menu: { key: Section; label: string; icon: React.ReactNode }[] = [
    { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
    { key: "leads", label: "Chamadas", icon: <Users className="h-4 w-4" /> },
    { key: "payments", label: "Pagamentos", icon: <CreditCard className="h-4 w-4" /> },
    { key: "locations", label: "Localização", icon: <Globe2 className="h-4 w-4" /> },
    { key: "settings", label: "Configurações", icon: <SettingsIcon className="h-4 w-4" /> },
  ];

  const sectionTitle = menu.find((m) => m.key === section)?.label ?? "";

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-[#080a0d] text-white">
        <Sidebar collapsible="icon" className="border-r border-white/10 bg-[#0d1117]">
          <SidebarHeader className="px-4 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-sm font-black text-black">
                7
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-bold">Seven Calls</div>
                <div className="truncate text-xs text-white/45">Administração</div>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel className="text-white/35">Menu</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menu.map((m) => (
                    <SidebarMenuItem key={m.key}>
                      <SidebarMenuButton
                        isActive={section === m.key}
                        onClick={() => setSection(m.key)}
                        className="h-11 rounded-xl text-white/70 transition hover:bg-white/10 hover:text-white data-[active=true]:bg-emerald-500 data-[active=true]:font-semibold data-[active=true]:text-black"
                      >
                        {m.icon}
                        <span>{m.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="p-3">
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="justify-start text-white/65 hover:bg-white/10 hover:text-white">
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </Button>
          </SidebarFooter>
        </Sidebar>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-white/10 bg-[#080a0d]/90 px-4 backdrop-blur-xl sm:px-6">
            <SidebarTrigger className="h-10 w-10 rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10" />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-semibold">{sectionTitle}</h1>
              <div className="text-xs text-white/45">Atualiza automaticamente a cada 15s</div>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                loadDashboard();
                if (section === "settings") loadSettings();
              }}
              className="hidden bg-white/10 text-white hover:bg-white/15 sm:inline-flex"
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
            </Button>
          </header>

          <main className="flex-1 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">
              {section === "dashboard" ? (
                <DashboardView
                  stats={stats}
                  callLink={callLink}
                  sessions={sessions.slice(0, 5)}
                  payments={payments}
                  onOpenRecording={openRecording}
                />
              ) : null}

              {section === "leads" ? (
                <LeadsView
                  sessions={sessions}
                  paidSessions={paidSessions}
                  unpaidSessions={unpaidSessions}
                  payments={payments}
                  onOpenRecording={openRecording}
                />
              ) : null}

              {section === "payments" ? (
                <PaymentsView payments={payments} sessions={sessions} />
              ) : null}

              {section === "locations" ? (
                <LocationsView sessions={locatedSessions} />
              ) : null}

              {section === "settings" ? (
                <SettingsView
                  settings={settings}
                  setSettings={setSettings}
                  photoPreviewUrl={photoPreviewUrl}
                  videoPreviewUrl={videoPreviewUrl}
                  saving={saving}
                  uploading={uploading}
                  onSave={handleSave}
                  onUpload={handleUpload}
                />
              ) : null}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

// ---------- Views ----------

function DashboardView({
  stats,
  callLink,
  sessions,
  payments,
  onOpenRecording,
}: {
  stats: Stats | null;
  callLink: string;
  sessions: Session[];
  payments: Payment[];
  onOpenRecording: (path: string) => void;
}) {
  return (
    <div className="space-y-6">
      {stats ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={<Phone className="h-4 w-4" />} label="Chamadas" value={stats.total.toString()} />
          <StatCard icon={<Play className="h-4 w-4" />} label="Atendidas" value={stats.answered.toString()} />
          <StatCard
            icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />}
            label="Pagaram"
            value={stats.paid.toString()}
            accent="text-emerald-400"
          />
          <StatCard
            icon={<DollarSign className="h-4 w-4 text-emerald-400" />}
            label="Receita"
            value={formatBRL(stats.revenueCents)}
            accent="text-emerald-400"
          />
        </div>
      ) : null}

      <Card className="border-neutral-800 bg-neutral-900 p-4 text-white">
        <div className="text-xs uppercase tracking-widest text-white/50">Link da chamada</div>
        <div className="mt-2 flex items-center gap-2">
          <code className="flex-1 truncate rounded bg-black/40 px-3 py-2 text-sm">{callLink}</code>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              navigator.clipboard.writeText(callLink);
              toast.success("Link copiado");
            }}
          >
            <Copy className="h-4 w-4" />
          </Button>
          <a href={callLink} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="secondary">
              <ExternalLink className="h-4 w-4" />
            </Button>
          </a>
        </div>
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-white/70">Últimas chamadas</h2>
        <LeadList sessions={sessions} payments={payments} onOpenRecording={onOpenRecording} />
      </div>
    </div>
  );
}

function LeadsView({
  sessions,
  paidSessions,
  unpaidSessions,
  payments,
  onOpenRecording,
}: {
  sessions: Session[];
  paidSessions: Session[];
  unpaidSessions: Session[];
  payments: Payment[];
  onOpenRecording: (path: string) => void;
}) {
  const [filter, setFilter] = useState<"all" | "paid" | "unpaid">("all");
  const list =
    filter === "paid" ? paidSessions : filter === "unpaid" ? unpaidSessions : sessions;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>
          Todos ({sessions.length})
        </FilterButton>
        <FilterButton active={filter === "paid"} onClick={() => setFilter("paid")}>
          Pagaram ({paidSessions.length})
        </FilterButton>
        <FilterButton active={filter === "unpaid"} onClick={() => setFilter("unpaid")}>
          Não pagaram ({unpaidSessions.length})
        </FilterButton>
      </div>
      <LeadList sessions={list} payments={payments} onOpenRecording={onOpenRecording} />
    </div>
  );
}

function PaymentsView({ payments, sessions }: { payments: Payment[]; sessions: Session[] }) {
  if (payments.length === 0) {
    return (
      <Card className="border-neutral-800 bg-neutral-900 p-6 text-center text-sm text-white/50">
        Nenhum pagamento ainda.
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      {payments.map((p) => {
        const s = sessions.find((s) => s.id === p.session_id);
        return (
          <Card key={p.id} className="border-neutral-800 bg-neutral-900 p-4 text-white">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm">
                  {new Date(p.created_at).toLocaleString("pt-BR")}
                </div>
                <div className="mt-1 font-mono text-xs text-white/40">{p.id.slice(0, 8)}</div>
                {s ? (
                  <div className="mt-1 text-xs text-white/50">
                    Chamada {s.id.slice(0, 8)} · {s.geo_city ?? "—"} · IP {s.ip ?? "—"}
                  </div>
                ) : null}
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="text-lg font-bold text-emerald-400">
                  {formatBRL(p.amount_cents)}
                </div>
                <PaymentStatusBadge status={p.status} />
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function LocationsView({ sessions }: { sessions: Session[] }) {
  if (sessions.length === 0) {
    return (
      <Card className="border-neutral-800 bg-neutral-900 p-6 text-center text-sm text-white/50">
        Nenhuma localização registrada ainda.
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      {sessions.map((s) => (
        <Card key={s.id} className="border-neutral-800 bg-neutral-900 p-4 text-white">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm">
                {new Date(s.created_at).toLocaleString("pt-BR")}
              </div>
              <div className="mt-1 text-xs text-white/60">
                {[s.geo_city, s.geo_region, s.geo_country].filter(Boolean).join(", ") ||
                  "—"}
              </div>
              <div className="mt-1 text-xs text-white/40">
                IP {s.ip ?? "—"} · {detectDevice(s.user_agent)}
              </div>
              {s.geo_accuracy != null ? (
                <div className="mt-1 text-xs text-white/40">
                  Precisão ±{Math.round(s.geo_accuracy)}m
                </div>
              ) : null}
            </div>
            <a
              href={`https://www.google.com/maps?q=${s.geo_lat},${s.geo_lng}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="sm" variant="secondary">
                <MapPin className="mr-1 h-3.5 w-3.5" /> Abrir no mapa
              </Button>
            </a>
          </div>
        </Card>
      ))}
    </div>
  );
}

function SettingsView({
  settings,
  setSettings,
  photoPreviewUrl,
  videoPreviewUrl,
  saving,
  uploading,
  onSave,
  onUpload,
}: {
  settings: Settings | null;
  setSettings: React.Dispatch<React.SetStateAction<Settings | null>>;
  photoPreviewUrl: string | null;
  videoPreviewUrl: string | null;
  saving: boolean;
  uploading: "video" | "photo" | null;
  onSave: () => void;
  onUpload: (f: File, kind: "video" | "photo") => void;
}) {
  if (!settings) {
    return <div className="text-sm text-white/60">Carregando configurações…</div>;
  }
  return (
    <div className="space-y-6">
      <Card className="border-neutral-800 bg-neutral-900 p-5 text-white">
        <h2 className="mb-4 text-lg font-semibold">Modelo</h2>
        <div className="grid gap-4 sm:grid-cols-[auto,1fr]">
          <div>
            <div className="mb-2 text-xs text-white/60">Foto</div>
            <div className="relative h-24 w-24 overflow-hidden rounded-full bg-neutral-800">
              {photoPreviewUrl ? (
                <img
                  src={photoPreviewUrl}
                  alt="Foto"
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-md bg-white/10 px-3 py-1.5 text-xs">
              <Upload className="h-3.5 w-3.5" />
              {uploading === "photo" ? "Enviando…" : "Trocar"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUpload(f, "photo");
                }}
              />
            </label>
          </div>
          <div className="space-y-3">
            <div>
              <Label className="text-white/80">Nome exibido</Label>
              <Input
                value={settings.model_name}
                onChange={(e) => setSettings({ ...settings, model_name: e.target.value })}
                className="mt-1 border-neutral-700 bg-neutral-800 text-white"
              />
            </div>
            <div>
              <Label className="text-white/80">Link de contato (opcional)</Label>
              <Input
                placeholder="https://t.me/... ou https://wa.me/..."
                value={settings.contact_url ?? ""}
                onChange={(e) =>
                  setSettings({ ...settings, contact_url: e.target.value || null })
                }
                className="mt-1 border-neutral-700 bg-neutral-800 text-white"
              />
            </div>
          </div>
        </div>
      </Card>

      <Card className="border-neutral-800 bg-neutral-900 p-5 text-white">
        <h2 className="mb-4 text-lg font-semibold">Vídeo da modelo</h2>
        {videoPreviewUrl ? (
          <video
            src={videoPreviewUrl}
            controls
            className="mb-3 aspect-video w-full rounded-lg bg-black"
          />
        ) : (
          <div className="mb-3 flex aspect-video w-full items-center justify-center rounded-lg border border-dashed border-white/20 bg-black/40 text-sm text-white/50">
            Nenhum vídeo enviado ainda
          </div>
        )}
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-white">
          <Upload className="h-4 w-4" />
          {uploading === "video" ? "Enviando…" : "Enviar vídeo (MP4)"}
          <input
            type="file"
            accept="video/mp4,video/webm,video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f, "video");
            }}
          />
        </label>
      </Card>

      <Card className="border-neutral-800 bg-neutral-900 p-5 text-white">
        <h2 className="mb-4 text-lg font-semibold">Configurações da chamada</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-white/80">Duração grátis (segundos)</Label>
            <Input
              type="number"
              min={1}
              value={settings.free_duration_seconds}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  free_duration_seconds: parseInt(e.target.value || "0", 10),
                })
              }
              className="mt-1 border-neutral-700 bg-neutral-800 text-white"
            />
          </div>
          <div>
            <Label className="text-white/80">Valor (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              value={(settings.price_cents / 100).toFixed(2)}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  price_cents: Math.round(parseFloat(e.target.value || "0") * 100),
                })
              }
              className="mt-1 border-neutral-700 bg-neutral-800 text-white"
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-white/80">Título da oferta</Label>
            <Input
              value={settings.offer_title}
              onChange={(e) => setSettings({ ...settings, offer_title: e.target.value })}
              className="mt-1 border-neutral-700 bg-neutral-800 text-white"
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-white/80">Subtítulo da oferta</Label>
            <Textarea
              value={settings.offer_subtitle}
              onChange={(e) =>
                setSettings({ ...settings, offer_subtitle: e.target.value })
              }
              className="mt-1 border-neutral-700 bg-neutral-800 text-white"
            />
          </div>
        </div>
        <Button
          onClick={onSave}
          disabled={saving}
          className="mt-4 bg-emerald-500 hover:bg-emerald-600"
        >
          {saving ? "Salvando…" : "Salvar alterações"}
        </Button>
      </Card>
    </div>
  );
}

// ---------- Small UI helpers ----------

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
        active ? "bg-emerald-500 text-white" : "bg-neutral-800 text-white/70 hover:bg-neutral-700"
      }`}
    >
      {children}
    </button>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <Card className="border-neutral-800 bg-neutral-900 p-4 text-white">
      <div className="flex items-center gap-2 text-xs text-white/60">
        {icon}
        {label}
      </div>
      <div className={`mt-1 text-2xl font-bold ${accent ?? ""}`}>{value}</div>
    </Card>
  );
}

function LeadList({
  sessions,
  payments,
  onOpenRecording,
}: {
  sessions: Session[];
  payments: Payment[];
  onOpenRecording: (path: string) => void;
}) {
  if (sessions.length === 0) {
    return (
      <Card className="border-neutral-800 bg-neutral-900 p-6 text-center text-sm text-white/50">
        Nenhum lead nessa categoria ainda.
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      {sessions.map((s) => {
        const payment = payments.find((p) => p.session_id === s.id);
        const device = detectDevice(s.user_agent);
        const location = [s.geo_city, s.geo_region, s.geo_country]
          .filter(Boolean)
          .join(", ");
        return (
          <Card key={s.id} className="border-neutral-800 bg-neutral-900 p-4 text-white">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm text-white/80">
                  {new Date(s.created_at).toLocaleString("pt-BR")}
                  <span className="text-white/30">·</span>
                  <span className="font-mono text-xs text-white/40">
                    {s.id.slice(0, 8)}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {s.has_paid ? (
                    <Badge className="bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30">
                      <CheckCircle2 className="mr-1 h-3 w-3" /> Pagou
                    </Badge>
                  ) : (
                    <Badge className="bg-red-500/20 text-red-300 hover:bg-red-500/30">
                      <XCircle className="mr-1 h-3 w-3" /> Não pagou
                    </Badge>
                  )}
                  <StatusBadge status={s.status} />
                  {payment ? (
                    <Badge variant="secondary" className="bg-neutral-800">
                      Pix: {payment.status} · {formatBRL(payment.amount_cents)}
                    </Badge>
                  ) : null}
                </div>

                <div className="mt-3 grid gap-2 text-xs text-white/70 sm:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-3.5 w-3.5 text-white/40" />
                    <span>
                      <span className="text-white/40">Dispositivo:</span> {device}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white/40">IP:</span>
                    <span className="font-mono">{s.ip ?? "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 sm:col-span-2">
                    <MapPin className="h-3.5 w-3.5 text-white/40" />
                    <span>
                      {location || "Localização desconhecida"}
                      {s.geo_lat != null && s.geo_lng != null ? (
                        <a
                          href={`https://www.google.com/maps?q=${s.geo_lat},${s.geo_lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 text-emerald-400 underline underline-offset-2"
                        >
                          abrir no mapa
                          {s.geo_accuracy != null
                            ? ` (±${Math.round(s.geo_accuracy)}m)`
                            : ""}
                        </a>
                      ) : null}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {s.recording_path ? (
                  <Button
                    size="sm"
                    onClick={() => onOpenRecording(s.recording_path!)}
                    className="bg-emerald-500 hover:bg-emerald-600"
                  >
                    <Play className="mr-1 h-3 w-3" /> Gravação
                  </Button>
                ) : (
                  <Badge variant="outline" className="border-white/10 text-white/40">
                    Sem gravação
                  </Badge>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    started: "bg-blue-500/20 text-blue-300",
    free_ended: "bg-yellow-500/20 text-yellow-300",
    paid: "bg-emerald-500/20 text-emerald-300",
    completed: "bg-neutral-500/20 text-neutral-300",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
        map[status] ?? "bg-neutral-500/20 text-neutral-300"
      }`}
    >
      {status}
    </span>
  );
}

function PaymentStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    approved: "bg-emerald-500/20 text-emerald-300",
    pending: "bg-yellow-500/20 text-yellow-300",
    rejected: "bg-red-500/20 text-red-300",
    cancelled: "bg-red-500/20 text-red-300",
    not_configured: "bg-neutral-500/20 text-neutral-300",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
        map[status] ?? "bg-neutral-500/20 text-neutral-300"
      }`}
    >
      {status}
    </span>
  );
}
