import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Dumbbell, Wallet, LogOut, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StudentLogin } from "@/components/aluno/StudentLogin";
import { StudentWorkoutExecution } from "@/components/aluno/StudentWorkoutExecution";
import { StudentFinanceAnnouncements } from "@/components/aluno/StudentFinanceAnnouncements";
import { StudentGoalProgress } from "@/components/aluno/StudentGoalProgress";
import { StudentAttendanceHistory } from "@/components/aluno/StudentAttendanceHistory";
import { StudentMembershipQr } from "@/components/aluno/StudentMembershipQr";
import sharkAsset from "@/assets/alt-mascote.webp.asset.json";
const shark = sharkAsset.url;

export const Route = createFileRoute("/aluno")({
  ssr: false,
  head: () => ({ links: [{ rel: "manifest", href: "/manifest-aluno.webmanifest" }], meta: [
    { title: "ALT ALUNO — Academia ALT FITNESS" },
    { name: "description", content: "Treinos, mensalidades e informações do aluno ALT FITNESS." },
  ] }),
  component: StudentPortal,
});

function StudentPortal() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [signedIn, setSignedIn] = useState(false);
  const { data: profile } = useQuery({
    queryKey: ["student-portal-profile"],
    enabled: signedIn,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("aluno_me");
      if (error) throw error;
      return Array.isArray(data) ? data[0] ?? null : data;
    },
  });
  const { data: workouts = [] } = useQuery({
    queryKey: ["student-portal-workouts"],
    enabled: signedIn,
    queryFn: async () => {
      const { data, error } = await supabase.from("workouts")
        .select("id,letter,name,notes,workout_exercises(id,exercise,sets,reps,load,rest,sort_order)")
        .eq("active", true).order("letter");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: bills = [] } = useQuery({
    queryKey: ["student-portal-bills"],
    enabled: signedIn,
    queryFn: async () => {
      const { data, error } = await supabase.from("receivables")
        .select("id,description,amount,due_date,paid_at").order("due_date", { ascending: false }).limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.app_metadata?.kind === "student") setSignedIn(true);
    });
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    queryClient.removeQueries({ predicate: (query) => String(query.queryKey[0] ?? "").startsWith("student-") });
    setSignedIn(false);
    navigate({ to: "/aluno", replace: true });
  }

  if (!signedIn) return (
    <main className="min-h-screen bg-[#080808] px-4 py-10 text-white">
      <StudentLogin onSignedIn={() => setSignedIn(true)} />
    </main>
  );

  return (
    <main className="min-h-screen bg-[#080808] px-4 py-6 text-white">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#151515] p-4">
          <div className="flex items-center gap-3"><img src={shark} alt="Mascote ALT FITNESS" className="h-16 w-16 object-contain"/><div><p className="text-xs font-bold tracking-[.25em] text-[#facc15]">ALT FITNESS</p><h1 className="text-2xl font-black">Olá, {profile?.name?.split(" ")[0] ?? "aluno"}!</h1><p className="text-xs text-zinc-400">Sua área do aluno</p></div></div>
          <button onClick={logout} className="rounded-lg border border-white/15 p-2 text-zinc-300" aria-label="Sair"><LogOut size={19}/></button>
        </header>
        <section className="grid gap-3 sm:grid-cols-2">
          <article className="rounded-xl border border-white/10 bg-[#151515] p-4"><p className="text-xs text-zinc-400">MATRÍCULA</p><p className="mt-1 text-xl font-bold">{profile?.matricula ?? "—"}</p><p className="mt-2 text-sm text-zinc-400">Situação: {profile?.status ?? "—"}</p></article>
          <article className="rounded-xl border border-white/10 bg-[#151515] p-4"><p className="text-xs text-zinc-400">VALIDADE</p><p className="mt-1 text-xl font-bold">{profile?.valid_until ? new Date(profile.valid_until+"T12:00:00").toLocaleDateString("pt-BR") : "Consulte a recepção"}</p></article>
        </section>
        <section className="rounded-xl border border-white/10 bg-[#151515] p-4">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold"><Dumbbell className="text-[#facc15]"/> Meus treinos</h2>
          {workouts.length ? <div className="space-y-3">{workouts.map(w=><article key={w.id} className="rounded-lg border border-white/10 bg-black p-3"><div className="flex items-center gap-2"><span className="rounded bg-[#facc15] px-2 py-1 font-black text-black">{w.letter}</span><h3 className="font-bold">{w.name}</h3></div>{w.notes && <p className="mt-2 text-sm text-zinc-400">{w.notes}</p>}<ul className="mt-3 space-y-2">{[...(w.workout_exercises??[])].sort((a,b)=>a.sort_order-b.sort_order).map(ex=><li key={ex.id} className="flex justify-between gap-3 border-b border-white/5 pb-2 text-sm"><span>{ex.exercise}</span><span className="shrink-0 text-zinc-400">{ex.sets} × {ex.reps}</span></li>)}</ul></article>)}</div> : <p className="text-sm text-zinc-400">Nenhuma ficha ativa cadastrada ainda.</p>}
        </section>
        <StudentMembershipQr />
        <StudentWorkoutExecution workouts={workouts as any} />
        <StudentGoalProgress />
        <StudentAttendanceHistory />
        <section className="rounded-xl border border-white/10 bg-[#151515] p-4">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold"><Wallet className="text-[#facc15]"/> Minhas mensalidades</h2>
          {bills.length ? <div className="space-y-2">{bills.map(b=><div key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-black p-3 text-sm"><span>{b.description}<small className="block text-zinc-500">Vencimento: {new Date(b.due_date+"T12:00:00").toLocaleDateString("pt-BR")}</small></span><span className="text-right font-bold">R$ {Number(b.amount).toFixed(2).replace(".",",")}<small className={"block "+(b.paid_at?"text-emerald-400":"text-amber-300")}>{b.paid_at?"Pago":"Em aberto"}</small></span></div>)}</div> : <p className="text-sm text-zinc-400">Nenhum lançamento financeiro disponível.</p>}
        </section>
        {profile?.id && <StudentFinanceAnnouncements studentId={profile.id} bills={bills as any} />}
        <p className="flex items-center justify-center gap-2 text-center text-xs text-zinc-500"><ShieldCheck size={14}/> Seus dados são privados e visíveis apenas na sua conta.</p>
      </div>
    </main>
  );
}
