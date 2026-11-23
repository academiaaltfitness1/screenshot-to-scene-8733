import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, UserPlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { ModuleWindow } from "@/components/shell/ModuleWindow";
import { Field, EmptyRow, grid } from "@/components/app/common";
import { StudentPicker } from "@/components/app/StudentPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStaff } from "@/hooks/use-staff";
import { errMsg } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/turmas")({
  head: () => ({
    meta: [
      { title: "Controle de Turmas — ALT FITNESS" },
      { name: "description", content: "Horários, modalidades coletivas, vagas e professores." },
      { property: "og:title", content: "Controle de Turmas — ALT FITNESS" },
      { property: "og:description", content: "Horários, modalidades coletivas, vagas e professores." },
    ],
  }),
  component: TurmasPage,
});

type Klass = Tables<"classes">;

function TurmasPage() {
  const [edit, setEdit] = useState<Partial<Klass> | null>(null);
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("*, profiles(full_name), class_students(student_id)").order("start_time");
      if (error) throw error;
      return data;
    },
  });
  return (
    <ModuleWindow
      module="turmas"
      actions={
        <Button size="sm" variant="accent" onClick={() => setEdit({ modality: "Muay Thai", weekdays: "Seg, Qua, Sex", start_time: "19:00", end_time: "20:00", capacity: 20, active: true })}>
          <Plus /> Nova turma
        </Button>
      }
    >
      <table className={grid.table}>
        <thead className={grid.thead}>
          <tr>
            <th className={grid.th}>Turma</th>
            <th className={grid.th}>Modalidade</th>
            <th className={grid.th}>Dias</th>
            <th className={grid.th}>Horário</th>
            <th className={grid.th}>Professor</th>
            <th className={grid.th}>Vagas</th>
          </tr>
        </thead>
        <tbody>
          {isLoading && <EmptyRow cols={6} text="Carregando…" />}
          {!isLoading && rows.length === 0 && <EmptyRow cols={6} text="Nenhuma turma cadastrada." />}
          {rows.map((r) => {
            const used = r.class_students.length;
            return (
              <tr key={r.id} className={`${grid.tr} cursor-pointer`} onClick={() => setEdit(r)}>
                <td className={`${grid.td} font-semibold`}>{r.name}</td>
                <td className={grid.td}>{r.modality}</td>
                <td className={grid.td}>{r.weekdays}</td>
                <td className={grid.td}>
                  {r.start_time.slice(0, 5)} – {r.end_time.slice(0, 5)}
                </td>
                <td className={grid.td}>{r.profiles?.full_name ?? "—"}</td>
                <td className={grid.td}>
                  <Badge variant={used >= r.capacity ? "destructive" : "success"}>
                    {used}/{r.capacity}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {edit && <ClassDialog klass={edit} onClose={() => setEdit(null)} />}
    </ModuleWindow>
  );
}

function ClassDialog({ klass, onClose }: { klass: Partial<Klass>; onClose: () => void }) {
  const qc = useQueryClient();
  const { staff } = useStaff();
  const [f, setF] = useState(klass);
  const [add, setAdd] = useState<string | null>(null);
  const { data: team = [] } = useQuery({
    queryKey: ["team-names"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name").eq("active", true).order("full_name")).data ?? [],
  });
  const { data: members = [] } = useQuery({
    queryKey: ["class-members", f.id],
    enabled: !!f.id,
    queryFn: async () => (await supabase.from("class_students").select("student_id, students(name, matricula)").eq("class_id", f.id!)).data ?? [],
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["classes"] });
    qc.invalidateQueries({ queryKey: ["class-members"] });
  };
  const save = useMutation({
    mutationFn: async () => {
      if (!f.name) throw new Error("Informe o nome da turma.");
      const payload = {
        name: f.name,
        modality: f.modality ?? "Muay Thai",
        weekdays: f.weekdays ?? "",
        start_time: f.start_time ?? "19:00",
        end_time: f.end_time ?? "20:00",
        capacity: Number(f.capacity ?? 20),
        instructor_id: f.instructor_id || null,
        active: f.active ?? true,
      };
      const res = f.id
        ? await supabase.from("classes").update(payload).eq("id", f.id).select().single()
        : await supabase.from("classes").insert(payload).select().single();
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: (d) => {
      toast.success("Turma salva");
      setF(d);
      refresh();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const addMember = useMutation({
    mutationFn: async () => {
      if (!add || !f.id) return;
      if (members.length >= Number(f.capacity ?? 0)) throw new Error("Turma lotada.");
      const { error } = await supabase.from("class_students").insert({ class_id: f.id, student_id: add });
      if (error) throw error;
    },
    onSuccess: () => {
      setAdd(null);
      refresh();
    },
    onError: (e) => toast.error(errMsg(e).includes("duplicate") ? "Aluno já está na turma." : errMsg(e)),
  });
  const removeMember = async (sid: string) => {
    await supabase.from("class_students").delete().eq("class_id", f.id!).eq("student_id", sid);
    refresh();
  };
  const remove = async () => {
    if (!confirm("Excluir esta turma?")) return;
    const { error } = await supabase.from("classes").delete().eq("id", f.id!);
    if (error) { toast.error(error.message); return; }
    refresh();
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-auto">
        <DialogHeader>
          <DialogTitle>{f.id ? f.name : "Nova turma"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome da turma">
            <Input value={f.name ?? ""} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Muay Thai — Noite" />
          </Field>
          <Field label="Modalidade">
            <Input value={f.modality ?? ""} onChange={(e) => setF({ ...f, modality: e.target.value })} />
          </Field>
          <Field label="Dias da semana">
            <Input value={f.weekdays ?? ""} onChange={(e) => setF({ ...f, weekdays: e.target.value })} />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Início">
              <Input type="time" value={f.start_time?.slice(0, 5) ?? ""} onChange={(e) => setF({ ...f, start_time: e.target.value })} />
            </Field>
            <Field label="Fim">
              <Input type="time" value={f.end_time?.slice(0, 5) ?? ""} onChange={(e) => setF({ ...f, end_time: e.target.value })} />
            </Field>
            <Field label="Vagas">
              <Input type="number" value={f.capacity ?? 20} onChange={(e) => setF({ ...f, capacity: Number(e.target.value) })} />
            </Field>
          </div>
          <Field label="Professor responsável" className="sm:col-span-2">
            <Select value={f.instructor_id ?? ""} onValueChange={(v) => setF({ ...f, instructor_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {team.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        {f.id && (
          <div className="rounded-lg border border-border p-3">
            <p className="mb-2 text-sm font-semibold">
              Alunos da turma ({members.length}/{f.capacity})
            </p>
            <div className="mb-2 flex gap-2">
              <div className="flex-1">
                <StudentPicker value={add} onChange={setAdd} />
              </div>
              <Button variant="outline" onClick={() => addMember.mutate()} disabled={!add}>
                <UserPlus /> Incluir
              </Button>
            </div>
            <ul className="max-h-48 space-y-1 overflow-auto text-sm">
              {members.map((m) => (
                <li key={m.student_id} className="flex items-center justify-between rounded bg-muted px-2 py-1">
                  <span>
                    <span className="mr-2 font-mono text-xs">{m.students?.matricula}</span>
                    {m.students?.name}
                  </span>
                  <button type="button" onClick={() => removeMember(m.student_id)} aria-label="Remover">
                    <X className="h-4 w-4 text-destructive" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <DialogFooter className="gap-2">
          {f.id && staff?.isAdmin && (
            <Button variant="destructive" className="mr-auto" onClick={remove}>
              <Trash2 /> Excluir
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button variant="hero" onClick={() => save.mutate()}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
