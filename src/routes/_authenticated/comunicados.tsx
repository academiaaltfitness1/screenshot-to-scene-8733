import { createFileRoute } from "@tanstack/react-router";
import { ModuleWindow } from "@/components/shell/ModuleWindow";
import { AnnouncementManager } from "@/components/aluno/AnnouncementManager";

export const Route = createFileRoute("/_authenticated/comunicados")({
  head: () => ({ meta: [
    { title: "Comunicados — ALT FITNESS" },
    { name: "description", content: "Avisos e promoções publicados para os alunos ALT FITNESS." },
  ] }),
  component: ComunicadosPage,
});

function ComunicadosPage() {
  return <ModuleWindow module="comunicados"><div className="p-3"><AnnouncementManager /></div></ModuleWindow>;
}
