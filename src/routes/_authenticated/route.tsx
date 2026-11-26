import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/shell/AppShell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    if (data.user.app_metadata?.kind === "student") throw redirect({ to: "/aluno" });
    const [{ data: roles }, { data: profile }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", data.user.id),
      supabase.from("profiles").select("active").eq("id", data.user.id).maybeSingle(),
    ]);
    if (!roles?.length || profile?.active === false) throw redirect({ to: "/auth" });
  },
  component: AppShell,
});
