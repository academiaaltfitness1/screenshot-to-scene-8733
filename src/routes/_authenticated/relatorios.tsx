import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ModuleWindow } from "@/components/shell/ModuleWindow";
import { Field, ModuleBar, EmptyRow, grid } from "@/components/app/common";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { settingsQuery } from "@/hooks/use-staff";
import { brl, fmtDate, addDaysISO } from "@/lib/format";
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

type StatusFilter = "todos" | "recebidos" | "a_receber" | "hoje" | "a_vencer" | "pendentes" | "vencidos";

function VencimentosReport() {
  const today = todayISO();
  const { data: settings } = useQuery(settingsQuery);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<StatusFilter>("a_receber");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [messageIndex, setMessageIndex] = useState(0);
  const soonLimit = addDaysISO(today, settings?.bill_alert_days ?? 3);

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["receivables-report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receivables")
        .select("*, students(name, matricula, whatsapp)")
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
    if (status !== "recebidos" && status !== "todos" && row.paid_at) return false;
    if (status === "hoje" && row.due_date !== today) return false;
    if (status === "a_vencer" && (row.due_date <= today || row.due_date > soonLimit)) return false;
    if (status === "pendentes" && row.due_date <= soonLimit) return false;
    if (status === "vencidos" && row.due_date >= today) return false;
    return true;
  }), [rows, startDate, endDate, status, today, soonLimit]);

  const phoneDigits = (phone: string | null | undefined) => (phone ?? "").replace(/\\D/g, "");
  const selectableRows = filtered.filter((row) => !row.paid_at && phoneDigits(row.students?.whatsapp).length >= 10);
  const selectedRows = selectableRows.filter((row) => selectedIds.includes(row.id));
  const messageFor = (row: (typeof rows)[number]) => {
    const name = row.students?.name ?? "aluno";
    const dueVerb = row.due_date < today ? "venceu em" : "vence em";
    const message = `Olá ${name.split(" ")[0]}! Aqui é da ${settings?.gym_name ?? "Academia ALT FITNESS"}. Sua mensalidade de ${brl(Number(row.amount))} ${dueVerb} ${fmtDate(row.due_date)}.${settings?.pix_key ? ` Chave Pix: ${settings.pix_key}` : ""}`;
    const phone = phoneDigits(row.students?.whatsapp);
    return `https://wa.me/${phone.length <= 11 ? "55" + phone : phone}?text=${encodeURIComponent(message)}`;
  };
  const openNextSelectedMessage = () => {
    if (!selectedRows.length) { toast.error("Selecione pelo menos um aluno com WhatsApp."); return; }
    if (messageIndex >= selectedRows.length) { toast.success("Todas as conversas selecionadas já foram abertas."); return; }
    const opened = window.open(messageFor(selectedRows[messageIndex]), "_blank");
    if (!opened) { toast.error("O navegador bloqueou a nova aba. Permita pop-ups para este sistema e tente novamente."); return; }
    opened.opener = null;
    setMessageIndex((index) => index + 1);
    toast.success(`Conversa ${messageIndex + 1} de ${selectedRows.length} aberta. Envie a mensagem no WhatsApp e avance para a próxima.`);
  };

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
            <Select value={status} onValueChange={(value) => { setStatus(value as StatusFilter); setSelectedIds([]); setMessageIndex(0); }}>
              <SelectTrigger className="w-40 bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="a_receber">A receber</SelectItem>
                <SelectItem value="a_vencer">A vencer</SelectItem>
                <SelectItem value="hoje">Vence hoje</SelectItem>
                <SelectItem value="vencidos">Vencidos</SelectItem>
                <SelectItem value="pendentes">Pendentes</SelectItem>
                <SelectItem value="recebidos">Recebidos</SelectItem>
                <SelectItem value="todos">Todos</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Button size="sm" variant="outline" disabled={!selectableRows.length} onClick={() => { setSelectedIds(selectableRows.map((row) => row.id)); setMessageIndex(0); }}>Marcar todos ({selectableRows.length})</Button>
          <Button size="sm" variant="outline" disabled={!selectedIds.length} onClick={() => { setSelectedIds([]); setMessageIndex(0); }}>Limpar seleção</Button>
          <Badge variant="secondary">Selecionados: {selectedRows.length}</Badge>
          <Button size="sm" disabled={!selectedRows.length || messageIndex >= selectedRows.length} onClick={openNextSelectedMessage}><Send /> Abrir próxima conversa ({Math.max(0, selectedRows.length - messageIndex)})</Button>
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
                <th className={grid.th}>Selecionar</th>
                <th className={grid.th}>Vencimento</th>
                <th className={grid.th}>Matrícula</th>
                <th className={grid.th}>Aluno</th>
                <th className={grid.th}>Descrição</th>
                <th className={grid.th}>Valor</th>
                <th className={grid.th}>Situação</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <EmptyRow cols={7} text="Carregando…" />}
              {!isLoading && filtered.length === 0 && <EmptyRow cols={7} text="Nenhum vencimento encontrado nesse filtro." />}
              {!(startDate && endDate && startDate > endDate) && filtered.map((row) => (
                <tr key={row.id} className={grid.tr}>
                  <td className={grid.td}>{!row.paid_at && phoneDigits(row.students?.whatsapp).length >= 10 ? <input aria-label={`Selecionar ${row.students?.name}`} type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => { setSelectedIds((current) => current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id]); setMessageIndex(0); }} /> : "—"}</td>
                  <td className={grid.td}>{fmtDate(row.due_date)}</td>
                  <td className={grid.td}>{row.students?.matricula ?? "—"}</td>
                  <td className={grid.td}>{row.students?.name ?? "—"}</td>
                  <td className={grid.td}>{row.description}</td>
                  <td className={grid.td}>{brl(row.amount)}</td>
                  <td className={grid.td}>
                    {row.paid_at ? <Badge variant="success">Recebido · {fmtDate(row.paid_at)}</Badge>
                      : row.due_date < today ? <Badge variant="destructive">Vencido</Badge>
                      : row.due_date === today ? <Badge variant="warning">Vence hoje</Badge>
                      : row.due_date <= soonLimit ? <Badge variant="warning">A vencer</Badge>
                      : <Badge variant="secondary">Pendente</Badge>}
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
