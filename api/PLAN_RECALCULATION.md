# Recálculo de Livros dos Planos de Leitura

Este documento descreve a funcionalidade de recálculo dos livros de um plano de leitura, corrigindo erros onde o mesmo livro aparecia múltiplas vezes no mesmo dia.

## 📋 Visão Geral

Havia um bug antigo no sistema onde, ao criar planos de leitura, quando o usuário tinha que ler dois livros no mesmo dia (por exemplo, os últimos capítulos de Gênesis e os primeiros de Êxodo), o sistema gravava incorretamente o nome do livro.

**Exemplo do erro:**
- ❌ **Errado**: Gênesis 49-50 e Gênesis 1-2
- ✅ **Correto**: Gênesis 49-50 e Êxodo 1-2

Esta funcionalidade recalcula todo o plano de leitura mantendo o progresso do usuário.

## 🎯 Funcionalidades

- ✅ Recalcula todas as leituras do plano sequencialmente
- ✅ Mantém todo o progresso (dias já lidos permanecem marcados)
- ✅ Corrige os nomes dos livros nas leituras
- ✅ Distribui os capítulos corretamente entre os livros da Bíblia
- ✅ Preserva as datas de conclusão das leituras completadas

## 🖥️ Interface Admin

### Como usar no Painel Administrativo:

1. Acesse **Gerenciamento de Usuários**
2. Usuários com planos ativos terão um botão **📚** na coluna de ações
3. Clique no botão para abrir o modal de recálculo
4. Revise as informações sobre a operação
5. Clique em **Confirmar Recálculo**
6. Aguarde a confirmação de sucesso

### Segurança:

- ⚠️ Sempre solicita confirmação antes de recalcular
- ⚠️ Mostra claramente o que será alterado
- ✅ Mantém o progresso do usuário
- ℹ️ Informa quantas leituras foram corrigidas

## 🔧 API Endpoints

### Recalcular Livros do Plano

```
POST /admin/users/:userId/recalculate-plan
```

**Body (opcional):**
```json
{
  "planId": 456
}
```

Se `planId` não for fornecido, o backend busca automaticamente o plano ativo do usuário.

**Resposta:**
```json
{
  "success": true,
  "message": "Plano recalculado com sucesso!",
  "correctedReadings": 15,
  "progressMaintained": 120
}
```

### Verificar Duplicatas em um Plano

```
GET /admin/users/:userId/plan/:planId/check-duplicates
```

**Resposta:**
```json
{
  "hasDuplicates": true,
  "duplicateDays": [45, 89, 134, 178, 223]
}
```

## 💻 Linha de Comando

### Recalcular Livros de um Plano

```bash
cd api
node ace plan:recalculate-books <PLAN_ID>
```

**Interação:**
```
📚 Iniciando recálculo dos livros do plano...
📋 Plano encontrado: "Plano Sequencial 2026"
📅 Total de dias: 365

⚠️  Encontradas duplicatas nos dias: 45, 89, 134, 178, 223

? Deseja recalcular este plano? O progresso será mantido, mas os livros serão redistribuídos. (Y/n) › Y

📚 Recalculando livros do plano 12: "Plano Sequencial 2026"
✅ Progresso atual: 120/365 leituras
📖 Total de capítulos: 1189
📅 Total de dias: 365
📊 Capítulos por dia: 4
🔄 Geradas 365 novas leituras
✅ Recálculo completo!
📈 Progresso mantido: 120 dias
🔧 Leituras corrigidas: 15

✅ Plano recalculado com sucesso!
🔧 Leituras corrigidas: 15
📈 Progresso mantido: 120 dias
```

## 🔬 Como Funciona

### Algoritmo de Recálculo

1. **Backup do Progresso**: Salva quais dias estavam completados
2. **Cálculo de Capítulos**: 
   - Total da Bíblia: 1189 capítulos
   - Capítulos por dia = `Math.ceil(1189 / totalDays)`
3. **Geração Sequencial**: Distribui os capítulos sequencialmente pelos livros
4. **Aplicação do Progresso**: Marca os novos dias como completados se estavam completados antes
5. **Preservação de Datas**: Mantém a data original de conclusão

### Exemplo Prático

**Antes (com erro):**
- Dia 45: Gênesis 49-50 ✅ (completado)
- Dia 45: Gênesis 1-2 ✅ (completado) ← ERRO: deveria ser Êxodo

**Depois (corrigido):**
- Dia 45: Gênesis 49-50 ✅ (completado - mantido)
- Dia 45: Êxodo 1-2 ✅ (completado - mantido) ← CORRIGIDO

### Distribuição Sequencial

O algoritmo distribui os capítulos seguindo a ordem da Bíblia:

```typescript
Gênesis (50 capítulos) → Êxodo (40 capítulos) → Levítico (27 capítulos) → ...
```

Cada dia recebe aproximadamente 3-4 capítulos, garantindo cobertura completa da Bíblia.

## ⚠️ Avisos Importantes

1. **Apenas Planos Ativos**: O recálculo funciona apenas no plano ativo do usuário
2. **Progresso Mantido**: Todos os dias marcados como lidos permanecem marcados
3. **Redistribuição**: A distribuição dos livros pode mudar, mas o total de capítulos permanece o mesmo
4. **Não Afeta Backend Original**: Planos criados após a correção do bug não precisam de recálculo

## 🧪 Quando Usar

Use esta funcionalidade quando:

- ✅ Encontrar o mesmo livro múltiplas vezes no mesmo dia
- ✅ Identificar leituras que não seguem a sequência correta da Bíblia
- ✅ Usuários reportarem inconsistências nos livros do plano
- ✅ Após migração de dados de sistemas antigos

**Não use quando:**
- ❌ O plano foi criado recentemente (após correção do bug)
- ❌ O plano é customizado (não sequencial)
- ❌ O usuário personalizou manualmente as leituras

## 🐛 Troubleshooting

### "Usuário não possui plano ativo"
- O usuário não tem nenhum plano marcado como ativo
- Verifique se o plano existe no banco de dados

### "Erro ao recalcular plano"
- Verifique os logs do servidor para detalhes
- Confirme que o plano existe e pertence ao usuário

### Nenhuma leitura corrigida (correctedReadings: 0)
- O plano já estava correto
- Não havia duplicatas de livros no mesmo dia

## 📊 Estatísticas

Após o recálculo, você verá:

- **Leituras corrigidas**: Quantos registros tinham o livro errado
- **Progresso mantido**: Quantos dias completados foram preservados

Exemplo:
```
✅ Plano recalculado com sucesso!
• Leituras corrigidas: 15
• Progresso mantido: 120 dias
```

Isso significa que 15 leituras tinham o livro errado e foram corrigidas, e 120 dias que estavam marcados como lidos continuam marcados.
