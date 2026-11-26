import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Send, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ModuleWindow } from "@/components/shell/ModuleWindow";
import { Field, ModuleBar, EmptyRow, grid } from "@/components/app/common";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

type StatusFilter = "todos" | "recebidos" | "hoje" | "a_vencer" | "vencidos";
type MessageTemplates = { a_vencer: string; hoje: string; vencidos: string; recebidos: string };
const defaultTemplates: MessageTemplates = {
  a_vencer: "Olá {nome}! Aqui é da {academia}. Sua mensalidade de {valor} vence em {vencimento}.{pix}",
  hoje: "Olá {nome}! Aqui é da {academia}. Sua mensalidade de {valor} vence hoje ({vencimento}).{pix}",
  vencidos: "Olá {nome}! Aqui é da {academia}. Sua mensalidade de {valor} venceu em {vencimento} e está em aberto.{pix}",
  recebidos: "Olá {nome}! Aqui é da {academia}. Confirmamos o recebimento da sua mensalidade de {valor}, com vencimento em {vencimento}. Obrigado!",
};

function VencimentosReport() {
  const today = todayISO();
  const { data: settings } = useQuery(settingsQuery);
  const queryClient = useQueryClient();
  const [showMessageSettings, setShowMessageSettings] = useState(false);
  const [templates, setTemplates] = useState<MessageTemplates>(defaultTemplates);
  const [savingTemplates, setSavingTemplates] = useState(false);
  useEffect(() => {
    if (settings?.receivables_message_templates) setTemplates({ ...defaultTemplates, ...(settings.receivables_message_templates as Partial<MessageTemplates>) });
  }, [settings?.receivables_message_templates]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<StatusFilter>("a_vencer");
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

  const phoneDigits = (phone: string | null | undefined) => (phone ?? "").replace(/\D/g, "");
  const selectableRows = filtered.filter((row) => phoneDigits(row.students?.whatsapp).length >= 10);
  const selectedRows = selectableRows.filter((row) => selectedIds.includes(row.id));
  const allSelectableSelected = selectableRows.length > 0 && selectableRows.every((row) => selectedIds.includes(row.id));
  const toggleAllSelectable = () => {
    // Seleção em lote considera todos os alunos visíveis que possuem WhatsApp válido.
    // Se a seleção estiver parcial, completa; se estiver completa, limpa.
    setSelectedIds(allSelectableSelected ? [] : selectableRows.map((row) => row.id));
    setMessageIndex(0);
  };
  const messageFor = (row: (typeof rows)[number]) => {
    const name = row.students?.name ?? "aluno";
    const templateKey: keyof MessageTemplates = row.paid_at ? "recebidos" : row.due_date < today ? "vencidos" : row.due_date === today ? "hoje" : "a_vencer";
    const message = templates[templateKey]
      .replaceAll("{nome}", name.split(" ")[0])
      .replaceAll("{academia}", settings?.gym_name ?? "Academia ALT FITNESS")
      .replaceAll("{valor}", brl(Number(row.amount)))
      .replaceAll("{vencimento}", fmtDate(row.due_date))
      .replaceAll("{chave_pix}", settings?.pix_key ?? "")
      .replaceAll("{pix}", settings?.pix_key ? ` Chave Pix: ${settings.pix_key}` : "");
    const phone = phoneDigits(row.students?.whatsapp);
    return `https://wa.me/${phone.length <= 11 ? "55" + phone : phone}?text=${encodeURIComponent(message)}`;
  };
  const saveTemplates = async () => {
    setSavingTemplates(true);
    const { error } = await supabase.from("settings").update({ receivables_message_templates: templates }).eq("id", 1);
    setSavingTemplates(false);
    if (error) { toast.error("Não foi possível salvar os modelos de mensagem."); return; }
    await queryClient.invalidateQueries({ queryKey: ["settings"] });
    toast.success("Modelos de mensagem salvos.");
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
        <div className="flex justify-end"><Button size="sm" variant="outline" onClick={() => setShowMessageSettings((value) => !value)}><Settings2 className="mr-2 h-4 w-4" />{showMessageSettings ? "Fechar modelos" : "Configurar mensagens"}</Button></div>
        {showMessageSettings && <section className="space-y-3 rounded-lg border border-border bg-card p-3">
          <div><h3 className="font-semibold">Modelos de mensagens do WhatsApp</h3><p className="text-xs text-muted-foreground">Edite os textos. Variáveis disponíveis: {`{nome}`}, {`{academia}`}, {`{valor}`}, {`{vencimento}`}, {`{pix}`} e {`{chave_pix}`}.</p></div>
          {([{ key: "a_vencer", label: "A vencer" }, { key: "hoje", label: "Vence hoje" }, { key: "vencidos", label: "Vencidos" }, { key: "recebidos", label: "Recebidos" }] as const).map(({ key, label }) => <Field key={key} label={label}><Textarea value={templates[key]} onChange={(event) => setTemplates((current) => ({ ...current, [key]: event.target.value }))} rows={3} /></Field>)}
          <div className="flex justify-end"><Button size="sm" onClick={saveTemplates} disabled={savingTemplates}>{savingTemplates ? "Salvando…" : "Salvar modelos"}</Button></div>
        </section>}
        <ModuleBar>
          <Field label="Data inicial">
            <Input type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); setSelectedIds([]); setMessageIndex(0); }} />
          </Field>
          <Field label="Data final">
            <Input type="date" value={endDate} onChange={(event) => { setEndDate(event.target.value); setSelectedIds([]); setMessageIndex(0); }} />
          </Field>
          <Field label="Situação">
            <Select value={status} onValueChange={(value) => { setStatus(value as StatusFilter); setSelectedIds([]); setMessageIndex(0); }}>
              <SelectTrigger className="w-40 bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="a_vencer">A vencer</SelectItem>
                <SelectItem value="hoje">Vence hoje</SelectItem>
                <SelectItem value="vencidos">Vencidos</SelectItem>
                <SelectItem value="recebidos">Recebidos</SelectItem>
                <SelectItem value="todos">Todos</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Button size="sm" variant="outline" disabled={!selectableRows.length} onClick={toggleAllSelectable}>
            {allSelectableSelected ? "Desmarcar todos" : `Marcar todos (${selectableRows.length})`}
          </Button>
          <Button size="sm" variant="ghost" disabled={!selectedIds.length} onClick={() => { setSelectedIds([]); setMessageIndex(0); }}>Limpar seleção</Button>
          <Badge variant="secondary">Selecionados: {selectedRows.length} de {selectableRows.length}</Badge>
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
                  <td className={grid.td}>{phoneDigits(row.students?.whatsapp).length >= 10 ? <input aria-label={`Selecionar ${row.students?.name}`} type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => { setSelectedIds((current) => current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id]); setMessageIndex(0); }} /> : "—"}</td>
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
        <p className="text-xs text-muted-foreground">Exibindo {filtered.length} lançamento(s). Somente alunos com WhatsApp cadastrado podem ser selecionados. Marque individualmente ou use “Marcar todos”; depois você pode desmarcar qualquer aluno antes de abrir as conversas.</p>
      </div>
    </ModuleWindow>
  );
}
