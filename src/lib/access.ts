/**
 * Turnstile / access rules shared by the web app. The Local Agent carries a
 * copy of this exact logic (see agent-package.ts) so it keeps working offline.
 */
export type StudentStatus = "ativo" | "inativo" | "bloqueado";

export interface AccessInput {
  status: StudentStatus | string;
  /** Last day of the latest active enrollment (YYYY-MM-DD) or null. */
  valid_until: string | null;
  /** Due date of the oldest unpaid bill (YYYY-MM-DD) or null. */
  overdue_since: string | null;
}

export type AccessCode = "liberado" | "inativo" | "bloqueado" | "vencido" | "inadimplente" | "sem_matricula";

export interface AccessResult {
  allowed: boolean;
  code: AccessCode;
  message: string;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function checkAccess(s: AccessInput, today: string, toleranceDays: number): AccessResult {
  const status = String(s.status ?? "").trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\\u0300-\\u036f]/g, "");
  if (["bloqueado", "blocked"].includes(status)) return { allowed: false, code: "bloqueado", message: "Procure a Recepção" };
  if (["inativo", "inativa", "inactive"].includes(status)) return { allowed: false, code: "inativo", message: "Aluno Inativo" };
  if (!s.valid_until) return { allowed: false, code: "sem_matricula", message: "Procure a Recepção" };
  if (today > addDays(s.valid_until, toleranceDays))
    return { allowed: false, code: "vencido", message: "Mensalidade Vencida" };
  if (s.overdue_since && today > addDays(s.overdue_since, toleranceDays))
    return { allowed: false, code: "inadimplente", message: "Mensalidade Vencida" };
  return { allowed: true, code: "liberado", message: "Acesso Liberado" };
}

export const ACCESS_LABEL: Record<AccessCode, string> = {
  liberado: "Regular",
  inativo: "Inativo",
  bloqueado: "Bloqueado",
  vencido: "Matrícula vencida",
  inadimplente: "Inadimplente",
  sem_matricula: "Sem matrícula",
};

export function todayISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}
