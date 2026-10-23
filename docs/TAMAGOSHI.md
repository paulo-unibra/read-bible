# Tamagoshi

Começa desativado. No menu da foto do perfil, **Ativar Tamagoshi** abre a ativação. Depois de ativado, a opção passa a **Configurar Tamagoshi**. Também pode ser acessado pelo perfil. Ativação gera uma espécie/nome inicial persistentes; o usuário pode alterar o nome e os horários.

Os dados ficam no AsyncStorage, separados pelo ID da conta. Esta versão não sincroniza cuidados ou constância entre dispositivos. Não altera a API nem precisa de deploy do backend.

## Constância e saúde

- Saúde inicial 60; limite 0–100.
- Pelo menos um capítulo confirmado no dia: +6, uma única vez por dia.
- Pelo menos um questionário confirmado pela API no dia: +2, uma única vez por dia.
- Dia inteiro sem leitura: −5. O dia da ativação é isento dessa perda.
- Sono configurado menor que 7 horas: −8 por dia encerrado.
- O dia atual não recebe perdas antecipadas.
- Quizzes não substituem a leitura. Vários capítulos no mesmo dia não compensam dias sem leitura.
- A sequência considera datas locais consecutivas, permitindo que o usuário ainda conclua a leitura de hoje.

A conclusão é explícita: **Concluí este capítulo** no fim da leitura na Bíblia ou no plano, ou **Marcar como Lida** ao concluir a leitura do plano. Só abrir o capítulo não registra constância. Leituras e quizzes anteriores à ativação não criam ganhos retroativos.

O diário guarda no máximo uma marca de leitura e uma de quiz por data. As operações de armazenamento são serializadas para não perder atividades concorrentes. Dias anteriores são liquidados uma vez, inclusive após períodos com o app fechado. Configurar novos horários primeiro liquida os dias passados, evitando recalculá-los com o novo horário.

## Sono

Padrão: 22:00–06:00. Horários HH:mm no relógio local, incluindo intervalos que cruzam meia-noite. Intervalos de zero hora ou maiores que 16 horas são rejeitados. Intervalos abaixo de 7 horas são permitidos com aviso explícito sobre perda de saúde.

O sono é simulado pelo horário configurado, não por sensores ou tempo real de uso do celular. A aparência mostra olhos fechados e Zs durante o período. A leitura continua disponível enquanto o mascote dorme. A saúde permanece visível na tela inicial e abre a configuração/cuidados.

## Validação

```sh
node scripts/test-tamagoshi.cjs
npx expo export --platform android --output-dir /tmp/readbible-tamagoshi
```

Os testes cobrem fronteiras do sono, constância versus volume, limites de saúde, dia atual/ativação, idempotência, isolamento de contas, escrita concorrente, datas inválidas e validação de configurações.
