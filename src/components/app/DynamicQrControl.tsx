import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";

export function DynamicQrControl({ isAdmin }: { isAdmin: boolean }) {
  const client = useQueryClient();
  const { data: enabled = false } = useQuery({
    queryKey: ["dynamic-qr-enabled"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("settings").select("dynamic_qr_enabled").eq("id", 1).single();
      if (error) throw error;
      return data?.dynamic_qr_enabled === true;
    },
  });
  async function change(value: boolean) {
    if (!isAdmin) return;
    if (value && !window.confirm("Ative somente depois de instalar a nova versão do Agente Henry e testar a leitura na catraca. O QR fixo continuará ativo.")) return;
    const { error } = await (supabase as any).from("settings").update({ dynamic_qr_enabled: value, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) { toast.error("Não foi possível alterar a ativação do QR temporário."); return; }
    toast.success(value ? "QR temporário habilitado." : "QR temporário desabilitado; o QR fixo continua ativo.");
    await client.invalidateQueries({ queryKey: ["dynamic-qr-enabled"] });
    await client.invalidateQueries({ queryKey: ["settings"] });
  }
  return <section className="rounded-lg border border-amber-500/30 bg-card p-4">
    <div className="flex items-center justify-between gap-4">
      <div><h3 className="flex items-center gap-2 font-bold"><ShieldCheck className="h-5 w-5 text-primary"/> QR temporário (30 segundos)</h3>
        <p className="mt-1 text-xs text-muted-foreground">{enabled ? "Ativo: o app gera códigos temporários e o agente atualizado valida offline." : "Desativado: os alunos continuam usando o QR fixo atual."}</p>
      </div>
      <Switch checked={enabled} onCheckedChange={(value)=>void change(value)} disabled={!isAdmin}/>
    </div>
    <p className="mt-3 text-xs text-amber-600">Importante: não habilite antes de baixar e instalar o novo Agente Local no computador da recepção e testar com a Henry. O QR fixo não é desligado por esta opção.</p>
  </section>;
}
