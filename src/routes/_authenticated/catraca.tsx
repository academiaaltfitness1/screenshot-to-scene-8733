import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Save, Unlock, Wifi, WifiOff, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { ModuleWindow } from "@/components/shell/ModuleWindow";
import { Field } from "@/components/app/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { settingsQuery, useStaff } from "@/hooks/use-staff";
import { buildAgentZip } from "@/lib/agent-package";
import { fmtDateTime, errMsg } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/catraca")({
  head: () => ({
    meta: [
      { title: "Catraca Henry — ALT FITNESS" },
      { name: "description", content: "Integração local com a catraca Henry Primme Acesso SF." },
    ],
  }),
  component: CatracaPage,
});

type Settings = Tables<"settings">;

function CatracaPage() {
  const qc = useQueryClient();
  const { staff } = useStaff();
  const { data, isLoading } = useQuery({ ...settingsQuery, refetchInterval: 10_000 });
  const [f, setF] = useState<Partial<Settings>>({});
  const [cameraActive, setCameraActive] = useState(false);
  const [keyboardCode, setKeyboardCode] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const keyboardBuffer = useRef("");
  const lastKeyAt = useRef(0);


  useEffect(() => {
    if (data) setF(data);
  }, [data]);

  async function identifyAtComputer(credential: string, source: "teclado" | "qrcode") {
    const code = credential.trim();
    if (!code) return;
    try {
      const response = await fetch("http://127.0.0.1:3001/identificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: code, source }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        toast.error(result.message || (result.error === "aluno_nao_encontrado" ? "Código não encontrado." : "Não foi possível comunicar com a catraca."));
        return;
      }
      toast.success(result.allowed ? "Acesso liberado: " + result.name : "Acesso bloqueado: " + result.message);
    } catch {
      toast.error("Agente local indisponível. Confira se está instalado e aberto no computador da recepção.");
    }
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (f.allow_sko12 === false) return;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (event.key === "Enter") {
        const value = keyboardBuffer.current;
        keyboardBuffer.current = "";
        if (value) { event.preventDefault(); void identifyAtComputer(value, "teclado"); }
        return;
      }
      if (/^[0-9]$/.test(event.key) || /^Numpad[0-9]$/.test(event.code)) {
        const digit = /^[0-9]$/.test(event.key) ? event.key : event.code.replace("Numpad", "");
        const now = Date.now();
        if (now - lastKeyAt.current > 1500) keyboardBuffer.current = "";
        lastKeyAt.current = now;
        keyboardBuffer.current = (keyboardBuffer.current + digit).slice(-30);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [f.allow_sko12]);

  useEffect(() => {
    if (!cameraActive) return;
    let stream: MediaStream | null = null;
    let timer = 0;
    let busy = false;
    let stopped = false;
    async function startScanner() {
      try {
        const BarcodeDetectorCtor = (window as any).BarcodeDetector;
        if (!BarcodeDetectorCtor) {
          toast.error("Leitura QR nativa não disponível neste navegador. Use Chrome ou Edge atualizado.");
          setCameraActive(false);
          return;
        }
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (stopped || !videoRef.current) { stream.getTracks().forEach((track) => track.stop()); return; }
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const detector = new BarcodeDetectorCtor({ formats: ["qr_code"] });
        timer = window.setInterval(async () => {
          if (busy || !videoRef.current) return;
          busy = true;
          try {
            const codes = await detector.detect(videoRef.current);
            const value = codes?.[0]?.rawValue;
            if (value) {
              setCameraActive(false);
              await identifyAtComputer(value, "qrcode");
            }
          } catch { /* aguarda o próximo quadro */ }
          finally { busy = false; }
        }, 400);
      } catch {
        toast.error("Não foi possível abrir a webcam. Verifique a permissão de câmera do navegador.");
        setCameraActive(false);
      }
    }
    void startScanner();
    return () => {
      stopped = true;
      if (timer) window.clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [cameraActive]);

  const online = !!data?.agent_last_seen &&
    Date.now() - new Date(data.agent_last_seen).getTime() < 3 * 60_000;

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("settings").update({
        turnstile_model: "Henry Primme Acesso SF",
        turnstile_firmware: "2.0.26",
        turnstile_ip: String(f.turnstile_ip || "192.168.0.229").trim(),
        turnstile_port: Number(f.turnstile_port || 3000),
        release_seconds: Number(f.release_seconds || 5),
        block_inactive: f.block_inactive !== false,
        allow_qrcode: f.allow_qrcode !== false,
        allow_sko12: f.allow_sko12 !== false,
        allow_password: f.allow_password !== false,
        allow_matricula: f.allow_matricula !== false,
        allow_card: f.allow_card !== false,
        fingerprint_rule: String(f.fingerprint_rule || "CONSULTAR NÚMERO DE MATRÍCULA"),
        keypad_rule: String(f.keypad_rule || "CONSULTAR NÚMERO DE MATRÍCULA"),
        welcome_message: String(f.welcome_message || "Bem-vindo"),
        updated_at: new Date().toISOString(),
      }).eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configurações da catraca salvas");
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const release = useMutation({
    mutationFn: async () => {
      if (!online) throw new Error("O Agente Local está sem sinal. Não foi enviado comando à catraca.");
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Sessão expirada. Entre novamente.");
      const { error } = await supabase.from("turnstile_commands").insert({
        command: "liberar",
        direction: "entrada",
        requested_by: auth.user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Comando enviado ao Agente Local. Aguarde a confirmação da catraca.");
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  async function downloadAgent() {
    try {
      if (!staff?.isAdmin) throw new Error("Somente o administrador pode gerar o pacote seguro do Agente Local.");
      const { data: credential, error } = await supabase.from("agent_credentials")
        .select("token").eq("id", 1).single();
      if (error || !credential?.token) throw new Error("Não foi possível obter o código do Agente. Verifique sua permissão de administrador.");
      const blob = await buildAgentZip({
        system_url: window.location.origin,
        token: credential.token,
        porta_local: 3001,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "agente-henry-altfitness.zip";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Pacote do Agente Local gerado.");
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  const set = (key: keyof Settings, value: unknown) =>
    setF((old) => ({ ...old, [key]: value } as Partial<Settings>));

  return (
    <ModuleWindow
      module="catraca"
      actions={
        <Button size="sm" variant="hero" onClick={downloadAgent} disabled={!staff?.isAdmin}>
          <Download /> Baixar Agente Local
        </Button>
      }
    >
      <div className="mx-auto grid max-w-4xl gap-5 p-5">
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold">
              <ShieldCheck className="h-5 w-5 text-primary" /> Henry Primme Acesso SF
            </h3>
            <p className="text-sm text-muted-foreground">Firmware 2.0.26 · Comunicação TCP/IP · Agente Local no computador da recepção</p>
            <p className="mt-1 text-xs text-muted-foreground">Último sinal: {fmtDateTime(data?.agent_last_seen)}</p>
          </div>
          {online ? (
            <Badge variant="success"><Wifi className="mr-1 h-3.5 w-3.5" /> Agente conectado</Badge>
          ) : (
            <Badge variant="destructive"><WifiOff className="mr-1 h-3.5 w-3.5" /> Sem sinal do agente</Badge>
          )}
        </section>

        <section className="grid gap-3 rounded-lg border border-primary/30 bg-card p-4">
          <h3 className="text-base font-bold">Identificação pelo computador da recepção</h3>
          <p className="text-sm text-muted-foreground">O teclado USB SKO 12 é o teclado principal: digite a matrícula ou senha e pressione Enter. A webcam conectada à CPU lê o QR Code do aplicativo do aluno.</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="success">SKO 12 — teclado principal</Badge>
            <Badge variant="secondary">Webcam USB — QR Code</Badge>
          </div>
          <div className="flex gap-2">
            <Input
              autoFocus
              disabled={f.allow_sko12 === false}
              value={keyboardCode}
              onChange={(event) => setKeyboardCode(event.target.value.replace(/[^0-9]/g, "").slice(0, 30))}
              onKeyDown={(event) => {
                if (event.key === "Enter" && keyboardCode.trim()) {
                  event.preventDefault();
                  void identifyAtComputer(keyboardCode, "teclado");
                  setKeyboardCode("");
                }
              }}
              placeholder="Clique aqui e digite a matrícula no SKO 12; confirme no Enter"
              inputMode="numeric"
              aria-label="Entrada pelo teclado SKO 12"
            />
            <Button disabled={f.allow_sko12 === false} onClick={() => { if (keyboardCode.trim()) { void identifyAtComputer(keyboardCode, "teclado"); setKeyboardCode(""); } }}>Confirmar</Button>
          </div>
          <Button variant="outline" disabled={f.allow_qrcode === false} onClick={() => setCameraActive((v) => !v)}>
            {cameraActive ? "Parar leitura da webcam" : "Abrir câmera para ler QR Code"}
          </Button>
          {cameraActive && <video ref={videoRef} className="max-h-72 w-full rounded-lg bg-black object-contain" muted playsInline />}
          <p className="text-xs text-muted-foreground">Mantenha esta tela aberta no computador. O teclado SKO 12 funciona quando a janela do sistema está em foco; a leitura pela webcam usa a câmera conectada ao mesmo computador.</p>
        </section>

        <section className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-3">
          <h3 className="text-base font-bold sm:col-span-3">Comunicação com a catraca</h3>
          <Field label="Endereço IP">
            <Input value={String(f.turnstile_ip ?? "192.168.0.229")} onChange={(e) => set("turnstile_ip", e.target.value)} />
          </Field>
          <Field label="Porta TCP">
            <Input type="number" min="1" max="65535" value={String(f.turnstile_port ?? 3000)} onChange={(e) => set("turnstile_port", Number(e.target.value))} />
          </Field>
          <Field label="Tempo de liberação (segundos)">
            <Input type="number" min="1" max="30" value={String(f.release_seconds ?? 5)} onChange={(e) => set("release_seconds", Number(e.target.value))} />
          </Field>
          <Field label="Mensagem no visor" >
            <Input value={String(f.welcome_message ?? "Bem-vindo")} onChange={(e) => set("welcome_message", e.target.value)} />
          </Field>
          <Field label="Regra da biometria">
            <Input value={String(f.fingerprint_rule ?? "CONSULTAR NÚMERO DE MATRÍCULA")} onChange={(e) => set("fingerprint_rule", e.target.value)} />
          </Field>
          <Field label="Regra do teclado">
            <Input value={String(f.keypad_rule ?? "CONSULTAR NÚMERO DE MATRÍCULA")} onChange={(e) => set("keypad_rule", e.target.value)} />
          </Field>
        </section>

        <section className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
          <h3 className="text-base font-bold sm:col-span-2">Formas de identificação permitidas</h3>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.allow_matricula !== false} onCheckedChange={(v) => set("allow_matricula", v === true)} /> Matrícula / digital vinculada à matrícula</label>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.allow_sko12 !== false} onCheckedChange={(v) => set("allow_sko12", v === true)} /> Teclado USB SKO 12 (conectado à CPU)</label>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.allow_password !== false} onCheckedChange={(v) => set("allow_password", v === true)} /> Senha no teclado</label>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.allow_card !== false} onCheckedChange={(v) => set("allow_card", v === true)} /> Cartão / proximidade</label>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.allow_qrcode !== false} onCheckedChange={(v) => set("allow_qrcode", v === true)} /> QR Code</label>
          <label className="flex items-center gap-2 text-sm opacity-70 sm:col-span-2"><Checkbox checked={false} disabled /> Reconhecimento facial — módulo biométrico em desenvolvimento</label>
          <p className="text-xs text-muted-foreground sm:col-span-2">O reconhecimento facial ainda não está disponível. A opção só será liberada após cadastro com autorização, proteção dos dados biométricos e testes de validação. Enquanto isso, use matrícula, SKO 12 ou QR Code.</p>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><Checkbox checked={f.block_inactive !== false} onCheckedChange={(v) => set("block_inactive", v === true)} /> Bloquear alunos inativos</label>
        </section>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => save.mutate()} disabled={save.isPending || isLoading}>
            <Save /> Salvar configurações
          </Button>
          <Button variant="outline" onClick={() => release.mutate()} disabled={!online || release.isPending}>
            <Unlock /> Liberar catraca remotamente
          </Button>
        </div>

        <section className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
          <h3 className="mb-2 font-bold">Instalação no computador da recepção</h3>
          <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>Salve as configurações da catraca.</li>
            <li>Baixe o Agente Local e extraia o ZIP no computador conectado à mesma rede da Henry.</li>
            <li>Instale o Node.js LTS, se ainda não estiver instalado.</li>
            <li>Execute <strong>instalar-inicio-automatico.bat</strong> dentro da pasta extraída.</li>
            <li>Volte a esta tela. O indicador deve mudar para “Agente conectado”.</li>
          </ol>
          <p className="mt-3 text-xs text-muted-foreground">O agente mantém cópia local dos alunos e fila de frequência para continuar validando acessos quando a internet cair.</p>
        </section>
      </div>
    </ModuleWindow>
  );
}
