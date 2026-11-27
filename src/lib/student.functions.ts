import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

/** Resolves a student's own login identifier server-side; no student email or account id is exposed. */
function publicClient() {
  const url = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["SUPABASE_ANON_KEY"] || process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Configuração pública do Supabase ausente no servidor.");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      headers.set("apikey", key);
      if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
      return fetch(input, { ...init, headers });
    } },
  });
}

export const studentSignIn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({
    identifier: z.string().trim().min(1).max(32),
    password: z.string().min(1).max(200),
  }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createHash } = await import("node:crypto");
    const digits = data.identifier.replace(/[^0-9]/g, "");
    if (!digits) return { ok: false as const, error: "Matrícula ou senha inválidos." };

    const attemptKey = createHash("sha256").update(digits).digest("hex");
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: recentAttempts, error: attemptsError } = await supabaseAdmin.from("student_auth_attempts")
      .select("id").eq("key", attemptKey).eq("kind", "login").gte("created_at", since).limit(10);
    if (attemptsError) return { ok: false as const, error: "Não foi possível validar as tentativas de acesso. Tente novamente." };
    if ((recentAttempts?.length ?? 0) >= 10) {
      return { ok: false as const, error: "Muitas tentativas. Aguarde 15 minutos e tente novamente." };
    }
    const recordAttempt = async (success: boolean) => {
      const { error } = await supabaseAdmin.from("student_auth_attempts").insert({ key: attemptKey, kind: "login", success });
      if (error) throw new Error("Não foi possível registrar a tentativa de acesso. Tente novamente.");
    };

    const matricula = Number(digits);
    if (!Number.isSafeInteger(matricula)) return { ok: false as const, error: "Matrícula ou senha inválidos." };
    const { data: student, error: lookupError } = await supabaseAdmin.from("students")
      .select("id").eq("matricula", matricula).maybeSingle();
    if (lookupError) return { ok: false as const, error: "Não foi possível validar o acesso. Tente novamente." };
    if (!student) { await recordAttempt(false); return { ok: false as const, error: "Matrícula ou senha inválidos." }; }

    const { data: account, error: accountError } = await supabaseAdmin.from("student_accounts")
      .select("user_id,email_verified_at").eq("student_id", student.id).maybeSingle();
    if (accountError) return { ok: false as const, error: "Não foi possível validar o cadastro. Tente novamente." };
    if (!account?.user_id || !account.email_verified_at) {
      await recordAttempt(false);
      return { ok: false as const, error: "Acesso ainda não ativado. Procure a recepção para ativar seu app." };
    }
    const { data: authUser, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(account.user_id);
    if (authUserError) return { ok: false as const, error: "Não foi possível validar o cadastro. Tente novamente." };
    const email = authUser.user?.email;
    if (!email) { await recordAttempt(false); return { ok: false as const, error: "Acesso ainda não ativado. Procure a recepção." }; }

    const { data: session, error } = await publicClient().auth.signInWithPassword({ email, password: data.password });
    await recordAttempt(!error && !!session.session);
    if (error || !session.session) return { ok: false as const, error: "Matrícula ou senha inválidos." };
    return { ok: true as const, access_token: session.session.access_token, refresh_token: session.session.refresh_token };
  });


/** Activates student access with the shared gym code and enrollment number. */
export const beginStudentActivation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({
    matricula: z.string().trim().min(1).max(20),
    code: z.string().regex(/^\d{8}$/),
    password: z.string().min(8).max(200),
  }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createHash } = await import("node:crypto");
    const matriculaDigits = data.matricula.replace(/[^0-9]/g, "");
    if (!matriculaDigits || !/^\d+$/.test(matriculaDigits)) {
      return { ok: false as const, error: "Confira o número da matrícula." };
    }
    const key = createHash("sha256").update("activation:" + matriculaDigits).digest("hex");
    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: attempts, error: attemptsError } = await supabaseAdmin.from("student_auth_attempts")
      .select("id").eq("key", key).eq("kind", "activation").gte("created_at", since).limit(5);
    if (attemptsError) return { ok: false as const, error: "Não foi possível validar agora. Tente novamente." };
    if ((attempts?.length ?? 0) >= 5) {
      return { ok: false as const, error: "Muitas tentativas. Aguarde 30 minutos ou procure a recepção." };
    }
    const validCode = data.code === "02226770";
    const { data: student, error: studentError } = validCode
      ? await supabaseAdmin.from("students").select("id,status").eq("matricula", Number(matriculaDigits)).maybeSingle()
      : { data: null, error: null };
    if (studentError) return { ok: false as const, error: "Não foi possível localizar a matrícula. Tente novamente." };
    const validStudent = !!student && student.status === "ativo";
    const { error: attemptError } = await supabaseAdmin.from("student_auth_attempts").insert({
      key, kind: "activation", success: validCode && validStudent,
    });
    if (attemptError) return { ok: false as const, error: "Não foi possível registrar a tentativa. Tente novamente." };
    if (!validCode || !validStudent || !student) {
      return { ok: false as const, error: "Código ou matrícula inválidos. Confira os dados com a recepção." };
    }

    const { data: existing, error: existingError } = await supabaseAdmin.from("student_accounts")
      .select("user_id").eq("student_id", student.id).maybeSingle();
    if (existingError) return { ok: false as const, error: "Não foi possível verificar o acesso. Tente novamente." };
    if (existing?.user_id) {
      return { ok: false as const, error: "Esta matrícula já possui acesso. Procure a recepção para redefinir a senha." };
    }

    const internalEmail = student.id + "@students.altfitness.invalid";
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: internalEmail,
      password: data.password,
      email_confirm: true,
      app_metadata: { kind: "student" },
      user_metadata: { student_id: student.id },
    });
    if (createError || !created.user) {
      console.error("[ALT ALUNO] Falha ao criar usuário de primeiro acesso:", createError?.message ?? "Usuário não retornado");
      return { ok: false as const, error: "Não foi possível criar o acesso. Confira se a matrícula está ativa e tente novamente. Se persistir, procure a recepção." };
    }

    const { error: accountError } = await supabaseAdmin.from("student_accounts").insert({
      user_id: created.user.id,
      student_id: student.id,
      email_verified_at: new Date().toISOString(),
    });
    if (accountError) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      console.error("[ALT ALUNO] Falha ao vincular conta à matrícula:", accountError.message);
      return { ok: false as const, error: "Esta matrícula já possui acesso ou não foi possível concluir o cadastro. Procure a recepção para conferir." };
    }

    const { data: session, error: signInError } = await publicClient().auth.signInWithPassword({
      email: internalEmail,
      password: data.password,
    });
    if (signInError || !session.session) {
      console.error("[ALT ALUNO] Conta criada, mas o login automático falhou:", signInError?.message ?? "Sessão não retornada");
      return { ok: true as const, activated: true as const, access_token: null, refresh_token: null, message: "Acesso criado. Entre com sua matrícula e a senha cadastrada." };
    }
    return {
      ok: true as const,
      activated: true as const,
      access_token: session.session.access_token,
      refresh_token: session.session.refresh_token,
      message: "Primeiro acesso concluído!",
    };
  });

/** Resends the confirmation OTP without disclosing whether a student account exists. */
export const resendStudentActivationOtp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ identifier: z.string().trim().min(1).max(32) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createHash } = await import("node:crypto");
    const digits = data.identifier.replace(/[^0-9]/g, "");
    const key = createHash("sha256").update(digits).digest("hex");
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: attempts } = await supabaseAdmin.from("student_auth_attempts")
      .select("id").eq("key", key).eq("kind", "otp_resend").gte("created_at", since).limit(3);
    if ((attempts?.length ?? 0) >= 3) {
      return { ok: true as const, message: "Se houver uma ativação pendente, enviaremos um novo código ao e-mail cadastrado." };
    }
    await supabaseAdmin.from("student_auth_attempts").insert({ key, kind: "otp_resend", success: true });
    const formattedCpf = digits.length === 11 ? digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4") : "";
    const { data: student } = digits.length === 11
      ? await supabaseAdmin.from("students").select("id").or("cpf.eq." + digits + ",cpf.eq." + formattedCpf).maybeSingle()
      : await supabaseAdmin.from("students").select("id").eq("matricula", Number(digits)).maybeSingle();
    if (student) {
      const { data: account } = await supabaseAdmin.from("student_accounts").select("user_id")
        .eq("student_id", student.id).maybeSingle();
      if (account?.user_id) {
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(account.user_id);
        if (authUser.user?.email && !authUser.user.email_confirmed_at) {
          await publicClient().auth.resend({ type: "signup", email: authUser.user.email });
        }
      }
    }
    return { ok: true as const, message: "Se houver uma ativação pendente, enviaremos um novo código ao e-mail cadastrado." };
  });

/** Password reset is sent only to the verified email already linked to the student's account. */
export const requestStudentPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ identifier: z.string().trim().min(1).max(32), redirectTo: z.string().url() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createHash } = await import("node:crypto");
    const digits = data.identifier.replace(/[^0-9]/g, "");
    const key = createHash("sha256").update(digits).digest("hex");
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: attempts } = await supabaseAdmin.from("student_auth_attempts")
      .select("id").eq("key", key).eq("kind", "password_reset").gte("created_at", since).limit(3);
    if ((attempts?.length ?? 0) >= 3) {
      return { ok: true as const, message: "Se o cadastro estiver ativo, enviaremos instruções para o e-mail confirmado." };
    }
    await supabaseAdmin.from("student_auth_attempts").insert({ key, kind: "password_reset", success: true });
    const redirectUrl = new URL(data.redirectTo);
    const configuredOrigin = process.env["APP_URL"] ? new URL(process.env["APP_URL"]).origin : null;
    const allowedPreviewHost = redirectUrl.hostname === "id-preview--6058a297-1ce8-4b91-915f-3c03d4798d03.lovable.app";
    const allowedRedirect = redirectUrl.protocol === "https:" && (allowedPreviewHost || (!!configuredOrigin && redirectUrl.origin === configuredOrigin));
    if (!allowedRedirect) throw new Error("Endereço de recuperação inválido.");
    const redirectTo = `${redirectUrl.origin}/reset-password`;
    const formattedCpf = digits.length === 11 ? digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4") : "";
    const { data: student } = digits.length === 11
      ? await supabaseAdmin.from("students").select("id").or("cpf.eq." + digits + ",cpf.eq." + formattedCpf).maybeSingle()
      : await supabaseAdmin.from("students").select("id").eq("matricula", Number(digits)).maybeSingle();
    if (student) {
      const { data: account } = await supabaseAdmin.from("student_accounts").select("user_id,email_verified_at")
        .eq("student_id", student.id).maybeSingle();
      if (account?.user_id && account.email_verified_at) {
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(account.user_id);
        if (authUser.user?.email) {
          await publicClient().auth.resetPasswordForEmail(authUser.user.email, {
            redirectTo,
          });
        }
      }
    }
    return { ok: true as const, message: "Se o cadastro estiver ativo, enviaremos instruções para o e-mail confirmado." };
  });
