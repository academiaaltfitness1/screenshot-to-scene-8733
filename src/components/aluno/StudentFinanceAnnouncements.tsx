import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Megaphone, Upload, Wallet } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Bill = { id: string; description: string; amount: number; due_date: string; paid_at: string | null };

export function StudentFinanceAnnouncements({ studentId, bills }: { studentId: string; bills: Bill[] }) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState<string | null>(null);
  const { data: pix } = useQuery({
    queryKey: ["student-pix-details"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("aluno_pix");
      if (error) throw error;
      return Array.isArray(data) ? data[0] ?? null : data;
    },
  });
  const { data: announcements = [] } = useQuery({
    queryKey: ["student-announcements"],
    queryFn: async () => {
      const { data, error } = await supabase.from("announcements")
        .select("id,title,body,pinned,starts_at,ends_at")
        .lte("starts_at", new Date().toISOString())
        .order("pinned", { ascending: false }).order("starts_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: proofs = [] } = useQuery({
    queryKey: ["student-payment-proofs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payment_proofs")
        .select("id,receivable_id,status,note,created_at")
        .order("created_at", { ascending: false }).limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });

  async function uploadProof(bill: Bill, file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "application/pdf"].includes(file.type)) {
      toast.error("Envie uma imagem JPG/PNG ou um PDF."); return;
    }
    if (file.size > 5 * 1024 * 1024) { toast.error("O arquivo deve ter até 5 MB."); return; }
    setUploading(bill.id);
    const ext = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
    const path = studentId + "/" + crypto.randomUUID() + "." + ext;
    try {
      const { error: storageError } = await supabase.storage.from("comprovantes").upload(path, file, { contentType: file.type, upsert: false });
      if (storageError) throw storageError;
      const { error } = await supabase.from("payment_proofs").insert({
        receivable_id: bill.id, student_id: studentId, file_path: path, status: "pendente",
      });
      if (error) {
        await supabase.storage.from("comprovantes").remove([path]);
        throw error;
      }
      toast.success("Comprovante enviado. A recepção fará a conferência.");
      await qc.invalidateQueries({ queryKey: ["student-payment-proofs"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar o comprovante.");
    } finally { setUploading(null); }
  }

  return <div className="space-y-5">
    <section className="rounded-xl border border-white/10 bg-[#151515] p-4">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold"><Wallet className="text-[#facc15]"/> Pix e comprovantes</h2>
      {pix?.pix_key ? <div className="flex flex-col items-center gap-3 rounded-lg bg-black p-4 sm:flex-row">
        <QRCodeSVG value={String(pix.pix_key)} size={132} bgColor="#000000" fgColor="#facc15"/>
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="text-sm font-semibold">{pix.gym_name || "ALT FITNESS"}</p>
          <p className="mt-1 break-all text-sm text-zinc-300">{pix.pix_key}</p>
          <button onClick={()=>{void navigator.clipboard.writeText(String(pix.pix_key));toast.success("Chave Pix copiada.");}} className="mt-2 inline-flex items-center gap-2 rounded bg-[#facc15] px-3 py-2 text-sm font-bold text-black"><Copy size={15}/> Copiar chave Pix</button>
          <p className="mt-2 text-xs text-zinc-500">Confira o valor e os dados antes de pagar. O pagamento só será confirmado após análise da equipe.</p>
        </div>
      </div> : <p className="text-sm text-zinc-400">A chave Pix ainda não foi configurada pela academia.</p>}
      <div className="mt-4 space-y-3">{bills.filter(b=>!b.paid_at).map(b=><div key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-black p-3">
        <div><p className="font-semibold">{b.description}</p><p className="text-xs text-zinc-400">Vencimento {new Date(b.due_date+"T12:00:00").toLocaleDateString("pt-BR")} · R$ {Number(b.amount).toFixed(2).replace(".",",")}</p></div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded bg-[#facc15] px-3 py-2 text-sm font-bold text-black">
          <Upload size={15}/>{uploading===b.id?"Enviando...":"Enviar comprovante"}
          <input type="file" accept="image/jpeg,image/png,application/pdf" className="hidden" disabled={!!uploading} onChange={e=>{void uploadProof(b,e.target.files?.[0]);e.currentTarget.value="";}}/>
        </label>
      </div>)}</div>
      {proofs.length>0 && <div className="mt-4"><p className="mb-2 text-sm font-bold">Comprovantes enviados</p>{proofs.map(p=><div key={p.id} className="flex justify-between gap-3 border-t border-white/10 py-2 text-sm"><span>{new Date(p.created_at).toLocaleDateString("pt-BR")}</span><span className={p.status==="aprovado"?"text-emerald-400":p.status==="recusado"?"text-red-400":"text-amber-300"}>{p.status==="aprovado"?"Aprovado":p.status==="recusado"?"Recusado":"Aguardando análise"}</span></div>)}</div>}
    </section>
    <section className="rounded-xl border border-white/10 bg-[#151515] p-4">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold"><Megaphone className="text-[#facc15]"/> Avisos da academia</h2>
      {announcements.filter(a=>!a.ends_at||new Date(a.ends_at)>new Date()).length ? announcements.filter(a=>!a.ends_at||new Date(a.ends_at)>new Date()).map(a=><article key={a.id} className="mb-2 rounded-lg bg-black p-3">
        <div className="flex items-center gap-2"><h3 className="font-bold">{a.title}</h3>{a.pinned&&<span className="rounded bg-[#facc15] px-2 py-0.5 text-[10px] font-black text-black">IMPORTANTE</span>}</div>
        <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-300">{a.body}</p>
      </article>) : <p className="text-sm text-zinc-400">Nenhum comunicado no momento.</p>}
    </section>
  </div>;
}
