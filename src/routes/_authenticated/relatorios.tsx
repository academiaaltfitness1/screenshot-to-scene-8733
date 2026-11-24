import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ModuleWindow } from "@/components/shell/ModuleWindow";
import { Field, ModuleBar, EmptyRow, grid } from "@/components/app/common";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { brl, fmtDate } from "@/lib/format";
import { todayISO } from "@/lib/access";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatório de Vencimentos — ALT FITNESS" },
      { name: "description", content: "Consulte mensalidades por data e situação." },
    ],
  }),
  component: VencimentosReport,
});

type StatusFilter = "todos" | "recebidos" | "pendentes" | "vencidos";

function VencimentosReport() {
  const today = todayISO();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [status, setStatus] = useState<StatusFilter>("todos");

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["receivables-report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receivables")
        .select("*, students(name, matricula)")
        .order("due_date", { ascending: true })
        .limit(5000);
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => rows.filter((row) => {
    if (startDate && row.due_date < startDate) return false;
    if (endDate && row.due_date > endDate) return false;
    if (status === "recebidos" && !row.paid_at) return false;
    if (status === "pendentes" && row.paid_at) return false;
    if (status === "vencidos" && (row.paid_at || row.due_date >= today)) return false;
    return true;
  }), [rows, startDate, endDate, status, today]);

  const totals = useMemo(() => ({
    received: filtered.reduce((sum, row) => sum + (row.paid_at ? Number(row.paid_amount ?? row.amount) : 0), 0),
    pending: filtered.reduce((sum, row) => sum + (!row.paid_at ? Number(row.amount) : 0), 0),
  }), [filtered]);

  return (
    <ModuleWindow module="relatorios">
      <div className="space-y-3 p-3">
        <div>
          <h2 className="text-lg font-bold">Vencimentos de Alunos</h2>
          <p className="text-sm text-muted-foreground">Consulte quem vence em uma data específica, em um período ou quem está pendente.</p>
        </div>
        <ModuleBar>
          <Field label="Data inicial">
            <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </Field>
          <Field label="Data final">
            <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </Field>
          <Field label="Situação">
            <Select value={status} onValueChange={(value) => setStatus(value as StatusFilter)}>
              <SelectTrigger className="w-40 bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="recebidos">Recebidos</SelectItem>
                <SelectItem value="pendentes">Pendentes</SelectItem>
                <SelectItem value="vencidos">Vencidos</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </ModuleBar>
        {startDate && endDate && startDate > endDate && (
          <p className="text-sm text-destructive">A data inicial não pode ser posterior à data final.</p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Total recebido no período</p>
            <p className="text-xl font-bold text-success">{brl(totals.received)}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Total pendente no período</p>
            <p className="text-xl font-bold text-destructive">{brl(totals.pending)}</p>
          </div>
        </div>
        {error && <p className="text-sm text-destructive">Não foi possível carregar os recebimentos.</p>}
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className={grid.table}>
            <thead className={grid.thead}>
              <tr>
                <th className={grid.th}>Vencimento</th>
                <th className={grid.th}>Matrícula</th>
                <th className={grid.th}>Aluno</th>
                <th className={grid.th}>Descrição</th>
                <th className={grid.th}>Valor</th>
                <th className={grid.th}>Situação</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <EmptyRow cols={6} text="Carregando…" />}
              {!isLoading && filtered.length === 0 && <EmptyRow cols={6} text="Nenhum vencimento encontrado nesse filtro." />}
              {!(startDate && endDate && startDate > endDate) && filtered.map((row) => (
                <tr key={row.id} className={grid.tr}>
                  <td className={grid.td}>{fmtDate(row.due_date)}</td>
                  <td className={grid.td}>{row.students?.matricula ?? "—"}</td>
                  <td className={grid.td}>{row.students?.name ?? "—"}</td>
                  <td className={grid.td}>{row.description}</td>
                  <td className={grid.td}>{brl(row.amount)}</td>
                  <td className={grid.td}>
                    {row.paid_at ? <Badge variant="success">Recebido · {fmtDate(row.paid_at)}</Badge>
                      : row.due_date < today ? <Badge variant="destructive">Vencido / pendente</Badge>
                      : <Badge variant="warning">Pendente</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">Exibindo {filtered.length} lançamento(s). Os totais consideram os vencimentos dentro do período selecionado.</p>
      </div>
    </ModuleWindow>
  );
}
