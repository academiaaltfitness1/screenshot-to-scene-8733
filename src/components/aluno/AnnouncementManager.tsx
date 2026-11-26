import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, Pin, Send, Archive, ImagePlus, X } from "lucide-react";
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
  const [media,setMedia]=useState<File|null>(null);
  const {data:items=[],isLoading}=useQuery({
    queryKey:["staff-announcements"],
    queryFn:async()=>{const {data,error}=await supabase.from("announcements").select("id,title,body,pinned,starts_at,ends_at,media_path,media_type").order("created_at",{ascending:false}).limit(100);if(!error)return data??[];const fallback=await supabase.from("announcements").select("id,title,body,pinned,starts_at,ends_at").order("created_at",{ascending:false}).limit(100);if(fallback.error)throw fallback.error;return (fallback.data??[]).map(item=>({...item,media_path:null,media_type:null}));}
  });
  const publish=useMutation({
    mutationFn:async()=>{if(!title.trim()&&!body.trim()&&!media)throw new Error("Adicione um título, texto ou mídia.");let mediaPath:string|null=null;let mediaType:"image"|"video"|null=null;if(media){const allowed=["image/jpeg","image/png","image/webp","image/gif","video/mp4","video/webm","video/quicktime"];if(!allowed.includes(media.type))throw new Error("Formato não permitido. Use imagem ou vídeo comum.");if(media.size>50*1024*1024)throw new Error("O arquivo deve ter até 50 MB.");mediaType=media.type.startsWith("video/")?"video":"image";const ext=media.name.split(".").pop()?.toLowerCase()||"bin";mediaPath=crypto.randomUUID()+"."+ext;const {error:uploadError}=await supabase.storage.from("comunicados").upload(mediaPath,media,{contentType:media.type,upsert:false});if(uploadError)throw uploadError;}const {data:{user}}=await supabase.auth.getUser();let {error}=await supabase.from("announcements").insert({title:title.trim()||"Comunicado ALT FITNESS",body:body.trim(),pinned,created_by:user?.id??null,media_path:mediaPath,media_type:mediaType});if(error&&!mediaPath){const fallback=await supabase.from("announcements").insert({title:title.trim()||"Comunicado ALT FITNESS",body:body.trim(),pinned,created_by:user?.id??null});error=fallback.error;}if(error){if(mediaPath)await supabase.storage.from("comunicados").remove([mediaPath]);throw error;}},
    onSuccess:async()=>{setTitle("");setBody("");setPinned(false);setMedia(null);toast.success("Comunicado publicado para os alunos.");await Promise.all([qc.invalidateQueries({queryKey:["staff-announcements"]}),qc.invalidateQueries({queryKey:["student-announcements"]})]);},
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
    <div className="flex flex-wrap items-center gap-3"><label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium"><ImagePlus size={16}/> Anexar imagem ou vídeo<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" onChange={e=>setMedia(e.target.files?.[0]??null)}/></label>{media&&<span className="flex items-center gap-2 text-sm text-muted-foreground">{media.name}<button type="button" aria-label="Remover anexo" onClick={()=>setMedia(null)}><X size={15}/></button></span>}<span className="text-xs text-muted-foreground">Até 50 MB · JPG, PNG, WEBP, GIF, MP4 ou WEBM</span></div>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={pinned} onChange={e=>setPinned(e.target.checked)}/> Fixar como importante</label>
    <div><Button disabled={publish.isPending} onClick={()=>publish.mutate()}><Send/> Publicar comunicado</Button></div>
    <div className="mt-2 space-y-2">{isLoading?"Carregando comunicados...":items.length===0?<p className="text-sm text-muted-foreground">Nenhum comunicado cadastrado.</p>:items.map(item=><article key={item.id} className="flex flex-wrap items-start justify-between gap-3 rounded-md bg-muted/40 p-3">
      <div className="min-w-0"><p className="font-semibold">{item.title} {item.pinned&&<Pin className="inline h-3.5 w-3.5 text-primary"/>}</p><p className="whitespace-pre-wrap text-sm text-muted-foreground">{item.body}</p><p className="text-xs text-muted-foreground">{item.media_type==="video"?"Vídeo anexado":item.media_type==="image"?"Imagem anexada":""}</p><p className="mt-1 text-xs text-muted-foreground">{item.ends_at?"Encerrado":"Ativo"}</p></div>
      {!item.ends_at&&<Button size="sm" variant="outline" disabled={archive.isPending} onClick={()=>archive.mutate(item.id)}><Archive/> Encerrar</Button>}
    </article>)}</div>
  </section>;
}
