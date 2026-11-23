import { describe, expect, it } from "vitest";
import { checkAccess } from "./access";

const today = "2026-11-23";

describe("checkAccess (catraca)", () => {
  it("libera aluno ativo com matrícula em dia", () => {
    expect(checkAccess({ status: "ativo", valid_until: "2026-12-10", overdue_since: null }, today, 5).allowed).toBe(true);
  });
  it("bloqueia aluno inativo com a mensagem 'Aluno Inativo'", () => {
    const r = checkAccess({ status: "inativo", valid_until: "2026-12-10", overdue_since: null }, today, 5);
    expect(r).toMatchObject({ allowed: false, message: "Aluno Inativo" });
  });
  it("bloqueia aluno bloqueado com 'Procure a Recepção'", () => {
    const r = checkAccess({ status: "bloqueado", valid_until: "2026-12-10", overdue_since: null }, today, 5);
    expect(r).toMatchObject({ allowed: false, message: "Procure a Recepção" });
  });
  it("respeita os dias de tolerância após o vencimento da matrícula", () => {
    expect(checkAccess({ status: "ativo", valid_until: "2026-11-18", overdue_since: null }, today, 5).allowed).toBe(true);
    const r = checkAccess({ status: "ativo", valid_until: "2026-11-17", overdue_since: null }, today, 5);
    expect(r).toMatchObject({ allowed: false, message: "Mensalidade Vencida" });
  });
  it("bloqueia inadimplente com conta em aberto além da tolerância", () => {
    const r = checkAccess({ status: "ativo", valid_until: "2027-01-10", overdue_since: "2026-11-10" }, today, 5);
    expect(r).toMatchObject({ allowed: false, code: "inadimplente" });
  });
  it("bloqueia quem nunca teve matrícula", () => {
    expect(checkAccess({ status: "ativo", valid_until: null, overdue_since: null }, today, 5).allowed).toBe(false);
  });
});
