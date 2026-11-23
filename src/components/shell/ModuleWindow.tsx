import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { X, Lock } from "lucide-react";
import { MODULES, type ModuleKey } from "@/lib/modules";
import { useStaff } from "@/hooks/use-staff";
import { cn } from "@/lib/utils";

interface Props {
  module: ModuleKey;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
  adminOnly?: boolean;
}

export function ModuleWindow({ module, children, actions, className, adminOnly }: Props) {
  const mod = MODULES[module];
  const Icon = mod.icon;
  const navigate = useNavigate();
  const { can, staff, isLoading } = useStaff();
  const allowed = adminOnly ? !!staff?.isAdmin : can(module);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (document.querySelector("[role='dialog']")) return;
      navigate({ to: "/painel" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  return (
    <div className="h-full p-2 md:p-4">
      <section
        className={cn(
          "mx-auto flex h-full max-w-[1400px] flex-col overflow-hidden rounded-lg border border-primary-deep/30 bg-card shadow-window",
          className,
        )}
      >
        <header className="bg-window-title flex items-center gap-2 px-3 py-1.5 text-primary-foreground">
          <Icon className="h-4 w-4" />
          <h2 className="text-base font-bold tracking-wide">
            {mod.title}
            {mod.fkey && <span className="ml-2 text-xs font-semibold opacity-75">[{mod.fkey}]</span>}
          </h2>
          <div className="ml-auto flex items-center gap-2">{allowed && actions}</div>
          <button
            type="button"
            aria-label="Fechar janela"
            onClick={() => navigate({ to: "/painel" })}
            className="ml-2 flex h-6 w-6 items-center justify-center rounded bg-destructive/90 text-destructive-foreground hover:bg-destructive"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-8 text-sm text-muted-foreground">Carregando…</div>
          ) : allowed ? (
            children
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center">
              <Lock className="h-10 w-10 text-muted-foreground" />
              <p className="text-lg font-semibold">Acesso não liberado</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Peça ao administrador para liberar o módulo “{mod.title}” no Cadastro de Funcionários.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
