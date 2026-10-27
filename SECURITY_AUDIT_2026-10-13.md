# Relatório de verificação de segurança — 2026-10-13

## Resumo

Não foi observado bypass de autenticação. As rotas administrativas testadas sem credenciais responderam `401 Unauthorized`. Foram aplicadas correções no código para os riscos encontrados nas rotas públicas. Também foi corrigida em produção uma exposição direta da API na porta `1999`.

## Escopo e método

- Verificações web de baixo impacto no site e no endpoint administrativo.
- Revisão estática das rotas e do código de autenticação administrativa.
- Testes da API em `127.0.0.1`, conectada a um schema MySQL isolado.
- Verificação de autenticação, gabarito e pontuação; nenhuma credencial real foi usada.
- Requisições web públicas de leitura e preflight CORS, sem extrair dados pessoais do ranking.
- Nenhum teste de carga, força bruta, alteração de dados de produção ou exploração de bypass foi realizado.

O teste local usou um schema e um usuário dedicados; ambos e o encaminhamento TCP privado do Tailscale foram removidos após a execução. O Tailscale SSH permanece habilitado. A API de produção agora escuta apenas em `127.0.0.1:1999`; a verificação externa da porta `1999` falhou ao conectar, enquanto `https://bibliafoco.com.br/api/` continuou respondendo `200` pelo Apache.

## Resultados

### 1. Rate limit do login administrativo — corrigido no código

`POST /admin/login` agora tem limite de 5 tentativas por IP/rota em 15 minutos. O middleware usa a rota padronizada, evitando criar um bucket separado para cada parâmetro ou query string. `request.ip()` confia somente no proxy Apache local `127.0.0.1`.

O limite continua armazenado em memória por processo; produção com múltiplas instâncias deve usar armazenamento compartilhado. As rotas públicas de custo elevado também receberam limites específicos.

**Operação:** proteger contra excesso entre instâncias com rate limiter compartilhado no proxy/WAF/Redis antes de escalar horizontalmente.

### 2. Credenciais fixas no comando de criação de administrador — corrigido no código

`api/commands/create_admin_user.ts` agora exige `BOOTSTRAP_ADMIN_EMAIL` e uma senha temporária com pelo menos 12 caracteres. A senha não é impressa. O guia e as instruções do projeto não contêm mais as credenciais padrão.

Não foi verificado se a senha padrão antiga já foi usada em produção.

**Ação operacional:** se o comando antigo foi executado em produção, revisar a conta criada e rotacionar a senha.

### 3. Respostas de autenticação observadas

- `GET /api/admin/me` sem token: `401 Unauthorized`.
- `POST /api/admin/login` com dados fictícios: `401` com mensagem genérica de credenciais inválidas.
- API local isolada: as mesmas respostas de negação, sem sucesso de autenticação ou acesso a dados administrativos.

**Resultado:** nenhum bypass foi demonstrado; isso não constitui prova de ausência de outras falhas.

### 4. Cabeçalhos e identificação do servidor — corrigido em produção

O Apache foi configurado com `ServerTokens Prod` e `ServerSignature Off`; a resposta observada agora divulga somente `Server: Apache`. As respostas HTTPS do site e da API incluem HSTS, CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` e `Permissions-Policy`. O painel carregou sem erros de console após a política CSP ser aplicada.

As mudanças do vhost e do arquivo de segurança do Apache foram aplicadas diretamente no servidor da DigitalOcean. O repositório também contém as políticas para o painel e a API nos próximos deploys; mantenha as diretivas do servidor refletidas na configuração de infraestrutura.

## Limitações

Não foram testados login com usuário real, recuperação de senha, permissões entre papéis, upload, endpoints de escrita, exploração de vulnerabilidades ou capacidade sob carga. A proteção de rate limit possivelmente existente fora da aplicação não foi avaliada; o resultado observado cobre o conjunto limitado descrito acima.

## Verificações adicionais

### Autorização administrativa

Sem token, estas rotas responderam `401`: `/api/admin/users`, `/api/admin/audit-logs`, `/api/admin/reports/general-stats` e `/api/admin/roles`. A revisão de `api/start/routes.ts:244–401` mostra autenticação e middleware administrativo aplicados ao grupo de rotas protegidas.

### Recuperação de senha e CORS

- `POST /api/password/forgot` com um endereço fictício `.invalid` respondeu `200` com mensagem genérica, sem revelar se a conta existe.
- Preflight CORS com `Origin: https://evil.invalid` respondeu `204`, sem `Access-Control-Allow-Origin` ou `Access-Control-Allow-Credentials`.

### Dependências

Foi executado `npm audit fix` sem `--force` e depois `npm audit --omit=dev` em API, painel administrativo e aplicativo móvel.

| Área | Alertas | Destaques da árvore de dependências |
| --- | --- | --- |
| API | 19: 7 moderados, 12 altos, 0 críticos | O `proxy-addr` crítico foi atualizado para `2.0.8`. Permanecem advisories em versões atuais do AdonisJS e dependências transitivas; a correção automática exige atualização major do framework. |
| Painel admin | 0 | Os alertas de DOMPurify e fflate foram corrigidos por atualização compatível. |
| Aplicativo móvel | 45: 21 moderados, 24 altos, 0 críticos | Permanecem alertas em transitivos de Expo/Metro e ferramentas. Corrigir todos automaticamente exigiria atualizações incompatíveis de Expo/React Native. |

O Japa foi fixado em `10.3.0` para manter compatibilidade com Node 22. Os alertas restantes devem ser tratados numa atualização coordenada de major do AdonisJS e do Expo; `npm audit fix --force` não foi usado.

## Revisão estática das rotas públicas

Os itens abaixo foram encontrados na revisão dos handlers. As correções indicadas estão no código local; não foi necessário ler dados pessoais para validá-las.

| Rota pública | Correção aplicada no código | Prioridade original |
| --- | --- | --- |
| `GET /ranking` e `/ranking/page` | Removidos e-mails e hábitos detalhados; ranking anonimizado, limitado a 100 entradas, HTML escapado. | Alta |
| `GET /quizzes/:id`, `POST /generate-quiz` e `POST /quiz-results` | Gabaritos removidos; servidor calcula pontuação a partir das respostas armazenadas e mantém só o primeiro resultado por usuário/quiz. O app não recebe a chave durante o quiz. | Alta para integridade |
| `POST /password/forgot`, `/password/verify-token`, `/password/reset` | Mensagem de solicitação unificada; tokens HMAC e no máximo cinco tentativas por token, mantidas no banco entre reinícios. | Média |
| `POST /auth/register`, `/auth/verify-email` | Resposta indistinguível para e-mails existentes e novos; conta nova exige código antes do login; códigos limitados a cinco tentativas e reenvio sujeito a cooldown. | Média/baixa |
| `POST /curiosities/:id/share` | Limite de chamadas e incremento atômico do contador. | Média/baixa |
| `GET /drive/bibles/:fileId/download` e `/drive/harpa/:fileId/download` | Verifica pasta pai, extensão permitida e tamanho máximo de 250 MiB antes de transmitir; downloads e consultas receberam limites. | Média |
| `GET /drive/bibles` e catálogos/áudio BibleBrain e hinos | Links públicos passaram a ser relativos, em vez de serem montados com o `Host` da requisição, evitando links envenenados por cabeçalho `Host`. | Baixa |
| `GET /bible-brain/video-proxy/.../*` e endpoints públicos de mídia | Wildcard limitado a caminhos relativos seguros dentro da playlist, origem validada, timeout, limite de tamanho da playlist e rate limit. | Média |
| `GET /bible-brain/bibles/:bibleId/audio/:bookId/:chapterNumber` | Parâmetros validados e caminho resolvido confinado ao diretório de áudio. | Média |
| Downloads públicos de Bíblia, hinos, áudio e pacotes | Limites de taxa adicionados às rotas de streaming e proxy. | Média/baixa |
| `GET /quiz-results/ranking` | IDs internos e nomes reais removidos; posições exibem rótulos anônimos. | Baixa/média |

### Rotas públicas que parecem intencionais, com proteções observadas

- `GET /uploads/profile-pictures/:fileName` aceita apenas nomes com caracteres e extensões de imagem permitidos (`auth_controller.ts:459–489`), reduzindo traversal; as imagens continuam públicas por URL.
- Templates de leitura, tipos de plano, catálogos/dicionários e conteúdo de áudio/vídeo continuam públicos por projeto. Downloads de dicionários usam uma chave permitida pelo serviço, e `hymn-audios/stream/:fileId` só transmite arquivos cadastrados e ativos.
- CORS rejeitou a origem externa testada; endpoints administrativos de leitura testados sem token responderam `401`.

## Estado da aplicação e implantação

As correções de API e do app estão no código local e passaram nos testes; elas ainda precisam de deploy coordenado, pois o cadastro agora inclui verificação por e-mail e o app envia respostas do quiz para pontuação no servidor. **Em produção já foram aplicados** o bind da API em loopback, a redução do banner Apache e os cabeçalhos HSTS/CSP e demais cabeçalhos de segurança.

**Verificação local:** `api` typecheck passou em Node 22; os 5 testes funcionais passaram em schema MySQL isolado. O schema, usuário de teste e encaminhamento Tailscale foram removidos após os testes. A lint direcionada dos arquivos de API verificados passou; a lint do app não apresentou erros, apenas avisos preexistentes de variáveis/hooks.
