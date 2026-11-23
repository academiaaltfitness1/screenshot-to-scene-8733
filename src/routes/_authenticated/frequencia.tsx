import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { LogIn, LogOut, ShieldAlert, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ModuleWindow } from "@/components/shell/ModuleWindow";
import { ModuleBar, EmptyRow, grid } from "@/components/app/common";
import { StudentPicker } from "@/components/app/StudentPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { settingsQuery } from "@/hooks/use-staff";
import { checkAccess, todayISO } from "@/lib/access";
import { errMsg } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/frequencia")({
  head: () => ({
    meta: [
      { title: "Controle de Frequência — ALT FITNESS" },
      { name: "description", content: "Entradas, saídas e bloqueios da catraca em tempo real." },
      { property: "og:title", content: "Controle de Frequência — ALT FITNESS" },
      { property: "og:description", content: "Entradas, saídas e bloqueios da catraca em tempo real." },
    ],
  }),
  component: FrequenciaPage,
});

const SOURCE: Record<string, string> = {
  catraca: "Catraca",
  qrcode: "QR Code",
  teclado: "Teclado",
  cartao: "Cartão",
  digital: "Digital",
  manual: "Recepção",
  remoto: "Liberação manual",
};

function FrequenciaPage() {
  const qc = useQueryClient();
  const [day, setDay] = useState(todayISO());
  const [student, setStudent] = useState<string | null>(null);
  const { data: settings } = useQuery(settingsQuery);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["attendance", day],
    refetchInterval: 10_000,
    queryFn: async () => {
      const start = new Date(`${day}T00:00:00`).toISOString();
      const end = new Date(`${day}T23:59:59.999`).toISOString();
      const { data, error } = await supabase
        .from("attendance")
        .select("*, students(name, matricula)")
        .gte("occurred_at", start)
        .lte("occurred_at", end)
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const present = useMemo(() => {
    if (day !== todayISO()) return [];
    const last = new Map<string, (typeof rows)[number]>();
    for (const r of [...rows].reverse()) if (r.student_id && r.allowed) last.set(r.student_id, r);
    const cutoff = Date.now() - 4 * 3600_000;
    return [...last.values()].filter((r) => r.direction === "entrada" && new Date(r.occurred_at).getTime() > cutoff);
  }, [rows, day]);

  const register = useMutation({
    mutationFn: async (direction: "entrada" | "saida") => {
      if (!student) throw new Error("Selecione o aluno.");
      const { data: s, error } = await supabase.from("student_overview").select("*").eq("id", student).single();
      if (error) throw error;
      const res =
        direction === "saida"
          ? { allowed: true, message: "Saída" }
          : checkAccess({ status: s.status ?? "ativo", valid_until: s.valid_until, overdue_since: s.overdue_since }, todayISO(), settings?.tolerance_days ?? 5);
      const { error: e2 } = await supabase.from("attendance").insert({
        student_id: student,
        direction,
        allowed: res.allowed,
        reason: res.allowed ? null : res.message,
        source: "manual",
        credential: String(s.matricula),
      });
      if (e2) throw e2;
      return { ...res, name: s.name };
    },
    onSuccess: (r) => {
      if (r.allowed) toast.success(`${r.name}: registrado`);
      else toast.error(`${r.name}: ${r.message}`);
      qc.invalidateQueries({ queryKey: ["attendance"] });
      setStudent(null);
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const entries = rows.filter((r) => r.allowed && r.direction === "entrada").length;
  const blocked = rows.filter((r) => !r.allowed).length;

  return (
    <ModuleWindow module="frequencia">
      <ModuleBar>
        <Input type="date" className="h-9 w-40 bg-card" value={day} onChange={(e) => setDay(e.target.value)} />
        <div className="w-72">
          <StudentPicker value={student} onChange={setStudent} placeholder="Registrar manualmente…" />
        </div>
        <Button size="sm" variant="success" onClick={() => register.mutate("entrada")} disabled={!student}>
          <LogIn /> Entrada
        </Button>
        <Button size="sm" variant="outline" onClick={() => register.mutate("saida")} disabled={!student}>
          <LogOut /> Saída
        </Button>
        <div className="ml-auto flex gap-2 text-xs">
          <Badge variant="success">{entries} entradas</Badge>
          <Badge variant="destructive">{blocked} bloqueios</Badge>
        </div>
      </ModuleBar>
      <div className="grid gap-0 lg:grid-cols-[1fr_280px]">
        <table className={grid.table}>
          <thead className={grid.thead}>
            <tr>
              <th className={grid.th}>Hora</th>
              <th className={grid.th}>Matr.</th>
              <th className={grid.th}>Aluno</th>
              <th className={grid.th}>Movimento</th>
              <th className={grid.th}>Origem</th>
              <th className={grid.th}>Resultado</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <EmptyRow cols={6} text="Carregando…" />}
            {!isLoading && rows.length === 0 && <EmptyRow cols={6} text="Nenhum registro neste dia." />}
            {rows.map((r) => (
              <tr key={r.id} className={`${grid.tr} ${r.allowed ? "" : "bg-destructive/5"}`}>
                <td className={`${grid.td} tabular-nums`}>{new Date(r.occurred_at).toLocaleTimeString("pt-BR")}</td>
                <td className={`${grid.td} font-mono`}>{r.students?.matricula ?? r.credential ?? "—"}</td>
                <td className={grid.td}>{r.students?.name ?? <span className="text-muted-foreground">Não identificado</span>}</td>
                <td className={`${grid.td} capitalize`}>{r.direction}</td>
                <td className={grid.td}>{SOURCE[r.source] ?? r.source}</td>
                <td className={grid.td}>
                  {r.allowed ? (
                    <Badge variant="success">Liberado</Badge>
                  ) : (
                    <Badge variant="destructive">
                      <ShieldAlert className="mr-1 h-3 w-3" /> {r.reason ?? "Bloqueado"}
                    </Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <aside className="border-l border-border bg-muted/40 p-3">
          <h3 className="mb-2 flex items-center gap-2 text-lg font-bold">
            <Users className="h-4 w-4 text-primary" /> Na academia agora ({present.length})
          </h3>
          <ul className="space-y-1 text-sm">
            {present.map((p) => (
              <li key={p.id} className="flex justify-between rounded border border-border bg-card px-2 py-1">
                <span className="truncate">{p.students?.name}</span>
                <span className="tabular-nums text-muted-foreground">{new Date(p.occurred_at).toLocaleTimeString("pt-BR", { timeStyle: "short" })}</span>
              </li>
            ))}
            {present.length === 0 && <li className="text-muted-foreground">Ninguém no momento.</li>}
          </ul>
        </aside>
      </div>
    </ModuleWindow>
  );
}
