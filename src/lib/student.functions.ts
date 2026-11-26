import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

/** Resolves a student's own login identifier server-side; no student email or account id is exposed. */
function publicClient() {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
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
    if (!digits) return { ok: false as const, error: "Matrícula ou CPF e senha inválidos." };

    const attemptKey = createHash("sha256").update(digits).digest("hex");
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: recentAttempts } = await supabaseAdmin.from("student_auth_attempts")
      .select("id").eq("key", attemptKey).eq("kind", "login").gte("created_at", since).limit(10);
    if ((recentAttempts?.length ?? 0) >= 10) {
      return { ok: false as const, error: "Muitas tentativas. Aguarde 15 minutos e tente novamente." };
    }
    const recordAttempt = async (success: boolean) => {
      await supabaseAdmin.from("student_auth_attempts").insert({ key: attemptKey, kind: "login", success });
    };

    let student: { id: string } | null = null;
    if (digits.length === 11) {
      const { data: row } = await supabaseAdmin.from("students").select("id").eq("cpf", digits).maybeSingle();
      student = row;
    }
    if (!student && /^[0-9]+$/.test(digits)) {
      const { data: row } = await supabaseAdmin.from("students").select("id").eq("matricula", Number(digits)).maybeSingle();
      student = row;
    }
    if (!student) { await recordAttempt(false); return { ok: false as const, error: "Matrícula/CPF ou senha inválidos." }; }

    const { data: account } = await supabaseAdmin.from("student_accounts")
      .select("user_id,email_verified_at").eq("student_id", student.id).maybeSingle();
    if (!account?.user_id || !account.email_verified_at) {
      await recordAttempt(false);
      return { ok: false as const, error: "Acesso ainda não ativado. Procure a recepção para ativar seu app." };
    }
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(account.user_id);
    const email = authUser.user?.email;
    if (!email) { await recordAttempt(false); return { ok: false as const, error: "Acesso ainda não ativado. Procure a recepção." }; }

    const { data: session, error } = await publicClient().auth.signInWithPassword({ email, password: data.password });
    await recordAttempt(!error && !!session.session);
    if (error || !session.session) return { ok: false as const, error: "Matrícula/CPF ou senha inválidos." };
    return { ok: true as const, access_token: session.session.access_token, refresh_token: session.session.refresh_token };
  });


/** Creates a student Auth identity only after matching the gym-issued one-time code and birth date. */
export const beginStudentActivation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({
    identifier: z.string().trim().min(1).max(32),
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    code: z.string().regex(/^\d{8}$/),
    email: z.string().trim().email().max(254),
    password: z.string().min(8).max(200),
  }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createHash } = await import("node:crypto");
    const digits = data.identifier.replace(/[^0-9]/g, "");
    if (!digits) return { ok: false as const, error: "Dados de ativação inválidos. Confira com a recepção." };

    const key = createHash("sha256").update(digits).digest("hex");
    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: attempts } = await supabaseAdmin.from("student_auth_attempts")
      .select("id").eq("key", key).eq("kind", "activation").gte("created_at", since).limit(5);
    if ((attempts?.length ?? 0) >= 5) {
      return { ok: false as const, error: "Muitas tentativas. Aguarde 30 minutos ou procure a recepção." };
    }

    const { data: student } = digits.length === 11
      ? await supabaseAdmin.from("students").select("id,birth_date,status").eq("cpf", digits).maybeSingle()
      : await supabaseAdmin.from("students").select("id,birth_date,status").eq("matricula", Number(digits)).maybeSingle();
    const validStudent = !!student && student.status === "ativo" &&
      String(student.birth_date ?? "").slice(0, 10) === data.birthDate;

    let activation: { id: string } | null = null;
    if (validStudent) {
      const hash = createHash("sha256").update(data.code).digest("hex");
      const { data: codeRow } = await supabaseAdmin.from("student_activation_codes")
        .select("id").eq("student_id", student!.id).eq("code_hash", hash)
        .is("used_at", null).gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      activation = codeRow;
    }

    const { error: attemptError } = await supabaseAdmin.from("student_auth_attempts").insert({
      key, kind: "activation", success: !!activation,
    });
    if (attemptError) throw new Error("Não foi possível validar a ativação. Tente novamente.");

    if (!validStudent || !activation) {
      return { ok: false as const, error: "Dados ou código inválidos/expirados. Confira com a recepção." };
    }

    const { data: existing } = await supabaseAdmin.from("student_accounts")
      .select("user_id").eq("student_id", student!.id).maybeSingle();
    if (existing?.user_id) {
      return { ok: false as const, error: "Este acesso já foi ativado. Use recuperar senha ou procure a recepção." };
    }

    const email = data.email.toLowerCase();
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email, password: data.password, email_confirm: false,
      app_metadata: { kind: "student" },
      user_metadata: { student_id: student!.id },
    });
    if (createError || !created.user) {
      return { ok: false as const, error: "Não foi possível criar o acesso. Confira o e-mail ou procure a recepção." };
    }

    const { error: accountError } = await supabaseAdmin.from("student_accounts").insert({
      user_id: created.user.id, student_id: student!.id,
    });
    if (accountError) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      return { ok: false as const, error: "Este aluno já possui acesso ou não foi possível concluir o cadastro." };
    }

    const { data: consumed, error: consumeError } = await supabaseAdmin.from("student_activation_codes")
      .update({ used_at: new Date().toISOString() }).eq("id", activation.id).is("used_at", null)
      .select("id").maybeSingle();
    if (consumeError || !consumed) {
      await supabaseAdmin.from("student_accounts").delete().eq("user_id", created.user.id);
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      return { ok: false as const, error: "O código já foi utilizado. Solicite outro à recepção." };
    }

    const { error: otpError } = await publicClient().auth.resend({ type: "signup", email });
    if (otpError) {
      return { ok: true as const, emailVerificationPending: true, message: "Acesso criado. Use reenviar código para receber o e-mail de confirmação." };
    }
    return { ok: true as const, emailVerificationPending: true, message: "Enviamos um código de confirmação para seu e-mail." };
  });

/** Resends the confirmation OTP without disclosing whether a student account exists. */
export const resendStudentActivationOtp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ identifier: z.string().trim().min(1).max(32) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const digits = data.identifier.replace(/[^0-9]/g, "");
    const { data: student } = digits.length === 11
      ? await supabaseAdmin.from("students").select("id").eq("cpf", digits).maybeSingle()
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
    const redirectUrl = new URL(data.redirectTo);
    const configuredOrigin = process.env["APP_URL"] ? new URL(process.env["APP_URL"]).origin : null;
    const allowedRedirect = redirectUrl.protocol === "https:" && (redirectUrl.hostname.endsWith(".lovable.app") || redirectUrl.origin === configuredOrigin);
    if (!allowedRedirect) throw new Error("Endereço de recuperação inválido.");
    const redirectTo = `${redirectUrl.origin}/reset-password`;
    const digits = data.identifier.replace(/[^0-9]/g, "");
    const { data: student } = digits.length === 11
      ? await supabaseAdmin.from("students").select("id").eq("cpf", digits).maybeSingle()
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
