import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ModuleWindow } from "@/components/shell/ModuleWindow";
import { Button } from "@/components/ui/button";
import { errMsg } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/backup")({
  head: () => ({
    meta: [
      { title: "Backup dos Dados — ALT FITNESS" },
      { name: "description", content: "Exportação completa dos dados da academia." },
      { property: "og:title", content: "Backup dos Dados — ALT FITNESS" },
      { property: "og:description", content: "Exportação completa dos dados da academia." },
    ],
  }),
  component: BackupPage,
});

const TABLES = [
  "settings", "plans", "students", "enrollments", "classes", "class_students", "attendance", "products", "sales", "sale_items",
  "receivables", "payables", "cash_sessions", "cash_movements", "assessments", "workouts", "workout_exercises", "profiles",
] as const;

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function fetchAll(table: (typeof TABLES)[number]) {
  const out: unknown[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select("*").range(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

function BackupPage() {
  const [busy, setBusy] = useState(false);
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");

  async function full() {
    setBusy(true);
    try {
      const result: Record<string, unknown[]> = {};
      for (const t of TABLES) result[t] = await fetchAll(t);
      download(`backup-altfitness-${stamp}.json`, JSON.stringify({ created_at: new Date().toISOString(), tables: result }, null, 2), "application/json");
      toast.success("Backup gerado");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function studentsCsv() {
    const rows = (await fetchAll("students")) as Record<string, unknown>[];
    const cols = ["matricula", "name", "cpf", "birth_date", "whatsapp", "email", "status", "address"];
    const csv = [cols.join(";"), ...rows.map((r) => cols.map((c) => `"${String(r[c] ?? "").replace(/"/g, '""')}"`).join(";"))].join("\n");
    download(`alunos-${stamp}.csv`, "\uFEFF" + csv, "text/csv;charset=utf-8");
  }

  return (
    <ModuleWindow module="backup">
      <div className="mx-auto max-w-xl space-y-5 p-8">
        <p className="text-sm text-muted-foreground">
          Os dados ficam guardados com segurança na nuvem. Mesmo assim, recomendamos baixar uma cópia toda semana e guardar em um pen drive
          ou no Google Drive.
        </p>
        <div className="rounded-lg border border-border bg-card p-5 shadow-tile">
          <h3 className="text-lg font-bold">Backup completo</h3>
          <p className="mb-3 text-sm text-muted-foreground">Todos os cadastros, matrículas, financeiro, frequência, avaliações e treinos (arquivo .json).</p>
          <Button variant="hero" onClick={full} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Download />} Baixar backup completo
          </Button>
        </div>
        <div className="rounded-lg border border-border bg-card p-5 shadow-tile">
          <h3 className="text-lg font-bold">Lista de alunos (Excel)</h3>
          <p className="mb-3 text-sm text-muted-foreground">Planilha .csv que abre no Excel ou Google Planilhas.</p>
          <Button variant="outline" onClick={studentsCsv}>
            <FileSpreadsheet /> Baixar planilha de alunos
          </Button>
        </div>
      </div>
    </ModuleWindow>
  );
}
