import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

type FaceMode = "register" | "recognize";
type FaceApi = any;

declare global {
  interface Window { faceapi?: FaceApi; }
}

const FACE_API_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/dist/face-api.js";
const FACE_MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model/";
const CONSENT_VERSION = "altfitness-face-consent-2026-11-v1";
let faceApiLoading: Promise<FaceApi> | null = null;
let modelsLoading: Promise<FaceApi> | null = null;

function loadFaceApi(): Promise<FaceApi> {
  if (window.faceapi) return Promise.resolve(window.faceapi);
  if (!faceApiLoading) {
    faceApiLoading = new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-alt-face-api="true"]');
      if (existing) {
        existing.addEventListener("load", () => window.faceapi ? resolve(window.faceapi) : reject(new Error("Biblioteca facial indisponível.")), { once: true });
        existing.addEventListener("error", () => reject(new Error("Não foi possível carregar o módulo facial.")), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = FACE_API_URL;
      script.async = true;
      script.dataset.altFaceApi = "true";
      script.onload = () => window.faceapi ? resolve(window.faceapi) : reject(new Error("Biblioteca facial não inicializou."));
      script.onerror = () => reject(new Error("Falha ao baixar o módulo facial. Verifique a internet."));
      document.head.appendChild(script);
    });
  }
  return faceApiLoading;
}

async function loadModels(): Promise<FaceApi> {
  const api = await loadFaceApi();
  if (!modelsLoading) {
    modelsLoading = Promise.all([
      api.nets.ssdMobilenetv1.loadFromUri(FACE_MODEL_URL),
      api.nets.faceLandmark68Net.loadFromUri(FACE_MODEL_URL),
      api.nets.faceRecognitionNet.loadFromUri(FACE_MODEL_URL),
    ]).then(() => api).catch((error) => {
      modelsLoading = null;
      throw error;
    });
  }
  return modelsLoading;
}

function eyeRatio(points: any[]): number {
  const distance = (a: any, b: any) => Math.hypot(a.x - b.x, a.y - b.y);
  if (!points || points.length < 6) return 1;
  return (distance(points[1], points[5]) + distance(points[2], points[4])) / (2 * distance(points[0], points[3]));
}

export function FacialAccess({ enabled, onIdentify }: { enabled: boolean; onIdentify: (matricula: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onIdentifyRef = useRef(onIdentify);
  useEffect(() => { onIdentifyRef.current = onIdentify; }, [onIdentify]);
  const streamRef = useRef<MediaStream | null>(null);
  const blinkRef = useRef(0);
  const candidateRef = useRef<{ label: string; count: number } | null>(null);
  const busyRef = useRef(false);
  const [mode, setMode] = useState<FaceMode>("register");
  const [cameraActive, setCameraActive] = useState(false);
  const [matricula, setMatricula] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState("O cadastro facial é opcional e exige autorização expressa do aluno.");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!cameraActive) return;
    let cancelled = false;
    let interval = 0;
    async function openCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
        if (cancelled) { stream.getTracks().forEach((track) => track.stop()); return; }
        streamRef.current = stream;
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        if (mode === "recognize") {
          setStatus("Olhe para a câmera e pisque uma vez para confirmar presença.");
          interval = window.setInterval(async () => {
            if (busyRef.current || !videoRef.current) return;
            busyRef.current = true;
            try {
              const api = await loadModels();
              const result = await api.detectSingleFace(videoRef.current).withFaceLandmarks().withFaceDescriptor();
              if (!result) return;
              const landmarks = result.landmarks;
              const ratio = (eyeRatio(landmarks.getLeftEye()) + eyeRatio(landmarks.getRightEye())) / 2;
              if (ratio < 0.19) blinkRef.current = 1;
              else if (blinkRef.current === 1 && ratio > 0.23) blinkRef.current = 2;
              if (blinkRef.current !== 2) return;

              const { data, error } = await (supabase as any).from("student_face_templates")
                .select("student_id, descriptor, students(matricula,name)");
              if (error) throw error;
              const labeled = (data ?? []).filter((row: any) => Array.isArray(row.descriptor) && row.students?.matricula)
                .map((row: any) => new api.LabeledFaceDescriptors(String(row.students.matricula), [new Float32Array(row.descriptor)]));
              if (!labeled.length) { setStatus("Nenhum cadastro facial autorizado foi encontrado."); setCameraActive(false); return; }
              const matcher = new api.FaceMatcher(labeled, 0.48);
              const match = matcher.findBestMatch(result.descriptor);
              if (match.label !== "unknown") {
                if (candidateRef.current?.label === match.label) candidateRef.current.count += 1;
                else candidateRef.current = { label: match.label, count: 1 };
                if (candidateRef.current.count < 2) {
                  setStatus("Rosto localizado. Mantenha o rosto de frente por um instante…");
                  return;
                }
                const found = (data ?? []).find((row: any) => String(row.students?.matricula) === match.label);
                if (found) {
                  setStatus("Rosto reconhecido: " + (found.students?.name ?? "aluno") + ". Validando acesso…");
                  setCameraActive(false);
                  onIdentifyRef.current(match.label);
                }
              } else {
                candidateRef.current = null;
                setStatus("Rosto não reconhecido. Tente novamente ou use matrícula/QR Code.");
                blinkRef.current = 0;
              }
            } catch (error) {
              setStatus(error instanceof Error ? error.message : "Erro durante o reconhecimento facial.");
              setCameraActive(false);
            } finally {
              busyRef.current = false;
            }
          }, 500);
        } else {
          setStatus("Câmera pronta. Posicione somente o aluno no enquadramento e capture o rosto.");
        }
      } catch {
        setStatus("Não foi possível abrir a webcam. Confira a conexão e a permissão de câmera do navegador.");
        setCameraActive(false);
      }
    }
    void openCamera();
    return () => {
      cancelled = true;
      if (interval) window.clearInterval(interval);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [cameraActive, mode]);

  async function start(nextMode: FaceMode) {
    setWorking(true);
    try {
      await loadModels();
      blinkRef.current = 0;
      candidateRef.current = null;
      setMode(nextMode);
      setCameraActive(true);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível iniciar o reconhecimento facial.");
    } finally {
      setWorking(false);
    }
  }

  async function registerFace() {
    if (!consent) { setStatus("Confirme primeiro que o aluno recebeu as informações e autorizou o cadastro."); return; }
    if (!/^\d+$/.test(matricula.trim())) { setStatus("Informe a matrícula numérica do aluno."); return; }
    if (!videoRef.current || !cameraActive || mode !== "register") { setStatus("Abra a câmera no modo de cadastro antes de capturar."); return; }
    setWorking(true);
    try {
      const api = await loadModels();
      const detections = await api.detectAllFaces(videoRef.current).withFaceLandmarks().withFaceDescriptors();
      if (detections.length !== 1) throw new Error(detections.length === 0 ? "Nenhum rosto detectado. Ajuste a iluminação e tente novamente." : "Deixe apenas o aluno na frente da câmera.");
      const { data: student, error: studentError } = await supabase.from("students").select("id,name,matricula").eq("matricula", Number(matricula)).single();
      if (studentError || !student) throw new Error("Matrícula não encontrada.");
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("student_face_templates").upsert({
        student_id: student.id,
        descriptor: Array.from(detections[0].descriptor as Float32Array),
        consent_at: new Date().toISOString(),
        consent_text_version: CONSENT_VERSION,
        recorded_by: auth.user?.id ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "student_id" });
      if (error) throw error;
      setStatus("Cadastro facial autorizado salvo para " + student.name + ". Nenhuma fotografia é armazenada por este módulo; somente o modelo matemático protegido.");
      setConsent(false);
      setCameraActive(false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível cadastrar este rosto.");
    } finally {
      setWorking(false);
    }
  }

  async function removeFace() {
    if (!/^\d+$/.test(matricula.trim())) { setStatus("Informe a matrícula para remover o cadastro."); return; }
    if (!window.confirm("Remover o cadastro facial deste aluno?")) return;
    setWorking(true);
    try {
      const { data: student, error: studentError } = await supabase.from("students").select("id").eq("matricula", Number(matricula)).single();
      if (studentError || !student) throw new Error("Matrícula não encontrada.");
      const { error } = await (supabase as any).from("student_face_templates").delete().eq("student_id", student.id);
      if (error) throw error;
      setStatus("Cadastro facial removido. O aluno continua podendo entrar por matrícula, senha ou QR Code.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível remover o cadastro.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="grid gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-bold">Reconhecimento facial</h3>
          <p className="text-xs text-muted-foreground">Cadastro individual autorizado e identificação pela webcam da recepção.</p>
        </div>
        <Badge variant={enabled ? "success" : "secondary"}>{enabled ? "Identificação ativa" : "Identificação desativada"}</Badge>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <Input value={matricula} onChange={(event) => setMatricula(event.target.value.replace(/\D/g, "").slice(0, 12))} placeholder="Matrícula do aluno para cadastrar/remover o rosto" inputMode="numeric" />
        <Button variant="outline" disabled={working || !matricula.trim()} onClick={removeFace}>Remover cadastro facial</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={working} onClick={() => start("register")}>Abrir câmera para cadastro</Button>
        <Button disabled={!enabled || working} onClick={() => start("recognize")}>Iniciar reconhecimento facial</Button>
        {cameraActive && <Button variant="destructive" onClick={() => setCameraActive(false)}>Parar câmera</Button>}
      </div>
      {cameraActive && <video ref={videoRef} className="max-h-72 w-full rounded-lg bg-black object-contain" muted playsInline />}
      {mode === "register" && cameraActive && (
        <div className="grid gap-2 rounded-md border p-3">
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={consent} onCheckedChange={(value) => setConsent(value === true)} />
            <span>Confirmo que o aluno foi informado sobre a finalidade de controle de acesso, que o cadastro é opcional, que existem outras formas de entrada e que ele autorizou expressamente o uso do dado biométrico facial. A autorização pode ser retirada e o cadastro excluído.</span>
          </label>
          <p className="text-xs text-muted-foreground">Texto sugerido para apresentar ao aluno: “Autorizo a Academia ALT FITNESS a utilizar meu dado biométrico facial exclusivamente para identificação e controle de acesso. Sei que o cadastro é opcional, posso utilizar matrícula ou QR Code e posso solicitar a exclusão do cadastro.”</p>
          <Button disabled={!consent || working} onClick={registerFace}>Capturar rosto e registrar autorização</Button>
        </div>
      )}
      <p className="text-sm text-muted-foreground" role="status">{status}</p>
      <p className="text-xs text-muted-foreground">Privacidade e segurança: este módulo grava um vetor biométrico, não a foto. O acesso aos vetores deve ficar restrito à equipe autorizada. A piscada é uma verificação básica de presença, não uma certificação anti-fraude; não use o reconhecimento facial como único fator até validar o desempenho e os riscos no local.</p>
    </section>
  );
}
