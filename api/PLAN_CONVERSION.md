# Conversão de Planos para 365 Dias

Este documento descreve a funcionalidade de conversão de planos de leitura com mais de 365 dias para exatamente 365 dias.

## 📋 Visão Geral

Alguns usuários criaram planos de leitura em datas que resultaram em mais de 365 dias (por exemplo, se criaram próximo ao final do ano). Esta funcionalidade permite recalcular esses planos para 365 dias sem perder o progresso já realizado.

## 🎯 Funcionalidades

- ✅ Converte planos com mais de 365 dias para exatamente 365 dias
- ✅ Mantém todo o progresso (leituras completadas)
- ✅ Redistribui as leituras de forma proporcional
- ✅ Ajusta automaticamente a data de término
- ✅ **Ajusta a data de início para 1º de janeiro do ANO ATUAL**
- ✅ Recalcula o dia atual baseado no progresso

## 🖥️ Interface Admin

### Como usar no Painel Administrativo:

1. Acesse **Gerenciamento de Usuários**
2. Usuários com planos de mais de 365 dias terão um botão **🔄** na coluna de ações
3. Clique no botão para abrir o modal de conversão
4. Selecione o plano que deseja converter
5. Revise as informações e clique em **Confirmar Conversão**
6. Aguarde a confirmação de sucesso

### Segurança:

- ⚠️ Sempre solicita confirmação antes de converter
- ⚠️ Mostra claramente o que será alterado
- ⚠️ Ação irreversível - confirme com atenção!

## 🔧 API Endpoints

### Listar Planos Convertíveis de um Usuário

```
GET /admin/users/:userId/convertible-plans
```

**Resposta:**

```json
{
  "userId": 123,
  "userEmail": "usuario@email.com",
  "convertiblePlans": [
    {
      "id": 456,
      "name": "Plano Sequencial 2026",
      "type": "sequential",
      "totalDays": 380,
      "currentDay": 50,
      "startDate": "2026-01-01T00:00:00.000Z",
      "endDate": "2027-01-15T23:59:59.000Z",
      "isActive": true,
      "completedChapters": 120
    }
  ]
}
```

### Converter Plano

```
POST /admin/users/:userId/convert-plan
```

**Body:**

```json
{
  "planId": 456
}
```

**Resposta:**

```json
{
  "success": true,
  "message": "Plano convertido com sucesso para 365 dias!",
  "oldTotalDays": 380,
  "newTotalDays": 365,
  "progressMaintained": 120
}
```

## 💻 Linha de Comando

### Listar Planos Convertíveis

```bash
cd api
node ace plan:list-convertible
```

**Saída:**

```
🔍 Buscando planos com mais de 365 dias...

📊 Encontrados 3 plano(s) convertível(is):

┌────┬──────────────────────┬───────────────────┬──────┬───────┬─────────────────┐
│ ID │ Nome                 │ Usuário           │ Dias │ Ativo │ Progresso       │
├────┼──────────────────────┼───────────────────┼──────┼───────┼─────────────────┤
│ 12 │ Plano Sequencial... │ user@email.com    │ 380  │ ✅    │ 120 capítulos  │
│ 45 │ Bíblia Completa     │ outro@email.com   │ 370  │ ✅    │ 200 capítulos  │
│ 78 │ Plano Anual 2026    │ terceiro@email... │ 366  │ ❌    │ 50 capítulos   │
└────┴──────────────────────┴───────────────────┴──────┴───────┴─────────────────┘

💡 Para converter um plano, use: node ace plan:convert-to-365 <PLAN_ID>
```

### Converter um Plano

```bash
cd api
node ace plan:convert-to-365 12
```

**Interação:**

```
🔄 Iniciando conversão do plano para 365 dias...
📋 Plano encontrado: "Plano Sequencial 2026"
📊 Total de dias atual: 380

? Deseja realmente converter este plano de 380 dias para 365 dias? O progresso será mantido. (Y/n) › Y

📊 Plano 12: 380 dias → 365 dias
✅ Progresso atual: 120/500 leituras
🔄 Redistribuindo 500 leituras em 365 dias...
✅ Conversão completa! Novo currentDay: 51
📈 Progresso mantido: 120 leituras completadas

✅ Plano convertido com sucesso!
📊 Dias anteriores: 380
📊 Novos dias: 365
✅ Progresso mantido: 120 leituras
```

## 🔬 Como Funciona

### Algoritmo de Conversão

1. **Verificação**: Confirma que o plano tem mais de 365 dias
2. **Cálculo de Proporção**: `compressionRatio = 365 / totalDays`
3. **Remapeamento de Dias**: Cada dia antigo é mapeado para um novo dia:
   ```typescript
   newDay = Math.ceil(oldDay * compressionRatio)
   ```
4. **Agrupamento**: Leituras do mesmo novo dia são agrupadas
5. **Redistribuição**:
   - Leituras são redistribuídas nos novos dias
   - Status de completude é mantido
   - Data de conclusão é preservada
6. **Atualização do Plano**:
   - `totalDays = 365`
   - `startDate = 1º de janeiro do ano atual`
   - `endDate = 31 de dezembro do ano atual`
   - `currentDay` recalculado baseado no maior dia completado

### Exemplo Prático

**Antes:**

- Início: 15 de novembro de 2025
- Fim: 30 de dezembro de 2026
- Total: 380 dias
- Dia 100 completado
- Dia 101 pendente

**Depois (executado em 2026):**

- **Início: 1º de janeiro de 2026**
- **Fim: 31 de dezembro de 2026**
- Total: 365 dias
- Dia 96 completado (100 × 365/380 ≈ 96)
- Dia 97 pendente (101 × 365/380 ≈ 97)

## ⚠️ Avisos Importantes

1. **Ação Irreversível**: A conversão não pode ser desfeita
2. **Progresso Mantido**: Todas as leituras completadas são preservadas
3. **Redistribuição Proporcional**: Múltiplas leituras podem ser agrupadas no mesmo dia
4. **Backup Recomendado**: Faça backup do banco de dados antes de conversões em massa

## 🧪 Testes

Para testar em desenvolvimento:

1. Crie um plano com mais de 365 dias manualmente no banco
2. Use o comando `node ace plan:list-convertible` para verificar
3. Execute `node ace plan:convert-to-365 <PLAN_ID>`
4. Verifique no painel admin que o plano foi convertido corretamente

## 📝 Logs

Todos os passos da conversão são logados no console:

```
📊 Plano 12: 380 dias → 365 dias
✅ Progresso atual: 120/500 leituras
🔄 Redistribuindo 500 leituras em 365 dias...
✅ Conversão completa! Novo currentDay: 51
📈 Progresso mantido: 120 leituras completadas
```

## 🔐 Permissões

- Requer permissão `gerenciar_usuarios` no painel admin
- Endpoints protegidos por autenticação JWT
- Comandos CLI requerem acesso ao servidor

## 🐛 Troubleshooting

### "O plano já tem X dias"

- Apenas planos com **mais de 365 dias** podem ser convertidos
- Planos com exatamente 365 dias ou menos não precisam de conversão

### "Erro ao converter plano"

- Verifique se o plano existe no banco de dados
- Confirme que há leituras associadas ao plano
- Verifique os logs do servidor para detalhes

### "Usuário não possui planos convertíveis"

- O usuário não tem nenhum plano com mais de 365 dias
- Verifique a data de criação e tipo do plano
