import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Trash2, Upload, Printer } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { ModuleWindow } from "@/components/shell/ModuleWindow";
import { Field, ModuleBar, SearchBox, SituationBadge, EmptyRow, grid } from "@/components/app/common";
import { StudentPhoto } from "@/components/app/StudentPhoto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStaff, settingsQuery } from "@/hooks/use-staff";
import { fmtDate, errMsg } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/alunos")({
  validateSearch: z.object({ id: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Cadastro de Alunos — ALT FITNESS" },
      { name: "description", content: "Cadastro de alunos da Academia ALT FITNESS." },
      { property: "og:title", content: "Cadastro de Alunos — ALT FITNESS" },
      { property: "og:description", content: "Cadastro de alunos da Academia ALT FITNESS." },
    ],
  }),
  component: AlunosPage,
});

type Student = Tables<"students">;
type Overview = Tables<"student_overview">;

const EMPTY: Partial<Student> = { name: "", status: "ativo" };

function AlunosPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [editing, setEditing] = useState<Partial<Student> | null>(null);
  const { data: settings } = useQuery(settingsQuery);
  const tolerance = settings?.tolerance_days ?? 5;

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["students-overview"],
    queryFn: async () => {
      const { data, error } = await supabase.from("student_overview").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (search.id && rows.length) {
      const s = rows.find((r) => r.id === search.id);
      if (s) setEditing(s as Student);
      navigate({ to: "/alunos", search: {}, replace: true });
    }
  }, [search.id, rows, navigate]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "todos" && r.status !== statusFilter) return false;
      if (!t) return true;
      return (
        r.name?.toLowerCase().includes(t) ||
        String(r.matricula).includes(t) ||
        (r.cpf ?? "").includes(t) ||
        (r.whatsapp ?? "").includes(t)
      );
    });
  }, [rows, q, statusFilter]);

  return (
    <ModuleWindow
      module="alunos"
      actions={
        <Button size="sm" variant="accent" onClick={() => setEditing({ ...EMPTY })}>
          <Plus /> Novo aluno
        </Button>
      }
    >
      <ModuleBar>
        <SearchBox value={q} onChange={setQ} placeholder="Nome, matrícula, CPF ou WhatsApp" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-40 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="inativo">Inativos</SelectItem>
            <SelectItem value="bloqueado">Bloqueados</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} aluno(s)</span>
      </ModuleBar>
      <table className={grid.table}>
        <thead className={grid.thead}>
          <tr>
            <th className={grid.th}>Matrícula</th>
            <th className={grid.th}>Nome</th>
            <th className={grid.th}>WhatsApp</th>
            <th className={grid.th}>Vencimento</th>
            <th className={grid.th}>Cadastro</th>
            <th className={grid.th}>Situação</th>
          </tr>
        </thead>
        <tbody>
          {isLoading && <EmptyRow cols={6} text="Carregando…" />}
          {!isLoading && filtered.length === 0 && <EmptyRow cols={6} text="Nenhum aluno encontrado. Clique em “Novo aluno”." />}
          {filtered.map((r) => (
            <tr key={r.id} className={`${grid.tr} cursor-pointer`} onClick={() => setEditing(r as Student)}>
              <td className={`${grid.td} font-mono font-semibold text-primary-deep`}>{r.matricula}</td>
              <td className={grid.td}>{r.name}</td>
              <td className={grid.td}>{r.whatsapp ?? "—"}</td>
              <td className={grid.td}>{fmtDate(r.valid_until)}</td>
              <td className={grid.td}>
                <span className="capitalize">{r.status}</span>
              </td>
              <td className={grid.td}>
                <SituationBadge
                  s={{ status: r.status ?? "ativo", valid_until: r.valid_until, overdue_since: r.overdue_since }}
                  tolerance={tolerance}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {editing && <StudentDialog student={editing} onClose={() => setEditing(null)} onEnroll={(id) => navigate({ to: "/matriculas", search: { studentId: id } })} />}
    </ModuleWindow>
  );
}

function StudentDialog({ student, onClose, onEnroll }: { student: Partial<Student> | Overview; onClose: () => void; onEnroll: (id: string) => void }) {
  const qc = useQueryClient();
  const { staff } = useStaff();
  const [f, setF] = useState<Partial<Student>>(student as Partial<Student>);
  const set = <K extends keyof Student>(k: K, v: Student[K] | null) => setF((p) => ({ ...p, [k]: v }));
  const isNew = !f.id;

  const save = useMutation({
    mutationFn: async () => {
      if (!f.name?.trim()) throw new Error("Informe o nome do aluno.");
      const payload = {
        name: f.name.trim(),
        cpf: f.cpf || null,
        birth_date: f.birth_date || null,
        gender: f.gender || null,
        whatsapp: f.whatsapp || null,
        email: f.email || null,
        address: f.address || null,
        access_password: f.access_password || null,
        card_number: f.card_number || null,
        status: f.status ?? "ativo",
        medical_notes: f.medical_notes || null,
        notes: f.notes || null,
        photo_url: f.photo_url || null,
      };
      if (isNew) {
        const { data, error } = await supabase.from("students").insert(payload).select().single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase.from("students").update(payload).eq("id", f.id!).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (d) => {
      toast.success(isNew ? `Aluno cadastrado — matrícula ${d.matricula}` : "Cadastro atualizado");
      qc.invalidateQueries({ queryKey: ["students-overview"] });
      qc.invalidateQueries({ queryKey: ["students-mini"] });
      setF(d);
      if (!isNew) onClose();
      else if (confirm("Cadastro confirmado! Deseja fazer a matrícula agora?")) onEnroll(d.id);
    },
    onError: (e) => {
      const m = errMsg(e);
      toast.error(m.includes("access_password") ? "Esta senha de acesso já é usada por outro aluno." : m.includes("card_number") ? "Este cartão já está cadastrado." : m);
    },
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("students").delete().eq("id", f.id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Aluno excluído");
      qc.invalidateQueries({ queryKey: ["students-overview"] });
      onClose();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  async function uploadPhoto(file: File) {
    const path = `${crypto.randomUUID()}.${file.name.split(".").pop() ?? "jpg"}`;
    const { error } = await supabase.storage.from("fotos").upload(path, file, { upsert: true });
    if (error) { toast.error(error.message); return; }
    set("photo_url", path);
    toast.success("Foto carregada — clique em Salvar");
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? "Novo aluno" : `Aluno ${f.matricula} — ${f.name}`}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="dados">
          <TabsList>
            <TabsTrigger value="dados">Dados pessoais</TabsTrigger>
            <TabsTrigger value="acesso">Acesso / Catraca</TabsTrigger>
            <TabsTrigger value="obs">Observações</TabsTrigger>
          </TabsList>
          <TabsContent value="dados" className="mt-4">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="flex flex-col items-center gap-2">
                <StudentPhoto path={f.photo_url} className="h-32 w-28" />
                <label className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-primary hover:underline">
                  <Upload className="h-3.5 w-3.5" /> Foto
                  <input type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])} />
                </label>
              </div>
              <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Nome completo" className="sm:col-span-2">
                  <Input value={f.name ?? ""} onChange={(e) => set("name", e.target.value)} autoFocus />
                </Field>
                <Field label="CPF">
                  <Input value={f.cpf ?? ""} onChange={(e) => set("cpf", e.target.value)} />
                </Field>
                <Field label="Data de nascimento">
                  <Input type="date" value={f.birth_date ?? ""} onChange={(e) => set("birth_date", e.target.value)} />
                </Field>
                <Field label="WhatsApp">
                  <Input value={f.whatsapp ?? ""} onChange={(e) => set("whatsapp", e.target.value)} placeholder="(00) 00000-0000" />
                </Field>
                <Field label="E-mail">
                  <Input type="email" value={f.email ?? ""} onChange={(e) => set("email", e.target.value)} />
                </Field>
                <Field label="Sexo">
                  <Select value={f.gender ?? ""} onValueChange={(v) => set("gender", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="F">Feminino</SelectItem>
                      <SelectItem value="M">Masculino</SelectItem>
                      <SelectItem value="O">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Status">
                  <Select value={f.status ?? "ativo"} onValueChange={(v) => set("status", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                      <SelectItem value="bloqueado">Bloqueado</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Endereço" className="sm:col-span-2">
                  <Input value={f.address ?? ""} onChange={(e) => set("address", e.target.value)} />
                </Field>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="acesso" className="mt-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <div className="grid gap-3">
                <Field label="Número de matrícula">
                  <Input value={f.matricula ?? "Gerado automaticamente ao salvar"} disabled />
                </Field>
                <Field label="Senha própria (teclado da catraca e app)">
                  <Input value={f.access_password ?? ""} onChange={(e) => set("access_password", e.target.value.replace(/\D/g, ""))} placeholder="Somente números, ex.: 4321" inputMode="numeric" />
                </Field>
                <Field label="Cartão / biometria (código)">
                  <Input value={f.card_number ?? ""} onChange={(e) => set("card_number", e.target.value)} />
                </Field>
                <p className="text-xs text-muted-foreground">
                  Na catraca o aluno pode usar: QR Code da carteirinha, número de matrícula, senha própria, cartão ou digital
                  cadastrada com o número de matrícula.
                </p>
              </div>
              {f.qr_code && (
                <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-3">
                  <QRCodeSVG value={f.qr_code} size={140} />
                  <span className="font-mono text-xs">{f.qr_code}</span>
                  <Button size="sm" variant="outline" onClick={() => window.print()}>
                    <Printer /> Imprimir
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
          <TabsContent value="obs" className="mt-4 grid gap-3">
            <Field label="Observações médicas">
              <Textarea rows={3} value={f.medical_notes ?? ""} onChange={(e) => set("medical_notes", e.target.value)} />
            </Field>
            <Field label="Observações gerais">
              <Textarea rows={3} value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
            </Field>
          </TabsContent>
        </Tabs>
        <DialogFooter className="gap-2">
          {!isNew && staff?.isAdmin && (
            <Button
              variant="destructive"
              className="mr-auto"
              onClick={() => confirm("Excluir este aluno e todo o histórico?") && remove.mutate()}
            >
              <Trash2 /> Excluir
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button variant="hero" onClick={() => save.mutate()} disabled={save.isPending}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
