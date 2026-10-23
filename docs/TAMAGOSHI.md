# Tamagoshi: pontuação mensal

O Tamagoshi começa inativo. O menu do perfil permite ativar, editar o nome, convidar amigos e abrir os cuidados. O nome exibido combina o nome-base com o primeiro nome do usuário, como **Lumi Paulo**.

## Pontos e ranking

- Leitura confirmada: **6 pontos por dia**, independentemente da quantidade de capítulos ou planos.
- Questionário concluído e validado pela API: **2 pontos por dia**, independentemente das tentativas ou questionários.
- Convite de nova conta com e-mail confirmado: **5 pontos por conta**, no mês da confirmação.
- Não há limite de 100, pontos iniciais nem perda de pontos por inatividade.
- O ranking exige login e considera apenas Tamagoshis ativados com pontos no mês corrente. Empates são ordenados pelo ID da conta para garantir paginação estável.
- A pontuação reinicia em **todo dia 1º, às 00:00 de America/Recife**. O filtro mensal é aplicado no servidor, sem depender do app aberto ou de tarefa agendada. O histórico dos meses anteriores é preservado.

O ranking mostra a lista paginada, o mês e a própria posição/pontuação, mesmo fora da página atual. Fica disponível em **Configurar Tamagoshi → Ver ranking do mês**, separado do antigo ranking de quizzes.

## Registro e sincronização

A API mantém `tamagoshi_profiles` e um livro de eventos em `tamagoshi_points`. Cada usuário possui uma entrada única por fonte e dia (leitura/quiz), ou por convite confirmado. O cliente nunca informa valores de pontos ou meses para ganhar pontuação. O registro de leitura é uma confirmação do usuário, limitada ao dia atual do servidor. O app exige conexão para participar do ranking.

A conclusão da leitura do plano, do quiz e do convite registra pontos dentro da transação original. Ao sincronizar, atividades confirmadas no servidor durante o mês corrente também são recuperadas, sem duplicação. Saúde antiga e histórico exclusivamente local não são convertidos em pontos.

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
