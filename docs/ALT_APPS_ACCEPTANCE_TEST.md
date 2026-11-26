# Roteiro de validação — ALT ADMIN e ALT ALUNO

## Antes de liberar para todos
- Confirmar que o projeto Lovable está sincronizado com a branch `altfitness/implementacao-prd-2026-11-24`.
- Confirmar que o workflow `validate-altfitness` terminou com sucesso.
- Confirmar que as migrações do Lovable Cloud estão aplicadas.
- Não alterar o banco Supabase externo usado em outro projeto.

## ALT ADMIN (PWA)
1. Abrir `/auth` no Chrome Android e instalar o app na tela inicial.
2. Entrar com uma conta de funcionário existente.
3. Conferir se o usuário vê apenas módulos autorizados.
4. Abrir Alunos e gerar um código de ativação de uso único para um aluno de teste.
5. Abrir Treinos, selecionar o aluno, definir a meta semanal e conferir o histórico de execuções.
6. Abrir Comunicados e publicar um aviso de teste.
7. Abrir Receber e aprovar/rejeitar um comprovante de teste.
8. Abrir Catraca e confirmar o status do agente Henry.

## ALT ALUNO (PWA)
1. Abrir `/aluno` no Chrome Android e instalar o app na tela inicial.
2. Ativar com matrícula, CPF, nascimento e código fornecido pela recepção.
3. Confirmar o e-mail por OTP e criar uma senha própria.
4. Sair e entrar novamente com matrícula/CPF e senha.
5. Conferir plano, vencimento, comunicados, frequência e QR fixo.
6. Executar um treino: registrar carga, repetições, duração, descanso e/ou pular com justificativa.
7. Concluir a sessão e conferir a progressão A/B/C/D e o histórico.
8. Conferir cobranças, gerar o Pix, enviar comprovante e aguardar aprovação da recepção.
9. Enviar um pedido de revisão e conferir que o professor consegue atendê-lo sem apagar o histórico.

## Teste da catraca e QR
- O QR temporário permanece desativado por padrão.
- Baixar e instalar o pacote atualizado do Agente Henry no PC da recepção.
- Confirmar que o agente aparece como versão compatível e online na tela Catraca.
- Testar primeiro o QR fixo atual.
- Somente depois do teste físico, o administrador pode habilitar o QR temporário.
- Testar expiração, uso único, modo offline do agente e botão de retorno ao QR fixo.
- Se qualquer etapa falhar, desligar QR temporário; o QR fixo permanece como alternativa.

## Critérios para publicação
- Não publicar em produção antes de validar OTP por e-mail, Pix/comprovante, permissões por perfil e leitura real da catraca.
- Não apagar nem substituir cadastros, cobranças, fichas ou histórico existentes.
- Confirmar que o sistema desktop SCA Fit continua operando normalmente.
