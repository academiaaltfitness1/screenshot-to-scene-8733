import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { ModuleWindow } from "@/components/shell/ModuleWindow";
import { Field } from "@/components/app/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { settingsQuery } from "@/hooks/use-staff";
import { errMsg } from "@/lib/format";

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
        <section className="grid gap-3 sm:grid-cols-2">
          <h3 className="text-lg font-bold sm:col-span-2">Bloqueio de acesso</h3>
          {text("tolerance_days", "Dias de tolerância após o vencimento", "Depois disso a catraca bloqueia automaticamente.")}
          {text("welcome_message", "Mensagem de boas-vindas no visor")}
        </section>
      </div>
    </ModuleWindow>
  );
}
