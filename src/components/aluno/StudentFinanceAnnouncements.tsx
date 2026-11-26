import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Megaphone, Upload, Wallet } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { buildPixPayload } from "@/lib/pix";

type Bill = { id: string; description: string; amount: number; due_date: string; paid_at: string | null };

function dueReminder(date: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(date + "T00:00:00");
  const days = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (days < 0) return "Atrasada há " + Math.abs(days) + " dia(s)";
  if (days === 0) return "Vence hoje";
  if (days === 1) return "Vence amanhã";
  if (days === 2) return "Vence em 2 dias";
  return "Vence em " + days + " dias";
}

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
  const { data: reads = [] } = useQuery({
    queryKey: ["student-announcement-reads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("announcement_reads")
        .select("announcement_id,read_at");
      if (error) throw error;
      return data ?? [];
    },
  });
  async function markRead(announcementId: string) {
    const { error } = await supabase.from("announcement_reads").insert({
      announcement_id: announcementId, student_id: studentId,
    });
    if (error) { toast.error("Não foi possível marcar como lido."); return; }
    await qc.invalidateQueries({ queryKey: ["student-announcement-reads"] });
  }
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

  const openBills = bills.filter(b => !b.paid_at);
  return <div className="space-y-5">
    <section className="rounded-xl border border-white/10 bg-[#151515] p-4">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold"><Wallet className="text-[#facc15]"/> Pix e comprovantes</h2>
      {pix?.pix_key ? <div className="rounded-lg bg-black p-4">
        <p className="font-semibold">{pix.gym_name || "ALT FITNESS"}</p>
        <p className="mt-1 break-all text-sm text-zinc-300">Chave Pix: {pix.pix_key}</p>
        <button onClick={()=>{void navigator.clipboard.writeText(String(pix.pix_key));toast.success("Chave Pix copiada.");}} className="mt-2 inline-flex items-center gap-2 rounded bg-[#facc15] px-3 py-2 text-sm font-bold text-black"><Copy size={15}/> Copiar chave Pix</button>
        <p className="mt-2 text-xs text-zinc-500">Use o QR de cada mensalidade abaixo: ele já contém o valor exato daquele lançamento. Confira o nome do recebedor no aplicativo do banco antes de confirmar.</p>
      </div> : <p className="text-sm text-zinc-400">A chave Pix ainda não foi configurada pela academia.</p>}
      <div className="mt-4 space-y-3">
        {openBills.map(b=><div key={b.id} className="flex flex-col gap-3 rounded-lg border border-white/10 bg-black p-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <p className="font-semibold">{b.description}</p>
            <p className="text-xs text-zinc-400">Vencimento {new Date(b.due_date+"T12:00:00").toLocaleDateString("pt-BR")} · R$ {Number(b.amount).toFixed(2).replace(".",",")}</p>
            <p className={dueReminder(b.due_date).startsWith("Atrasada")?"mt-1 text-xs font-bold text-red-400":"mt-1 text-xs font-bold text-amber-300"}>{dueReminder(b.due_date)}</p>
            <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded bg-[#facc15] px-3 py-2 text-sm font-bold text-black">
              <Upload size={15}/>{uploading===b.id?"Enviando...":"Enviar comprovante"}
              <input type="file" accept="image/jpeg,image/png,application/pdf" className="hidden" disabled={!!uploading} onChange={e=>{void uploadProof(b,e.target.files?.[0]);e.currentTarget.value="";}}/>
            </label>
          </div>
          {pix?.pix_key ? <div className="flex shrink-0 flex-col items-center gap-1 rounded-lg bg-white p-2">
            <QRCodeSVG value={buildPixPayload({key:String(pix.pix_key),merchantName:String(pix.gym_name||"ALT FITNESS"),merchantCity:"SUZANO",amount:Number(b.amount)})} size={116} level="M"/>
            <span className="text-[10px] font-bold text-black">PIX · VALOR EXATO</span>
          </div> : null}
        </div>)}
        {openBills.length===0 && <p className="text-sm text-zinc-400">Não há mensalidades em aberto.</p>}
      </div>
      {proofs.length>0 && <div className="mt-4"><p className="mb-2 text-sm font-bold">Comprovantes enviados</p>{proofs.map(p=><div key={p.id} className="flex justify-between gap-3 border-t border-white/10 py-2 text-sm"><span>{new Date(p.created_at).toLocaleDateString("pt-BR")}</span><span className={p.status==="aprovado"?"text-emerald-400":p.status==="recusado"?"text-red-400":"text-amber-300"}>{p.status==="aprovado"?"Aprovado":p.status==="recusado"?"Recusado":"Aguardando análise"}</span></div>)}</div>}
    </section>
    <section className="rounded-xl border border-white/10 bg-[#151515] p-4">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold"><Megaphone className="text-[#facc15]"/> Avisos da academia</h2>
      {announcements.filter(a=>!a.ends_at||new Date(a.ends_at)>new Date()).length ? announcements.filter(a=>!a.ends_at||new Date(a.ends_at)>new Date()).map(a=><article key={a.id} className="mb-2 rounded-lg bg-black p-3">
        <div className="flex items-center gap-2"><h3 className="font-bold">{a.title}</h3>{a.pinned&&<span className="rounded bg-[#facc15] px-2 py-0.5 text-[10px] font-black text-black">IMPORTANTE</span>}</div>
        <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-300">{a.body}</p>
        {reads.some(r=>r.announcement_id===a.id) ? <p className="mt-2 text-xs font-semibold text-emerald-400">✓ Lido</p> : <button type="button" onClick={()=>void markRead(a.id)} className="mt-2 rounded border border-white/20 px-3 py-1.5 text-xs font-semibold text-zinc-200">Marcar como lido</button>}
      </article>) : <p className="text-sm text-zinc-400">Nenhum comunicado no momento.</p>}
    </section>
  </div>;
}
