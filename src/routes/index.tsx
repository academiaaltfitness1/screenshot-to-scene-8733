import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Smartphone } from "lucide-react";
import logoAsset from "@/assets/alt-logo.webp.asset.json";
import gymBg from "@/assets/gym-bg.webp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Academia ALT FITNESS — Sistema e App do Aluno" },
      { name: "description", content: "Acesso ao ALT ADMIN para gestão da academia e ao ALT ALUNO para treinos e serviços." },
      { property: "og:title", content: "Academia ALT FITNESS — Sistema e App do Aluno" },
      { property: "og:description", content: "Acesso ao ALT ADMIN para gestão da academia e ao ALT ALUNO para treinos e serviços." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-chrome text-chrome-foreground">
      <img src={gymBg} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
      <div className="absolute inset-0 bg-chrome-gradient opacity-80" />
      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-10 px-6 py-12 md:flex-row">
        <img src={logoAsset.url} alt="Logotipo ALT FITNESS com o mascote tubarão" className="w-60 drop-shadow-2xl md:w-80" />
        <div className="max-w-md text-center md:text-left">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">Academia</p>
          <h1 className="text-5xl font-extrabold leading-none md:text-6xl">ALT FITNESS</h1>
          <div className="mx-auto mt-3 h-1.5 w-24 rounded bg-accent md:mx-0" />
          <p className="mt-5 text-lg opacity-85">Escolha como deseja entrar.</p>
          <div className="mt-8 grid gap-3">
            <Link
              to="/auth"
              className="flex items-center gap-3 rounded-lg bg-accent px-5 py-4 text-left text-accent-foreground shadow-window transition hover:brightness-105"
            >
              <ShieldCheck className="h-7 w-7" />
              <span>
                <span className="block text-lg font-bold">ALT ADMIN</span>
                <span className="text-sm opacity-80">Gestão da academia, equipe, alunos e financeiro</span>
              </span>
            </Link>
            <Link
              to="/aluno"
              className="flex items-center gap-3 rounded-lg border border-chrome-foreground/25 bg-chrome-foreground/10 px-5 py-4 text-left transition hover:bg-chrome-foreground/15"
            >
              <Smartphone className="h-7 w-7 text-accent" />
              <span>
                <span className="block text-lg font-bold">ALT ALUNO</span>
                <span className="text-sm opacity-80">Treino, avaliação, mensalidade e carteirinha</span>
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
