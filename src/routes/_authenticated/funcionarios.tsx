import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ModuleWindow } from "@/components/shell/ModuleWindow";
import { Field, EmptyRow, grid } from "@/components/app/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useStaff } from "@/hooks/use-staff";
import { ALL_MODULE_KEYS, MODULES, type ModuleKey } from "@/lib/modules";
import { createEmployee, updateEmployee, deleteEmployee } from "@/lib/staff.functions";
import { errMsg } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/funcionarios")({
  head: () => ({
    meta: [
      { title: "Cadastro de Funcionários — ALT FITNESS" },
      { name: "description", content: "Equipe, cargos, senhas e permissões por módulo." },
      { property: "og:title", content: "Cadastro de Funcionários — ALT FITNESS" },
      { property: "og:description", content: "Equipe, cargos, senhas e permissões por módulo." },
    ],
  }),
  component: FuncionariosPage,
});

interface Emp {
  id: string;
  full_name: string;
  cargo: string;
  email: string | null;
  active: boolean;
  isAdmin: boolean;
  permissions: ModuleKey[];
}

const PRESETS: Record<string, ModuleKey[]> = {
  Recepção: ["alunos", "matriculas", "frequencia", "turmas", "vendas", "receber", "caixa", "catraca"],
  Instrutor: ["alunos", "frequencia", "turmas", "avaliacao", "treinos"],
  Professor: ["alunos", "frequencia", "turmas", "avaliacao", "treinos"],
};

function FuncionariosPage() {
  const { staff } = useStaff();
  const [edit, setEdit] = useState<(Partial<Emp> & { password?: string; emailNew?: string }) | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: async (): Promise<Emp[]> => {
      const [p, r, perms] = await Promise.all([
        supabase.from("profiles").select("*").order("full_name"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("employee_permissions").select("user_id, module"),
      ]);
      if (p.error) throw p.error;
      return (p.data ?? []).map((x) => ({
        id: x.id,
        full_name: x.full_name,
        cargo: x.cargo,
        email: x.email,
        active: x.active,
        isAdmin: (r.data ?? []).some((y) => y.user_id === x.id && y.role === "admin"),
        permissions: (perms.data ?? []).filter((y) => y.user_id === x.id).map((y) => y.module as ModuleKey),
      }));
    },
  });

  return (
    <ModuleWindow
      module="funcionarios"
      actions={
        staff?.isAdmin && (
          <Button size="sm" variant="accent" onClick={() => setEdit({ cargo: "Recepção", active: true, permissions: PRESETS["Recepção"] ?? [], isAdmin: false })}>
            <Plus /> Novo funcionário
          </Button>
        )
      }
    >
      <table className={grid.table}>
        <thead className={grid.thead}>
          <tr>
            <th className={grid.th}>Nome</th>
            <th className={grid.th}>Cargo</th>
            <th className={grid.th}>Acesso</th>
            <th className={grid.th}>Módulos liberados</th>
            <th className={grid.th}>Situação</th>
          </tr>
        </thead>
        <tbody>
          {isLoading && <EmptyRow cols={5} text="Carregando…" />}
          {rows.map((e) => (
            <tr key={e.id} className={`${grid.tr} ${staff?.isAdmin ? "cursor-pointer" : ""}`} onClick={() => staff?.isAdmin && setEdit(e)}>
              <td className={`${grid.td} font-semibold`}>{e.full_name}</td>
              <td className={grid.td}>{e.cargo}</td>
              <td className={grid.td}>
                {e.isAdmin ? (
                  <Badge variant="accent">
                    <ShieldCheck className="mr-1 h-3 w-3" /> Administrador
                  </Badge>
                ) : (
                  <Badge variant="secondary">Funcionário</Badge>
                )}
              </td>
              <td className={`${grid.td} text-xs text-muted-foreground`}>
                {e.isAdmin ? "Todos" : e.permissions.map((k) => MODULES[k]?.label).filter(Boolean).join(", ") || "Nenhum"}
              </td>
              <td className={grid.td}>{e.active ? <Badge variant="success">Ativo</Badge> : <Badge variant="destructive">Inativo</Badge>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {edit && <EmpDialog emp={edit} onClose={() => setEdit(null)} selfId={staff?.userId ?? ""} />}
    </ModuleWindow>
  );
}

function EmpDialog({ emp, onClose, selfId }: { emp: Partial<Emp> & { password?: string; emailNew?: string }; onClose: () => void; selfId: string }) {
  const qc = useQueryClient();
  const [f, setF] = useState(emp);
  const create = useServerFn(createEmployee);
  const update = useServerFn(updateEmployee);
  const del = useServerFn(deleteEmployee);
  const isNew = !f.id;
  const perms = new Set(f.permissions ?? []);

  const toggle = (k: ModuleKey) => {
    const s = new Set(perms);
    if (s.has(k)) s.delete(k);
    else s.add(k);
    setF({ ...f, permissions: [...s] });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (isNew) {
        await create({
          data: {
            full_name: f.full_name ?? "",
            cargo: f.cargo ?? "Recepção",
            email: f.emailNew ?? "",
            password: f.password ?? "",
            permissions: [...perms],
            admin: !!f.isAdmin,
          },
        });
      } else {
        await update({
          data: {
            userId: f.id!,
            full_name: f.full_name ?? "",
            cargo: f.cargo ?? "",
            active: f.active ?? true,
            password: f.password ?? "",
            permissions: [...perms],
            admin: !!f.isAdmin,
          },
        });
      }
    },
    onSuccess: () => {
      toast.success(isNew ? "Funcionário cadastrado" : "Funcionário atualizado");
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["staff-me"] });
      onClose();
    },
    onError: (e) => {
      const m = errMsg(e);
      toast.error(m.includes("password") || m.includes("String must") ? "Confira nome (mín. 2 letras) e senha (mín. 6 caracteres)." : m);
    },
  });

  const remove = useMutation({
    mutationFn: async () => {
      await del({ data: { userId: f.id! } });
    },
    onSuccess: () => {
      toast.success("Funcionário excluído");
      qc.invalidateQueries({ queryKey: ["employees"] });
      onClose();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? "Novo funcionário" : f.full_name}</DialogTitle>
          <DialogDescription>O funcionário entra escolhendo o nome na lista da tela de entrada e digitando a senha.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome">
            <Input value={f.full_name ?? ""} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
          </Field>
          <Field label="Cargo">
            <Input
              list="cargos"
              value={f.cargo ?? ""}
              onChange={(e) => {
                const cargo = e.target.value;
                setF({ ...f, cargo, ...(isNew && PRESETS[cargo] ? { permissions: PRESETS[cargo] } : {}) });
              }}
            />
            <datalist id="cargos">
              {["Recepção", "Instrutor", "Professor", "Gerente", "Supervisor Técnico"].map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          {isNew && (
            <Field label="E-mail (opcional)">
              <Input type="email" value={f.emailNew ?? ""} onChange={(e) => setF({ ...f, emailNew: e.target.value })} />
            </Field>
          )}
          <Field label={isNew ? "Senha (mín. 6)" : "Nova senha (deixe em branco p/ manter)"}>
            <Input type="password" autoComplete="new-password" minLength={6} maxLength={100} value={f.password ?? ""} onChange={(e) => setF({ ...f, password: e.target.value })} />
          </Field>
          <div className="flex items-center gap-6 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={!!f.isAdmin} onCheckedChange={(v) => setF({ ...f, isAdmin: v })} disabled={f.id === selfId} /> Administrador (acesso total)
            </label>
            {!isNew && (
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={f.active ?? true} onCheckedChange={(v) => setF({ ...f, active: v })} disabled={f.id === selfId} /> Ativo
              </label>
            )}
          </div>
        </div>
        {!f.isAdmin && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Módulos liberados</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ALL_MODULE_KEYS.map((k) => {
                const Icon = MODULES[k].icon;
                return (
                  <label key={k} className="flex items-center gap-2 rounded-md border border-border p-2 text-sm hover:bg-secondary">
                    <Checkbox checked={perms.has(k)} onCheckedChange={() => toggle(k)} />
                    <Icon className="h-4 w-4 text-primary" />
                    {MODULES[k].title}
                  </label>
                );
              })}
            </div>
          </div>
        )}
        <DialogFooter className="gap-2">
          {!isNew && f.id !== selfId && (
            <Button variant="destructive" className="mr-auto" onClick={() => confirm("Excluir este funcionário?") && remove.mutate()}>
              <Trash2 /> Excluir
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="hero" onClick={() => save.mutate()} disabled={save.isPending}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
