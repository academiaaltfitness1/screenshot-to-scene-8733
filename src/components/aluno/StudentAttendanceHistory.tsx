import { useQuery } from "@tanstack/react-query";
import { CalendarCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function StudentAttendanceHistory() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["student-attendance-history"],
    queryFn: async () => {
      const { data, error } = await supabase.from("attendance")
        .select("id,direction,allowed,reason,source,occurred_at")
        .order("occurred_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
  return <section className="rounded-xl border border-white/10 bg-[#151515] p-4">
    <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold"><CalendarCheck className="text-[#facc15]"/> Minha frequência</h2>
    {isLoading ? <p className="text-sm text-zinc-400">Carregando frequência…</p> : data.length ? <ul className="space-y-2">
      {data.map(item=><li key={item.id} className="flex items-center justify-between gap-3 rounded-lg bg-black p-3 text-sm">
        <span>{item.direction === "entrada" ? "Entrada" : "Saída"}<small className="block text-zinc-500">{new Date(item.occurred_at).toLocaleString("pt-BR")}</small></span>
        <span className={item.allowed ? "text-emerald-400" : "text-amber-300"}>{item.allowed ? "Registrada" : "Não autorizada"}</span>
      </li>)}
    </ul> : <p className="text-sm text-zinc-400">Nenhum registro de frequência encontrado.</p>}
  </section>;
}
