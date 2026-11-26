import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

/** Login by choosing a name from the team list: the e-mail never leaves the server. */
export const staffSignIn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), password: z.string().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [profile, roles] = await Promise.all([
      supabaseAdmin.from("profiles").select("active").eq("id", data.userId).maybeSingle(),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", data.userId),
    ]);
    if (profile.error || roles.error) {
      return { ok: false as const, error: "Não foi possível validar o acesso da equipe. Tente novamente." };
    }
    if (!profile.data || profile.data.active !== true || !(roles.data ?? []).some((row) => row.role === "admin" || row.role === "staff")) {
      return { ok: false as const, error: "Usuário inativo ou sem permissão de equipe." };
    }
    const { data: u, error: userError } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (userError) return { ok: false as const, error: "Usuário não encontrado." };
    const email = u.user?.email;
    if (!email) return { ok: false as const, error: "Usuário não encontrado." };
    const { data: s, error } = await publicClient().auth.signInWithPassword({ email, password: data.password });
    if (error || !s.session) return { ok: false as const, error: "Senha incorreta." };
    return { ok: true as const, access_token: s.session.access_token, refresh_token: s.session.refresh_token };
  });

async function assertAdmin(context: { supabase: ReturnType<typeof publicClient>; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Somente o administrador pode fazer isso.");
}

const MODULE_KEYS = [
  "alunos", "matriculas", "frequencia", "turmas", "funcionarios", "produtos", "vendas", "receber",
  "pagar", "caixa", "avaliacao", "treinos", "sistema", "backup", "catraca", "relatorios", "comunicados",
] as const;

export const createEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        full_name: z.string().trim().min(2).max(100),
        cargo: z.string().trim().min(1).max(60),
        email: z.string().trim().email().max(200).optional().or(z.literal("")),
        password: z.string().min(6).max(100),
        permissions: z.array(z.enum(MODULE_KEYS)).max(20),
        admin: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email || `equipe-${crypto.randomUUID().slice(0, 8)}@altfitness.local`;
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      app_metadata: { kind: "staff" },
      user_metadata: { full_name: data.full_name, cargo: data.cargo },
    });
    if (error || !created.user) throw new Error(error?.message.includes("already") ? "Este e-mail já está cadastrado." : error?.message ?? "Erro ao criar");
    const id = created.user.id;
    await supabaseAdmin.from("profiles").upsert({ id, full_name: data.full_name, cargo: data.cargo, email: data.email || null, active: true });
    await supabaseAdmin.from("user_roles").insert({ user_id: id, role: data.admin ? "admin" : "staff" });
    if (data.permissions.length) {
      await supabaseAdmin.from("employee_permissions").insert(data.permissions.map((m) => ({ user_id: id, module: m })));
    }
    return { id };
  });

export const updateEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        full_name: z.string().trim().min(2).max(100),
        cargo: z.string().trim().min(1).max(60),
        active: z.boolean(),
        password: z.string().min(6).max(100).optional().or(z.literal("")),
        permissions: z.array(z.enum(MODULE_KEYS)).max(20),
        admin: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const ctx = context as unknown as { userId: string };
    if (data.userId === ctx.userId && (!data.admin || !data.active)) {
      throw new Error("Você não pode remover seu próprio acesso de administrador.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.password) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password: data.password });
      if (error) throw new Error(error.message);
    }
    await supabaseAdmin.from("profiles").update({ full_name: data.full_name, cargo: data.cargo, active: data.active }).eq("id", data.userId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: data.admin ? "admin" : "staff" });
    await supabaseAdmin.from("employee_permissions").delete().eq("user_id", data.userId);
    if (data.permissions.length) {
      await supabaseAdmin.from("employee_permissions").insert(data.permissions.map((m) => ({ user_id: data.userId, module: m })));
    }
    return { ok: true };
  });

export const deleteEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    if (data.userId === (context as unknown as { userId: string }).userId) throw new Error("Você não pode excluir a si mesmo.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
