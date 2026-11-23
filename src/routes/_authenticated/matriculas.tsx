import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, RefreshCw, Ban, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { usePlans } from "@/hooks/use-data";
import { ModuleWindow } from "@/components/shell/ModuleWindow";
import { Field, ModuleBar, SearchBox, EmptyRow, grid } from "@/components/app/common";
import { StudentPicker } from "@/components/app/StudentPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { brl, fmtDate, addMonthsISO, addDaysISO, errMsg } from "@/lib/format";
import { todayISO } from "@/lib/access";

export const Route = createFileRoute("/_authenticated/matriculas")({
  head: () => ({
    meta: [
      { title: "Controle de Matrículas — ALT FITNESS" },
      { name: "description", content: "Planos, matrículas e renovações da Academia ALT FITNESS." },
      { property: "og:title", content: "Controle de Matrículas — ALT FITNESS" },
      { property: "og:description", content: "Planos, matrículas e renovações da Academia ALT FITNESS." },
    ],
  }),
  component: MatriculasPage,
});

type Plan = Tables<"plans">;
type EnrollmentRow = Tables<"enrollments"> & { students: { name: string; matricula: number } | null };


interface Draft {
  student_id: string | null;
  plan_id: string;
  start_date: string;
  price: string;
  createBill: boolean;
  paidNow: boolean;
  method: string;
}

function MatriculasPage() {
  const [q, setQ] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const qc = useQueryClient();
  const today = todayISO();
  const { data: plans = [] } = usePlans();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["enrollments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("*, students(name, matricula)")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data as EnrollmentRow[];
    },
  });

  const filtered = useMemo(() => {
    const t = q.toLowerCase();
    return rows.filter(
      (r) =>
        (!onlyActive || r.status === "ativa") &&
        (!t || r.students?.name.toLowerCase().includes(t) || String(r.students?.matricula).includes(t)),
    );
  }, [rows, q, onlyActive]);

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("enrollments").update({ status: "cancelada" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Matrícula cancelada");
      qc.invalidateQueries({ queryKey: ["enrollments"] });
      qc.invalidateQueries({ queryKey: ["students-overview"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  function openNew(studentId: string | null = null, planId?: string, start?: string) {
    const p = plans.find((x) => x.id === planId) ?? plans.find((x) => x.active);
    setDraft({
      student_id: studentId,
      plan_id: p?.id ?? "",
      start_date: start ?? today,
      price: String(p?.price ?? ""),
      createBill: true,
      paidNow: false,
      method: "Dinheiro",
    });
  }

  return (
    <ModuleWindow
      module="matriculas"
      actions={
        <Button size="sm" variant="accent" onClick={() => openNew()}>
          <Plus /> Nova matrícula
        </Button>
      }
    >
      <Tabs defaultValue="matriculas" className="flex h-full flex-col">
        <div className="border-b border-border bg-toolbar-gradient px-3 pt-2">
          <TabsList>
            <TabsTrigger value="matriculas">Matrículas</TabsTrigger>
            <TabsTrigger value="planos">Planos</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="matriculas" className="mt-0 flex-1">
          <ModuleBar>
            <SearchBox value={q} onChange={setQ} placeholder="Aluno ou matrícula" />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={onlyActive} onCheckedChange={(v) => setOnlyActive(!!v)} /> Somente ativas
            </label>
          </ModuleBar>
          <table className={grid.table}>
            <thead className={grid.thead}>
              <tr>
                <th className={grid.th}>Matr.</th>
                <th className={grid.th}>Aluno</th>
                <th className={grid.th}>Plano</th>
                <th className={grid.th}>Início</th>
                <th className={grid.th}>Vencimento</th>
                <th className={grid.th}>Valor</th>
                <th className={grid.th}>Situação</th>
                <th className={grid.th}></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <EmptyRow cols={8} text="Carregando…" />}
              {!isLoading && filtered.length === 0 && <EmptyRow cols={8} text="Nenhuma matrícula." />}
              {filtered.map((r) => {
                const expired = r.end_date < today;
                const soon = !expired && r.end_date <= addDaysISO(today, 7);
                return (
                  <tr key={r.id} className={grid.tr}>
                    <td className={`${grid.td} font-mono`}>{r.students?.matricula}</td>
                    <td className={grid.td}>{r.students?.name}</td>
                    <td className={grid.td}>
                      {r.plan_name} <span className="text-xs text-muted-foreground">· {r.modality}</span>
                    </td>
                    <td className={grid.td}>{fmtDate(r.start_date)}</td>
                    <td className={grid.td}>{fmtDate(r.end_date)}</td>
                    <td className={grid.td}>{brl(r.price)}</td>
                    <td className={grid.td}>
                      {r.status === "cancelada" ? (
                        <Badge variant="secondary">Cancelada</Badge>
                      ) : expired ? (
                        <Badge variant="destructive">Vencida</Badge>
                      ) : soon ? (
                        <Badge variant="warning">Vence em breve</Badge>
                      ) : (
                        <Badge variant="success">Em dia</Badge>
                      )}
                    </td>
                    <td className={`${grid.td} whitespace-nowrap text-right`}>
                      {r.status === "ativa" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            title="Renovação rápida"
                            onClick={() => openNew(r.student_id, r.plan_id ?? undefined, expired ? today : addDaysISO(r.end_date, 1))}
                          >
                            <RefreshCw /> Renovar
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Cancelar"
                            onClick={() => confirm("Cancelar esta matrícula?") && cancel.mutate(r.id)}
                          >
                            <Ban className="text-destructive" />
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TabsContent>
        <TabsContent value="planos" className="mt-0 flex-1">
          <PlansTab plans={plans} />
        </TabsContent>
      </Tabs>
      {draft && <EnrollDialog draft={draft} setDraft={setDraft} plans={plans} />}
    </ModuleWindow>
  );
}

function EnrollDialog({ draft, setDraft, plans }: { draft: Draft; setDraft: (d: Draft | null) => void; plans: Plan[] }) {
  const qc = useQueryClient();
  const plan = plans.find((p) => p.id === draft.plan_id);
  const end = plan ? addMonthsISO(draft.start_date, plan.months) : "";
  const upd = (p: Partial<Draft>) => setDraft({ ...draft, ...p });

  const save = useMutation({
    mutationFn: async () => {
      if (!draft.student_id) throw new Error("Selecione o aluno.");
      if (!plan) throw new Error("Selecione o plano.");
      const price = Number(draft.price.replace(",", "."));
      const { data: enr, error } = await supabase
        .from("enrollments")
        .insert({
          student_id: draft.student_id,
          plan_id: plan.id,
          plan_name: plan.name,
          modality: plan.modality,
          start_date: draft.start_date,
          end_date: end,
          price,
        })
        .select()
        .single();
      if (error) throw error;
      if (draft.createBill) {
        const { error: e2 } = await supabase.from("receivables").insert({
          student_id: draft.student_id,
          enrollment_id: enr.id,
          description: `${plan.name} (${fmtDate(draft.start_date)} a ${fmtDate(end)})`,
          amount: price,
          due_date: draft.start_date,
          ...(draft.paidNow ? { paid_at: new Date().toISOString(), paid_amount: price, payment_method: draft.method } : {}),
        });
        if (e2) throw e2;
      }
      // Reactivate student if they were inactive
      await supabase.from("students").update({ status: "ativo" }).eq("id", draft.student_id).eq("status", "inativo");
    },
    onSuccess: () => {
      toast.success("Matrícula registrada");
      ["enrollments", "students-overview", "receivables"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      setDraft(null);
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && setDraft(null)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Matrícula / Renovação</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Aluno">
            <StudentPicker value={draft.student_id} onChange={(id) => upd({ student_id: id })} />
          </Field>
          <Field label="Plano">
            <Select
              value={draft.plan_id}
              onValueChange={(v) => upd({ plan_id: v, price: String(plans.find((p) => p.id === v)?.price ?? "") })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {plans
                  .filter((p) => p.active)
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {brl(p.price)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Início">
              <Input type="date" value={draft.start_date} onChange={(e) => upd({ start_date: e.target.value })} />
            </Field>
            <Field label="Vencimento">
              <Input value={end ? fmtDate(end) : "—"} disabled />
            </Field>
            <Field label="Valor (R$)">
              <Input value={draft.price} onChange={(e) => upd({ price: e.target.value })} inputMode="decimal" />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={draft.createBill} onCheckedChange={(v) => upd({ createBill: !!v })} /> Lançar em Contas a Receber
          </label>
          {draft.createBill && (
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={draft.paidNow} onCheckedChange={(v) => upd({ paidNow: !!v })} /> Já foi pago
              </label>
              {draft.paidNow && (
                <Select value={draft.method} onValueChange={(v) => upd({ method: v })}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Dinheiro", "Pix", "Cartão de débito", "Cartão de crédito"].map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDraft(null)}>
            Cancelar
          </Button>
          <Button variant="hero" onClick={() => save.mutate()} disabled={save.isPending}>
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlansTab({ plans }: { plans: Plan[] }) {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<Partial<Plan> | null>(null);
  const save = useMutation({
    mutationFn: async () => {
      if (!edit?.name) throw new Error("Informe o nome do plano.");
      const payload = {
        name: edit.name,
        modality: edit.modality ?? "Musculação",
        months: Number(edit.months ?? 1),
        price: Number(String(edit.price ?? 0).replace(",", ".")),
        active: edit.active ?? true,
      };
      const { error } = edit.id
        ? await supabase.from("plans").update(payload).eq("id", edit.id)
        : await supabase.from("plans").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Plano salvo");
      qc.invalidateQueries({ queryKey: ["plans"] });
      setEdit(null);
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <div>
      <ModuleBar>
        <Button size="sm" variant="outline" onClick={() => setEdit({ months: 1, modality: "Musculação", active: true })}>
          <Plus /> Novo plano
        </Button>
      </ModuleBar>
      <table className={grid.table}>
        <thead className={grid.thead}>
          <tr>
            <th className={grid.th}>Plano</th>
            <th className={grid.th}>Modalidade</th>
            <th className={grid.th}>Meses</th>
            <th className={grid.th}>Valor</th>
            <th className={grid.th}>Ativo</th>
            <th className={grid.th}></th>
          </tr>
        </thead>
        <tbody>
          {plans.map((p) => (
            <tr key={p.id} className={grid.tr}>
              <td className={grid.td}>{p.name}</td>
              <td className={grid.td}>{p.modality}</td>
              <td className={grid.td}>{p.months}</td>
              <td className={grid.td}>{brl(p.price)}</td>
              <td className={grid.td}>{p.active ? "Sim" : "Não"}</td>
              <td className={`${grid.td} text-right`}>
                <Button size="icon" variant="ghost" onClick={() => setEdit(p)}>
                  <Pencil />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {edit && (
        <Dialog open onOpenChange={(o) => !o && setEdit(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{edit.id ? "Editar plano" : "Novo plano"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3">
              <Field label="Nome">
                <Input value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Modalidade">
                  <Select value={edit.modality ?? "Musculação"} onValueChange={(v) => setEdit({ ...edit, modality: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["Musculação", "Muay Thai", "Musculação + Muay Thai", "Outra"].map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Meses">
                  <Input type="number" min={1} value={edit.months ?? 1} onChange={(e) => setEdit({ ...edit, months: Number(e.target.value) })} />
                </Field>
                <Field label="Valor">
                  <Input value={edit.price ?? ""} onChange={(e) => setEdit({ ...edit, price: e.target.value as unknown as number })} />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={edit.active ?? true} onCheckedChange={(v) => setEdit({ ...edit, active: !!v })} /> Plano ativo
              </label>
            </div>
            <DialogFooter>
              <Button variant="hero" onClick={() => save.mutate()}>
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
