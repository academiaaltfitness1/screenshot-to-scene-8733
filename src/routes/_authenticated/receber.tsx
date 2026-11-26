import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ModuleWindow } from "@/components/shell/ModuleWindow";
import { Field, ModuleBar, SearchBox, EmptyRow, grid } from "@/components/app/common";
import { StudentPicker } from "@/components/app/StudentPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { settingsQuery } from "@/hooks/use-staff";
import { brl, fmtDate, addDaysISO, errMsg } from "@/lib/format";
import { todayISO } from "@/lib/access";
import { PAYMENT_METHODS, recordCash } from "@/lib/cash";
import { PaymentProofReview } from "@/components/aluno/PaymentProofReview";

export const Route = createFileRoute("/_authenticated/receber")({
  head: () => ({
    meta: [
      { title: "Contas a Receber — ALT FITNESS" },
      { name: "description", content: "Mensalidades pagas, pendentes e vencidas." },
      { property: "og:title", content: "Contas a Receber — ALT FITNESS" },
      { property: "og:description", content: "Mensalidades pagas, pendentes e vencidas." },
    ],
  }),
  component: ReceberPage,
});

type Filter = "abertas" | "hoje" | "a_vencer" | "pendentes" | "vencidas" | "pagas" | "todas";

function ReceberPage() {
  const { data: settings } = useQuery(settingsQuery);
  const [filter, setFilter] = useState<Filter>("abertas");
  const [q, setQ] = useState("");
  const [paying, setPaying] = useState<{ id: string; amount: number; desc: string; name: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const today = todayISO();
  const soonLimit = addDaysISO(today, settings?.bill_alert_days ?? 3);
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["receivables"],
    queryFn: async () => {
      const { data, error } = await supabase.from("receivables").select("*, students(name, matricula, whatsapp)").order("due_date", { ascending: false }).limit(2000);
      if (error) throw error;
      return data;
    },
  });
  const filtered = useMemo(() => {
    const t = q.toLowerCase();
    return rows.filter((r) => {
      const daysUntilDue = Math.round((new Date(r.due_date + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86400000);
      if (filter === "abertas" && r.paid_at) return false;
      if (filter === "vencidas" && (r.paid_at || daysUntilDue >= 0)) return false;
      if (filter === "hoje" && (r.paid_at || daysUntilDue !== 0)) return false;
      if (filter === "a_vencer" && (r.paid_at || daysUntilDue <= 0 || daysUntilDue > (settings?.bill_alert_days ?? 3))) return false;
      if (filter === "pendentes" && (r.paid_at || daysUntilDue <= (settings?.bill_alert_days ?? 3))) return false;
      if (filter === "pagas" && !r.paid_at) return false;
      return !t || r.students?.name.toLowerCase().includes(t) || r.description.toLowerCase().includes(t);
    });
  }, [rows, filter, q, today, settings?.bill_alert_days]);
  const totals = useMemo(() => {
    const open = rows.filter((r) => !r.paid_at);
    return { open: open.reduce((a, r) => a + Number(r.amount), 0), overdue: open.filter((r) => r.due_date < today).reduce((a, r) => a + Number(r.amount), 0) };
  }, [rows, today]);
  return (
    <ModuleWindow module="receber" actions={<Button size="sm" variant="accent" onClick={() => setCreating(true)}><Plus /> Novo lançamento</Button>}>
      <ModuleBar>
        <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}><SelectTrigger className="h-9 w-36 bg-card"><SelectValue /></SelectTrigger><SelectContent>
          <SelectItem value="abertas">A receber (todos em aberto)</SelectItem><SelectItem value="hoje">Vence hoje</SelectItem><SelectItem value="a_vencer">A vencer</SelectItem><SelectItem value="pendentes">Pendentes</SelectItem><SelectItem value="vencidas">Vencidos</SelectItem><SelectItem value="pagas">Pagas</SelectItem><SelectItem value="todas">Todas</SelectItem>
        </SelectContent></Select>
        <SearchBox value={q} onChange={setQ} placeholder="Aluno ou descrição" />
        <div className="ml-auto flex gap-2 text-sm"><Badge variant="warning">Em aberto: {brl(totals.open)}</Badge><Badge variant="destructive">Vencido: {brl(totals.overdue)}</Badge></div>
      </ModuleBar>
      <table className={grid.table}><thead className={grid.thead}><tr><th className={grid.th}>Vencimento</th><th className={grid.th}>Aluno</th><th className={grid.th}>Descrição</th><th className={grid.th}>Valor</th><th className={grid.th}>Situação</th><th className={grid.th}></th></tr></thead><tbody>
        {isLoading && <EmptyRow cols={6} text="Carregando…" />}{!isLoading && filtered.length === 0 && <EmptyRow cols={6} text="Nenhum lançamento." />}
        {filtered.map((r) => { const overdue = !r.paid_at && r.due_date < today; const soon = !r.paid_at && !overdue && r.due_date <= soonLimit; return <tr key={r.id} className={`${grid.tr} ${overdue ? "bg-destructive/5" : ""}`}>
          <td className={grid.td}>{fmtDate(r.due_date)}</td><td className={grid.td}><span className="mr-1 font-mono text-xs text-muted-foreground">{r.students?.matricula}</span>{r.students?.name ?? "—"}</td><td className={grid.td}>{r.description}</td><td className={`${grid.td} font-semibold`}>{brl(r.amount)}</td><td className={grid.td}>{r.paid_at ? <Badge variant="success">Pago {fmtDate(r.paid_at)} · {r.payment_method}</Badge> : overdue ? <Badge variant="destructive">Vencida</Badge> : soon ? <Badge variant="warning">A vencer</Badge> : <Badge variant="secondary">Pendente</Badge>}</td>
          <td className={`${grid.td} whitespace-nowrap text-right`}>{!r.paid_at && <Button size="sm" variant="success" onClick={() => setPaying({ id: r.id, amount: Number(r.amount), desc: r.description, name: r.students?.name ?? "" })}><CheckCircle2 /> Receber</Button>}</td>
        </tr>; })}
      </tbody></table>
      {paying && <PayDialog bill={paying} onClose={() => setPaying(null)} />}{creating && <NewReceivable onClose={() => setCreating(false)} />}<PaymentProofReview />
    </ModuleWindow>
  );
}

function PayDialog({ bill, onClose }: { bill: { id: string; amount: number; desc: string; name: string }; onClose: () => void }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState(String(bill.amount));
  const [method, setMethod] = useState("Dinheiro");
  const pay = useMutation({
    mutationFn: async () => {
      const value = Number(amount.replace(",", "."));
      const { error } = await supabase
        .from("receivables")
        .update({ paid_at: new Date().toISOString(), paid_amount: value, payment_method: method })
        .eq("id", bill.id);
      if (error) throw error;
      return recordCash("entrada", value, method, `Recebimento: ${bill.name} — ${bill.desc}`);
    },
    onSuccess: (inCash) => {
      toast.success(inCash ? "Pagamento recebido e lançado no caixa" : "Pagamento recebido (caixa fechado)");
      ["receivables", "students-overview", "home-alerts"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      onClose();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Receber pagamento</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {bill.name} — {bill.desc}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor recebido">
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
          </Field>
          <Field label="Forma">
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger>
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
          </Field>
        </div>
        <DialogFooter>
          <Button variant="success" onClick={() => pay.mutate()} disabled={pay.isPending}>
            Confirmar recebimento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewReceivable({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [student, setStudent] = useState<string | null>(null);
  const [desc, setDesc] = useState("Mensalidade");
  const [amount, setAmount] = useState("");
  const [due, setDue] = useState(todayISO());
  const save = useMutation({
    mutationFn: async () => {
      if (!student) throw new Error("Selecione o aluno.");
      const { error } = await supabase.from("receivables").insert({ student_id: student, description: desc, amount: Number(amount.replace(",", ".")), due_date: due });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lançamento criado");
      qc.invalidateQueries({ queryKey: ["receivables"] });
      onClose();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo lançamento a receber</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Aluno">
            <StudentPicker value={student} onChange={setStudent} />
          </Field>
          <Field label="Descrição">
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor">
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
            </Field>
            <Field label="Vencimento">
              <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="hero" onClick={() => save.mutate()}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
