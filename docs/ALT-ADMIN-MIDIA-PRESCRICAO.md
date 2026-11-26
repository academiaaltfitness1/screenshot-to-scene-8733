# ALT FITNESS — instruções de implementação para Lovable

Esta especificação é uma continuação do projeto existente. Não recriar o app, não remover telas/rotas/funcionalidades, não substituir o Supabase atual e não introduzir dados fictícios.

## 1. ALT Desktop
- Remover somente o atalho/botão “App do Aluno” da tela inicial/menu do ALT Desktop.
- Preservar rotas, autenticação e o aplicativo separado ALT Aluno.

## 2. Comunicados no ALT Admin
- Criar área administrativa para criar, editar, pré-visualizar, publicar e despublicar comunicados.
- Cada comunicado aceita texto e mídias (imagens e vídeos), upload pelo dispositivo e opção de destaque/importante.
- Comunicado publicado aparece no ALT Aluno.
- Manter comunicados gerais separados das mídias vinculadas aos exercícios.

## 3. Mídia na prescrição de exercícios
- Na edição/prescrição de cada exercício, permitir anexar uma ou mais imagens e vídeos demonstrativos.
- Permitir legenda e instruções de execução; pré-visualizar antes de salvar.
- Reutilizar mídia já cadastrada quando apropriado.
- No ALT Aluno, exibir as mídias e instruções em modo somente leitura; o aluno não edita a prescrição.

## 4. Aplicar modelo e preservar histórico
- Disponibilizar “Aplicar este modelo” com confirmação clara.
- Aplicar a nova prescrição sem apagar registros de execução, cargas, repetições ou histórico anterior do aluno.
- Preservar versões/atribuição anterior de treinos, usando estratégia aditiva compatível com o esquema atual.

## 5. Dados, armazenamento e segurança
- Antes de alterar o banco, inspecionar tabelas, migrations, buckets e policies existentes.
- Usar Supabase Storage com acesso restrito e políticas RLS adequadas aos papéis e vínculos existentes.
- Nunca expor service_role no cliente.
- Fazer somente migrations aditivas; não usar DROP, TRUNCATE nem apagar dados.
- Separar caminhos/entidades de mídia de comunicados e de exercícios.

## 6. Entrega e validação
- Manter identidade visual ALT existente: fundo preto, botões amarelos e mascote tubarão.
- Responsivo em celular e desktop.
- Executar build, typecheck e testes disponíveis; corrigir erros antes de declarar pronto.
- Atualizar documentação/roadmap apenas com o que estiver realmente implementado e validado.
- Não publicar/deployar em produção sem confirmação.
- Não consumir créditos pagos nem solicitar upgrade sem autorização explícita.
