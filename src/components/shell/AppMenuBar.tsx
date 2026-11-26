import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarSeparator, MenubarShortcut, MenubarTrigger,
} from "@/components/ui/menubar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MODULES, type ModuleKey } from "@/lib/modules";
import { useStaff } from "@/hooks/use-staff";
import { useSignOut } from "./AppShell";
import { StudentSearchDialog } from "./StudentSearchDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { staffSignIn } from "@/lib/staff.functions";
import sharkAsset from "@/assets/alt-mascote.webp.asset.json";
const shark = sharkAsset.url;

const MENUS: { label: string; items: (ModuleKey | "-")[] }[] = [
  { label: "Controle", items: ["alunos", "matriculas", "frequencia", "turmas", "-", "funcionarios", "produtos"] },
  { label: "Financeiro", items: ["vendas", "receber", "pagar", "caixa"] },
];

export function AppMenuBar() {
  const navigate = useNavigate();
  const { can } = useStaff();
  const signOut = useSignOut();
  const queryClient = useQueryClient();
  const signInFn = useServerFn(staffSignIn);
  const [search, setSearch] = useState(false);
  const [about, setAbout] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [selected, setSelected] = useState<{ id: string; full_name: string; cargo: string } | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: team = [], isLoading: teamLoading } = useQuery({
    queryKey: ["login-team"],
    enabled: switchOpen,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("login_staff_list");
      if (error) throw error;
      return data ?? [];
    },
  });

  const openSwitch = () => {
    setSelected(null);
    setPassword("");
    setSwitchOpen(true);
  };

  const confirmSwitch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || !password || busy) return;
    setBusy(true);
    try {
      const result = await signInFn({ data: { userId: selected.id, password } });
      if (!result.ok) throw new Error(result.error);
      // Only replace the current session after the next employee's credentials are validated.
      const { error } = await supabase.auth.setSession({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
      });
      if (error) throw error;
      queryClient.clear();
      setSwitchOpen(false);
      setSelected(null);
      setPassword("");
      toast.success(`Turno alterado. Bem-vindo(a), ${selected.full_name}!`);
      navigate({ to: "/painel", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível trocar o funcionário.");
    } finally {
      setBusy(false);
    }
  };

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
              {menu.label === "Controle" && (
                <>
                  <MenubarSeparator />
                  <MenubarItem onSelect={openSwitch}>Troca de funcionário</MenubarItem>
                </>
              )}
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
            {item("sistema")}{item("comunicados")}{item("backup")}{item("catraca")}
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger className="px-2.5 py-1">Aplicativos</MenubarTrigger>
          <MenubarContent>
            {item("avaliacao")}{item("treinos")}
            <MenubarSeparator />
            <MenubarItem onSelect={() => navigate({ to: "/admin-mobile" })}>ALT ADMIN (celular)</MenubarItem>
            <MenubarItem onSelect={() => window.open("/aluno", "_blank")}>App do Aluno (celular)</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger className="px-2.5 py-1">Relatórios</MenubarTrigger>
          <MenubarContent>{item("relatorios")}</MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger className="px-2.5 py-1">Informações</MenubarTrigger>
          <MenubarContent><MenubarItem onSelect={() => setAbout(true)}>Sobre o sistema</MenubarItem></MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger className="px-2.5 py-1" onClick={signOut}>Sair</MenubarTrigger>
        </MenubarMenu>
      </Menubar>
      <StudentSearchDialog open={search} onOpenChange={setSearch} />
      <Dialog open={switchOpen} onOpenChange={(open) => { if (!busy) setSwitchOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Troca de funcionário</DialogTitle>
            <DialogDescription>Selecione o próximo funcionário e confirme com a senha individual dele. O ALT Desktop continuará aberto.</DialogDescription>
          </DialogHeader>
          {!selected ? (
            <div className="max-h-[55vh] space-y-2 overflow-auto">
              {teamLoading && <p className="text-sm text-muted-foreground">Carregando equipe…</p>}
              {team.map((employee) => (
                <button key={employee.id} type="button" onClick={() => { setSelected(employee); setPassword(""); }}
                  className="flex w-full items-center justify-between rounded-md border border-border p-3 text-left hover:border-primary hover:bg-primary/5">
                  <span><span className="block font-medium">{employee.full_name}</span><span className="text-xs text-muted-foreground">{employee.cargo}</span></span>
                  <span className="text-sm text-primary">Selecionar</span>
                </button>
              ))}
              {!teamLoading && team.length === 0 && <p className="text-sm text-muted-foreground">Nenhum funcionário ativo encontrado.</p>}
            </div>
          ) : (
            <form onSubmit={confirmSwitch} className="space-y-4">
              <div className="rounded-md border border-border bg-muted/40 p-3">
                <p className="font-semibold">{selected.full_name}</p><p className="text-xs text-muted-foreground">{selected.cargo}</p>
                <button type="button" className="mt-1 text-xs text-primary hover:underline" onClick={() => setSelected(null)}>Escolher outra pessoa</button>
              </div>
              <div className="space-y-1.5"><Label htmlFor="switch-employee-password">Senha do funcionário</Label>
                <Input id="switch-employee-password" type="password" autoComplete="current-password" autoFocus required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setSelected(null)} disabled={busy}>Voltar</Button>
                <Button type="submit" variant="hero" disabled={busy || !password}>{busy ? "Validando…" : "Confirmar troca"}</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={about} onOpenChange={setAbout}>
        <DialogContent>
          <DialogHeader className="items-center text-center">
            <img src={shark} alt="" className="h-24 w-24 object-contain" />
            <DialogTitle className="text-2xl">ACADEMIA ALT FITNESS</DialogTitle>
            <DialogDescription>Sistema de Gestão · catraca Henry Primme Acesso SF · App do Aluno. Sem custo de licença por usuário.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}
