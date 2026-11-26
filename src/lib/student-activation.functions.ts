import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const createStudentActivationCode = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({
    studentId: z.string().uuid(),
    accessToken: z.string().min(20).max(10000),
  }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(data.accessToken);
    const user = authData.user;
    if (authError || !user) throw new Error("Sessão expirada. Entre novamente no sistema.");

    const [profile, roles, permissions] = await Promise.all([
      supabaseAdmin.from("profiles").select("active").eq("id", user.id).maybeSingle(),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", user.id),
      supabaseAdmin.from("employee_permissions").select("module").eq("user_id", user.id),
    ]);
    const isAdmin = (roles.data ?? []).some(r => r.role === "admin");
    const canManageStudents = isAdmin || (profile.data?.active !== false && (permissions.data ?? []).some(p => p.module === "alunos"));
    if (profile.data?.active === false || !canManageStudents) throw new Error("Sem permissão para gerar código de ativação.");

    const { data: student, error: studentError } = await supabaseAdmin.from("students")
      .select("id").eq("id", data.studentId).maybeSingle();
    if (studentError || !student) throw new Error("Aluno não encontrado.");

    const { randomInt, createHash } = await import("node:crypto");
    const code = String(randomInt(10000000, 100000000));
    const codeHash = createHash("sha256").update(code).digest("hex");
    await supabaseAdmin.from("student_activation_codes").update({ used_at: new Date().toISOString() })
      .eq("student_id", data.studentId).is("used_at", null);
    const { error } = await supabaseAdmin.from("student_activation_codes").insert({
      student_id: data.studentId,
      code_hash: codeHash,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      created_by: user.id,
    });
    if (error) throw new Error("Não foi possível gerar o código. Verifique se a migração ALT ALUNO está aplicada.");
    return { ok: true as const, code, expiresInMinutes: 30 };
  });
