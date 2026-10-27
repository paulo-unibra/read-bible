# Certificados e medalhas de leitura

A tela inicial de planos destaca o certificado mais recente. O perfil lista todos os certificados e a medalha de cada plano concluído. Cada certificado pode ser aberto e compartilhado em PDF, com nome do leitor, plano, capítulos, data da última leitura e código de registro.

## Critério de conclusão

A API verifica todos os registros de leitura do plano: nenhum pode estar pendente e o número de capítulos distintos precisa alcançar o total do plano. Capítulos repetidos não contam duas vezes. O contador `completed_chapters` não é usado para conceder conquistas.

`POST /achievements/sync` exige autenticação, consulta somente planos do usuário e reconhece conclusões anteriores. A restrição única por plano impede certificados duplicados em chamadas simultâneas. Certificados emitidos ficam salvos mesmo após exclusão do plano ou desmarcação posterior de uma leitura. O nome do leitor e do plano são preservados como estavam na emissão. A medalha acompanha o certificado e identifica o tipo de plano.

## Publicação

Aplicar a migração `1793300000000_create_reading_certificates` antes de disponibilizar a rota da API. Depois, distribuir uma nova build do aplicativo. A funcionalidade não depende de novas bibliotecas nativas.

## Verificação

- `node scripts/test-certificates.cjs`: elegibilidade, leituras duplicadas, data de conclusão, sessão, isolamento entre usuários, concorrência, preservação da conquista e conteúdo do PDF.
- `CERTIFICATES_TEST_SOCKET=/tmp/.../mysql.sock node scripts/test-certificates-db.cjs`: migrações reais e persistência em uma instância MySQL isolada, sem carregar o `.env` do projeto. Cria e remove somente o banco de teste nessa instância.
- `npm run typecheck --prefix api`.
- Exportação do bundle Android com `expo export --platform android`.

## Revisão do nome antes da conclusão

Quando restam de um a cinco dias de leitura, a tela inicial do plano oferece “Revisar nome no certificado”. O botão abre diretamente a edição do nome no perfil, com orientação para conferir o nome completo. A alteração usa o endpoint existente de perfil e só é confirmada localmente depois do sucesso do servidor, para que a emissão receba o mesmo nome.

A contagem usa os dias ainda não concluídos, não a distância até a data final. Quando a cobertura de todos os capítulos está disponível no dispositivo, considera os dias reais do cronograma (que pode terminar antes da data limite). Em cronogramas carregados parcialmente, usa o total de dias e o progresso confirmado, evitando tratar os primeiros cinco dias baixados como o plano inteiro.

Verificação: `node scripts/test-certificate-name.cjs`.
