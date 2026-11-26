import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function PaymentProofReview() {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["staff-payment-proofs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payment_proofs")
        .select("id,student_id,receivable_id,file_path,status,note,created_at,students(name,matricula),receivables(description,amount,due_date)")
        .order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return Promise.all((data ?? []).map(async (p:any) => {
        const { data: signed } = await supabase.storage.from("comprovantes").createSignedUrl(p.file_path, 90);
        return { ...p, signedUrl: signed?.signedUrl ?? null };
      }));
    },
  });
  const review = useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      const { error } = await supabase.rpc("review_student_payment_proof", {
        _proof_id: id, _approved: approved, _note: approved ? "Pagamento confirmado pela recepção." : "Comprovante não confirmado. Procure a recepção.",
      });
      if (error) throw error;
    },
    onSuccess: async (_, vars) => {
      toast.success(vars.approved ? "Comprovante aprovado e mensalidade baixada." : "Comprovante recusado.");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["staff-payment-proofs"] }),
        qc.invalidateQueries({ queryKey: ["receivables"] }),
        qc.invalidateQueries({ queryKey: ["students-overview"] }),
        qc.invalidateQueries({ queryKey: ["home-alerts"] }),
      ]);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível revisar o comprovante."),
  });

  return <section className="mt-6 rounded-xl border border-border bg-card p-4">
    <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">Comprovantes enviados pelo ALT ALUNO</h2><Badge variant="secondary">{rows.filter((r:any)=>r.status==="pendente").length} pendente(s)</Badge></div>
    {isLoading ? <p className="text-sm text-muted-foreground">Carregando comprovantes…</p> : rows.length===0 ? <p className="text-sm text-muted-foreground">Nenhum comprovante enviado.</p> :
      <div className="space-y-3">{rows.map((p:any)=><article key={p.id} className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0"><p className="font-semibold">{p.students?.name ?? "Aluno"} · matrícula {p.students?.matricula ?? "—"}</p><p className="text-sm text-muted-foreground">{p.receivables?.description ?? "Mensalidade"} · R$ {Number(p.receivables?.amount ?? 0).toFixed(2).replace(".",",")} · venc. {p.receivables?.due_date ? new Date(p.receivables.due_date+"T12:00:00").toLocaleDateString("pt-BR") : "—"}</p><p className="text-xs text-muted-foreground">Enviado em {new Date(p.created_at).toLocaleString("pt-BR")} · {p.status}</p>{p.note&&<p className="text-xs text-muted-foreground">{p.note}</p>}</div>
        <div className="flex shrink-0 flex-wrap gap-2">{p.signedUrl&&<Button size="sm" variant="outline" onClick={()=>window.open(p.signedUrl,"_blank","noopener,noreferrer")}><ExternalLink/> Ver arquivo</Button>}
          {p.status==="pendente"&&<><Button size="sm" variant="success" disabled={review.isPending} onClick={()=>review.mutate({id:p.id,approved:true})}><CheckCircle2/> Aprovar</Button><Button size="sm" variant="destructive" disabled={review.isPending} onClick={()=>review.mutate({id:p.id,approved:false})}><XCircle/> Recusar</Button></>}
          {p.status!=="pendente"&&<Badge variant={p.status==="aprovado"?"success":"destructive"}>{p.status}</Badge>}
        </div>
      </article>)}</div>}
  </section>;
}
