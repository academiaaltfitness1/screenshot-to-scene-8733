import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Save, Upload, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { ModuleWindow } from "@/components/shell/ModuleWindow";
import { Field } from "@/components/app/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { settingsQuery } from "@/hooks/use-staff";
import { errMsg } from "@/lib/format";
import { AnnouncementManager } from "@/components/aluno/AnnouncementManager";

export const Route = createFileRoute("/_authenticated/sistema")({
  head: () => ({
    meta: [
      { title: "Configurações do Sistema — ALT FITNESS" },
      { name: "description", content: "Dados da academia, chave Pix, tolerância e alertas." },
      { property: "og:title", content: "Configurações do Sistema — ALT FITNESS" },
      { property: "og:description", content: "Dados da academia, chave Pix, tolerância e alertas." },
    ],
  }),
  component: SistemaPage,
});

type Settings = Tables<"settings">;

function SistemaPage() {
  const qc = useQueryClient();
  const { data } = useQuery(settingsQuery);
  const [f, setF] = useState<Partial<Settings>>({});
  const [mascotFile, setMascotFile] = useState<File | null>(null);
  const [uploadingMascot, setUploadingMascot] = useState(false);
  useEffect(() => {
    if (data) setF(data);
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("settings")
        .update({
          gym_name: f.gym_name ?? "",
          phone: f.phone ?? "",
          address: f.address ?? "",
          pix_key: f.pix_key ?? "",
          tolerance_days: Number(f.tolerance_days ?? 5),
          bill_alert_days: Number(f.bill_alert_days ?? 3),
          welcome_message: f.welcome_message ?? "Bem-vindo",
          dashboard_mascot_url: f.dashboard_mascot_url ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configurações salvas");
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const uploadMascot = async () => {
    if (!mascotFile) return;
    if (!mascotFile.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem.");
      return;
    }
    if (mascotFile.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5 MB.");
      return;
    }
    setUploadingMascot(true);
    try {
      const extension = mascotFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `mascote/${Date.now()}.${extension}`;
      const { error } = await supabase.storage.from("dashboard-assets").upload(path, mascotFile, {
        upsert: true,
        contentType: mascotFile.type,
        cacheControl: "3600",
      });
      if (error) throw error;
      const { data } = supabase.storage.from("dashboard-assets").getPublicUrl(path);
      setF((current) => ({ ...current, dashboard_mascot_url: data.publicUrl }));
      setMascotFile(null);
      toast.success("Imagem enviada. Clique em Salvar para aplicar no painel.");
    } catch (error) {
      toast.error(errMsg(error));
    } finally {
      setUploadingMascot(false);
    }
  };

  const text = (k: keyof Settings, label: string, hint?: string) => (
    <Field label={label}>
      <Input value={String(f[k] ?? "")} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </Field>
  );

  return (
    <ModuleWindow
      module="sistema"
      actions={
        <Button size="sm" variant="accent" onClick={() => save.mutate()}>
          <Save /> Salvar
        </Button>
      }
    >
      <div className="mx-auto grid max-w-3xl gap-6 p-6">
        <section className="grid gap-3 sm:grid-cols-2">
          <h3 className="text-lg font-bold sm:col-span-2">Personalizar tela inicial interna</h3>
          <div className="grid gap-3 sm:col-span-2">
            <p className="text-sm text-muted-foreground">Escolha a imagem do tubarão exibida dentro do painel após entrar no sistema. A imagem padrão continua disponível quando nenhuma imagem personalizada estiver salva.</p>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                {f.dashboard_mascot_url ? <img src={f.dashboard_mascot_url} alt="Prévia do mascote do painel" className="h-full w-full object-contain" /> : <ImageIcon className="h-8 w-8 text-muted-foreground" />}
              </div>
              <div className="grid gap-2">
                <Input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => setMascotFile(e.target.files?.[0] ?? null)} />
                <Button type="button" size="sm" variant="outline" disabled={!mascotFile || uploadingMascot} onClick={uploadMascot}>
                  <Upload /> {uploadingMascot ? "Enviando..." : "Enviar imagem"}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setF((current) => ({ ...current, dashboard_mascot_url: null }))}>
                  Restaurar imagem padrão
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Formatos: PNG, JPG, WEBP ou GIF. Limite: 5 MB. A tela externa preta com o tubarão não é afetada.</p>
          </div>
        </section>
        <section className="grid gap-3 sm:grid-cols-2">
          <h3 className="text-lg font-bold sm:col-span-2">Dados da academia</h3>
          {text("gym_name", "Nome da academia")}
          {text("phone", "Telefone / WhatsApp")}
          <div className="sm:col-span-2">{text("address", "Endereço")}</div>
        </section>
        <section className="grid gap-3 sm:grid-cols-2">
          <h3 className="text-lg font-bold sm:col-span-2">Financeiro</h3>
          {text("pix_key", "Chave Pix", "Aparece no app do aluno para renovação.")}
          {text("bill_alert_days", "Avisar contas com quantos dias de antecedência")}
        </section>
        <AnnouncementManager />
        <section className="grid gap-3 sm:grid-cols-2">
          <h3 className="text-lg font-bold sm:col-span-2">Bloqueio de acesso</h3>
          {text("tolerance_days", "Dias de tolerância após o vencimento", "Depois disso a catraca bloqueia automaticamente.")}
          {text("welcome_message", "Mensagem de boas-vindas no visor")}
        </section>
      </div>
    </ModuleWindow>
  );
}
