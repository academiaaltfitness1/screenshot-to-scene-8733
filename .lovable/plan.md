# Plano — ALT ALUNO (app do aluno em rota separada)

Nada foi alterado. Este plano parte do que foi lido agora no código e no banco.

## 1. Diagnóstico (verificado)

- **Rota do aluno não existe.** A página inicial e o menu "Aplicativos" já apontam para `/aluno`, mas não há arquivo de rota; hoje o link cai em "página não encontrada".
- **Contas:** só existem 2 usuários (equipe). Alunos não têm conta. Todo usuário novo ganha automaticamente um perfil de funcionário "Recepção" (gatilho `handle_new_user`), o que não serve para alunos.
- **Cadastro aberto:** a criação de conta pública está ligada e sem confirmação de e-mail (escolha feita para o primeiro administrador). Como o administrador já existe, isso hoje só deixa a porta aberta.
- **Dados dos alunos:** 4 alunos, todos com CPF, nenhum com e-mail, 1 com WhatsApp, nenhum com `access_password`. Ou seja, o e-mail terá de ser coletado na ativação.
- **`students.access_password`** é usado apenas pela catraca (teclado) e vai para o Agente Local. Não será usado no app.
- **Treinos:** `workouts` e `workout_exercises` existem e estão vazios. A tela de prescrição apaga e recria os exercícios a cada salvamento — o histórico do aluno não pode depender do id do exercício.
- **Financeiro:** `receivables` (4 lançamentos) e `settings.pix_key` existem; ambos só legíveis pela equipe.
- **QR atual:** `students.qr_code` é fixo e validado pelo Agente Local offline. Não há expiração nem controle de reuso.
- **Segurança atual:** todas as tabelas têm RLS; as regras usam `is_staff()` / `can_access()`, que retornam falso para quem não é da equipe. Um aluno logado não leria nada da equipe.
- **Pendências encontradas fora deste escopo (a conferir antes de começar):** o código usa `settings.dashboard_mascot_url` e o local de arquivos `dashboard-assets`, mas a consulta ao banco não mostrou nem a coluna nem esse local (só `fotos`). A Central de Mensagens do WhatsApp continua na lista, ainda não iniciada.

## 2. O que será construído

### Acesso do aluno
- Entrada em `/aluno` com **matrícula ou CPF + senha própria** (criada pelo aluno, guardada pelo sistema de login, nunca em `students`).
- **Ativação (primeiro acesso):** matrícula + CPF + data de nascimento + **código de ativação de uso único** gerado pela recepção na ficha do aluno. O aluno informa o e-mail, recebe um código de confirmação e cria a senha.
- **Recuperação:** por e-mail verificado (link para `/aluno/redefinir-senha`). Sem e-mail: a recepção gera novo código de ativação.
- Limite de tentativas na ativação e no login (bloqueio temporário após erros).

### Treino
- Professor continua prescrevendo no desktop (F12). No app o aluno **não edita a ficha**.
- "Treino de hoje" segue a sequência A→B→C. A posição só avança quando o aluno **conclui** um treino; faltar dias não reinicia.
- Em cada exercício: registrar por série carga, repetições e tempo; marcar concluído ou pulado (com motivo).
- Histórico de execuções e última carga usada em cada exercício.
- Meta opcional (ex.: treinos por semana, peso-alvo) definida pelo aluno.

### Financeiro
- Mensalidades em aberto e pagas, vencimento da matrícula, chave Pix com botão copiar.
- Envio de **comprovante** (foto/PDF) que fica "pendente". O aluno nunca marca como pago: a recepção confere em Contas a Receber e usa o "Receber" já existente.

### Carteirinha / QR
- QR **temporário** (troca a cada 30 s) no lugar do fixo; cada código vale uma única passagem.
- O QR fixo impresso continua funcionando até você decidir desligar.

### Mural
- Comunicados com título, texto, período de exibição e destaque; marcação de lido.
- Equipe publica por uma tela nova "Comunicados" no desktop (com permissão própria).

### Desktop (mudanças mínimas)
- Ficha do aluno: botão "Gerar código de ativação" e situação da conta do app.
- Contas a Receber: indicador de comprovante pendente + visualizar.
- Nova tela "Comunicados".
- Bloquear a entrada de contas de aluno na área da equipe.
- Tela inicial preta, mascote, menus e teclas F1–F12 permanecem como estão.

## 3. Etapas

1. Banco: tabelas novas e regras de acesso (item 5).
2. Ativação, login, recuperação e proteção das rotas do aluno.
3. Treino de hoje, execução e histórico.
4. Financeiro, comprovantes e Pix.
5. Mural + tela de Comunicados.
6. QR temporário (nuvem + atualização do Agente Local).
7. Ícone para instalar no celular (sem modo offline).
8. Testes: regras de sequência A→B→C, validade/reuso do QR, isolamento entre alunos (um aluno não lê dados de outro nem da equipe), fluxo completo no celular.

## 4. O que depende de você

| Item | Tipo | Observação |
|---|---|---|
| Criar tabelas e regras novas | Possível direto | Só adições; nenhum dado existente é alterado ou apagado |
| Ajustar o gatilho de novos usuários | Possível direto | Aluno deixa de virar "funcionário Recepção" |
| Desligar cadastro público e a entrada sem confirmação de e-mail | **Sua aprovação** | Reverte a escolha "entrar direto"; equipe não é afetada (contas criadas pelo administrador) |
| Envio de e-mails de confirmação/recuperação | **Configuração** | Funciona com o remetente padrão, com limite por hora; domínio próprio é opcional e exige plano pago |
| Recuperação por telefone (SMS) | **Configuração + custo** | Exige contratar um serviço de SMS; proposta: ficar fora da 1ª versão, usando o código da recepção |
| QR temporário na catraca | **Ação sua** | Baixar e reinstalar o Agente Local na recepção; testar no leitor Henry se ele lê o novo formato |
| Desligar o QR fixo | **Sua decisão** | Só depois do teste na catraca |
| Publicar | **Sua decisão** | Nada será publicado nesta etapa |

## 5. Detalhes técnicos

- **Vínculo conta↔matrícula:** `student_accounts (user_id unique, student_id unique, email_verified_at, phone_verified_at)`. Contas criadas somente no servidor (`auth.admin.createUser` com `app_metadata.kind = 'student'`); `handle_new_user` ignora esse tipo. Função `current_student_id()` (security definer) usada nas regras.
- **Ativação:** `student_activation_codes (student_id, code_hash, expires_at, used_at, created_by)` e `student_auth_attempts` para limite de tentativas; verificação em `createServerFn` com Zod. Confirmação de e-mail por código (OTP) com `shouldCreateUser: false`.
- **Leitura pelo aluno:** novas regras SELECT "próprio aluno" em `workouts`, `workout_exercises`, `receivables`, `enrollments`, `assessments`. `students` e `settings` **não** recebem regra para aluno; dados seguros saem por funções `aluno_me()` e `aluno_pix()` (sem `access_password`, `qr_code`, observações médicas internas).
- **Execução:** `workout_sessions (student_id, workout_id null on delete, letter, started_at, finished_at, status)`, `workout_set_logs (session_id, exercise_id null on delete, exercise_name, set_number, load, reps, duration_seconds, status, skip_reason)`, `student_training_state (student_id pk, next_letter)`, `student_goals`. Nome do exercício é copiado para o registro, pois a prescrição recria os exercícios.
- **Comprovantes:** `payment_proofs (receivable_id, student_id, file_path, status, reviewed_by, reviewed_at)` + local privado `comprovantes` (pasta por aluno; aluno insere/lê os próprios, equipe com `receber` lê e revisa). `receivables` sem permissão de escrita para aluno.
- **QR:** segredo por aluno em `student_qr_secrets` (só servidor). Código = matrícula + 8 dígitos HMAC da janela de 30 s, gerado por `createServerFn`. O Agente recebe os segredos no `sync`, valida offline com tolerância de ±1 janela e guarda a última janela usada por aluno (anti-replay); `qr_uses` registra na nuvem via `events`.
- **Mural:** `announcements`, `announcement_reads`; novo módulo `comunicados` em `modules.ts` e na lista de permissões.
- **Rotas:** `/aluno` (pública), `/aluno/ativar`, `/aluno/redefinir-senha`; layout protegido `_aluno` (`ssr: false`) com `/aluno/inicio`, `/aluno/treino`, `/aluno/historico`, `/aluno/financeiro`, `/aluno/carteirinha`, `/aluno/mural`. `_authenticated` passa a redirecionar quem não é da equipe.
- **Regras do repositório:** todas as mudanças de banco pela ferramenta de migração (nada editado à mão em `drizzle/`), sem tocar em arquivos gerados (`src/integrations/supabase/*`, `routeTree.gen.ts`).
