import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, BellRing, CalendarCheck, Users } from "lucide-react";
import gymBg from "@/assets/gym-bg.webp";
import sharkAsset from "@/assets/alt-mascote.webp.asset.json";
const shark = sharkAsset.url;
import { supabase } from "@/integrations/supabase/client";
import { useStaff, settingsQuery } from "@/hooks/use-staff";
import { MODULES, SHORTCUTS } from "@/lib/modules";
import { brl, fmtDate, addDaysISO } from "@/lib/format";
import { todayISO } from "@/lib/access";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel — ALT FITNESS" },
      { name: "description", content: "Tela principal do sistema de gestão da Academia ALT FITNESS." },
      { property: "og:title", content: "Painel — ALT FITNESS" },
      { property: "og:description", content: "Tela principal do sistema de gestão da Academia ALT FITNESS." },
    ],
  }),
  component: Painel,
});

function Painel() {
  const navigate = useNavigate();
  const { can } = useStaff();
  const { data: settings } = useQuery(settingsQuery);
  const alertDays = settings?.bill_alert_days ?? 3;
  const today = todayISO();

  const { data: alerts } = useQuery({
    queryKey: ["home-alerts", today, alertDays, can("pagar")],
    queryFn: async () => {
      const limit = addDaysISO(today, alertDays);
      const [pay, rec, students, freq] = await Promise.all([
        can("pagar")
          ? supabase.from("payables").select("id, description, amount, due_date").is("paid_at", null).lte("due_date", limit).order("due_date")
          : Promise.resolve({ data: [] as { id: string; description: string; amount: number; due_date: string }[] }),
        supabase.from("receivables").select("id, amount, due_date").is("paid_at", null).lt("due_date", today),
        supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "ativo"),
        can("frequencia")
          ? supabase.from("attendance").select("id", { count: "exact", head: true }).eq("allowed", true).eq("direction", "entrada").gte("occurred_at", `${today}T00:00:00`)
          : Promise.resolve({ count: null }),
      ]);
      return {
        payables: pay.data ?? [],
        overdueRec: rec.data ?? [],
        activeStudents: students.count ?? 0,
        todayEntries: freq.count,
      };
    },
  });

  return (
    <div className="relative h-full min-h-[560px] overflow-hidden">
      <img src={gymBg} alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" />
      <div className="absolute inset-0 bg-gradient-to-br from-background/70 via-background/40 to-primary/20" />
      <img
        src={shark}
        alt=""
        className="pointer-events-none absolute -bottom-6 right-4 hidden h-[78%] max-h-[520px] object-contain opacity-90 drop-shadow-2xl lg:block"
      />

      <div className="relative flex h-full flex-col gap-4 p-4 md:flex-row md:items-start md:p-8">
        {/* Quadro flutuante de teclas de atalho */}
        <div className="w-full max-w-sm overflow-hidden rounded-lg border border-primary-deep/30 bg-card/95 shadow-window backdrop-blur">
          <div className="bg-window-title px-4 py-2 text-primary-foreground">
            <h2 className="text-lg font-bold tracking-wide">Teclas de atalho</h2>
          </div>
          <ul className="divide-y divide-border">
            {SHORTCUTS.map((key) => {
              const m = MODULES[key];
              const allowed = can(key);
              return (
                <li key={key}>
                  <button
                    type="button"
                    disabled={!allowed}
                    onClick={() => navigate({ to: m.path })}
                    className="flex w-full items-center gap-3 px-4 py-1.5 text-left text-sm transition hover:bg-secondary disabled:opacity-40"
                  >
                    <span className="kbd-key">{m.fkey}</span>
                    <span className="font-medium">{m.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex w-full max-w-sm flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Stat icon={Users} label="Alunos ativos" value={alerts?.activeStudents ?? "…"} />
            <Stat icon={CalendarCheck} label="Entradas hoje" value={alerts?.todayEntries ?? "—"} />
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-card/95 shadow-window backdrop-blur">
            <div className="flex items-center gap-2 bg-accent px-4 py-2 text-accent-foreground">
              <BellRing className="h-4 w-4" />
              <h2 className="font-bold tracking-wide">Alertas</h2>
            </div>
            <div className="max-h-72 space-y-2 overflow-auto p-3 text-sm">
              {alerts && alerts.overdueRec.length > 0 && (
                <button
                  type="button"
                  onClick={() => navigate({ to: "/receber" })}
                  className="flex w-full items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-left"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <span>
                    <strong>{alerts.overdueRec.length} mensalidade(s) vencida(s)</strong> —{" "}
                    {brl(alerts.overdueRec.reduce((a, r) => a + Number(r.amount), 0))}
                  </span>
                </button>
              )}
              {alerts?.payables.map((p) => {
                const overdue = p.due_date < today;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => navigate({ to: "/pagar" })}
                    className={cn(
                      "flex w-full items-start gap-2 rounded-md border p-2 text-left",
                      overdue ? "border-destructive/30 bg-destructive/10" : "border-warning/40 bg-warning/15",
                    )}
                  >
                    <AlertTriangle className={cn("mt-0.5 h-4 w-4 shrink-0", overdue ? "text-destructive" : "text-warning-foreground")} />
                    <span>
                      <strong>{overdue ? "Conta vencida" : "Conta a vencer"}:</strong> {p.description} — {brl(p.amount)} ·{" "}
                      {fmtDate(p.due_date)}
                    </span>
                  </button>
                );
              })}
              {alerts && alerts.overdueRec.length === 0 && alerts.payables.length === 0 && (
                <p className="text-muted-foreground">Nenhuma conta vencida ou a vencer nos próximos {alertDays} dias.</p>
              )}
              {!alerts && <p className="text-muted-foreground">Carregando…</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-border bg-card/95 p-3 shadow-window backdrop-blur">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {label}
      </div>
      <div className="mt-1 font-display text-3xl font-extrabold text-primary-deep">{value}</div>
    </div>
  );
}
