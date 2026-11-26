import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Save, Trash2, X, Printer, Copy, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ModuleWindow } from "@/components/shell/ModuleWindow";
import { ModuleBar } from "@/components/app/common";
import { StudentPicker } from "@/components/app/StudentPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { errMsg } from "@/lib/format";
import { StudentGoalManager } from "@/components/aluno/StudentGoalManager";

export const Route = createFileRoute("/_authenticated/treinos")({
  head: () => ({
    meta: [
      { title: "Prescrição de Treinos — ALT FITNESS" },
      { name: "description", content: "Fichas de treino A, B, C com séries, repetições, carga e descanso." },
      { property: "og:title", content: "Prescrição de Treinos — ALT FITNESS" },
      { property: "og:description", content: "Fichas de treino A, B, C com séries, repetições, carga e descanso." },
    ],
  }),
  component: TreinosPage,
});

interface Ex {
  exercise: string;
  sets: string;
  reps: string;
  load: string;
  rest: string;
}
interface Workout {
  id?: string;
  letter: string;
  name: string;
  notes: string;
  exercises: Ex[];
}

const SUGGESTIONS = [
  "Supino reto", "Supino inclinado", "Crucifixo", "Puxada frontal", "Remada baixa", "Remada curvada", "Agachamento livre",
  "Leg press 45°", "Cadeira extensora", "Mesa flexora", "Stiff", "Elevação lateral", "Desenvolvimento", "Rosca direta",
  "Rosca alternada", "Tríceps pulley", "Tríceps testa", "Panturrilha em pé", "Abdominal supra", "Prancha",
];

const newEx = (): Ex => ({ exercise: "", sets: "3", reps: "12", load: "", rest: "60s" });

const WORKOUT_TEMPLATES: Record<string, Workout[]> = {
  adaptacao: [{ letter: "A", name: "Adaptação — Corpo todo", notes: "Priorizar técnica, amplitude confortável e cargas leves.", exercises: [
    { exercise: "Leg press 45°", sets: "2", reps: "15", load: "Leve", rest: "60s" },
    { exercise: "Supino máquina", sets: "2", reps: "15", load: "Leve", rest: "60s" },
    { exercise: "Puxada frontal", sets: "2", reps: "15", load: "Leve", rest: "60s" },
    { exercise: "Cadeira extensora", sets: "2", reps: "15", load: "Leve", rest: "60s" },
    { exercise: "Abdominal supra", sets: "2", reps: "15", load: "Peso corporal", rest: "45s" },
  ] }],
  hipertrofia_a_b: [
    { letter: "A", name: "Hipertrofia — A (Peito, ombro e tríceps)", notes: "Ajustar cargas e volume à avaliação individual.", exercises: [
      { exercise: "Supino reto", sets: "3", reps: "8–12", load: "", rest: "90s" },
      { exercise: "Supino inclinado", sets: "3", reps: "8–12", load: "", rest: "90s" },
      { exercise: "Crucifixo", sets: "3", reps: "10–12", load: "", rest: "60s" },
      { exercise: "Elevação lateral", sets: "3", reps: "12", load: "", rest: "60s" },
      { exercise: "Tríceps pulley", sets: "3", reps: "10–12", load: "", rest: "60s" },
    ] },
    { letter: "B", name: "Hipertrofia — B (Costas e bíceps)", notes: "Ajustar cargas e volume à avaliação individual.", exercises: [
      { exercise: "Puxada frontal", sets: "3", reps: "8–12", load: "", rest: "90s" },
      { exercise: "Remada baixa", sets: "3", reps: "8–12", load: "", rest: "90s" },
      { exercise: "Remada curvada", sets: "3", reps: "10", load: "", rest: "90s" },
      { exercise: "Rosca direta", sets: "3", reps: "10–12", load: "", rest: "60s" },
      { exercise: "Rosca alternada", sets: "2", reps: "12", load: "", rest: "60s" },
    ] },
  ],
  emagrecimento: [{ letter: "A", name: "Emagrecimento — Resistência geral", notes: "Combinar com atividade aeróbica conforme condição e avaliação do aluno.", exercises: [
    { exercise: "Leg press 45°", sets: "3", reps: "12–15", load: "", rest: "45s" },
    { exercise: "Puxada frontal", sets: "3", reps: "12–15", load: "", rest: "45s" },
    { exercise: "Supino máquina", sets: "3", reps: "12–15", load: "", rest: "45s" },
    { exercise: "Cadeira extensora", sets: "3", reps: "12–15", load: "", rest: "45s" },
    { exercise: "Remada baixa", sets: "3", reps: "12–15", load: "", rest: "45s" },
    { exercise: "Prancha", sets: "3", reps: "20–30s", load: "Peso corporal", rest: "45s" },
  ] }],
};

function TreinosPage() {
  const qc = useQueryClient();
  const [student, setStudent] = useState<string | null>(null);
  const [plan, setPlan] = useState<Workout[]>([]);
  const [saving, setSaving] = useState(false);
  const [templateKey, setTemplateKey] = useState("");
  const [copySource, setCopySource] = useState<string | null>(null);
  const [loadingCopy, setLoadingCopy] = useState(false);

  const { data } = useQuery({
    queryKey: ["workouts", student],
    enabled: !!student,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workouts")
        .select("*, workout_exercises(*)")
        .eq("student_id", student!)
        .eq("active", true)
        .order("letter");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!data) return;
    setPlan(
      data.map((w) => ({
        id: w.id,
        letter: w.letter,
        name: w.name,
        notes: w.notes ?? "",
        exercises: [...w.workout_exercises].sort((a, b) => a.sort_order - b.sort_order).map((e) => ({ exercise: e.exercise, sets: e.sets, reps: e.reps, load: e.load, rest: e.rest })),
      })),
    );
  }, [data]);

  const addWorkout = () => {
    const letter = String.fromCharCode(65 + plan.length);
    setPlan([...plan, { letter, name: `Treino ${letter}`, notes: "", exercises: [newEx()] }]);
  };
  const upd = (i: number, w: Partial<Workout>) => setPlan(plan.map((x, j) => (j === i ? { ...x, ...w } : x)));

  function applyTemplate() {
    const template = WORKOUT_TEMPLATES[templateKey];
    if (!template) return;
    if (plan.length && !confirm("Aplicar este modelo substituirá a ficha que está sendo editada. Continuar?")) return;
    setPlan(template.map((w) => ({ ...w, exercises: w.exercises.map((e) => ({ ...e })) })));
    toast.success("Modelo aplicado. Revise e personalize antes de salvar.");
  }

  async function copyFromStudent() {
    if (!student || !copySource) return;
    if (student === copySource) { toast.error("Selecione outro aluno para copiar."); return; }
    if (plan.length && !confirm("Copiar a ficha substituirá a ficha que está sendo editada. Continuar?")) return;
    setLoadingCopy(true);
    try {
      const { data: source, error } = await supabase.from("workouts").select("*, workout_exercises(*)")
        .eq("student_id", copySource).eq("active", true).order("letter");
      if (error) throw error;
      if (!source?.length) { toast.error("Este aluno não possui ficha ativa para copiar."); return; }
      setPlan(source.map((w) => ({
        letter: w.letter, name: w.name, notes: w.notes ?? "",
        exercises: [...w.workout_exercises].sort((a, b) => a.sort_order - b.sort_order).map((e) => ({
          exercise: e.exercise, sets: e.sets, reps: e.reps, load: e.load, rest: e.rest,
        })),
      })));
      toast.success("Ficha copiada para edição. O aluno de origem não será alterado.");
    } catch (e) { toast.error(errMsg(e)); }
    finally { setLoadingCopy(false); }
  }
  const updEx = (i: number, k: number, e: Partial<Ex>) => upd(i, { exercises: plan[i]!.exercises.map((x, j) => (j === k ? { ...x, ...e } : x)) });

  async function save() {
    if (!student) return;
    setSaving(true);
    const createdIds: string[] = [];
    try {
      const { data: u } = await supabase.auth.getUser();
      const previousIds = (data ?? []).map((w) => w.id);

      // Cada salvamento cria uma nova versão. As fichas e exercícios anteriores
      // permanecem no banco para preservar o histórico de treino do aluno.
      for (const w of plan) {
        const { data: nw, error } = await supabase
          .from("workouts")
          .insert({
            student_id: student,
            letter: w.letter,
            name: w.name,
            notes: w.notes || null,
            created_by: u.user?.id ?? null,
          })
          .select()
          .single();
        if (error) throw error;
        createdIds.push(nw.id);

        const exs = w.exercises
          .filter((e) => e.exercise.trim())
          .map((e, k) => ({
            exercise: e.exercise,
            sets: e.sets,
            reps: e.reps,
            load: e.load,
            rest: e.rest,
            workout_id: nw.id,
            sort_order: k,
          }));
        if (exs.length) {
          const { error: exerciseError } = await supabase.from("workout_exercises").insert(exs);
          if (exerciseError) throw exerciseError;
        }
      }

      if (previousIds.length) {
        const { error } = await supabase.from("workouts").update({ active: false }).in("id", previousIds);
        if (error) throw error;
      }

      toast.success("Nova versão da ficha salva. O histórico anterior foi preservado.");
      qc.invalidateQueries({ queryKey: ["workouts", student] });
    } catch (e) {
      // Se houver falha no meio, a versão anterior continua ativa e a nova
      // fica inativa; nenhum treino ou exercício histórico é apagado.
      if (createdIds.length) {
        await supabase.from("workouts").update({ active: false }).in("id", createdIds);
      }
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModuleWindow
      module="treinos"
      actions={
        student && (
          <>
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer /> Imprimir
            </Button>
            <Button size="sm" variant="accent" onClick={save} disabled={saving}>
              <Save /> Salvar ficha
            </Button>
          </>
        )
      }
    >
      <ModuleBar>
        <div className="w-80">
          <StudentPicker value={student} onChange={(id) => { setStudent(id); setCopySource(null); setPlan([]); }} />
        </div>
        {student && (
          <>
            <div className="flex min-w-52 items-center gap-2">
              <Select value={templateKey} onValueChange={setTemplateKey}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Modelos de treino" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="adaptacao">Adaptação</SelectItem>
                  <SelectItem value="hipertrofia_a_b">Hipertrofia iniciante A/B</SelectItem>
                  <SelectItem value="emagrecimento">Emagrecimento</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={applyTemplate} disabled={!templateKey}><ClipboardList /> Aplicar</Button>
            </div>
            <div className="flex min-w-64 items-center gap-2">
              <div className="w-44"><StudentPicker value={copySource} onChange={setCopySource} placeholder="Copiar de outro aluno…" /></div>
              <Button size="sm" variant="outline" onClick={copyFromStudent} disabled={!copySource || loadingCopy}><Copy /> Copiar ficha</Button>
            </div>
            <Button size="sm" variant="outline" onClick={addWorkout}>
              <Plus /> Adicionar treino {String.fromCharCode(65 + plan.length)}
            </Button>
          </>
        )}
      </ModuleBar>
      {student && <div className="px-3 pt-3"><StudentGoalManager studentId={student} /></div>}
      <datalist id="ex-suggest">
        {SUGGESTIONS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      {!student ? (
        <p className="p-8 text-center text-muted-foreground">Selecione um aluno para montar a ficha de treino.</p>
      ) : (
        <div className="grid gap-4 p-3 xl:grid-cols-2">
          {plan.length === 0 && <p className="text-muted-foreground">Nenhum treino. Clique em “Adicionar treino A”.</p>}
          {plan.map((w, i) => (
            <div key={i} className="overflow-hidden rounded-lg border border-border bg-card shadow-tile">
              <div className="flex items-center gap-2 bg-window-title px-3 py-1.5 text-primary-foreground">
                <span className="flex h-7 w-7 items-center justify-center rounded bg-accent font-display text-lg font-extrabold text-accent-foreground">{w.letter}</span>
                <input
                  className="flex-1 bg-transparent font-display text-lg font-bold outline-none placeholder:text-primary-foreground/60"
                  value={w.name}
                  onChange={(e) => upd(i, { name: e.target.value })}
                />
                <button type="button" aria-label="Remover treino" onClick={() => setPlan(plan.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-secondary text-xs uppercase text-secondary-foreground">
                  <tr>
                    <th className="px-2 py-1 text-left">Exercício</th>
                    <th className="w-14 px-1 py-1">Séries</th>
                    <th className="w-16 px-1 py-1">Reps</th>
                    <th className="w-16 px-1 py-1">Carga</th>
                    <th className="w-16 px-1 py-1">Desc.</th>
                    <th className="w-7"></th>
                  </tr>
                </thead>
                <tbody>
                  {w.exercises.map((e, k) => (
                    <tr key={k} className="border-b border-border">
                      <td className="px-1 py-0.5">
                        <Input list="ex-suggest" className="h-8" value={e.exercise} onChange={(ev) => updEx(i, k, { exercise: ev.target.value })} />
                      </td>
                      {(["sets", "reps", "load", "rest"] as const).map((f) => (
                        <td key={f} className="px-0.5 py-0.5">
                          <Input className="h-8 px-1 text-center" value={e[f]} onChange={(ev) => updEx(i, k, { [f]: ev.target.value })} />
                        </td>
                      ))}
                      <td>
                        <button type="button" aria-label="Remover exercício" onClick={() => upd(i, { exercises: w.exercises.filter((_, j) => j !== k) })}>
                          <X className="h-4 w-4 text-destructive" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center gap-2 p-2">
                <Button size="sm" variant="ghost" onClick={() => upd(i, { exercises: [...w.exercises, newEx()] })}>
                  <Plus /> Exercício
                </Button>
                <Input className="h-8 flex-1" placeholder="Observações do treino" value={w.notes} onChange={(e) => upd(i, { notes: e.target.value })} />
              </div>
            </div>
          ))}
        </div>
      )}
    </ModuleWindow>
  );
}
