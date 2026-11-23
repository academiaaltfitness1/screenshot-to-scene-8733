import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { ModuleWindow } from "@/components/shell/ModuleWindow";
import { Field, ModuleBar, EmptyRow, grid } from "@/components/app/common";
import { StudentPicker } from "@/components/app/StudentPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStaff } from "@/hooks/use-staff";
import { fmtDate, errMsg } from "@/lib/format";
import { todayISO } from "@/lib/access";
import { bmi, bmiLabel } from "@/lib/bmi";

export const Route = createFileRoute("/_authenticated/avaliacao")({
  head: () => ({
    meta: [
      { title: "Avaliação Física — ALT FITNESS" },
      { name: "description", content: "Medidas, peso, gordura, IMC e evolução dos alunos." },
      { property: "og:title", content: "Avaliação Física — ALT FITNESS" },
      { property: "og:description", content: "Medidas, peso, gordura, IMC e evolução dos alunos." },
    ],
  }),
  component: AvaliacaoPage,
});

type Assessment = Tables<"assessments">;
const MEASURES: [keyof Assessment, string][] = [
  ["weight", "Peso (kg)"],
  ["height", "Altura (m)"],
  ["body_fat", "% Gordura"],
  ["muscle_mass", "Massa magra (kg)"],
  ["chest", "Tórax (cm)"],
  ["waist", "Cintura (cm)"],
  ["abdomen", "Abdômen (cm)"],
  ["hip", "Quadril (cm)"],
  ["arm_right", "Braço D (cm)"],
  ["arm_left", "Braço E (cm)"],
  ["thigh_right", "Coxa D (cm)"],
  ["thigh_left", "Coxa E (cm)"],
  ["calf", "Panturrilha (cm)"],
];

function AvaliacaoPage() {
  const [student, setStudent] = useState<string | null>(null);
  const [edit, setEdit] = useState<Partial<Assessment> | null>(null);
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["assessments", student],
    enabled: !!student,
    queryFn: async () => (await supabase.from("assessments").select("*").eq("student_id", student!).order("assessed_at")).data ?? [],
  });
  const chart = rows.map((r) => ({ data: fmtDate(r.assessed_at), Peso: r.weight, "% Gordura": r.body_fat, IMC: bmi(r.weight, r.height) }));
  const first = rows[0];
  const last = rows[rows.length - 1];

  return (
    <ModuleWindow
      module="avaliacao"
      actions={
        student && (
          <Button size="sm" variant="accent" onClick={() => setEdit({ student_id: student, assessed_at: todayISO(), height: last?.height ?? null })}>
            <Plus /> Nova avaliação
          </Button>
        )
      }
    >
      <ModuleBar>
        <div className="w-80">
          <StudentPicker value={student} onChange={setStudent} />
        </div>
      </ModuleBar>
      {!student ? (
        <p className="p-8 text-center text-muted-foreground">Selecione um aluno para ver ou registrar avaliações.</p>
      ) : (
        <div className="space-y-4 p-3">
          {rows.length >= 2 && first && last && (
            <div className="grid gap-3 lg:grid-cols-[1fr_300px]">
              <div className="h-64 rounded-lg border border-border bg-card p-2">
                <ResponsiveContainer>
                  <LineChart data={chart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="data" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="Peso" stroke="var(--color-chart-1)" strokeWidth={2} />
                    <Line type="monotone" dataKey="% Gordura" stroke="var(--color-chart-4)" strokeWidth={2} />
                    <Line type="monotone" dataKey="IMC" stroke="var(--color-chart-3)" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="rounded-lg border border-border bg-card p-3 text-sm">
                <h4 className="mb-2 font-bold">Comparação (1ª × última)</h4>
                <ul className="space-y-1">
                  {MEASURES.map(([k, label]) => {
                    const a = first[k] as number | null;
                    const b = last[k] as number | null;
                    if (a == null || b == null) return null;
                    const d = Number(b) - Number(a);
                    return (
                      <li key={k} className="flex justify-between">
                        <span>{label}</span>
                        <span>
                          {a} → {b}{" "}
                          <strong className={d < 0 ? "text-success" : d > 0 ? "text-primary" : ""}>
                            ({d > 0 ? "+" : ""}
                            {d.toFixed(1)})
                          </strong>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}
          <table className={grid.table}>
            <thead className={grid.thead}>
              <tr>
                <th className={grid.th}>Data</th>
                <th className={grid.th}>Peso</th>
                <th className={grid.th}>Altura</th>
                <th className={grid.th}>IMC</th>
                <th className={grid.th}>% Gordura</th>
                <th className={grid.th}>Cintura</th>
                <th className={grid.th}>Abdômen</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <EmptyRow cols={7} text="Carregando…" />}
              {!isLoading && rows.length === 0 && <EmptyRow cols={7} text="Nenhuma avaliação registrada." />}
              {[...rows].reverse().map((r) => {
                const i = bmi(r.weight, r.height);
                return (
                  <tr key={r.id} className={`${grid.tr} cursor-pointer`} onClick={() => setEdit(r)}>
                    <td className={grid.td}>{fmtDate(r.assessed_at)}</td>
                    <td className={grid.td}>{r.weight ?? "—"}</td>
                    <td className={grid.td}>{r.height ?? "—"}</td>
                    <td className={grid.td}>{i ? `${i} · ${bmiLabel(i)}` : "—"}</td>
                    <td className={grid.td}>{r.body_fat ?? "—"}</td>
                    <td className={grid.td}>{r.waist ?? "—"}</td>
                    <td className={grid.td}>{r.abdomen ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {edit && <AssessmentDialog a={edit} onClose={() => setEdit(null)} />}
    </ModuleWindow>
  );
}

function AssessmentDialog({ a, onClose }: { a: Partial<Assessment>; onClose: () => void }) {
  const qc = useQueryClient();
  const { staff } = useStaff();
  const [f, setF] = useState<Record<string, unknown>>(a);
  const i = bmi(Number(f["weight"]) || null, Number(String(f["height"] ?? "").replace(",", ".")) || null);
  const save = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = { student_id: a.student_id, assessed_at: f["assessed_at"], notes: f["notes"] || null };
      for (const [k] of MEASURES) {
        const v = String(f[k] ?? "").replace(",", ".");
        payload[k] = v === "" ? null : Number(v);
      }
      const { data: u } = await supabase.auth.getUser();
      const { error } = a.id
        ? await supabase.from("assessments").update(payload as never).eq("id", a.id)
        : await supabase.from("assessments").insert({ ...(payload as Tables<"assessments">), created_by: u.user?.id ?? null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Avaliação salva");
      qc.invalidateQueries({ queryKey: ["assessments"] });
      onClose();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const remove = async () => {
    if (!confirm("Excluir avaliação?")) return;
    await supabase.from("assessments").delete().eq("id", a.id!);
    qc.invalidateQueries({ queryKey: ["assessments"] });
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-auto">
        <DialogHeader>
          <DialogTitle>Avaliação física</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Data">
            <Input type="date" value={String(f["assessed_at"] ?? "")} onChange={(e) => setF({ ...f, assessed_at: e.target.value })} />
          </Field>
          {MEASURES.map(([k, label]) => (
            <Field key={k} label={label}>
              <Input inputMode="decimal" value={f[k] == null ? "" : String(f[k])} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
            </Field>
          ))}
          <div className="col-span-2 flex items-end rounded-md bg-secondary p-2 text-sm sm:col-span-3">
            IMC: <strong className="ml-1">{i ? `${i} — ${bmiLabel(i)}` : "informe peso e altura"}</strong>
          </div>
          <Field label="Observações" className="col-span-2 sm:col-span-4">
            <Textarea rows={2} value={String(f["notes"] ?? "")} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          </Field>
        </div>
        <DialogFooter className="gap-2">
          {a.id && staff?.isAdmin && (
            <Button variant="destructive" className="mr-auto" onClick={remove}>
              <Trash2 /> Excluir
            </Button>
          )}
          <Button variant="hero" onClick={() => save.mutate()}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
