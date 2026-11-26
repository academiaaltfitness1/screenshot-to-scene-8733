import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Target, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function StudentGoalManager({ studentId }: { studentId: string }) {
  const client = useQueryClient();
  const [sessions, setSessions] = useState("3");
  const [weight, setWeight] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: events = [] } = useQuery({
    queryKey: ["student-goal-events-admin", studentId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("student_goal_events")
        .select("week_start,target_sessions,completed_sessions,reached_at")
        .eq("student_id", studentId).order("reached_at", { ascending: false }).limit(5);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60000,
  });
  const { data: goal } = useQuery({
    queryKey: ["student-goal-admin", studentId],
    queryFn: async () => {
      const { data, error } = await supabase.from("student_goals").select("*").eq("student_id", studentId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => {
    if (!goal) return;
    setSessions(String(goal.weekly_sessions ?? 3));
    setWeight(goal.target_weight == null ? "" : String(goal.target_weight));
    setNote(goal.note ?? "");
  }, [goal]);
  async function save() {
    setBusy(true);
    try {
      const { error } = await supabase.from("student_goals").upsert({
        student_id: studentId,
        weekly_sessions: Number(sessions),
        target_weight: weight.trim() ? Number(weight.replace(",", ".")) : null,
        note: note.trim() || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "student_id" });
      if (error) throw error;
      toast.success("Meta do aluno atualizada.");
      await client.invalidateQueries({ queryKey: ["student-goal-admin", studentId] });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar a meta."); }
    finally { setBusy(false); }
  }
  return <section className="rounded-lg border border-border bg-card p-3">
    <h3 className="mb-3 flex items-center gap-2 font-bold"><Target className="text-primary"/> Meta semanal do aluno</h3>
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="text-xs text-muted-foreground">Treinos por semana
        <Input className="mt-1" type="number" min="1" max="14" value={sessions} onChange={e=>setSessions(e.target.value)}/>
      </label>
      <label className="text-xs text-muted-foreground">Meta de peso (kg, opcional)
        <Input className="mt-1" inputMode="decimal" value={weight} onChange={e=>setWeight(e.target.value)}/>
      </label>
      <label className="text-xs text-muted-foreground">Orientação ao aluno
        <Input className="mt-1" value={note} onChange={e=>setNote(e.target.value)} maxLength={300}/>
      </label>
    </div>
    <Button className="mt-3" size="sm" onClick={save} disabled={busy || Number(sessions)<1 || Number(sessions)>14}><Save/> Salvar meta</Button>
    {events.length > 0 && <div className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm"><strong className="text-emerald-600">Metas alcançadas recentemente</strong><ul className="mt-1 space-y-1">{events.map((event:any)=><li key={event.week_start}>{new Date(event.week_start+"T12:00:00").toLocaleDateString("pt-BR")}: {event.completed_sessions}/{event.target_sessions} treinos na semana</li>)}</ul></div>}
  </section>;
}
