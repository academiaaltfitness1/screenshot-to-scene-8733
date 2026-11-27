import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import sharkAsset from "@/assets/alt-mascote.webp.asset.json";
const shark = sharkAsset.url;
import { supabase } from "@/integrations/supabase/client";
import { useStaff, settingsQuery } from "@/hooks/use-staff";
import { MODULES, SHORTCUTS, TOOLBAR } from "@/lib/modules";
import { AppMenuBar } from "./AppMenuBar";
import { cn } from "@/lib/utils";
import { lockDesktopSession } from "@/lib/desktop-session";

export function useSignOut() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    lockDesktopSession();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="tabular-nums">
      {now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })} ·{" "}
      {now.toLocaleTimeString("pt-BR")}
    </span>
  );
}

export function AppShell() {
  const { staff, can } = useStaff();
  const navigate = useNavigate();
  const signOut = useSignOut();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: settings } = useQuery(settingsQuery);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const m = /^F(\d{1,2})$/.exec(e.key);
      if (m) {
        const idx = Number(m[1]) - 1;
        const key = SHORTCUTS[idx];
        if (!key) return;
        e.preventDefault();
        if (!can(key)) {
          toast.error(`Sem permissão para ${MODULES[key].title}`);
          return;
        }
        navigate({ to: MODULES[key].path });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [can, navigate]);

  if (pathname === "/admin-mobile") return <div className="min-h-screen bg-[#080808]"><Outlet /></div>;

  const agentOnline =
    settings?.agent_last_seen && Date.now() - new Date(settings.agent_last_seen).getTime() < 3 * 60_000;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Cabeçalho */}
      <header className="bg-chrome-gradient text-chrome-foreground">
        <div className="flex items-center gap-3 px-4 py-1.5">
          <img src={shark} alt="Mascote ALT FITNESS" className="h-10 w-10 object-contain drop-shadow" />
          <div className="leading-tight">
            <h1 className="text-xl font-extrabold tracking-wide">
              ACADEMIA <span className="text-accent">ALT FITNESS</span>
            </h1>
            <p className="text-[11px] uppercase tracking-[0.2em] opacity-70">Sistema de Gestão</p>
          </div>
          <div className="ml-auto hidden text-xs opacity-80 md:block">
            <Clock />
          </div>
        </div>
        <div className="h-1 bg-accent" />
      </header>

      <AppMenuBar />

      {/* Barra de atalhos com ícones */}
      <nav className="bg-toolbar-gradient border-b border-border">
        <div className="flex gap-1 overflow-x-auto px-2 py-1.5">
          {TOOLBAR.map((key) => {
            const mod = MODULES[key];
            const Icon = mod.icon;
            const allowed = can(key);
            const active = pathname.startsWith(mod.path);
            return (
              <button
                key={key}
                type="button"
                disabled={!allowed}
                title={allowed ? mod.title : `${mod.title} (sem permissão)`}
                onClick={() => navigate({ to: mod.path })}
                className={cn(
                  "group flex w-[78px] shrink-0 flex-col items-center gap-1 rounded-md border border-transparent px-1 py-1.5 text-[12px] font-semibold text-secondary-foreground transition",
                  "hover:border-border hover:bg-card hover:shadow-tile disabled:cursor-not-allowed disabled:opacity-35",
                  active && "border-primary/40 bg-card shadow-tile",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-md bg-shark-gradient text-primary-foreground shadow-tile transition group-hover:scale-105",
                    key === "catraca" && "bg-accent text-accent-foreground",
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                {mod.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={signOut}
            className="group flex w-[78px] shrink-0 flex-col items-center gap-1 rounded-md border border-transparent px-1 py-1.5 text-[12px] font-semibold text-secondary-foreground transition hover:border-border hover:bg-card hover:shadow-tile"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-destructive text-destructive-foreground shadow-tile">
              <LogOut className="h-5 w-5" />
            </span>
            Sair
          </button>
        </div>
      </nav>

      <main className="relative min-h-0 flex-1 overflow-auto">
        <Outlet />
      </main>

      {/* Rodapé */}
      <footer className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-border bg-toolbar-gradient px-4 py-1 text-xs text-muted-foreground">
        <span>
          Funcionário: <strong className="text-foreground">{staff?.name ?? "…"}</strong>
          {staff?.cargo ? ` · ${staff.cargo}` : ""}
          {staff?.isAdmin ? " · Administrador" : ""}
        </span>
        <span className="flex items-center gap-1.5">
          <span className={cn("h-2 w-2 rounded-full", agentOnline ? "bg-success" : "bg-muted-foreground/50")} />
          Agente da catraca: {agentOnline ? "conectado" : "sem sinal"}
        </span>
        <span className="ml-auto">Pressione F1 a F12 para abrir os módulos · Esc fecha a janela</span>
      </footer>
    </div>
  );
}
