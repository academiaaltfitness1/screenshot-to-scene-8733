import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Loader2, MailCheck, KeyRound, UserRoundPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { studentSignIn, beginStudentActivation, resendStudentActivationOtp, requestStudentPasswordReset } from "@/lib/student.functions";

type Mode = "login" | "activate" | "verify" | "forgot";

export function StudentLogin({ onSignedIn }: { onSignedIn: () => void }) {
  const signIn = useServerFn(studentSignIn);
  const activate = useServerFn(beginStudentActivation);
  const resend = useServerFn(resendStudentActivationOtp);
  const reset = useServerFn(requestStudentPasswordReset);
  const [mode, setMode] = useState<Mode>("login");
  const [identifier, setIdentifier] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
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

  function begin(e: React.FormEvent) {
    e.preventDefault();
    void run(async () => {
      const result = await activate({ data: { identifier, birthDate, code, email, password } });
      if (!result.ok) throw new Error(result.error);
      toast.success(result.message);
      setMode("verify");
    });
  }

  function verify(e: React.FormEvent) {
    e.preventDefault();
    void run(async () => {
      const { data, error } = await supabase.auth.verifyOtp({ email, token: otp, type: "signup" });
      if (error) throw error;
      if (!data.session) throw new Error("Confirmação recebida, mas não foi possível iniciar a sessão. Entre com sua matrícula e senha.");
      toast.success("E-mail confirmado. Seu ALT ALUNO está ativado!");
      onSignedIn();
    });
  }

  function resendCode() {
    void run(async () => {
      const result = await resend({ data: { identifier } });
      toast.success(result.message);
    });
  }

  function forgot(e: React.FormEvent) {
    e.preventDefault();
    void run(async () => {
      const result = await reset({ data: { identifier, redirectTo: `${window.location.origin}/reset-password` } });
      toast.success(result.message);
      setMode("login");
    });
  }

  const field = "mt-2 h-12 w-full rounded-lg border border-white/15 bg-black px-3 text-white outline-none focus:border-[#facc15]";
  const button = "flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#facc15] font-extrabold text-black disabled:opacity-60";
  const title = mode === "login" ? "Entre na sua conta" : mode === "activate" ? "Ativar meu acesso" : mode === "verify" ? "Confirmar e-mail" : "Recuperar senha";

  return <div className="mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#151515] shadow-2xl">
    <div className="border-b border-white/10 bg-black px-6 py-8 text-center">
      <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#facc15] text-black"><KeyRound size={30}/></div>
      <p className="text-xs font-bold tracking-[.3em] text-[#facc15]">ACADEMIA</p>
      <h1 className="mt-1 text-3xl font-black">ALT FITNESS</h1>
      <p className="mt-2 text-sm text-zinc-400">ALT ALUNO · {title}</p>
    </div>

    {mode === "login" && <form onSubmit={login} className="space-y-4 p-6">
      <label className="block text-sm font-semibold">Matrícula ou CPF
        <input value={identifier} onChange={e=>setIdentifier(e.target.value)} autoComplete="username" inputMode="numeric" required className={field} placeholder="Digite sua matrícula ou CPF"/>
      </label>
      <label className="block text-sm font-semibold">Senha
        <input value={password} onChange={e=>setPassword(e.target.value)} type="password" autoComplete="current-password" required className={field} placeholder="Sua senha do app"/>
      </label>
      <button disabled={busy} className={button}>{busy && <Loader2 className="animate-spin" size={18}/>} Entrar</button>
      <div className="flex flex-wrap justify-between gap-3 text-sm">
        <button type="button" onClick={()=>setMode("activate")} className="text-[#facc15]">Primeiro acesso</button>
        <button type="button" onClick={()=>setMode("forgot")} className="text-zinc-300">Esqueci a senha</button>
      </div>
      <p className="text-center text-xs text-zinc-500">Ainda não tem código? Solicite à recepção. A senha da catraca não é a senha do aplicativo.</p>
      <a href="/" className="block text-center text-sm text-[#facc15]">Voltar ao início</a>
    </form>}

    {mode === "activate" && <form onSubmit={begin} className="space-y-3 p-6">
      <label className="block text-sm font-semibold">Matrícula ou CPF<input required inputMode="numeric" value={identifier} onChange={e=>setIdentifier(e.target.value)} className={field}/></label>
      <label className="block text-sm font-semibold">Data de nascimento<input required type="date" value={birthDate} onChange={e=>setBirthDate(e.target.value)} className={field}/></label>
      <label className="block text-sm font-semibold">Código de 8 dígitos da recepção<input required inputMode="numeric" pattern="[0-9]{8}" maxLength={8} value={code} onChange={e=>setCode(e.target.value.replace(/[^0-9]/g,"").slice(0,8))} className={field}/></label>
      <label className="block text-sm font-semibold">Seu e-mail<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className={field}/></label>
      <label className="block text-sm font-semibold">Crie uma senha (mínimo 8 caracteres)<input required minLength={8} type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} className={field}/></label>
      <button disabled={busy} className={button}>{busy?<Loader2 className="animate-spin"/>:<UserRoundPlus size={18}/>} Criar acesso</button>
      <button type="button" onClick={()=>setMode("login")} className="flex w-full items-center justify-center gap-2 text-sm text-zinc-300"><ArrowLeft size={15}/> Voltar ao login</button>
    </form>}

    {mode === "verify" && <form onSubmit={verify} className="space-y-4 p-6">
      <div className="flex items-center gap-2 text-sm text-zinc-300"><MailCheck className="text-[#facc15]"/> Digite o código enviado para {email}.</div>
      <label className="block text-sm font-semibold">Código recebido por e-mail<input required inputMode="numeric" maxLength={8} value={otp} onChange={e=>setOtp(e.target.value.replace(/[^0-9]/g,"").slice(0,8))} className={field}/></label>
      <button disabled={busy} className={button}>{busy && <Loader2 className="animate-spin"/>} Confirmar e-mail</button>
      <button type="button" disabled={busy} onClick={resendCode} className="w-full text-sm text-[#facc15]">Reenviar código</button>
    </form>}

    {mode === "forgot" && <form onSubmit={forgot} className="space-y-4 p-6">
      <p className="text-sm text-zinc-400">Informe sua matrícula ou CPF. Se seu acesso estiver ativado, enviaremos a recuperação para o e-mail confirmado.</p>
      <label className="block text-sm font-semibold">Matrícula ou CPF<input required inputMode="numeric" value={identifier} onChange={e=>setIdentifier(e.target.value)} className={field}/></label>
      <button disabled={busy} className={button}>{busy && <Loader2 className="animate-spin"/>} Enviar recuperação</button>
      <button type="button" onClick={()=>setMode("login")} className="flex w-full items-center justify-center gap-2 text-sm text-zinc-300"><ArrowLeft size={15}/> Voltar ao login</button>
    </form>}
  </div>;
}
