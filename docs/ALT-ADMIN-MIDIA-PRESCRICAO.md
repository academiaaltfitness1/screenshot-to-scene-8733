# ALT FITNESS — instruções de implementação para Lovable

Esta especificação é uma continuação do projeto existente. Não recriar o app, não remover telas/rotas/funcionalidades, não substituir o Supabase atual e não introduzir dados fictícios.

## 1. ALT Desktop
- Remover somente o atalho/botão “App do Aluno” da tela inicial/menu do ALT Desktop.
- Preservar rotas, autenticação e o aplicativo separado ALT Aluno.

## 2. Comunicados no ALT Admin — prioridade e requisito ainda pendente
**Estado observado pelo proprietário:** a área “Comunicado ao Aluno” ainda não apresenta as funções de anexar/enviar imagem e vídeo. Portanto, não considerar esta funcionalidade implementada apenas porque existe uma tela ou campo de texto.

Implementar na própria área “Comunicado ao Aluno”:
- Botão visível “Adicionar imagem” para selecionar arquivo do celular/computador, com pré-visualização, opção de remover/trocar antes de publicar.
- Botão visível “Adicionar vídeo” para selecionar arquivo do celular/computador, com pré-visualização e opção de remover/trocar antes de publicar.
- Aceitar seleção pela galeria/arquivos do Android e seletor de arquivos do computador; permitir mais de uma imagem e, se suportado com segurança, mais de um vídeo.
- Mostrar progresso de upload, erro compreensível, limite/tipo/tamanho aceito e opção de tentar novamente.
- Permitir texto, título, destaque/importante, rascunho, pré-visualização, publicar, editar e despublicar.
- Só exibir o comunicado no ALT Aluno depois de publicado; mídias devem carregar para o aluno autorizado.
- Separar comunicados gerais das mídias vinculadas aos exercícios.
- A interface deve ser responsiva e manter a identidade ALT (preto, amarelo e mascote).

### Critérios obrigatórios de aceite dos comunicados
1. No ALT Admin, o usuário consegue escolher uma imagem do celular e vê-la na prévia antes de publicar.
2. No ALT Admin, o usuário consegue escolher um vídeo do celular e vê-lo na prévia antes de publicar.
3. Após publicar, o comunicado e suas mídias aparecem no ALT Aluno; rascunhos/despublicados não aparecem.
4. Edição/despublicação não apaga arquivos ou histórico de forma destrutiva sem regra explícita.
5. Uploads são persistidos no Supabase Storage com buckets/caminhos separados para comunicados e exercícios, validação de MIME/tamanho e políticas de acesso adequadas.
6. Testar o fluxo real em celular e desktop; não marcar como concluído sem validar upload, leitura no app do aluno e permissões.

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
