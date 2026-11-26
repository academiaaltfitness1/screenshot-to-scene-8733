import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Target, Trophy, MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function StudentGoalProgress({ studentId }: { studentId: string }) {
  const client = useQueryClient();
  const [note, setNote] = useState("");
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
    refetchInterval: 60000,
  });
  const { data: requests = [] } = useQuery({
    queryKey: ["student-workout-review-requests"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("student_workout_review_requests")
        .select("id,note,status,created_at,reviewed_at").order("created_at", { ascending: false }).limit(10);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 15000,
  });
  const pending = requests.some((request: any) => request.status === "pendente");
  async function requestReview() {
    const { error } = await (supabase as any).from("student_workout_review_requests").insert({
      student_id: studentId, note: note.trim() || null, status: "pendente",
    });
    if (error) { toast.error("Não foi possível enviar o pedido. Tente novamente."); return; }
    setNote("");
    toast.success("Pedido enviado ao professor. Seu treino e histórico foram preservados.");
    await client.invalidateQueries({ queryKey: ["student-workout-review-requests"] });
    await client.invalidateQueries({ queryKey: ["admin-mobile-stats"] });
  }
  const target = data?.goal?.weekly_sessions ?? 0;
  const progress = target > 0 ? Math.min(100, Math.round(((data?.count ?? 0) / target) * 100)) : 0;
  return <section className="rounded-xl border border-white/10 bg-[#151515] p-4">
    <h2 className="mb-2 flex items-center gap-2 text-lg font-extrabold"><Target className="text-[#facc15]"/> Minha meta da semana</h2>
    {target > 0 ? <>
      <div className="flex items-end justify-between gap-3">
        <p className="text-sm text-zinc-300">{data?.count ?? 0} de {target} treinos concluídos</p>
        <strong className="text-[#facc15]">{progress}%</strong>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-black"><div className="h-full rounded-full bg-[#facc15] transition-all" style={{width: progress+"%"}}/></div>
      {data?.goal?.target_weight != null && <p className="mt-2 text-sm text-zinc-300">Meta de peso: {Number(data.goal.target_weight).toLocaleString("pt-BR")} kg</p>}
      {data?.goal?.note && <p className="mt-2 text-sm text-zinc-400">{data.goal.note}</p>}
      {data?.reached && <p className="mt-3 flex items-center gap-2 font-bold text-emerald-400"><Trophy size={17}/> Meta semanal alcançada. Parabéns!</p>}
    </> : <p className="text-sm text-zinc-400">O professor ainda não definiu uma meta semanal.</p>}
    <div className="mt-4 border-t border-white/10 pt-3">
      <h3 className="flex items-center gap-2 font-bold"><MessageSquareText size={17} className="text-[#facc15]"/> Pedir revisão do treino</h3>
      <p className="mt-1 text-xs text-zinc-400">Envie uma observação ao professor. O pedido não apaga nem altera seus treinos ou seu histórico.</p>
      <textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={300} rows={2} placeholder="Escreva sua dúvida ou observação (opcional)" className="mt-2 w-full rounded-lg border border-white/15 bg-black p-3 text-sm text-white"/>
      <button type="button" onClick={()=>void requestReview()} disabled={pending} className="mt-2 rounded-lg bg-[#facc15] px-4 py-2 text-sm font-bold text-black disabled:opacity-50">{pending ? "Pedido aguardando o professor" : "Enviar pedido de revisão"}</button>
      {requests.length>0 && <ul className="mt-3 space-y-2">{requests.slice(0,4).map((request:any)=><li key={request.id} className="rounded-md bg-black p-2 text-xs">
        <span className={request.status==="atendido"?"text-emerald-400":request.status==="cancelado"?"text-zinc-500":"text-amber-300"}>{request.status==="atendido"?"Atendido":request.status==="cancelado"?"Cancelado":"Aguardando professor"}</span>
        {request.note && <p className="mt-1 text-zinc-300">{request.note}</p>}
        <p className="mt-1 text-zinc-500">{new Date(request.created_at).toLocaleString("pt-BR")}</p>
      </li>)}</ul>}
    </div>
  </section>;
}
