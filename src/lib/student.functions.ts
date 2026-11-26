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
    const digits = data.identifier.replace(/[^0-9]/g, "");
    if (!digits) return { ok: false as const, error: "Matrícula ou CPF e senha inválidos." };

    let student: { id: string } | null = null;
    if (digits.length === 11) {
      const { data: row } = await supabaseAdmin.from("students").select("id").eq("cpf", digits).maybeSingle();
      student = row;
    }
    if (!student && /^[0-9]+$/.test(digits)) {
      const { data: row } = await supabaseAdmin.from("students").select("id").eq("matricula", Number(digits)).maybeSingle();
      student = row;
    }
    if (!student) return { ok: false as const, error: "Matrícula/CPF ou senha inválidos." };

    const { data: account } = await supabaseAdmin.from("student_accounts")
      .select("user_id,email_verified_at").eq("student_id", student.id).maybeSingle();
    if (!account?.user_id || !account.email_verified_at) {
      return { ok: false as const, error: "Acesso ainda não ativado. Procure a recepção para ativar seu app." };
    }
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(account.user_id);
    const email = authUser.user?.email;
    if (!email) return { ok: false as const, error: "Acesso ainda não ativado. Procure a recepção." };

    const { data: session, error } = await publicClient().auth.signInWithPassword({ email, password: data.password });
    if (error || !session.session) return { ok: false as const, error: "Matrícula/CPF ou senha inválidos." };
    return { ok: true as const, access_token: session.session.access_token, refresh_token: session.session.refresh_token };
  });
