import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, Pin, Send, Archive } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function AnnouncementManager() {
  const qc=useQueryClient();
  const [title,setTitle]=useState("");
  const [body,setBody]=useState("");
  const [pinned,setPinned]=useState(false);
  const {data:items=[],isLoading}=useQuery({
    queryKey:["staff-announcements"],
    queryFn:async()=>{const {data,error}=await supabase.from("announcements").select("id,title,body,pinned,starts_at,ends_at").order("created_at",{ascending:false}).limit(100);if(error)throw error;return data??[];}
  });
  const publish=useMutation({
    mutationFn:async()=>{if(!title.trim()||!body.trim())throw new Error("Preencha o título e a mensagem.");const {data:{user}}=await supabase.auth.getUser();const {error}=await supabase.from("announcements").insert({title:title.trim(),body:body.trim(),pinned,created_by:user?.id??null});if(error)throw error;},
    onSuccess:async()=>{setTitle("");setBody("");setPinned(false);toast.success("Comunicado publicado para os alunos.");await Promise.all([qc.invalidateQueries({queryKey:["staff-announcements"]}),qc.invalidateQueries({queryKey:["student-announcements"]})]);},
    onError:e=>toast.error(e instanceof Error?e.message:"Não foi possível publicar.")
  });
  const archive=useMutation({
    mutationFn:async(id:string)=>{const {error}=await supabase.from("announcements").update({ends_at:new Date().toISOString()}).eq("id",id);if(error)throw error;},
    onSuccess:async()=>{toast.success("Comunicado encerrado.");await qc.invalidateQueries({queryKey:["staff-announcements"]});},
    onError:e=>toast.error(e instanceof Error?e.message:"Não foi possível encerrar.")
  });
  return <section className="grid gap-3 rounded-lg border border-border p-4 sm:col-span-2">
    <h3 className="flex items-center gap-2 text-lg font-bold"><Megaphone className="text-primary"/> Comunicados do ALT ALUNO</h3>
    <p className="text-sm text-muted-foreground">Publique avisos e promoções que aparecem na área do aluno. O acesso é controlado pela permissão de comunicados do sistema.</p>
    <Input placeholder="Título do comunicado" value={title} onChange={e=>setTitle(e.target.value)} maxLength={120}/>
    <Textarea placeholder="Digite o aviso ou promoção..." value={body} onChange={e=>setBody(e.target.value)} rows={4} maxLength={3000}/>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={pinned} onChange={e=>setPinned(e.target.checked)}/> Fixar como importante</label>
    <div><Button disabled={publish.isPending} onClick={()=>publish.mutate()}><Send/> Publicar comunicado</Button></div>
    <div className="mt-2 space-y-2">{isLoading?"Carregando comunicados...":items.length===0?<p className="text-sm text-muted-foreground">Nenhum comunicado cadastrado.</p>:items.map(item=><article key={item.id} className="flex flex-wrap items-start justify-between gap-3 rounded-md bg-muted/40 p-3">
      <div className="min-w-0"><p className="font-semibold">{item.title} {item.pinned&&<Pin className="inline h-3.5 w-3.5 text-primary"/>}</p><p className="whitespace-pre-wrap text-sm text-muted-foreground">{item.body}</p><p className="mt-1 text-xs text-muted-foreground">{item.ends_at?"Encerrado":"Ativo"}</p></div>
      {!item.ends_at&&<Button size="sm" variant="outline" disabled={archive.isPending} onClick={()=>archive.mutate(item.id)}><Archive/> Encerrar</Button>}
    </article>)}</div>
  </section>;
}
