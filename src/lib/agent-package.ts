import JSZip from "jszip";
import agentSource from "@/agent/agente-henry.js.txt?raw";

export interface AgentConfig {
  system_url: string;
  token: string;
  porta_local: number;
}

const crlf = (s: string) => s.replace(/\r?\n/g, "\r\n");

export async function buildAgentZip(c: AgentConfig): Promise<Blob> {
  const zip = new JSZip();
  const dir = zip.folder("agente-henry-altfitness")!;
  dir.file("agente-henry.js", agentSource);
  dir.file(
    "config.json",
    JSON.stringify(
      {
        system_url: c.system_url,
        token: c.token,
        porta_local: c.porta_local,
        // Deixe em branco para usar o que esta configurado na tela Catraca do sistema:
        turnstile_ip: "",
        turnstile_port: "",
        // Codigos do protocolo Henry (ajuste somente se o suporte tecnico orientar):
        codigo_liberar: "6",
        codigo_bloquear: "30",
        segundos_aviso: 3,
      },
      null,
      2,
    ),
  );
  dir.file(
    "iniciar-agente.bat",
    crlf(`@echo off
title Agente Catraca - ALT FITNESS
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  O Node.js nao esta instalado neste computador.
  echo  Baixe em https://nodejs.org  ^(versao LTS^), instale e abra este arquivo de novo.
  echo.
  pause
  exit /b
)
:loop
node agente-henry.js
echo O agente parou. Reiniciando em 5 segundos...
timeout /t 5 >nul
goto loop
`),
  );
  dir.file(
    "instalar-inicio-automatico.bat",
    crlf(`@echo off
cd /d "%~dp0"
set ATALHO=%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\Agente-ALT-FITNESS.bat
echo @echo off> "%ATALHO%"
echo start "" /min "%~dp0iniciar-agente.bat">> "%ATALHO%"
echo.
echo  Pronto! O agente vai abrir sozinho sempre que o Windows iniciar.
echo  Abrindo o agente agora...
start "" /min "%~dp0iniciar-agente.bat"
pause
`),
  );
  dir.file(
    "remover-inicio-automatico.bat",
    crlf(`@echo off
del "%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\Agente-ALT-FITNESS.bat"
echo Inicio automatico removido.
pause
`),
  );
  dir.file(
    "LEIA-ME.txt",
    crlf(`AGENTE LOCAL DA CATRACA - ACADEMIA ALT FITNESS
==============================================

PASSO A PASSO (computador da recepcao, Windows)

1. Instale o Node.js (gratuito): https://nodejs.org  -> botao "LTS".
2. Copie esta pasta inteira para  C:\\agente-henry-altfitness
3. De dois cliques em  instalar-inicio-automatico.bat
   (o agente abre agora e passa a abrir sozinho ao ligar o computador).
4. No sistema, abra a tela Catraca: o indicador "Agente" deve ficar verde.

O computador precisa estar na mesma rede da catraca (${"192.168.0.229"} porta 3000).

QR TEMPORARIO
Esta versao do agente reconhece o QR temporario HMAC de 30 segundos e impede
a reutilizacao do mesmo codigo na janela. O recurso fica DESATIVADO por padrao.
So habilite na tela Catraca depois de instalar esta versao e testar a leitura.
O QR fixo atual continua funcionando.

SEM INTERNET
O agente guarda uma copia dos alunos (alunos-cache.json). Se a internet cair,
a catraca continua liberando e bloqueando normalmente; os registros ficam em
eventos-pendentes.json e sobem para o sistema quando a internet voltar.

ARQUIVOS
- config.json   endereco do sistema e codigo secreto (NAO compartilhe).
- agente.log    historico do que aconteceu (envie ao suporte em caso de problema).

TESTE RAPIDO
Abra no navegador deste computador:  http://localhost:${c.porta_local}/status
`),
  );
  return zip.generateAsync({ type: "blob" });
}
