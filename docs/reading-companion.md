# Companheiro de leitura

O mascote aparece na tela de planos para usuários autenticados, inclusive antes da criação do primeiro plano. O desenho em pixel art acompanha as cores e a tipografia existentes, sem cobrir os controles de leitura. Nome, humor e motivos ficam visíveis; a expressão não depende apenas da cor.

Cada ID de usuário recebe uma escolha pseudoaleatória e determinística entre Pipo (gato), Lumi (coelho), Nino (urso) e Tito (pintinho). A versão da chave em `getCompanion` deve permanecer estável para preservar a escolha entre dispositivos e sessões. Não exige migração nem gravação de dados pessoais.

## Regras

- Sem plano: curioso; com questionários recentes, animado.
- Plano atrasado, sem questionários recentes: com saudade.
- Plano atrasado, com questionários recentes: esperançoso, mantendo o aviso de atraso.
- Plano em dia: feliz; com pelo menos 80% de acertos recentes, radiante.
- Plano concluído: radiante.
- Questionários: janela móvel dos últimos sete dias; acertos ponderados pelo total de questões respondidas. Resultados futuros ou com data inválida não participam.
- Falha na consulta: informa indisponibilidade; o plano ainda determina o humor. Não simula resultados.

Os dados de questionários vêm da rota autenticada existente `/quiz-results/me`. A consulta é renovada ao entrar na tela, cancelada ao sair e limitada a dez segundos. O progresso do plano atualiza após marcar a leitura. A animação para fora da tela e respeita a preferência de movimento reduzido.

Validação automatizada: `TZ=America/Recife node --test scripts/test-reading-companion.cjs scripts/test-reading-plan-status.cjs`. A inspeção visual final deve ser feita no aplicativo, incluindo fonte ampliada, retorno de questionário, troca de conta, modo offline e movimento reduzido.
