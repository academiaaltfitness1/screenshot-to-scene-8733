import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, Users, UserCheck, AlertTriangle, ClipboardList, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useStaff } from "@/hooks/use-staff";
import { MODULES } from "@/lib/modules";
import type { ModuleDef } from "@/lib/modules";
import sharkAsset from "@/assets/alt-mascote.webp.asset.json";
const shark = sharkAsset.url;
import { todayISO } from "@/lib/access";

export const Route = createFileRoute("/_authenticated/admin-mobile")({
  head: () => ({ meta: [
    { title: "ALT ADMIN — Academia ALT FITNESS" },
    { name: "description", content: "Painel móvel de gestão da Academia ALT FITNESS." },
  ] }),
  component: AdminMobile,
});

function AdminMobile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { staff, can, isLoading } = useStaff();
  const today = todayISO();
  const { data: stats } = useQuery({
    queryKey: ["admin-mobile-stats", today, can("alunos"), can("receber"), can("treinos")],
    enabled: !!staff,
    queryFn: async () => {
      const [students, ready, overdue, proofs, goals, reviews] = await Promise.all([
        can("alunos") ? supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "ativo") : Promise.resolve({ count: null }),
        can("alunos") ? supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "ativo").not("cpf", "is", null).neq("cpf", "").not("birth_date", "is", null) : Promise.resolve({ count: null }),
        can("receber") ? supabase.from("receivables").select("id", { count: "exact", head: true }).is("paid_at", null).lt("due_date", today) : Promise.resolve({ count: null }),
        can("receber") ? supabase.from("payment_proofs").select("id", { count: "exact", head: true }).eq("status", "pendente") : Promise.resolve({ count: null }),
        can("treinos") ? (supabase as any).from("student_goal_events").select("id,student_id,week_start,target_sessions,completed_sessions,reached_at,students(name,matricula)").order("reached_at", { ascending: false }).limit(5) : Promise.resolve({ data: [] }),
        can("treinos") ? (supabase as any).from("student_workout_review_requests").select("id,student_id,note,created_at,students(name,matricula)").eq("status", "pendente").order("created_at", { ascending: false }).limit(10) : Promise.resolve({ data: [] }),
      ]);
      return { students: students.count ?? 0, ready: ready.count ?? 0, overdue: overdue.count ?? 0, proofs: proofs.count ?? 0, goals: goals.data ?? [], reviews: reviews.data ?? [] };
    },
    refetchInterval: 15000,
  });
  const modules = (Object.values(MODULES) as ModuleDef[])
    .filter(module => can(module.key));

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (isLoading) return <div className="min-h-screen bg-[#080808] p-6 text-white">Carregando ALT ADMIN…</div>;
  return <main className="min-h-screen bg-[#080808] px-4 py-5 text-white">
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#151515] p-4">
        <div className="flex items-center gap-3"><img src={shark} alt="Mascote ALT FITNESS" className="h-16 w-16 object-contain"/><div><p className="text-xs font-bold tracking-[.25em] text-[#facc15]">ACADEMIA</p><h1 className="text-2xl font-black">ALT ADMIN</h1><p className="text-xs text-zinc-400">{staff?.name} · {staff?.cargo || "Equipe"}</p></div></div>
        <button onClick={logout} className="rounded-lg border border-white/15 p-3 text-zinc-300" aria-label="Sair"><LogOut size={20}/></button>
      </header>
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {can("alunos") && <article className="rounded-xl border border-white/10 bg-[#151515] p-3"><Users className="mb-2 text-[#facc15]"/><strong className="text-2xl">{stats?.students ?? "—"}</strong><p className="text-xs text-zinc-400">Alunos ativos</p></article>}
        {can("alunos") && <article className="rounded-xl border border-white/10 bg-[#151515] p-3"><UserCheck className="mb-2 text-emerald-400"/><strong className="text-2xl">{stats?.ready ?? "—"}</strong><p className="text-xs text-zinc-400">Prontos para ativar</p></article>}
        {can("receber") && <article className="rounded-xl border border-white/10 bg-[#151515] p-3"><AlertTriangle className="mb-2 text-amber-400"/><strong className="text-2xl">{stats?.overdue ?? "—"}</strong><p className="text-xs text-zinc-400">Em atraso</p></article>}
        {can("receber") && <article className="rounded-xl border border-white/10 bg-[#151515] p-3"><ClipboardList className="mb-2 text-[#facc15]"/><strong className="text-2xl">{stats?.proofs ?? "—"}</strong><p className="text-xs text-zinc-400">Comprovantes</p></article>}
      </section>
      {can("treinos") && <section className="rounded-xl border border-white/10 bg-[#151515] p-4">
        <h2 className="mb-2 text-lg font-extrabold text-[#facc15]">Pedidos de revisão de treino</h2>
        {stats?.reviews?.length ? <ul className="space-y-2">{stats.reviews.map((request: any)=><li key={request.id} className="rounded-lg bg-black p-3 text-sm">
          <strong>{request.students?.name ?? "Aluno"} · {request.students?.matricula ?? "—"}</strong>
          {request.note && <p className="mt-1 text-zinc-300">{request.note}</p>}
          <p className="mt-1 text-xs text-zinc-500">{new Date(request.created_at).toLocaleString("pt-BR")}</p>
          <button onClick={async()=>{const {data:{user}}=await supabase.auth.getUser();const {error}=await (supabase as any).from("student_workout_review_requests").update({status:"atendido",reviewed_by:user?.id??null,reviewed_at:new Date().toISOString()}).eq("id",request.id).eq("status","pendente");if(error){toast.error("Não foi possível atualizar o pedido.");return;}toast.success("Pedido marcado como atendido.");await queryClient.invalidateQueries({queryKey:["admin-mobile-stats"]});}} className="mt-2 rounded bg-[#facc15] px-3 py-1.5 text-xs font-bold text-black">Marcar como atendido</button>
        </li>)}</ul> : <p className="text-sm text-zinc-400">Nenhum pedido pendente.</p>}
      </section>}
      {can("treinos") && <section className="rounded-xl border border-white/10 bg-[#151515] p-4">
        <h2 className="mb-2 text-lg font-extrabold text-[#facc15]">Metas de alunos alcançadas</h2>
        {stats?.goals?.length ? <ul className="space-y-2">{stats.goals.map((event: any)=><li key={event.id} className="rounded-lg bg-black p-3 text-sm">
          <strong>{event.students?.name ?? "Aluno"} · {event.students?.matricula ?? "—"}</strong>
          <p className="text-zinc-400">{event.completed_sessions}/{event.target_sessions} treinos na semana · {new Date(event.reached_at).toLocaleString("pt-BR")}</p>
        </li>)}</ul> : <p className="text-sm text-zinc-400">Nenhuma meta alcançada recentemente.</p>}
      </section>}
      <section className="space-y-2">
        <h2 className="text-lg font-extrabold">Módulos disponíveis</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {modules.map(module=>{const Icon=module.icon;return <button key={module.key} onClick={()=>navigate({to:module.path})} className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#151515] p-4 text-left transition hover:border-[#facc15]/60">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#facc15] text-black"><Icon/></span>
            <span className="min-w-0 flex-1"><strong className="block">{module.label}</strong><small className="text-zinc-400">{module.title}</small></span><ChevronRight className="text-zinc-500"/>
          </button>;})}
        </div>
        {modules.length===0 && <p className="rounded-lg bg-[#151515] p-4 text-sm text-zinc-400">Nenhum módulo foi liberado para este usuário. Solicite permissão ao administrador.</p>}
      </section>
      <button onClick={()=>navigate({to:"/painel"})} className="w-full rounded-lg border border-white/15 p-3 text-sm text-zinc-300">Abrir sistema completo</button>
      <p className="text-center text-xs text-zinc-600">ALT FITNESS · Acesso administrativo protegido por permissões</p>
    </div>
  </main>;
}
