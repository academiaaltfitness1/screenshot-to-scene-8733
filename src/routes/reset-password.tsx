import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nova senha — ALT FITNESS" },
      { name: "description", content: "Defina uma nova senha de acesso ao sistema ALT FITNESS." },
      { property: "og:title", content: "Nova senha — ALT FITNESS" },
      { property: "og:description", content: "Defina uma nova senha de acesso ao sistema ALT FITNESS." },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data: authData } = await supabase.auth.getUser();
    const isStudent = authData.user?.app_metadata?.kind === "student";
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Senha alterada!");
    navigate({ to: isStudent ? "/aluno" : "/painel", replace: true });
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-chrome-gradient p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg bg-card p-6 shadow-window">
        <h1 className="text-2xl font-bold">Definir nova senha</h1>
        <div className="space-y-1.5">
          <Label htmlFor="pw">Nova senha</Label>
          <Input id="pw" type="password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" variant="hero" className="w-full" disabled={busy}>
          Salvar
        </Button>
      </form>
    </div>
  );
}
