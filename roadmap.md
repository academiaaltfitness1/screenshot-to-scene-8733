# Roadmap — ALT FITNESS

## Banco de dados e segurança
- [x] Estrutura principal no Supabase: alunos, matrículas, planos, mensalidades/recebíveis, frequência, equipe/permissões, turmas, produtos, vendas, contas, caixa, avaliações, treinos e configurações.
- [x] RLS ativada nas 23 tabelas; funções auxiliares de autorização movidas para o schema privado, fora da API pública.
- [x] Bucket privado `fotos` criado com políticas de acesso para equipe autorizada.
- [x] Dois registros da tabela antiga `public."Alunos"` copiados para `students` e `enrollments`; tabela original preservada sem exclusão.
- [x] Metadados de consentimento de foto e reconhecimento facial adicionados; reconhecimento facial permanece desativado por padrão.
- [x] Tipos TypeScript do Supabase regenerados e sincronizados com o banco após o hardening de segurança.
- [ ] Revisar e otimizar avisos de performance dos advisors após os primeiros testes reais.
- [ ] Cadastrar o primeiro administrador: o banco estava sem usuários Auth e promove automaticamente o primeiro cadastro a admin.

## Aplicação e catraca
- [ ] Tela inicial estilo SCA Fit (menus, 12 ícones, quadro F1–F12 pelo teclado, alertas).
- [ ] Módulos F1–F12 + Sistema, Backup, Catraca e Relatórios.
- [ ] Agente Local Windows (.js + .bat), comunicação autenticada com Supabase e status de conexão.
- [ ] Integração com Henry Primme Acesso SF, validando protocolo/comando de liberação no equipamento real.
- [ ] Compatibilidade com teclado USB SKO12: matrícula + tecla verde/Enter para registrar entrada e saída.
- [ ] Cadastro facial com aviso claro, consentimento explícito e alternativa por matrícula/teclado; reconhecimento desativado até o consentimento.
- [ ] Testes físicos de entrada, saída, aluno vencido, aluno bloqueado, falha de rede e reinício do computador.
- [ ] App do aluno instalável (treino, avaliação, financeiro, carteirinha QR).

## Concluído anteriormente
- [x] Admin entra direto, sem confirmar e-mail.
- [x] Logotipo original aplicado (cabeçalho, login, ícones, favicon).
- [x] Tela de entrada: lista da equipe (escolher nome + senha), e-mail opcional para funcionários.

## Registro técnico — 25/11/2026
- Projeto Supabase: `xyyuvwyyneadvkfwbvfb` (sa-east-1).
- Seis migrações aplicadas (schema, storage, login, importação/consentimento e hardening); sem inserir produtos/planos fictícios da migração original.
- A tabela legada foi mantida como cópia de segurança lógica; não foram inferidos pagamentos a partir de vencimento/valor.
