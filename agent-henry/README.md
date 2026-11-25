# Agente Local — Henry Primme Acesso SF

Este serviço faz a ponte entre a catraca Henry na rede local e o sistema ALT FITNESS no Supabase. O sistema em nuvem **não** tenta acessar o IP privado da academia.

## Requisitos

- Windows 10/11 ou Linux no computador que permanece ligado na rede da catraca.
- Node.js 20.6 ou superior.
- Henry Primme Acesso SF acessível pela rede local no IP/porta configurados.
- Usuário Supabase da academia com permissão para o módulo **catraca** (ou administrador).

## Instalação

1. Copie `.env.example` para `.env`.
2. Preencha `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `AGENT_EMAIL` e `AGENT_PASSWORD`. Use um usuário próprio para o agente com acesso ao módulo catraca. **Não use a chave service_role.**
3. Confirme `HENRY_HOST=192.168.0.229` e `HENRY_PORT=3000` ou ajuste para os valores reais da rede.
4. No terminal, dentro desta pasta, execute `npm install`.
5. Execute `npm test` e depois `npm start`.

O agente mantém uma conexão TCP de saída para a catraca, recebe a identificação enviada pelo equipamento, consulta o aluno pela matrícula (com fallback para cartão, senha e QR Code), aplica as mesmas regras de validade/tolerância do sistema, grava a tentativa em Frequência e só então envia a liberação ou bloqueio.

## Regras de segurança

- Se o aluno não existir, estiver inativo/bloqueado, sem matrícula vigente ou inadimplente além da tolerância, a passagem é negada.
- Se Supabase estiver indisponível ou não for possível gravar a frequência, o acesso é negado (fail closed).
- O agente usa autenticação normal do Supabase e a chave pública/anon; não utiliza nem armazena `service_role`.
- Credenciais ficam somente no arquivo local `.env`, ignorado pelo Git.
- A liberação usa o tempo configurado em `settings.release_seconds` (PRD: 5 segundos).

## Protocolo Henry

A camada TCP implementa o enquadramento STX/ETX, tamanho e checksum XOR, além dos comandos de permitir/negar acesso usados pela integração Primme SF. A documentação pública do fabricante confirma TCP/IP e o aplicativo embarcado; o formato dos comandos foi adaptado de uma implementação comunitária que declara teste com Primme Acesso SF. Antes de colocar em produção, valide com a catraca real e com o SDK/protocolo oficial fornecido pela Henry.

## Diagnóstico

- `ECONNREFUSED`: confirme IP, porta 3000, cabo/rede e modo de comunicação configurado na Henry.
- `Timeout waiting for Henry event`: conexão aberta, mas nenhum evento chegou; valide o modo de comunicação da catraca.
- `Supabase login failed` ou erro de permissão: use um usuário ativo com permissão no módulo catraca.
