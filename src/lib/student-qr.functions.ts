import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Generates a 30-second QR token; the per-student secret never leaves the server. */
export const createStudentQrToken = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ accessToken: z.string().min(20).max(10000) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createHmac } = await import("node:crypto");
    const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authError || !auth.user || auth.user.app_metadata?.kind !== "student") {
      throw new Error("Entre novamente no ALT ALUNO para gerar sua carteirinha.");
    }
    const { data: account, error: accountError } = await supabaseAdmin.from("student_accounts")
      .select("student_id,email_verified_at").eq("user_id", auth.user.id).maybeSingle();
    if (accountError || !account?.student_id || !account.email_verified_at) {
      throw new Error("Conta do aluno não confirmada.");
    }
    const [{ data: student, error: studentError }, { data: secret, error: secretError }] = await Promise.all([
      supabaseAdmin.from("students").select("matricula").eq("id", account.student_id).maybeSingle(),
      supabaseAdmin.from("student_qr_secrets").select("secret").eq("student_id", account.student_id).maybeSingle(),
    ]);
    if (studentError || !student || secretError || !secret?.secret) {
      throw new Error("Carteirinha temporária ainda não configurada. Procure a recepção.");
    }
    const window = Math.floor(Date.now() / 30000);
    const digest = createHmac("sha256", secret.secret).update(String(student.matricula) + ":" + window).digest();
    const code = String(digest.readUInt32BE(0) % 100000000).padStart(8, "0");
    return {
      token: String(student.matricula) + code,
      expiresAt: (window + 1) * 30000,
      refreshInMs: Math.max(1000, ((window + 1) * 30000) - Date.now()),
    };
  });
