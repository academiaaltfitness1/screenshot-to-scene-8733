import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Generates a 30-second QR token; the per-student secret never leaves the server. */
export const createStudentQrToken = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ accessToken: z.string().min(20).max(10000) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { makeTemporaryQrCode } = await import("@/lib/qr-hmac");
    const { checkAccess, todayISO } = await import("@/lib/access");
    const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authError || !auth.user || auth.user.app_metadata?.kind !== "student") {
      throw new Error("Entre novamente no ALT ALUNO para gerar sua carteirinha.");
    }
    const { data: account, error: accountError } = await supabaseAdmin.from("student_accounts")
      .select("student_id,email_verified_at").eq("user_id", auth.user.id).maybeSingle();
    if (accountError || !account?.student_id || !account.email_verified_at) {
      throw new Error("Conta do aluno não confirmada.");
    }
    const [{ data: student, error: studentError }, { data: secret, error: secretError }, { data: setting, error: settingError }, { data: qrAllowedSetting, error: qrAllowedError }, { data: enrollment, error: enrollmentError }, { data: unpaid, error: unpaidError }] = await Promise.all([
      supabaseAdmin.from("students").select("matricula,qr_code,status").eq("id", account.student_id).maybeSingle(),
      supabaseAdmin.from("student_qr_secrets").select("secret").eq("student_id", account.student_id).maybeSingle(),
      (supabaseAdmin as any).from("settings").select("dynamic_qr_enabled,agent_version,agent_last_seen,tolerance_days").eq("id", 1).maybeSingle(),
      supabaseAdmin.from("settings").select("allow_qrcode").eq("id", 1).maybeSingle(),
      supabaseAdmin.from("enrollments").select("end_date").eq("student_id", account.student_id).eq("status", "ativa").order("end_date", { ascending: false }).limit(1).maybeSingle(),
      supabaseAdmin.from("receivables").select("due_date").eq("student_id", account.student_id).is("paid_at", null).order("due_date", { ascending: true }).limit(1).maybeSingle(),
    ]);
    if (studentError || !student) throw new Error("Não foi possível carregar sua carteirinha.");
    if (enrollmentError || unpaidError) throw new Error("Não foi possível verificar sua situação financeira. Tente novamente ou procure a recepção.");
    const access = checkAccess({ status: student.status, valid_until: enrollment?.end_date ?? null, overdue_since: unpaid?.due_date ?? null }, todayISO(), Number(setting?.tolerance_days ?? 0));
    if (!access.allowed) throw new Error(`Acesso bloqueado: ${access.message}. Regularize sua situação na recepção.`);
    if (qrAllowedError || qrAllowedSetting?.allow_qrcode !== true) throw new Error("A leitura de QR está desativada pela academia. Procure a recepção.");
    const agentOnline = !!setting?.agent_last_seen && Date.now() - new Date(setting.agent_last_seen).getTime() < 3 * 60_000;
    if (settingError || !setting?.dynamic_qr_enabled || setting.agent_version !== "alt-hmac-qr-1" || !agentOnline) {
      if (!student.qr_code) throw new Error("A carteirinha fixa não está cadastrada. Procure a recepção.");
      return { token: String(student.qr_code), mode: "fixed" as const, expiresAt: Date.now() + 60000, refreshInMs: 60000 };
    }
    if (secretError || !secret?.secret) throw new Error("Carteirinha temporária ainda não configurada. Procure a recepção.");
    const window = Math.floor(Date.now() / 30000);
    const code = makeTemporaryQrCode(secret.secret, student.matricula, window);
    return {
      token: String(student.matricula) + code,
      fallbackToken: student.qr_code ? String(student.qr_code) : null,
      mode: "dynamic" as const,
      expiresAt: (window + 1) * 30000,
      refreshInMs: Math.max(1000, ((window + 1) * 30000) - Date.now()),
    };
  });
