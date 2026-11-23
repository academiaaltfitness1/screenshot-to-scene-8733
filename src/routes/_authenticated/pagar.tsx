import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, CheckCircle2, Trash2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { ModuleWindow } from "@/components/shell/ModuleWindow";
import { Field, ModuleBar, EmptyRow, grid } from "@/components/app/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStaff, settingsQuery } from "@/hooks/use-staff";
import { brl, fmtDate, addDaysISO, errMsg } from "@/lib/format";
import { todayISO } from "@/lib/access";
import { PAYMENT_METHODS, recordCash } from "@/lib/cash";

export const Route = createFileRoute("/_authenticated/pagar")({
  head: () => ({
    meta: [
      { title: "Contas a Pagar — ALT FITNESS" },
      { name: "description", content: "Despesas da academia com alertas de vencimento." },
      { property: "og:title", content: "Contas a Pagar — ALT FITNESS" },
      { property: "og:description", content: "Despesas da academia com alertas de vencimento." },
    ],
  }),
  component: PagarPage,
});

type Payable = Tables<"payables">;
const CATEGORIES = ["Aluguel", "Energia", "Água", "Internet", "Salários", "Manutenção", "Equipamentos", "Impostos", "Fornecedores", "Despesas gerais"];

function PagarPage() {
  const qc = useQueryClient();
  const { staff } = useStaff();
  const { data: settings } = useQuery(settingsQuery);
  const [filter, setFilter] = useState("abertas");
  const [edit, setEdit] = useState<Partial<Payable> | null>(null);
  const today = todayISO();
  const soonLimit = addDaysISO(today, settings?.bill_alert_days ?? 3);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["payables"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payables").select("*").order("due_date").limit(2000);
      if (error) throw error;
      return data;
    },
  });
  const filtered = rows.filter((r) => (filter === "abertas" ? !r.paid_at : filter === "pagas" ? !!r.paid_at : true));
  const alerts = useMemo(() => rows.filter((r) => !r.paid_at && r.due_date <= soonLimit), [rows, soonLimit]);

  const pay = useMutation({
    mutationFn: async ({ p, method }: { p: Payable; method: string }) => {
      const { error } = await supabase.from("payables").update({ paid_at: new Date().toISOString(), payment_method: method }).eq("id", p.id);
      if (error) throw error;
      return recordCash("saida", Number(p.amount), method, `Pagamento: ${p.description}`);
    },
    onSuccess: (inCash) => {
      toast.success(inCash ? "Conta paga e lançada no caixa" : "Conta paga");
      qc.invalidateQueries({ queryKey: ["payables"] });
      qc.invalidateQueries({ queryKey: ["home-alerts"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const remove = async (id: string) => {
    if (!confirm("Excluir esta conta?")) return;
    const { error } = await supabase.from("payables").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["payables"] });
  };

  return (
    <ModuleWindow
      module="pagar"
      actions={
        <Button size="sm" variant="accent" onClick={() => setEdit({ category: "Despesas gerais", due_date: today })}>
          <Plus /> Nova conta
        </Button>
      }
    >
      {alerts.length > 0 && (
        <div className="flex items-center gap-2 border-b border-warning/40 bg-warning/15 px-3 py-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-warning-foreground" />
          <strong>{alerts.length} conta(s) vencida(s) ou a vencer</strong> nos próximos {settings?.bill_alert_days ?? 3} dias —{" "}
          {brl(alerts.reduce((a, r) => a + Number(r.amount), 0))}
        </div>
      )}
      <ModuleBar>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="h-9 w-36 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="abertas">Em aberto</SelectItem>
            <SelectItem value="pagas">Pagas</SelectItem>
            <SelectItem value="todas">Todas</SelectItem>
          </SelectContent>
        </Select>
      </ModuleBar>
      <table className={grid.table}>
        <thead className={grid.thead}>
          <tr>
            <th className={grid.th}>Vencimento</th>
            <th className={grid.th}>Descrição</th>
            <th className={grid.th}>Fornecedor</th>
            <th className={grid.th}>Categoria</th>
            <th className={grid.th}>Valor</th>
            <th className={grid.th}>Situação</th>
            <th className={grid.th}></th>
          </tr>
        </thead>
        <tbody>
          {isLoading && <EmptyRow cols={7} text="Carregando…" />}
          {!isLoading && filtered.length === 0 && <EmptyRow cols={7} text="Nenhuma conta." />}
          {filtered.map((r) => {
            const overdue = !r.paid_at && r.due_date < today;
            const soon = !r.paid_at && !overdue && r.due_date <= soonLimit;
            return (
              <tr key={r.id} className={`${grid.tr} ${overdue ? "bg-destructive/5" : soon ? "bg-warning/10" : ""}`}>
                <td className={grid.td}>{fmtDate(r.due_date)}</td>
                <td className={`${grid.td} cursor-pointer font-semibold`} onClick={() => setEdit(r)}>
                  {r.description}
                </td>
                <td className={grid.td}>{r.supplier ?? "—"}</td>
                <td className={grid.td}>{r.category}</td>
                <td className={`${grid.td} font-semibold`}>{brl(r.amount)}</td>
                <td className={grid.td}>
                  {r.paid_at ? (
                    <Badge variant="success">Paga {fmtDate(r.paid_at)}</Badge>
                  ) : overdue ? (
                    <Badge variant="destructive">Vencida</Badge>
                  ) : soon ? (
                    <Badge variant="warning">A vencer</Badge>
                  ) : (
                    <Badge variant="secondary">Pendente</Badge>
                  )}
                </td>
                <td className={`${grid.td} whitespace-nowrap text-right`}>
                  {!r.paid_at && (
                    <Button size="sm" variant="success" onClick={() => pay.mutate({ p: r, method: "Dinheiro" })}>
                      <CheckCircle2 /> Pagar
                    </Button>
                  )}
                  {staff?.isAdmin && (
                    <Button size="icon" variant="ghost" onClick={() => remove(r.id)}>
                      <Trash2 className="text-destructive" />
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {edit && <PayableDialog p={edit} onClose={() => setEdit(null)} />}
    </ModuleWindow>
  );
}

function PayableDialog({ p, onClose }: { p: Partial<Payable>; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState(p);
  const [amount, setAmount] = useState(p.amount != null ? String(p.amount) : "");
  const [repeat, setRepeat] = useState("1");
  const save = useMutation({
    mutationFn: async () => {
      if (!f.description) throw new Error("Informe a descrição.");
      const base = {
        description: f.description,
        supplier: f.supplier || null,
        category: f.category ?? "Despesas gerais",
        amount: Number(amount.replace(",", ".")),
        notes: f.notes || null,
        payment_method: f.payment_method ?? null,
      };
      if (f.id) {
        const { error } = await supabase.from("payables").update({ ...base, due_date: f.due_date! }).eq("id", f.id);
        if (error) throw error;
        return;
      }
      const n = Math.max(1, Math.min(24, Number(repeat) || 1));
      const rows = Array.from({ length: n }, (_, i) => {
        const d = new Date(`${f.due_date}T12:00:00`);
        d.setMonth(d.getMonth() + i);
        return { ...base, due_date: d.toISOString().slice(0, 10), description: n > 1 ? `${base.description} (${i + 1}/${n})` : base.description };
      });
      const { error } = await supabase.from("payables").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conta salva");
      qc.invalidateQueries({ queryKey: ["payables"] });
      qc.invalidateQueries({ queryKey: ["home-alerts"] });
      onClose();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{f.id ? "Editar conta" : "Nova conta a pagar"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Descrição" className="col-span-2">
            <Input value={f.description ?? ""} onChange={(e) => setF({ ...f, description: e.target.value })} />
          </Field>
          <Field label="Fornecedor">
            <Input value={f.supplier ?? ""} onChange={(e) => setF({ ...f, supplier: e.target.value })} />
          </Field>
          <Field label="Categoria">
            <Select value={f.category ?? "Despesas gerais"} onValueChange={(v) => setF({ ...f, category: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Valor">
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
          </Field>
          <Field label="Vencimento">
            <Input type="date" value={f.due_date ?? ""} onChange={(e) => setF({ ...f, due_date: e.target.value })} />
          </Field>
          {!f.id && (
            <Field label="Repetir (meses)">
              <Input type="number" min={1} max={24} value={repeat} onChange={(e) => setRepeat(e.target.value)} />
            </Field>
          )}
          {f.id && !f.paid_at && (
            <Field label="Forma de pagamento">
              <Select value={f.payment_method ?? "Dinheiro"} onValueChange={(v) => setF({ ...f, payment_method: v })}>
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
          )}
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
