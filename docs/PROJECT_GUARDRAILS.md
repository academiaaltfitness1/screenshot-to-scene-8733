# ALT FITNESS — regras permanentes de continuidade e segurança

Este documento é a referência operacional obrigatória para toda alteração futura neste projeto.

## Identidade fixa do projeto
- Repositório único: `academiaaltfitness1/screenshot-to-scene-8733`.
- Projeto Lovable existente: `6058a297-1ce8-4b91-915f-3c03d4798d03`.
- Branch atualmente conectada ao Lovable: `altfitness/implementacao-prd-2026-11-24`.
- Branch `main`: preservar; não substituir nem apagar durante a consolidação.
- Projeto Supabase ativo confirmado: `xyyuvwyyneadvkfwbvfb`.

## Regras que não podem ser quebradas
1. Nunca criar outro repositório, outro projeto Lovable ou outro projeto Supabase para continuar este trabalho.
2. Nunca criar branches novas para cada pedido. Trabalhar na linha existente e só mudar a referência oficial mediante plano de consolidação verificado.
3. Nunca fazer force-push, reset destrutivo, exclusão de branch, substituição integral de código ou merge automático sem comparar os históricos e preservar pontos de recuperação.
4. Nunca apagar ou recriar tabelas, dados, usuários, autenticação, políticas RLS ou configurações Supabase como tentativa de sincronização.
5. Preservar ALT Desktop, ALT Admin, ALT Aluno, rotas, componentes, estilos e funcionalidades existentes. Alterações devem ser incrementais.
6. Antes de cada tarefa, recuperar este documento e o estado atual do GitHub/Lovable/Supabase; verificar branch, SHA e alterações pendentes.
7. Um novo pedido do usuário acrescenta ou ajusta o escopo; não reinicia o projeto nem autoriza trocar repositório, branch ou arquitetura.
8. Registrar decisões, arquivos alterados, migrações, testes e commit. Não declarar concluído sem evidência.
9. Não executar migrações no banco ativo até comparar o schema e o histórico de migrações, validar o destino e confirmar que a operação é segura e não destrutiva.
10. Não afirmar que GitHub e Lovable estão sincronizados sem verificar o mesmo SHA na branch conectada.

## Protocolo obrigatório antes de qualquer alteração
- Confirmar repositório e branch existentes.
- Consultar o SHA atual e comparar com o último estado conhecido.
- Verificar se há alterações ou commits em outras branches que precisam ser preservados.
- Ler os arquivos relacionados e entender o comportamento atual.
- Definir a menor alteração necessária; não refatorar áreas não relacionadas.
- Executar verificações/testes disponíveis.
- Fazer commit na branch existente e conferir o SHA resultante.
- Conferir se o Lovable reconheceu exatamente esse SHA.
- Se houver divergência, parar novas alterações de sincronização e investigar; não criar uma nova linha de desenvolvimento.

## Estado conhecido em 2026-11-26
- Comparação entre `main` e `altfitness/implementacao-prd-2026-11-24`: divergente.
- Na comparação consultada, a branch do Lovable estava 272 commits à frente e 17 atrás da `main`.
- O Lovable confirmou o SHA `fb6a2f1ab9ebcecf323eaa9daf8ef8a71e462e6c` antes da atualização deste documento.
- A `main` apontava para `07d145a8b71a079d4bda3a5606ada732f5a4adee`.
- Existem branches de backup `backup/pre-consolidacao-lovable-2026-11-26` e `backup/pre-consolidacao-main-2026-11-26`.
- Em 2026-11-26, o Lovable confirmou o SHA `fb6a2f1ab9ebcecf323eaa9daf8ef8a71e462e6c`; depois, o GitHub recebeu o commit `e20861f7212258dae7610e38011cdb7a812808a7` com a atualização deste documento. A sincronização do commit `e20861f` ainda precisa ser confirmada no Lovable. Isso não é consolidação com `main`.
- A comparação encontrou 72 arquivos diferentes entre as pontas das branches; a branch conectada contém a implementação do ALT Aluno, painel móvel administrativo, integrações Henry/QR e migrações adicionais. Não descartar esses arquivos.
- A branch conectada ainda tem `supabase/config.toml` apontando para `btcltrckmbmnbkbwmzid`, enquanto o projeto Supabase disponível na conta conectada é `xyyuvwyyneadvkfwbvfb`. Não executar migrações até resolver o destino.
- O histórico de migrações consultado no Supabase ativo contém 10 entradas; o journal do código da branch conectada contém 18 entradas (0000 a 0017). É necessária reconciliação migração por migração, sem reaplicar operações cegamente.
- PR #2 permanece aberta de `altfitness/implementacao-prd-2026-11-24` para `main` e trata da catraca Henry; não mesclar essa PR isoladamente porque a `main` não contém ainda toda a base de funcionalidades da branch conectada.
- A sincronização Lovable ↔ branch conectada está confirmada neste SHA; a integração entre branch conectada e `main` continua pendente.

## Regra de continuidade
Em caso de dúvida, não adivinhar, não criar outro caminho e não sobrescrever. Consultar o histórico, este documento e os estados reais dos serviços; preservar o trabalho e explicar o bloqueio antes de qualquer ação arriscada.
