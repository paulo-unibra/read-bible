# Convites e bônus de saúde

Cada conta possui um código permanente de 12 caracteres e um link público. O menu do perfil contém **Convidar amigos**, com compartilhamento nativo e cópia do código. A tela de cuidados do Tamagoshi também abre essa opção.

## Cadastro e recompensa

- O cadastro aceita `inviteCode` opcional. O aplicativo omite o campo quando estiver vazio.
- O link público mostra o código, os links das lojas e um botão para `readbible://auth?mode=register&invite=CODIGO`.
- O esquema `readbible` já está configurado para os builds nativos. No Expo Go, o código pode ser digitado manualmente; ele não registra o esquema próprio do aplicativo.
- O cadastro por link preenche o campo, e o código pendente é preservado localmente até o envio do cadastro.
- O código precisa existir e pertencer a uma conta confirmada.
- O vínculo só é criado no primeiro cadastro. Contas existentes, inclusive a do próprio convidador, não recebem um novo vínculo em tentativas de cadastro posteriores.
- A recompensa é de **5 pontos de saúde para quem convidou**, após a nova conta confirmar o e-mail. Compartilhar ou clicar no link não concede pontos.
- A confirmação usa transação, bloqueio de usuário e atualização condicional. Repetir ou concorrer confirmações não gera um segundo bônus.

## Persistência

A migração `1793100000000_create_user_referrals` cria:

- `invite_codes`: um código único por usuário;
- `user_referrals`: um vínculo único por nova conta, os pontos e a data de liberação.

O histórico de pontos liberados permanece se a conta convidada for excluída. Contas pendentes excluídas deixam de aparecer na contagem de pendentes.

`GET /referrals/me` exige autenticação e retorna apenas os totais da própria conta, sem dados pessoais dos convidados. `GET /invite/:code` é uma página pública com limitação de requisições e não revela o nome/e-mail do convidador.

O Tamagoshi consulta os totais do servidor ao abrir os cuidados, a tela de convite ou a tela inicial. O contador local `claimedInvitePoints` consome somente a diferença ainda não recebida e impede duplicação em consultas simultâneas. A saúde continua limitada a 100: excedentes não ficam disponíveis para recuperar saúde novamente depois. Antes da ativação, os pontos continuam guardados no servidor. A saúde em si permanece local ao aparelho, como no restante do Tamagoshi.

## Publicação

É necessário publicar a API e executar a migração antes de usar os novos endpoints em produção. `PUBLIC_API_URL` é opcional; o padrão é `https://bibliafoco.com.br/api`. Para homologação, configure a URL pública do ambiente. Os builds do app devem incluir as alterações do cadastro e convites.

## Validação

- Teste funcional `api/tests/functional/referrals.spec.ts`: código estável, autenticação, página pública, código inválido, cadastro sem código, pendência sem pontos, confirmação concorrente, bônus único e contas existentes.
- Regressão `api/tests/functional/public_quiz_security.spec.ts`: pontuação, confirmação de e-mail e limitação de acesso.
- `node scripts/test-tamagoshi.cjs`: bônus de convite, persistência, isolamento de contas, idempotência e limite de saúde, além das regras diárias.

Os testes funcionais foram executados em um MySQL temporário local, com e-mails simulados. Não usar banco de produção para testes.
