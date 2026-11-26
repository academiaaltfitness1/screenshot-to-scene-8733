import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Play, Square, Loader2, Youtube } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Workout = {
  id: string; letter: string; name: string;
  workout_exercises: { id: string; exercise: string; sets: string; reps: string; load: string; rest: string; sort_order: number }[];
};


type ExerciseMediaRecord = {
  id: string;
  name_en: string;
  name_es?: string;
  images?: { flat?: { start?: string; peak?: string; main?: string } };
};

const EXERCISE_SEARCH_ALIASES: Record<string, string[]> = {
  "supino reto": ["bench press"],
  "supino inclinado": ["incline barbell bench press", "incline bench press"],
  "supino maquina": ["machine chest press", "chest press machine"],
  "puxada frontal": ["lat pulldown"],
  "remada baixa": ["seated cable row", "seated row"],
  "remada curvada": ["bent over barbell row", "barbell bent over row"],
  "leg press 45": ["45 degree leg press", "leg press"],
  "cadeira extensora": ["leg extension"],
  "mesa flexora": ["lying leg curl", "leg curl"],
  "stiff": ["romanian deadlift"],
  "elevacao lateral": ["dumbbell lateral raise", "lateral raise"],
  "desenvolvimento": ["seated dumbbell shoulder press", "overhead press"],
  "rosca direta": ["barbell curl"],
  "rosca alternada": ["alternating dumbbell curl", "dumbbell curl"],
  "triceps pulley": ["cable triceps pushdown", "triceps pushdown"],
  "triceps testa": ["lying triceps extension", "skull crusher"],
  "panturrilha em pe": ["standing calf raise"],
  "abdominal supra": ["crunch"],
  "prancha": ["plank"],
};

function normalizeExerciseName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function ExerciseIllustration({ exercise }: { exercise: string }) {
  const { data: library = [], isLoading } = useQuery<ExerciseMediaRecord[]>({
    queryKey: ["repdb-exercise-illustrations"],
    queryFn: async () => {
      const response = await fetch("https://exercise-dataset.com/exercises.json");
      if (!response.ok) throw new Error("Não foi possível carregar as ilustrações.");
      const payload = await response.json();
      return Array.isArray(payload.exercises) ? payload.exercises : [];
    },
    staleTime: 1000 * 60 * 60 * 24,
    retry: 1,
  });

  const normalized = normalizeExerciseName(exercise);
  const aliases = EXERCISE_SEARCH_ALIASES[normalized] ?? [normalized];
  const match = library.find((item) => {
    const names = [normalizeExerciseName(item.name_en), normalizeExerciseName(item.name_es ?? "")];
    return aliases.some((alias) => {
      const needle = normalizeExerciseName(alias);
      return names.some((name) => name === needle || name.includes(needle));
    });
  });
  const imageBase = "https://huggingface.co/datasets/RepDB/exercise-dataset/resolve/main/";
  const startPath = match?.images?.flat?.start;
  const peakPath = match?.images?.flat?.peak;
  const mainPath = match?.images?.flat?.main;

  if (!match) {
    return <p className="mt-2 text-xs text-zinc-500">{isLoading ? "Carregando demonstração…" : "Ilustração ainda não disponível para este exercício."}</p>;
  }

  return (
    <div className="mt-3 rounded-lg border border-white/10 bg-[#101010] p-2">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#facc15]">Demonstração ilustrativa</p>
      <style>{"@keyframes alt-exercise-loop { 0%, 42% { opacity: 1; } 50%, 92% { opacity: 0; } 100% { opacity: 1; } } @keyframes alt-exercise-loop-reverse { 0%, 42% { opacity: 0; } 50%, 92% { opacity: 1; } 100% { opacity: 0; } }"}</style>
      <div className="relative mx-auto aspect-square w-full max-w-[280px] overflow-hidden rounded-lg bg-white">
        {(startPath || mainPath) && <img src={imageBase + (startPath || mainPath)} alt={exercise + " — posição inicial"} loading="lazy" className="absolute inset-0 h-full w-full object-contain" style={{ animation: peakPath ? "alt-exercise-loop 2.4s ease-in-out infinite" : "none" }} />}
        {peakPath && <img src={imageBase + peakPath} alt={exercise + " — posição final"} loading="lazy" className="absolute inset-0 h-full w-full object-contain" style={{ animation: "alt-exercise-loop-reverse 2.4s ease-in-out infinite" }} />}
      </div>
      <p className="mt-2 text-[10px] text-zinc-500">Demonstração visual em loop entre as posições inicial e final. Esta ilustração não é uma gravação real do exercício. Imagens: <a href="https://repdb.co" target="_blank" rel="noreferrer" className="underline">Exercise data by RepDB</a>.</p>
      <a
        href={`https://www.youtube.com/results?search_query=${encodeURIComponent(exercise + " execução correta")}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#facc15] px-3 py-2.5 text-sm font-extrabold text-black transition hover:bg-yellow-300"
        aria-label={`Buscar vídeo demonstrativo de ${exercise} no YouTube`}
      >
        <Youtube size={18} /> Assistir demonstração no YouTube
      </a>
    </div>
  );
}

/** Student-side execution; all ownership and progression rules are enforced by database RPC/RLS. */
export function StudentWorkoutExecution({ workouts }: { workouts: Workout[] }) {
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [selectedWorkout, setSelectedWorkout] = useState<string | null>(null);
  const [loads, setLoads] = useState<Record<string, string>>({});
  const [reps, setReps] = useState<Record<string, string>>({});
  const [durations, setDurations] = useState<Record<string, string>>({});
  const [restTimers, setRestTimers] = useState<Record<string, number>>({});
  const [clock, setClock] = useState(Date.now());
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

  const activeSession = sessions.find((session) => session.status === "em_andamento" && session.workout_id);
  const { data: activeSessionWorkout } = useQuery({
    queryKey: ["student-active-session-workout", activeSession?.workout_id],
    enabled: !!activeSession?.workout_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("workouts").select("*, workout_exercises(*)").eq("id", activeSession!.workout_id!).single();
      if (error) throw error;
      return data;
    },
  });
  const activeWorkout = useMemo(() => workouts.find(w => w.id === selectedWorkout) ?? (activeSessionWorkout as Workout | undefined), [workouts, selectedWorkout, activeSessionWorkout]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  function restSeconds(value: string | number | null | undefined) {
    const raw = String(value ?? "60").toLocaleLowerCase("pt-BR");
    const amount = Number.parseFloat(raw.replace(",", ".")) || 60;
    return Math.max(1, Math.min(900, Math.round(amount * (raw.includes("min") ? 60 : 1))));
  }
  function startRest(ex: Workout["workout_exercises"][number]) {
    setRestTimers(current => ({ ...current, [ex.id]: Date.now() + restSeconds(ex.rest) * 1000 }));
  }

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
    if (current?.workout_id) {
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
        <p className="break-words text-base font-bold leading-snug">{ex.exercise}</p>
        <ExerciseIllustration exercise={ex.exercise} />
        <p className="mt-2 text-xs text-zinc-400">{ex.sets} séries · {ex.reps} repetições · descanso {ex.rest}</p>
        <button type="button" onClick={()=>startRest(ex)} className="mt-2 rounded border border-[#facc15]/40 px-3 py-1.5 text-xs font-bold text-[#facc15]">
          {restTimers[ex.id] && restTimers[ex.id] > clock ? "Descansando " + Math.ceil((restTimers[ex.id] - clock) / 1000) + "s" : "Iniciar descanso (" + restSeconds(ex.rest) + "s)"}
        </button>{lastByName.get(ex.exercise.trim().toLocaleLowerCase("pt-BR"))?.load != null && <p className="mt-1 text-xs text-emerald-400">Última carga registrada: {Number(lastByName.get(ex.exercise.trim().toLocaleLowerCase("pt-BR"))?.load).toLocaleString("pt-BR")} kg</p>}
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
