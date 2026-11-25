import net from "node:net";
import { createClient } from "@supabase/supabase-js";
import { FrameReader, buildFrame, allowCommand, denyCommand } from "./henry-protocol.js";

const required = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "AGENT_EMAIL", "AGENT_PASSWORD"];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing environment variable: ${key}`);
}
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: true },
});
const host = process.env.HENRY_HOST || "192.168.0.229";
const port = Number(process.env.HENRY_PORT || 3000);

function log(...args) {
  console.log(new Date().toISOString(), "[ALT-HENRY]", ...args);
}

function todaySaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function addDays(iso, days) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function evaluateAccess(student, today, toleranceDays) {
  if (!student) return { allowed: false, reason: "Matrícula não encontrada" };
  if (student.status === "bloqueado") return { allowed: false, reason: "Procure a Recepção" };
  if (student.status === "inativo") return { allowed: false, reason: "Aluno Inativo" };
  if (!student.valid_until) return { allowed: false, reason: "Procure a Recepção" };
  if (today > addDays(student.valid_until, toleranceDays)) return { allowed: false, reason: "Mensalidade Vencida" };
  if (student.overdue_since && today > addDays(student.overdue_since, toleranceDays)) {
    return { allowed: false, reason: "Mensalidade Vencida" };
  }
  return { allowed: true, reason: null };
}

async function lookupStudent(credential) {
  const id = String(credential || "").trim();
  if (!id || id.length > 64) return null;

  if (/^\\d+$/.test(id)) {
    const { data, error } = await supabase.from("student_overview")
      .select("id,matricula,name,status,valid_until,overdue_since,access_password,card_number,qr_code")
      .eq("matricula", Number(id)).maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  for (const field of ["card_number", "access_password", "qr_code"]) {
    const { data, error } = await supabase.from("student_overview")
      .select("id,matricula,name,status,valid_until,overdue_since,access_password,card_number,qr_code")
      .eq(field, id).maybeSingle();
    if (error) throw error;
    if (data) return data;
  }
  return null;
}

async function recordAttempt(student, credential, result) {
  const { error } = await supabase.from("attendance").insert({
    student_id: student?.id ?? null,
    credential: String(credential ?? "").slice(0, 128),
    direction: "entrada",
    allowed: result.allowed,
    reason: result.reason,
    source: "catraca",
  });
  if (error) throw error;
}

async function getCurrentSettings() {
  const { data, error } = await supabase.from("settings")
    .select("tolerance_days,release_seconds,welcome_message")
    .eq("id", 1).single();
  if (error) throw error;
  return data;
}

async function refreshAgentHeartbeat() {
  const { error } = await supabase.from("settings").update({ agent_last_seen: new Date().toISOString() }).eq("id", 1);
  if (error) log("Não foi possível atualizar o status do agente:", error.message);
}

async function processEvent(socket, event) {
  if (event.err_or_version !== "00") {
    log("Evento Henry retornou código", event.err_or_version, event.data);
    return;
  }
  const parts = event.data.split("]");
  const credential = parts[1] ?? parts[0] ?? "";
  if (!credential) {
    log("Evento sem matrícula/credencial reconhecível:", event.data);
    socket.write(buildFrame(event.index, denyCommand(settings.release_seconds, "IDENTIFICACAO INVALIDA")));
    return;
  }

  let student = null;
  let result;
  let settings;
  try {
    settings = await getCurrentSettings();
    student = await lookupStudent(credential);
    result = evaluateAccess(student, todaySaoPaulo(), settings.tolerance_days ?? 5);
    // Fail closed: do not open the turnstile if the attempt cannot be recorded.
    await recordAttempt(student, credential, result);
  } catch (error) {
    log("Falha ao consultar aluno/registrar frequência; acesso negado:", error.message);
    socket.write(buildFrame(event.index, denyCommand(settings.release_seconds, "FALHA DE VALIDACAO")));
    return;
  }

  const message = result.allowed ? (settings.welcome_message || "BEM-VINDO") : result.reason;
  socket.write(buildFrame(event.index, result.allowed
    ? allowCommand(settings.release_seconds, message)
    : denyCommand(settings.release_seconds, message)));
  log(result.allowed ? "LIBERADO" : "BLOQUEADO", student?.matricula ?? credential, student?.name ?? "aluno não identificado", result.reason ?? "");
}

async function connectTurnstile() {
  const socket = net.createConnection({ host, port });
  socket.setKeepAlive(true, 15000);
  await new Promise((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("error", reject);
  });
  return { socket, reader: new FrameReader(socket) };
}

async function main() {
  const { error } = await supabase.auth.signInWithPassword({
    email: process.env.AGENT_EMAIL,
    password: process.env.AGENT_PASSWORD,
  });
  if (error) throw new Error(`Supabase login failed: ${error.message}`);

  const { data: settings, error: settingsError } = await supabase.from("settings")
    .select("tolerance_days,release_seconds,welcome_message,turnstile_ip,turnstile_port")
    .eq("id", 1).single();
  if (settingsError) throw new Error(`Cannot read gym settings: ${settingsError.message}`);
  const targetHost = process.env.HENRY_HOST || settings.turnstile_ip || host;
  const targetPort = Number(process.env.HENRY_PORT || settings.turnstile_port || port);
  log(`Agente autenticado. Conectando à Henry Primme SF em ${targetHost}:${targetPort}`);

  while (true) {
    let connection;
    try {
      connection = await connectTurnstileAt(targetHost, targetPort);
      await refreshAgentHeartbeat();
      log("Conectado à catraca; aguardando identificações.");
      while (true) {
        const event = await connection.reader.next(31000);
        await processEvent(connection.socket, event);
        // The controller acknowledges the release/deny command with the next frame.
        try {
          const ack = await connection.reader.next(5000);
          if (ack.err_or_version !== "00") log("Henry confirmou com código", ack.err_or_version);
          else if (ack.data && !ack.data.startsWith("1]")) log("Retorno da catraca:", ack.data);
        } catch (error) {
          if (!error.message.includes("Timeout")) throw error;
        }
      }
    } catch (error) {
      log("Conexão interrompida:", error.message, "— nova tentativa em 5 segundos.");
      connection?.socket.destroy();
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

async function connectTurnstileAt(targetHost, targetPort) {
  const socket = net.createConnection({ host: targetHost, port: targetPort });
  socket.setKeepAlive(true, 15000);
  await new Promise((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("error", reject);
  });
  return { socket, reader: new FrameReader(socket) };
}

main().catch((error) => {
  log("ERRO FATAL:", error.message);
  process.exitCode = 1;
});
