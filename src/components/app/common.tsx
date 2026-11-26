import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ACCESS_LABEL, todayISO, type AccessInput } from "@/lib/access";
import { cn } from "@/lib/utils";

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export function ModuleBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-border bg-toolbar-gradient px-3 py-2">
      {children}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative w-full max-w-xs">
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input className="h-9 bg-card pl-8" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? "Pesquisar…"} />
    </div>
  );
}

export function SituationBadge({ s, tolerance }: { s: AccessInput; tolerance: number }) {
  void tolerance;
  const today = todayISO();
  const code = s.status === "bloqueado" ? "bloqueado"
    : s.status === "inativo" ? "inativo"
    : s.overdue_since && s.overdue_since < today ? "inadimplente"
    : !s.valid_until ? "sem_matricula"
    : s.valid_until < today ? "vencido"
    : "liberado";
  const variant = code === "liberado" ? "success"
    : code === "inativo" || code === "sem_matricula" ? "secondary"
    : code === "vencido" ? "warning" : "destructive";
  return <Badge variant={variant}>{ACCESS_LABEL[code]}</Badge>;
}

export function EmptyRow({ cols, text }: { cols: number; text: string }) {
  return (
    <tr>
      <td colSpan={cols} className="p-8 text-center text-sm text-muted-foreground">
        {text}
      </td>
    </tr>
  );
}

/** Classic grid table styling. */
export const grid = {
  table: "w-full text-sm",
  thead: "sticky top-0 bg-secondary text-left text-xs uppercase tracking-wide text-secondary-foreground",
  th: "px-3 py-2 font-semibold",
  tr: "border-b border-border hover:bg-primary/5",
  td: "px-3 py-2",
};
