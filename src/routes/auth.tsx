import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, UserRound, ArrowLeft } from "lucide-react";
import sharkAsset from "@/assets/alt-mascote.webp.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errMsg } from "@/lib/format";
import { staffSignIn } from "@/lib/staff.functions";
import { cn } from "@/lib/utils";
import { lockDesktopSession, unlockDesktopSession } from "@/lib/desktop-session";

export const Route = createFileRoute("/auth")({
  head: () => ({
    links: [{ rel: "manifest", href: "/manifest-admin.webmanifest" }],
    meta: [
      { title: "Entrar — ALT FITNESS" },
      { name: "description", content: "Entrada da equipe da Academia ALT FITNESS." },
      { property: "og:title", content: "Entrar — ALT FITNESS" },
      { property: "og:description", content: "Entrada da equipe da Academia ALT FITNESS." },
    ],
  }),
  component: AuthPage,
});

type Mode = "list" | "email" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const signInFn = useServerFn(staffSignIn);
  const [mode, setMode] = useState<Mode>("list");
  const [selected, setSelected] = useState<{ id: string; full_name: string } | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: setupNeeded } = useQuery({
    queryKey: ["setup-needed"],
    queryFn: async () => {
      const { data } = await supabase.rpc("setup_needed");
      return !!data;
    },
  });
  const { data: team = [] } = useQuery({
    queryKey: ["login-team"],
    enabled: setupNeeded === false,
    queryFn: async () => {
      const { data } = await supabase.rpc("login_staff_list");
      return data ?? [];
    },
  });

  // A entrada da equipe exige senha novamente ao abrir a tela de login.
  // A sessão anterior é encerrada para impedir entrada automática no Desktop.
  useEffect(() => {
    lockDesktopSession();
    void supabase.auth.signOut();
  }, []);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      const m = errMsg(err);
      toast.error(m.includes("Invalid login") ? "E-mail ou senha incorretos." : m);
    } finally {
      setBusy(false);
    }
  }

  const createAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name }, emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      if (!data.session) {
        toast.success("Conta criada. Entre com sua senha.");
        return;
      }
      unlockDesktopSession();
      toast.success("Administrador criado! Bem-vindo.");
      navigate({ to: "/painel", replace: true });
    });
  };

  const loginByName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    run(async () => {
      const r = await signInFn({ data: { userId: selected.id, password } });
      if (!r.ok) throw new Error(r.error);
      const { error } = await supabase.auth.setSession({ access_token: r.access_token, refresh_token: r.refresh_token });
      if (error) throw error;
      window.sessionStorage.setItem("alt-desktop-unlocked", "1");
      navigate({ to: "/painel", replace: true });
    });
  };

  const loginByEmail = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        toast.success("Enviamos um link para redefinir a senha.");
        setMode("email");
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      window.sessionStorage.setItem("alt-desktop-unlocked", "1");
      navigate({ to: "/painel", replace: true });
    });
  };

  const subtitle = setupNeeded
    ? "Primeiro acesso — crie o administrador"
    : mode === "list"
      ? selected
        ? "Digite sua senha"
        : "Escolha seu nome"
      : mode === "forgot"
        ? "Recuperar senha"
        : "Entrar com e-mail";

  return (
    <div className="flex min-h-screen items-center justify-center bg-chrome-gradient p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-lg border border-chrome-foreground/15 bg-card shadow-window">
        <div className="bg-chrome-gradient flex items-center gap-3 px-5 py-3 text-chrome-foreground">
          <img src={sharkAsset.url} alt="" className="h-14 w-14 object-contain" />
          <div>
            <h1 className="text-2xl font-extrabold leading-none">
              ACADEMIA <span className="text-accent">ALT FITNESS</span>
            </h1>
            <p className="text-xs opacity-80">{subtitle}</p>
          </div>
        </div>
        <div className="h-1 bg-accent" />

        {setupNeeded ? (
          <form onSubmit={createAdmin} className="space-y-4 p-6">
            <div className="space-y-1.5">
              <Label htmlFor="name">Seu nome</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail (para recuperar a senha)</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" required minLength={6} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" variant="hero" className="w-full" size="lg" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} Criar administrador
            </Button>
          </form>
        ) : mode === "list" ? (
          <div className="p-6">
            {!selected ? (
              <>
                <div className="grid max-h-[50vh] grid-cols-1 gap-2 overflow-auto sm:grid-cols-2">
                  {team.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setSelected(t);
                        setPassword("");
                      }}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition",
                        "hover:border-primary hover:bg-primary/5 hover:shadow-tile",
                      )}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-shark-gradient text-primary-foreground">
                        <UserRound className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{t.full_name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{t.cargo}</span>
                      </span>
                    </button>
                  ))}
                  {team.length === 0 && <p className="text-sm text-muted-foreground">Carregando equipe…</p>}
                </div>
              </>
            ) : (
              <form onSubmit={loginByName} className="space-y-4">
                <div className="flex items-center gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-shark-gradient text-primary-foreground">
                    <UserRound className="h-5 w-5" />
                  </span>
                  <span className="font-semibold">{selected.full_name}</span>
                  <button type="button" className="ml-auto text-sm text-primary hover:underline" onClick={() => setSelected(null)}>
                    Trocar
                  </button>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pw">Senha</Label>
                  <Input id="pw" type="password" autoFocus required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" variant="hero" className="w-full" size="lg" disabled={busy}>
                  {busy && <Loader2 className="animate-spin" />} Entrar
                </Button>
              </form>
            )}
            <div className="mt-5 flex justify-between text-sm">
              <Link to="/" className="text-muted-foreground hover:text-foreground">
                ← Voltar
              </Link>
              <button type="button" className="text-primary hover:underline" onClick={() => setMode("email")}>
                Entrar com e-mail
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={loginByEmail} className="space-y-4 p-6">
            <div className="space-y-1.5">
              <Label htmlFor="email2">E-mail</Label>
              <Input id="email2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {mode === "email" && (
              <div className="space-y-1.5">
                <Label htmlFor="pw2">Senha</Label>
                <Input id="pw2" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            )}
            <Button type="submit" variant="hero" className="w-full" size="lg" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} {mode === "forgot" ? "Enviar link" : "Entrar"}
            </Button>
            <div className="flex justify-between text-sm">
              <button type="button" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground" onClick={() => setMode("list")}>
                <ArrowLeft className="h-3.5 w-3.5" /> Lista da equipe
              </button>
              <button type="button" className="text-primary hover:underline" onClick={() => setMode(mode === "forgot" ? "email" : "forgot")}>
                {mode === "forgot" ? "Voltar" : "Esqueci minha senha"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
