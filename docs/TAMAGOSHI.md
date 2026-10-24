# Tamagoshi: pontuação mensal

O Tamagoshi é gerado e ativado automaticamente na mesma transação que cria a conta, antes da confirmação de e-mail. Contas novas começam com zero pontos. Contas existentes sem Tamagoshi recebem um perfil no primeiro acesso autenticado; acessos simultâneos preservam um único perfil. O menu do perfil mostra Configurar Tamagoshi para editar o nome, convidar amigos e abrir o ranking. O nome exibido é somente o nome do Tamagoshi, como **Lumi**, e pode ser editado pelo usuário. O nome real do usuário não é acrescentado.

## Pontos e ranking

- Plano criado com Tamagoshi ativo: **10 pontos por plano**, sem duplicar na sincronização. Excluir o plano retira o bônus. Planos válidos criados no mês corrente também entram no retroativo.
- Leitura confirmada: **6 pontos por dia**, independentemente da quantidade de capítulos ou planos.
- Desmarcar a última leitura concluída de uma data retira os 6 pontos daquele dia e atualiza a constância/expressão. Excluir um plano também retira créditos que dependam apenas dele. Outra leitura válida do mesmo dia mantém o crédito, inclusive capítulo livre confirmado separadamente. Pontos de quizzes e convites permanecem.
- Questionário concluído e validado pela API: **2 pontos por dia**, independentemente das tentativas ou questionários.
- Convite de nova conta com e-mail confirmado: **5 pontos por conta**, no mês da confirmação.
- Não há limite de 100, pontos iniciais nem perda de pontos por inatividade.
- O ranking exige login e considera apenas Tamagoshis ativados com pontos no mês corrente. Empates são ordenados pelo ID da conta para garantir paginação estável.
- A pontuação reinicia em **todo dia 1º, às 00:00 de America/Recife**. O filtro mensal é aplicado no servidor, sem depender do app aberto ou de tarefa agendada. O histórico dos meses anteriores é preservado.

O ranking mostra os cinco participantes do pódio e carrega a classificação em blocos de 10, automaticamente ao se aproximar do fim da lista (lazy loading). Requisições simultâneas são bloqueadas e, se houver falha, a lista permanece visível com uma opção de tentar novamente. O mês e a própria posição/pontuação permanecem disponíveis, mesmo fora da página atual. Fica disponível em **Configurar Tamagoshi → Ver ranking do mês**, separado do antigo ranking de quizzes. As posições de **1º a 5º** formam o pódio; os demais aparecem na classificação, sem duplicar os participantes do pódio. O Tamagoshi da própria conta fica destacado com a indicação Seu Tamagoshi; avatar, nome, posição e pontos também aparecem no topo, mesmo fora da página carregada.

## Registro e sincronização

A API mantém `tamagoshi_profiles` e um livro de eventos em `tamagoshi_points`. Cada usuário possui uma entrada única por fonte e dia (leitura/quiz), ou por convite confirmado/plano criado. O cliente nunca informa valores de pontos ou meses para ganhar pontuação. O registro de leitura é uma confirmação do usuário, limitada ao dia atual do servidor. O app exige conexão para participar do ranking.

A conclusão da leitura do plano, do quiz e do convite registra pontos dentro da transação original. A pontuação considera atividades válidas desde o dia 1º do mês corrente no horário de Recife, mesmo quando anteriores à criação do Tamagoshi. A recuperação é idempotente e inclui leitura, quiz, convites confirmados e bônus de planos válidos. Contas existentes podem receber pontos retroativos; contas recém-cadastradas não possuem atividades anteriores e começam zeradas. Saúde antiga e histórico exclusivamente local não são convertidos em pontos.

A migração `1793200000001_track_free_reading_points` distingue confirmação de capítulo livre de conclusão de plano. O app não registra conclusão de plano como capítulo livre. Ao desmarcar, a API reconcilia os créditos na mesma transação; na sincronização também remove créditos sem leitura que os sustente. `readingHistory` substitui o histórico local de constância, incluindo meses anteriores, para que leituras removidas não mantenham a expressão feliz. Planos excluídos são preservados para auditoria, mas suas leituras não entram na recuperação nem na validação de pontos.

Leituras livres feitas offline ficam pendentes no aparelho. Precisam ser sincronizadas ainda no mesmo dia de Recife; o app informa essa condição. Pendências anteriores não são creditadas em outro dia ou mês. Um total em cache de mês anterior é exibido como zero após a virada, inclusive offline.

Nome e aparência são sincronizados por conta, permitindo recuperar o Tamagoshi em outro aparelho. Ao migrar os dados locais antigos, preservam-se nome, aparência e diário; descartam-se saúde e contadores antigos de bônus. O catálogo original continua preservado para mascotes antigos. O catálogo novo contém 50 nomes/aparências em 10 espécies.

## Sono e expressões

Sono automático fixo **22:00–06:00 no relógio local**, sem configuração. As expressões dependem da constância de leitura e não do total mensal, então a virada do mês não apaga a sequência. Quizzes e convites ajudam nos pontos; vários capítulos no mesmo dia não substituem a constância.

## API e validação

- `GET /tamagoshi`: perfil e pontuação do mês.
- `POST /tamagoshi/activate`: ativação idempotente.
- `PUT /tamagoshi`: alteração do nome.
- `POST /tamagoshi/reading`: confirmação da leitura no dia atual.
- `GET /tamagoshi/ranking?page=1`: primeira resposta com pódio (até 5) e até 10 participantes da classificação; páginas seguintes trazem até 10 posições, sem repetir o pódio. `hasMore` indica se há próxima página.

Todos exigem autenticação. Publicar a API e aplicar `1793200000000_create_tamagoshi_points` antes de usar os endpoints em produção.

Testes: `scripts/test-ranking-loading.cjs`, `scripts/test-tamagoshi.cjs`, `scripts/test-referral-service.cjs` e os testes funcionais da API `tamagoshi_points`, `public_quiz_security` e `referrals`. Os funcionais usam um MySQL temporário, nunca produção.

## Contas existentes: geração em lote

`scripts/backfill-existing-tamagoshis.cjs --bundle` gera uma rotina de manutenção independente usando o catálogo e o serviço de pontuação deste checkout. Execute o arquivo gerado a partir do diretório da API para usar suas dependências e ambiente. Sem `--apply`, ele apenas informa quantos perfis faltam.

Com `--apply`, a rotina cria somente os perfis ausentes, em transações de 25 contas, e recupera os pontos válidos do mês corrente. Perfis existentes não são alterados. Mantém um arquivo restrito em `../backups` (ou `READBIBLE_BACKUP_DIR`) com os IDs planejados e confirmados, registra `tamagoshi.bulk_create` na auditoria e confere a cobertura ao terminar. Repetir a execução não duplica perfis nem pontos. Essa manutenção não publica a API.
