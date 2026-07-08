import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Acesso admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function AuthPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirect if already signed in
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: (search.redirect as string) || "/admin" });
    });
  }, [navigate, search.redirect]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      navigate({ to: (search.redirect as string) || "/admin" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao autenticar";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 p-4">
      <Card className="w-full max-w-sm space-y-5 border-neutral-800 bg-neutral-900 p-6 text-white">
        <div>
          <h1 className="text-xl font-semibold">Acesso administrativo</h1>
          <p className="mt-1 text-sm text-white/60">
            Entre na conta admin já cadastrada.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-white/80">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-neutral-700 bg-neutral-800 text-white"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-white/80">
              Senha
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-neutral-700 bg-neutral-800 text-white"
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 text-white hover:bg-emerald-600"
          >
            {loading ? "Aguarde…" : "Entrar"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
