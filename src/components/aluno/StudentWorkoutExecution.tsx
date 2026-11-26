import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Play, Square, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Workout = {
  id: string; letter: string; name: string;
  workout_exercises: { id: string; exercise: string; sets: string; reps: string; load: string; rest: string; sort_order: number }[];
};

/** Student-side execution; all ownership and progression rules are enforced by database RPC/RLS. */
export function StudentWorkoutExecution({ workouts }: { workouts: Workout[] }) {
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [selectedWorkout, setSelectedWorkout] = useState<string | null>(null);
  const [loads, setLoads] = useState<Record<string, string>>({});
  const [reps, setReps] = useState<Record<string, string>>({});
  const [durations, setDurations] = useState<Record<string, string>>({});
  const activeWorkout = useMemo(() => workouts.find(w => w.id === selectedWorkout), [workouts, selectedWorkout]);
  const { data: sessions = [] } = useQuery({
    queryKey: ["student-workout-history"],
    queryFn: async () => {
      const { data, error } = await supabase.from("workout_sessions")
        .select("id,workout_id,letter,workout_name,status,started_at,finished_at")
        .order("started_at", { ascending: false }).limit(12);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: lastLogs = [] } = useQuery({
    queryKey: ["student-last-set-logs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("workout_set_logs")
        .select("exercise_name,load,reps,created_at")
        .eq("status", "concluido").order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });
  const lastByName = useMemo(() => {
    const map = new Map<string, { load: number | null; reps: number | null; created_at: string }>();
    for (const log of lastLogs) {
      const key = log.exercise_name.trim().toLocaleLowerCase("pt-BR");
      if (!map.has(key)) map.set(key, { load: log.load, reps: log.reps, created_at: log.created_at });
    }
    return map;
  }, [lastLogs]);

  useEffect(() => {
    const current = sessions.find((session) => session.status === "em_andamento" && session.workout_id);
    if (current?.workout_id && workouts.some((workout) => workout.id === current.workout_id)) {
      setSessionId(current.id);
      setSelectedWorkout(current.workout_id);
    } else if (!current) {
      setSessionId(null);
      setSelectedWorkout(null);
    }
  }, [sessions, workouts]);

  async function start(workout: Workout) {
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("aluno_start_session", { _workout_id: workout.id });
      if (error) throw error;
      setSessionId(data);
      setSelectedWorkout(workout.id);
      toast.success("Treino iniciado. Registre suas séries durante a execução.");
      await client.invalidateQueries({ queryKey: ["student-workout-history"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível iniciar."); }
    finally { setBusy(false); }
  }

  async function finish() {
    if (!sessionId || !activeWorkout) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("aluno_finish_session", { _session_id: sessionId });
      if (error) throw error;
      setSessionId(null); setSelectedWorkout(null);
      toast.success("Treino concluído! Sua sequência avançou para o próximo treino.");
      await client.invalidateQueries({ queryKey: ["student-workout-history"] });
      await client.invalidateQueries({ queryKey: ["student-goal-progress"] });
      await client.invalidateQueries({ queryKey: ["student-goal-events-admin"] });
      await client.invalidateQueries({ queryKey: ["admin-mobile-stats"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível concluir."); }
    finally { setBusy(false); }
  }

  async function saveExerciseLogs(ex: Workout["workout_exercises"][number], status: "concluido" | "pulado", skipReason?: string) {
    if (!sessionId) return;
    const count = Math.max(1, Math.min(20, Number.parseInt(ex.sets, 10) || 1));
    const rows = Array.from({ length: count }, (_, index) => {
      const key = ex.id + ":" + (index + 1);
      const loadValue = (loads[key] ?? ex.load ?? "").replace(",", ".");
      const load = loadValue.trim() ? Number(loadValue) : Number.NaN;
      const repCount = Number.parseInt(reps[key] ?? "", 10);
      const duration = Number.parseInt(durations[key] ?? "", 10);
      return {
        session_id: sessionId, exercise_id: ex.id, exercise_name: ex.exercise,
        sort_order: ex.sort_order, set_number: index + 1,
        load: status === "pulado" || !Number.isFinite(load) ? null : load,
        reps: status === "pulado" || !Number.isFinite(repCount) ? null : repCount,
        duration_seconds: status === "pulado" || !Number.isFinite(duration) ? null : duration,
        status, skip_reason: status === "pulado" ? skipReason : null,
      };
    });
    setBusy(true);
    try {
      const { error: deleteError } = await supabase.from("workout_set_logs")
        .delete().eq("session_id", sessionId).eq("exercise_id", ex.id);
      if (deleteError) throw deleteError;
      const { error } = await supabase.from("workout_set_logs").insert(rows);
      if (error) throw error;
      toast.success(status === "pulado" ? "Exercício marcado como pulado." : "Séries registradas.");
      await client.invalidateQueries({ queryKey: ["student-last-set-logs"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível registrar o exercício."); }
    finally { setBusy(false); }
  }

  async function logExercise(ex: Workout["workout_exercises"][number]) {
    await saveExerciseLogs(ex, "concluido");
  }

  async function skipExercise(ex: Workout["workout_exercises"][number]) {
    const reason = window.prompt("Por que você pulou este exercício? (ex.: aparelho ocupado, desconforto, orientação do professor)");
    if (!reason?.trim()) {
      toast.error("Informe o motivo para registrar o exercício como pulado.");
      return;
    }
    await saveExerciseLogs(ex, "pulado", reason.trim().slice(0, 300));
  }

  return <section className="rounded-xl border border-white/10 bg-[#151515] p-4">
    <h2 className="mb-3 text-lg font-extrabold">Executar treino e acompanhar histórico</h2>
    {sessionId && activeWorkout ? <div className="mb-4 rounded-lg border border-[#facc15]/40 bg-black p-3">
      <p className="font-bold text-[#facc15]">Em andamento · Treino {activeWorkout.letter} — {activeWorkout.name}</p>
      <div className="mt-3 space-y-3">{[...activeWorkout.workout_exercises].sort((a,b)=>a.sort_order-b.sort_order).map(ex=><div key={ex.id} className="rounded-lg border border-white/10 p-3">
        <p className="font-semibold">{ex.exercise}</p><p className="text-xs text-zinc-400">{ex.sets} séries · {ex.reps} repetições · descanso {ex.rest}</p>{lastByName.get(ex.exercise.trim().toLocaleLowerCase("pt-BR"))?.load != null && <p className="mt-1 text-xs text-emerald-400">Última carga registrada: {Number(lastByName.get(ex.exercise.trim().toLocaleLowerCase("pt-BR"))?.load).toLocaleString("pt-BR")} kg</p>}
        <div className="mt-3 space-y-2">
          {Array.from({length: Math.max(1, Math.min(20, Number.parseInt(ex.sets, 10) || 1))}, (_, index) => {
            const key = ex.id + ":" + (index + 1);
            return <div key={key} className="grid grid-cols-3 items-end gap-2 rounded-md bg-black/70 p-2">
              <span className="col-span-3 text-xs font-bold text-[#facc15]">Série {index + 1}</span>
              <label className="text-[11px] text-zinc-400">Carga kg<input inputMode="decimal" value={loads[key] ?? (lastByName.get(ex.exercise.trim().toLocaleLowerCase("pt-BR"))?.load != null ? String(lastByName.get(ex.exercise.trim().toLocaleLowerCase("pt-BR"))?.load) : ex.load ?? "")} onChange={e=>setLoads(v=>({...v,[key]:e.target.value}))} className="mt-1 w-full rounded border border-white/15 bg-black p-2 text-sm text-white"/></label>
              <label className="text-[11px] text-zinc-400">Reps<input inputMode="numeric" value={reps[key] ?? ex.reps ?? ""} onChange={e=>setReps(v=>({...v,[key]:e.target.value}))} className="mt-1 w-full rounded border border-white/15 bg-black p-2 text-sm text-white"/></label>
              <label className="text-[11px] text-zinc-400">Tempo seg.<input inputMode="numeric" value={durations[key] ?? ""} onChange={e=>setDurations(v=>({...v,[key]:e.target.value}))} className="mt-1 w-full rounded border border-white/15 bg-black p-2 text-sm text-white" placeholder="Opcional"/></label>
            </div>;
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button disabled={busy} onClick={()=>logExercise(ex)} className="rounded bg-[#facc15] px-3 py-2 text-sm font-bold text-black">Salvar séries</button>
          <button disabled={busy} onClick={()=>skipExercise(ex)} className="rounded border border-white/20 px-3 py-2 text-sm font-semibold text-zinc-200">Pular com motivo</button>
        </div>
      </div>)}</div>
      <button disabled={busy} onClick={finish} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 p-3 font-bold text-white"><CheckCircle2 size={18}/> Concluir treino</button>
    </div> : <div className="space-y-2">{workouts.map(w=><div key={w.id} className="flex items-center justify-between gap-3 rounded-lg bg-black p-3">
      <div><p className="font-bold">Treino {w.letter} · {w.name}</p><p className="text-xs text-zinc-400">{w.workout_exercises.length} exercícios</p></div>
      <button disabled={busy} onClick={()=>start(w)} className="flex items-center gap-1 rounded bg-[#facc15] px-3 py-2 text-sm font-bold text-black"><Play size={15}/> Iniciar</button>
    </div>)}</div>}
    <h3 className="mb-2 mt-5 font-bold">Histórico recente</h3>
    {sessions.length ? <ul className="space-y-2">{sessions.map(s=><li key={s.id} className="flex justify-between gap-3 rounded bg-black p-3 text-sm"><span>Treino {s.letter} · {s.workout_name}<small className="block text-zinc-500">{new Date(s.started_at).toLocaleString("pt-BR")}</small></span><span className={s.status==="concluido"?"text-emerald-400":"text-zinc-400"}>{s.status==="concluido"?"Concluído":s.status==="em_andamento"?"Em andamento":"Cancelado"}</span></li>)}</ul> : <p className="text-sm text-zinc-400">Nenhum treino executado ainda.</p>}
    <p className="mt-3 text-xs text-zinc-500">A sequência só avança ao concluir o treino. Registros e histórico ficam vinculados à sua conta.</p>
  </section>;
}
