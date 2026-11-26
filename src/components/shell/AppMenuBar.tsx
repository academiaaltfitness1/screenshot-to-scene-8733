import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { MODULES, type ModuleKey } from "@/lib/modules";
import { useStaff } from "@/hooks/use-staff";
import { useSignOut } from "./AppShell";
import { StudentSearchDialog } from "./StudentSearchDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import sharkAsset from "@/assets/alt-mascote.webp.asset.json";
const shark = sharkAsset.url;

const MENUS: { label: string; items: (ModuleKey | "-")[] }[] = [
  { label: "Controle", items: ["alunos", "matriculas", "frequencia", "turmas", "-", "funcionarios", "produtos"] },
  { label: "Financeiro", items: ["vendas", "receber", "pagar", "caixa"] },
];

export function AppMenuBar() {
  const navigate = useNavigate();
  const { can, staff } = useStaff();
  const signOut = useSignOut();
  const [search, setSearch] = useState(false);
  const [about, setAbout] = useState(false);

  const item = (key: ModuleKey) => {
    const m = MODULES[key];
    const Icon = m.icon;
    return (
      <MenubarItem key={key} disabled={!can(key)} onSelect={() => navigate({ to: m.path })}>
        <Icon className="mr-2 h-4 w-4 text-primary" />
        {m.title}
        {m.fkey && <MenubarShortcut>{m.fkey}</MenubarShortcut>}
      </MenubarItem>
    );
  };

  return (
    <>
      <Menubar className="h-8 rounded-none border-x-0 border-t-0 bg-card px-2 text-sm">
        {MENUS.map((menu) => (
          <MenubarMenu key={menu.label}>
            <MenubarTrigger className="px-2.5 py-1">{menu.label}</MenubarTrigger>
            <MenubarContent>
              {menu.items.map((k, i) => (k === "-" ? <MenubarSeparator key={i} /> : item(k)))}
            </MenubarContent>
          </MenubarMenu>
        ))}
        <MenubarMenu>
          <MenubarTrigger className="px-2.5 py-1">Pesquisa</MenubarTrigger>
          <MenubarContent>
            <MenubarItem onSelect={() => setSearch(true)}>Pesquisar aluno…</MenubarItem>
            {item("frequencia")}
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger className="px-2.5 py-1">Utilitários</MenubarTrigger>
          <MenubarContent>
            {item("sistema")}
            {item("backup")}
            {item("catraca")}
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger className="px-2.5 py-1">Aplicativos</MenubarTrigger>
          <MenubarContent>
            {item("avaliacao")}
            {item("treinos")}
            {staff?.isAdmin && (
              <>
                <MenubarSeparator />
                <MenubarItem onSelect={() => navigate({ to: "/painel" })}>
                  <ShieldCheck className="mr-2 h-4 w-4 text-primary" />
                  ALT Admin — Painel de gestão
                </MenubarItem>
              </>
            )}
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger className="px-2.5 py-1">Relatórios</MenubarTrigger>
          <MenubarContent>{item("relatorios")}</MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger className="px-2.5 py-1">Informações</MenubarTrigger>
          <MenubarContent>
            <MenubarItem onSelect={() => setAbout(true)}>Sobre o sistema</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger className="px-2.5 py-1" onClick={signOut}>
            Sair
          </MenubarTrigger>
        </MenubarMenu>
      </Menubar>
      <StudentSearchDialog open={search} onOpenChange={setSearch} />
      <Dialog open={about} onOpenChange={setAbout}>
        <DialogContent>
          <DialogHeader className="items-center text-center">
            <img src={shark} alt="" className="h-24 w-24 object-contain" />
            <DialogTitle className="text-2xl">ACADEMIA ALT FITNESS</DialogTitle>
            <DialogDescription>
              Sistema de Gestão · catraca Henry Primme Acesso SF. Sem custo de licença por usuário.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}
