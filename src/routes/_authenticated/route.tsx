import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/shell/AppShell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // A sessão do Supabase pode permanecer salva entre aberturas do PWA.
    // Só liberamos o Desktop depois de uma senha digitada nesta abertura.
    if (typeof window !== "undefined" && window.sessionStorage.getItem("alt-desktop-unlocked") !== "1") {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth" });
    }
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      if (typeof window !== "undefined") window.sessionStorage.removeItem("alt-desktop-unlocked");
      throw redirect({ to: "/auth" });
    }
    if (data.user.app_metadata?.kind === "student") throw redirect({ to: "/aluno" });
    const [{ data: roles }, { data: profile }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", data.user.id),
      supabase.from("profiles").select("active").eq("id", data.user.id).maybeSingle(),
    ]);
    // Fail closed: an absent, inactive, or unreadable profile must never enter the staff area.
    if (!roles?.length || !profile || profile.active !== true) throw redirect({ to: "/auth" });
  },
  component: AppShell,
});
