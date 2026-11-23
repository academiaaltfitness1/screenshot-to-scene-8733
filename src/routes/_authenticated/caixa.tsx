import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Lock, Unlock, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ModuleWindow } from "@/components/shell/ModuleWindow";
import { Field, EmptyRow, grid } from "@/components/app/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { brl, fmtDateTime, errMsg } from "@/lib/format";
import { PAYMENT_METHODS, getOpenSession } from "@/lib/cash";

export const Route = createFileRoute("/_authenticated/caixa")({
  head: () => ({
    meta: [
      { title: "Controle do Caixa — ALT FITNESS" },
      { name: "description", content: "Abertura, movimentos e fechamento do caixa diário." },
      { property: "og:title", content: "Controle do Caixa — ALT FITNESS" },
      { property: "og:description", content: "Abertura, movimentos e fechamento do caixa diário." },
    ],
  }),
  component: CaixaPage,
});

function CaixaPage() {
  const qc = useQueryClient();
  const [opening, setOpening] = useState("0");
  const [counted, setCounted] = useState("");
  const [mov, setMov] = useState({ type: "entrada" as "entrada" | "saida", amount: "", method: "Dinheiro", description: "" });

  const { data: session, isLoading } = useQuery({ queryKey: ["cash-session"], queryFn: getOpenSession });
  const { data: movs = [] } = useQuery({
    queryKey: ["cash-movs", session?.id],
    enabled: !!session,
    queryFn: async () => (await supabase.from("cash_movements").select("*").eq("session_id", session!.id).order("created_at", { ascending: false })).data ?? [],
  });
  const { data: history = [] } = useQuery({
    queryKey: ["cash-history"],
    queryFn: async () => (await supabase.from("cash_sessions").select("*").not("closed_at", "is", null).order("closed_at", { ascending: false }).limit(10)).data ?? [],
  });

  const ins = movs.filter((m) => m.type === "entrada").reduce((a, m) => a + Number(m.amount), 0);
  const outs = movs.filter((m) => m.type === "saida").reduce((a, m) => a + Number(m.amount), 0);
  const cashIn = movs.filter((m) => m.method === "Dinheiro").reduce((a, m) => a + (m.type === "entrada" ? 1 : -1) * Number(m.amount), 0);
  const expectedCash = Number(session?.opening_amount ?? 0) + cashIn;
  const byMethod = PAYMENT_METHODS.map((m) => ({
    m,
    v: movs.filter((x) => x.method === m).reduce((a, x) => a + (x.type === "entrada" ? 1 : -1) * Number(x.amount), 0),
  }));
  const refresh = () => ["cash-session", "cash-movs", "cash-history"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

  const open = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("cash_sessions").insert({ opening_amount: Number(opening.replace(",", ".")), opened_by: u.user?.id ?? null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Caixa aberto");
      refresh();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const close = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("cash_sessions")
        .update({ closed_at: new Date().toISOString(), closed_by: u.user?.id ?? null, closing_amount: Number((counted || String(expectedCash)).replace(",", ".")) })
        .eq("id", session!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Caixa fechado");
      setCounted("");
      refresh();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const addMov = useMutation({
    mutationFn: async () => {
      const amount = Number(mov.amount.replace(",", "."));
      if (!amount) throw new Error("Informe o valor.");
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("cash_movements").insert({ session_id: session!.id, type: mov.type, amount, method: mov.method, description: mov.description || (mov.type === "entrada" ? "Suprimento" : "Sangria"), created_by: u.user?.id ?? null });
      if (error) throw error;
    },
    onSuccess: () => {
      setMov({ ...mov, amount: "", description: "" });
      refresh();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <ModuleWindow module="caixa">
      {isLoading ? (
        <p className="p-6 text-sm text-muted-foreground">Carregando…</p>
      ) : !session ? (
        <div className="mx-auto max-w-sm space-y-4 p-8 text-center">
          <Lock className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="text-2xl font-bold">Caixa fechado</h3>
          <Field label="Valor inicial (troco)">
            <Input value={opening} onChange={(e) => setOpening(e.target.value)} inputMode="decimal" className="text-center text-lg" />
          </Field>
          <Button variant="hero" size="lg" className="w-full" onClick={() => open.mutate()}>
            <Unlock /> Abrir caixa
          </Button>
          <HistoryTable rows={history} />
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_320px]">
          <div>
            <div className="grid grid-cols-2 gap-3 p-3 md:grid-cols-4">
              <Kpi label="Abertura" value={brl(session.opening_amount)} sub={fmtDateTime(session.opened_at)} />
              <Kpi label="Entradas" value={brl(ins)} tone="success" />
              <Kpi label="Saídas" value={brl(outs)} tone="destructive" />
              <Kpi label="Dinheiro esperado" value={brl(expectedCash)} />
            </div>
            <div className="flex flex-wrap items-end gap-2 border-y border-border bg-toolbar-gradient px-3 py-2">
              <Select value={mov.type} onValueChange={(v) => setMov({ ...mov, type: v as "entrada" | "saida" })}>
                <SelectTrigger className="h-9 w-36 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Suprimento</SelectItem>
                  <SelectItem value="saida">Sangria / saída</SelectItem>
                </SelectContent>
              </Select>
              <Input className="h-9 w-28 bg-card" placeholder="Valor" value={mov.amount} onChange={(e) => setMov({ ...mov, amount: e.target.value })} />
              <Select value={mov.method} onValueChange={(v) => setMov({ ...mov, method: v })}>
                <SelectTrigger className="h-9 w-40 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input className="h-9 max-w-xs flex-1 bg-card" placeholder="Descrição" value={mov.description} onChange={(e) => setMov({ ...mov, description: e.target.value })} />
              <Button size="sm" variant="outline" onClick={() => addMov.mutate()}>
                Lançar
              </Button>
            </div>
            <table className={grid.table}>
              <thead className={grid.thead}>
                <tr>
                  <th className={grid.th}>Hora</th>
                  <th className={grid.th}>Descrição</th>
                  <th className={grid.th}>Forma</th>
                  <th className={`${grid.th} text-right`}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {movs.length === 0 && <EmptyRow cols={4} text="Nenhum movimento ainda." />}
                {movs.map((m) => (
                  <tr key={m.id} className={grid.tr}>
                    <td className={`${grid.td} tabular-nums`}>{new Date(m.created_at).toLocaleTimeString("pt-BR", { timeStyle: "short" })}</td>
                    <td className={grid.td}>
                      <span className="inline-flex items-center gap-1.5">
                        {m.type === "entrada" ? <ArrowDownCircle className="h-4 w-4 text-success" /> : <ArrowUpCircle className="h-4 w-4 text-destructive" />}
                        {m.description}
                      </span>
                    </td>
                    <td className={grid.td}>{m.method}</td>
                    <td className={`${grid.td} text-right font-semibold ${m.type === "entrada" ? "text-success" : "text-destructive"}`}>
                      {m.type === "saida" ? "-" : ""}
                      {brl(m.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <aside className="space-y-3 border-l border-border bg-muted/40 p-4">
            <h3 className="text-lg font-bold">Resumo por forma</h3>
            <ul className="space-y-1 text-sm">
              {byMethod.map((b) => (
                <li key={b.m} className="flex justify-between">
                  <span>{b.m}</span>
                  <strong>{brl(b.v)}</strong>
                </li>
              ))}
            </ul>
            <Field label="Dinheiro contado na gaveta">
              <Input value={counted} placeholder={String(expectedCash.toFixed(2))} onChange={(e) => setCounted(e.target.value)} className="bg-card" />
            </Field>
            {counted && (
              <p className="text-sm">
                Diferença:{" "}
                <strong className={Number(counted.replace(",", ".")) - expectedCash < 0 ? "text-destructive" : "text-success"}>
                  {brl(Number(counted.replace(",", ".")) - expectedCash)}
                </strong>
              </p>
            )}
            <Button variant="destructive" className="w-full" onClick={() => confirm("Fechar o caixa agora?") && close.mutate()}>
              <Lock /> Fechar caixa
            </Button>
          </aside>
        </div>
      )}
    </ModuleWindow>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "success" | "destructive" }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-tile">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`font-display text-2xl font-extrabold ${tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "text-primary-deep"}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function HistoryTable({ rows }: { rows: { id: string; opened_at: string; closed_at: string | null; opening_amount: number; closing_amount: number | null }[] }) {
  if (!rows.length) return null;
  return (
    <div className="pt-6 text-left">
      <h4 className="mb-2 font-bold">Últimos fechamentos</h4>
      <ul className="space-y-1 text-sm">
        {rows.map((r) => (
          <li key={r.id} className="flex justify-between rounded border border-border bg-card px-2 py-1">
            <span>{fmtDateTime(r.closed_at)}</span>
            <strong>{brl(r.closing_amount)}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
