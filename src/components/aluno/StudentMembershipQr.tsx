import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { QRCodeSVG } from "qrcode.react";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createStudentQrToken } from "@/lib/student-qr.functions";

export function StudentMembershipQr() {
  const generate = useServerFn(createStudentQrToken);
  const [now, setNow] = useState(Date.now());
  const { data, error, isFetching, refetch } = useQuery({
    queryKey: ["student-temporary-qr"],
    queryFn: async () => {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.access_token) throw new Error("Sessão expirada. Entre novamente.");
      return generate({ data: { accessToken: sessionData.session.access_token } });
    },
    refetchInterval: (query) => query.state.data?.mode === "dynamic" ? 25000 : false,
    refetchIntervalInBackground: true,
    retry: 1,
  });
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const remaining = data ? Math.max(0, Math.ceil((data.expiresAt - now) / 1000)) : 0;
  return <section className="rounded-xl border border-[#facc15]/30 bg-[#151515] p-4 text-center">
    <h2 className="mb-2 text-lg font-extrabold text-[#facc15]">Minha carteirinha digital</h2>
    {data?.token && remaining > 0 ? <div className="mx-auto w-fit rounded-xl bg-white p-3">
      <QRCodeSVG value={data.token} size={190} level="M" includeMargin/>
    </div> : <div className="mx-auto flex h-[214px] w-[214px] items-center justify-center rounded-xl bg-black text-sm text-zinc-400">
      {error instanceof Error ? error.message : "Gerando QR temporário…"}
    </div>}
    <p className="mt-3 font-mono text-sm tracking-widest">{data?.token ?? "—"}</p>
    <p className="mt-1 text-xs text-zinc-400">{data?.mode === "dynamic" ? "Código temporário · atualiza a cada 30 segundos" : "Carteirinha fixa atual · QR temporário ainda não ativado"}</p>
    {data?.mode === "dynamic" && <p className="mt-2 text-sm font-bold text-[#facc15]">{remaining > 0 ? "Expira em " + remaining + "s" : "Atualizando código…"}</p>}
    <button type="button" onClick={()=>void refetch()} disabled={isFetching} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm text-zinc-200 disabled:opacity-50">
      <RefreshCw size={15} className={isFetching?"animate-spin":""}/> Atualizar agora
    </button>
    <p className="mt-3 flex items-center justify-center gap-1 text-[11px] text-zinc-500"><ShieldCheck size={13}/> O código é temporário e só pode ser usado uma vez por janela na catraca habilitada.</p>
  </section>;
}
