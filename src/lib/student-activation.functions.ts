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
    if (profile.error || roles.error || permissions.error) {
      throw new Error("Não foi possível validar o perfil e as permissões da equipe.");
    }
    if (!profile.data || profile.data.active !== true) {
      throw new Error("Perfil de funcionário inexistente ou inativo.");
    }
    const roleList = (roles.data ?? []).map((row) => row.role);
    const isAdmin = roleList.includes("admin");
    const canManageStudents = isAdmin || (
      roleList.includes("staff") &&
      (permissions.data ?? []).some((permission) => permission.module === "alunos")
    );
    if (!canManageStudents) throw new Error("Sem permissão para gerar código de ativação.");

    const { data: student, error: studentError } = await supabaseAdmin.from("students")
      .select("id,cpf,birth_date,status").eq("id", data.studentId).maybeSingle();
    if (studentError || !student) throw new Error("Aluno não encontrado.");
    const studentStatus = String(student.status ?? "").trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (!["ativo", "ativa", "active", "true", "1"].includes(studentStatus)) throw new Error("Somente alunos ativos podem ativar o aplicativo.");
    if (String(student.cpf ?? "").replace(/[^0-9]/g, "").length !== 11 || !student.birth_date) throw new Error("Complete o CPF e a data de nascimento do aluno no cadastro antes de gerar o código.");
    const { data: existingAccount, error: accountError } = await supabaseAdmin.from("student_accounts")
      .select("user_id").eq("student_id", data.studentId).maybeSingle();
    if (accountError) throw new Error("Não foi possível verificar o acesso do aluno.");
    if (existingAccount?.user_id) throw new Error("Este aluno já tem acesso ao aplicativo. Oriente-o a recuperar a senha.");

    const { randomInt, createHash } = await import("node:crypto");
    const code = String(randomInt(10000000, 100000000));
    const codeHash = createHash("sha256").update(code).digest("hex");
    const { error: invalidateError } = await supabaseAdmin.from("student_activation_codes").update({ used_at: new Date().toISOString() })
      .eq("student_id", data.studentId).is("used_at", null);
    if (invalidateError) throw new Error("Não foi possível invalidar o código anterior. Tente novamente.");
    const { error } = await supabaseAdmin.from("student_activation_codes").insert({
      student_id: data.studentId,
      code_hash: codeHash,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      created_by: user.id,
    });
    if (error) throw new Error("Não foi possível gerar o código. Verifique se a migração ALT ALUNO está aplicada.");
    return { ok: true as const, code, expiresInMinutes: 30 };
  });
