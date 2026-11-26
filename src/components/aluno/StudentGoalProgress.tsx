import { useQuery } from "@tanstack/react-query";
import { Target, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function StudentGoalProgress() {
  const weekStart = new Date();
  weekStart.setHours(0,0,0,0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weekIso = weekStart.toISOString();
  const { data } = useQuery({
    queryKey: ["student-goal-progress", weekIso.slice(0,10)],
    queryFn: async () => {
      const [{ data: goal, error: goalError }, { count, error: countError }, { data: event, error: eventError }] = await Promise.all([
        supabase.from("student_goals").select("weekly_sessions,target_weight,note").maybeSingle(),
        supabase.from("workout_sessions").select("id", { count: "exact", head: true })
          .eq("status", "concluido").gte("finished_at", weekIso)
          .lt("finished_at", new Date(new Date(weekIso).getTime() + 7 * 86400000).toISOString()),
        (supabase as any).from("student_goal_events").select("id,week_start,reached_at")
          .eq("week_start", weekIso.slice(0,10)).maybeSingle(),
      ]);
      if (goalError) throw goalError;
      if (countError) throw countError;
      if (eventError) throw eventError;
      return { goal, count: count ?? 0, reached: !!event };
    },
  });
  if (!data?.goal?.weekly_sessions) return null;
  const target = data.goal.weekly_sessions;
  const progress = Math.min(100, Math.round((data.count / target) * 100));
  return <section className="rounded-xl border border-white/10 bg-[#151515] p-4">
    <h2 className="mb-2 flex items-center gap-2 text-lg font-extrabold"><Target className="text-[#facc15]"/> Minha meta da semana</h2>
    <div className="flex items-end justify-between gap-3">
      <p className="text-sm text-zinc-300">{data.count} de {target} treinos concluídos</p>
      <strong className="text-[#facc15]">{progress}%</strong>
    </div>
    <div className="mt-2 h-3 overflow-hidden rounded-full bg-black"><div className="h-full rounded-full bg-[#facc15] transition-all" style={{width: progress+"%"}}/></div>
    {data.goal.target_weight != null && <p className="mt-2 text-sm text-zinc-300">Meta de peso: {Number(data.goal.target_weight).toLocaleString("pt-BR")} kg</p>}
    {data.goal.note && <p className="mt-2 text-sm text-zinc-400">{data.goal.note}</p>}
    {data.reached && <p className="mt-3 flex items-center gap-2 font-bold text-emerald-400"><Trophy size={17}/> Meta semanal alcançada. Parabéns!</p>}
  </section>;
}
