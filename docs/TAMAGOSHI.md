# Tamagoshi: pontuação mensal

O Tamagoshi começa ativo por padrão e com zero pontos. No primeiro acesso autenticado, a API gera automaticamente nome e aparência; acessos simultâneos preservam um único perfil. O menu do perfil mostra Configurar Tamagoshi para editar o nome, convidar amigos e abrir o ranking. O nome exibido combina o nome-base com o primeiro nome do usuário, como **Lumi Paulo**.

## Pontos e ranking

- Plano criado com Tamagoshi ativo: **10 pontos por plano**, sem duplicar na sincronização. Excluir o plano retira o bônus. Planos anteriores à ativação não pontuam.
- Leitura confirmada: **6 pontos por dia**, independentemente da quantidade de capítulos ou planos.
- Desmarcar a última leitura concluída de uma data retira os 6 pontos daquele dia e atualiza a constância/expressão. Excluir um plano também retira créditos que dependam apenas dele. Outra leitura válida do mesmo dia mantém o crédito, inclusive capítulo livre confirmado separadamente. Pontos de quizzes e convites permanecem.
- Questionário concluído e validado pela API: **2 pontos por dia**, independentemente das tentativas ou questionários.
- Convite de nova conta com e-mail confirmado: **5 pontos por conta**, no mês da confirmação.
- Não há limite de 100, pontos iniciais nem perda de pontos por inatividade.
- O ranking exige login e considera apenas Tamagoshis ativados com pontos no mês corrente. Empates são ordenados pelo ID da conta para garantir paginação estável.
- A pontuação reinicia em **todo dia 1º, às 00:00 de America/Recife**. O filtro mensal é aplicado no servidor, sem depender do app aberto ou de tarefa agendada. O histórico dos meses anteriores é preservado.

O ranking mostra a lista paginada, o mês e a própria posição/pontuação, mesmo fora da página atual. Fica disponível em **Configurar Tamagoshi → Ver ranking do mês**, separado do antigo ranking de quizzes.

## Registro e sincronização

A API mantém `tamagoshi_profiles` e um livro de eventos em `tamagoshi_points`. Cada usuário possui uma entrada única por fonte e dia (leitura/quiz), ou por convite confirmado/plano criado. O cliente nunca informa valores de pontos ou meses para ganhar pontuação. O registro de leitura é uma confirmação do usuário, limitada ao dia atual do servidor. O app exige conexão para participar do ranking.

A conclusão da leitura do plano, do quiz e do convite registra pontos dentro da transação original. O Tamagoshi começa com zero pontos. Ao sincronizar, apenas atividades confirmadas no servidor no mês corrente e realizadas desde a ativação são recuperadas, sem duplicação. Leituras, questionários e convites anteriores à criação não pontuam. Saúde antiga e histórico exclusivamente local não são convertidos em pontos.

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
- `GET /tamagoshi/ranking?page=1`: classificação mensal paginada.

Todos exigem autenticação. Publicar a API e aplicar `1793200000000_create_tamagoshi_points` antes de usar os endpoints em produção.

Testes: `scripts/test-tamagoshi.cjs`, `scripts/test-referral-service.cjs` e os testes funcionais da API `tamagoshi_points`, `public_quiz_security` e `referrals`. Os funcionais usam um MySQL temporário, nunca produção.
