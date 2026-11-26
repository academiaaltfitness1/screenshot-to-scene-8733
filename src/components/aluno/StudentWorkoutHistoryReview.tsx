import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function StudentWorkoutHistoryReview({ studentId }: { studentId: string }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["staff-student-workout-history", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data, error } = await supabase.from("workout_sessions")
        .select("id,letter,workout_name,status,started_at,finished_at,workout_set_logs(id,exercise_name,sort_order,set_number,load,reps,duration_seconds,status,skip_reason)")
        .eq("student_id", studentId).order("started_at", { ascending: false }).limit(8);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30000,
  });
  return <section className="mt-3 rounded-lg border border-border bg-card p-3">
    <h3 className="mb-3 flex items-center gap-2 font-bold"><History className="text-primary"/> Histórico de execução do aluno</h3>
    {isLoading ? <p className="text-xs text-muted-foreground">Carregando histórico…</p> : data.length ? <div className="space-y-2">
      {data.map(session=><details key={session.id} className="rounded-md border border-border bg-background p-3">
        <summary className="cursor-pointer text-sm font-semibold">Treino {session.letter} · {session.workout_name} — {session.status==="concluido"?"Concluído":session.status==="em_andamento"?"Em andamento":"Cancelado"}<small className="block font-normal text-muted-foreground">{new Date(session.started_at).toLocaleString("pt-BR")}</small></summary>
        <div className="mt-3 space-y-2">{[...(session.workout_set_logs ?? [])].sort((a:any,b:any)=>a.sort_order-b.sort_order || a.set_number-b.set_number).map((log:any)=><div key={log.id} className="rounded bg-muted/40 p-2 text-xs">
          <strong>{log.exercise_name} · Série {log.set_number}</strong>
          <p className="text-muted-foreground">{log.status==="pulado" ? "Pulado" : "Carga: "+(log.load ?? "—")+" kg · Reps: "+(log.reps ?? "—")+(log.duration_seconds ? " · "+log.duration_seconds+" s" : "")}</p>
          {log.skip_reason && <p className="mt-1 text-amber-600">Motivo: {log.skip_reason}</p>}
        </div>)}</div>
      </details>)}
    </div> : <p className="text-xs text-muted-foreground">Este aluno ainda não registrou treinos pelo aplicativo.</p>}
  </section>;
}
