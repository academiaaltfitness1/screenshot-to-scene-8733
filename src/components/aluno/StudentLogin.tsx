import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Loader2, UserRoundPlus } from "lucide-react";
import sharkAsset from "@/assets/alt-mascote.webp.asset.json";
const shark = sharkAsset.url;
import { supabase } from "@/integrations/supabase/client";
import { studentSignIn, beginStudentActivation } from "@/lib/student.functions";

type Mode = "login" | "code" | "activate";

export function StudentLogin({ onSignedIn }: { onSignedIn: () => void }) {
  const signIn = useServerFn(studentSignIn);
  const activate = useServerFn(beginStudentActivation);
  const [mode, setMode] = useState<Mode>("login");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try { await fn(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível concluir."); }
    finally { setBusy(false); }
  }

  function login(e: React.FormEvent) {
    e.preventDefault();
    void run(async () => {
      const result = await signIn({ data: { identifier, password } });
      if (!result.ok) throw new Error(result.error);
      const { error } = await supabase.auth.setSession({ access_token: result.access_token, refresh_token: result.refresh_token });
      if (error) throw error;
      toast.success("Bem-vindo ao ALT ALUNO!");
      onSignedIn();
    });
  }

  function checkCode(e: React.FormEvent) {
    e.preventDefault();
    if (code !== "02226770") {
      toast.error("Código incorreto. Confira o código informado pela academia.");
      return;
    }
    setMode("activate");
  }

  function begin(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("As senhas não conferem.");
      return;
    }
    void run(async () => {
      const result = await activate({ data: { matricula: identifier, code, password } });
      if (!result.ok) throw new Error(result.error);
      toast.success(result.message);
      if (result.access_token && result.refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token: result.access_token, refresh_token: result.refresh_token });
        if (error) throw error;
        onSignedIn();
      } else {
        setMode("login");
        setPassword("");
        setConfirmPassword("");
      }
    });
  }

  const field = "mt-2 h-12 w-full rounded-lg border border-white/15 bg-black px-3 text-white outline-none focus:border-[#facc15]";
  const button = "flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#facc15] font-extrabold text-black disabled:opacity-60";
  const title = mode === "login" ? "Entre na sua conta" : mode === "code" ? "Primeiro acesso" : "Crie sua senha";

  return <div className="mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#151515] shadow-2xl">
    <div className="border-b border-white/10 bg-black px-6 py-8 text-center">
      <img src={shark} alt="Mascote ALT FITNESS" className="mx-auto mb-3 h-24 w-24 object-contain"/>
      <p className="text-xs font-bold tracking-[.3em] text-[#facc15]">ACADEMIA</p>
      <h1 className="mt-1 text-3xl font-black">ALT FITNESS</h1>
      <p className="mt-2 text-sm text-zinc-400">ALT ALUNO · {title}</p>
    </div>

    {mode === "login" && <form onSubmit={login} className="space-y-4 p-6">
      <label className="block text-sm font-semibold">Matrícula
        <input value={identifier} onChange={e=>setIdentifier(e.target.value.replace(/[^0-9]/g,""))} autoComplete="username" inputMode="numeric" required className={field} placeholder="Digite sua matrícula"/>
      </label>
      <label className="block text-sm font-semibold">Senha
        <input value={password} onChange={e=>setPassword(e.target.value)} type="password" autoComplete="current-password" required className={field} placeholder="Sua senha do app"/>
      </label>
      <button disabled={busy} className={button}>{busy && <Loader2 className="animate-spin" size={18}/>} Entrar</button>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <button type="button" onClick={()=>{setIdentifier("");setPassword("");setCode("");setMode("code");}} className="flex min-h-11 items-center justify-center rounded-lg border border-[#facc15]/70 bg-[#facc15]/10 px-4 font-bold text-[#facc15]">Primeiro acesso · criar senha</button>
        <button type="button" onClick={()=>toast.info("Para redefinir sua senha, procure a recepção da ALT FITNESS.")} className="text-zinc-300">Esqueci a senha</button>
      </div>
      <p className="text-center text-xs text-zinc-500">A senha do aplicativo é pessoal e diferente da senha da catraca. A equipe não consegue visualizar sua senha.</p>
      <a href="/" className="block text-center text-sm text-[#facc15]">Voltar ao início</a>
    </form>}

    {mode === "code" && <form onSubmit={checkCode} className="space-y-4 p-6">
      <p className="text-sm text-zinc-300">Informe o código de primeiro acesso fornecido pela academia. Ele é o mesmo para todos os alunos.</p>
      <label className="block text-sm font-semibold">Código de acesso
        <input required inputMode="numeric" pattern="[0-9]{8}" maxLength={8} value={code} onChange={e=>setCode(e.target.value.replace(/[^0-9]/g,"").slice(0,8))} className={field} placeholder="8 dígitos"/>
      </label>
      <button disabled={busy} className={button}>Continuar</button>
      <button type="button" onClick={()=>setMode("login")} className="flex w-full items-center justify-center gap-2 text-sm text-zinc-300"><ArrowLeft size={15}/> Voltar ao login</button>
    </form>}

    {mode === "activate" && <form onSubmit={begin} className="space-y-3 p-6">
      <label className="block text-sm font-semibold">Sua matrícula
        <input required inputMode="numeric" value={identifier} onChange={e=>setIdentifier(e.target.value.replace(/[^0-9]/g,""))} className={field} placeholder="Número da matrícula"/>
      </label>
      <label className="block text-sm font-semibold">Crie sua senha (mínimo 8 caracteres)
        <input required minLength={8} type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} className={field}/>
      </label>
      <label className="block text-sm font-semibold">Confirme sua senha
        <input required minLength={8} type="password" autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} className={field}/>
      </label>
      <button disabled={busy} className={button}>{busy?<Loader2 className="animate-spin"/>:<UserRoundPlus size={18}/>} Criar meu acesso</button>
      <button type="button" onClick={()=>setMode("code")} className="flex w-full items-center justify-center gap-2 text-sm text-zinc-300"><ArrowLeft size={15}/> Voltar</button>
    </form>}
  </div>;
}
