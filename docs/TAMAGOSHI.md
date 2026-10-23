# Tamagoshi

Começa desativado. No menu da foto do perfil, **Ativar Tamagoshi** abre a ativação. Depois de ativado, a opção passa a **Configurar Tamagoshi**. Também pode ser acessado pelo perfil. Ativação gera uma espécie/nome inicial persistentes; o usuário pode alterar o nome. Na tela inicial e nos cuidados, o nome exibido combina o nome do mascote com o primeiro nome do usuário (por exemplo, **Lumi Paulo**). O primeiro nome é obtido do perfil na exibição, sem alterar o nome-base salvo do mascote.

Os dados ficam no AsyncStorage, separados pelo ID da conta. Esta versão não sincroniza cuidados ou constância entre dispositivos. Não altera a API nem precisa de deploy do backend.

## Constância e saúde

- Saúde inicial 60; limite 0–100.
- Pelo menos um capítulo confirmado no dia: +6, uma única vez por dia.
- Pelo menos um questionário confirmado pela API no dia: +2, uma única vez por dia.
- Dia inteiro sem leitura: −5. O dia da ativação é isento dessa perda.
- Sono automático fixo de 22:00 a 06:00, sem perda de saúde por sono insuficiente.
- O dia atual não recebe perdas antecipadas.
- Quizzes não substituem a leitura. Vários capítulos no mesmo dia não compensam dias sem leitura.
- A sequência considera datas locais consecutivas, permitindo que o usuário ainda conclua a leitura de hoje.

A conclusão é explícita: **Concluí este capítulo** no fim da leitura na Bíblia ou no plano, ou **Marcar como Lida** ao concluir a leitura do plano. Só abrir o capítulo não registra constância. Leituras e quizzes anteriores à ativação não criam ganhos retroativos.

O diário guarda no máximo uma marca de leitura e uma de quiz por data. As operações de armazenamento são serializadas para não perder atividades concorrentes. Dias anteriores são liquidados uma vez, inclusive após períodos com o app fechado.

## Sono

O sono é fixo das **22:00 às 06:00**, seguindo o relógio local, sem campos de configuração. Nesse período o mascote aparece com olhos fechados e Zs. A leitura continua disponível enquanto ele dorme.

Os horários personalizados anteriormente salvos são normalizados na próxima leitura dos dados, preservando nome, aparência, saúde já registrada e diário. O cálculo ignora horários antigos e não aplica novas perdas por sono insuficiente. A configuração permite apenas alterar o nome.

## Validação

```sh
node scripts/test-tamagoshi.cjs
npx expo export --platform android --output-dir /tmp/readbible-tamagoshi
```

Os testes cobrem fronteiras do sono, constância versus volume, limites de saúde, dia atual/ativação, idempotência, isolamento de contas, escrita concorrente, datas inválidas e validação de configurações.

## Catálogo de companheiros

São 50 nomes e aparências iniciais, distribuídos em dez espécies (cinco por espécie): gato, coelho, urso, pintinho, raposa, cachorro, panda, coala, sapo e pinguim. Cada opção possui nome e combinação de espécie/cor únicos, além de detalhes específicos de orelhas e rosto.

Novas ativações usam `catalogVersion: 2`. Mascotes antigos sem esse campo continuam no catálogo original de quatro opções (`catalogVersion: 1`), preservando a aparência vinculada à semente, o nome escolhido e os cuidados. A seleção usa uma semente persistida e inclui todas as 50 opções.
