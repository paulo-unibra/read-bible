# Plano de Leitura para Iniciantes

## Visão Geral

O **Plano para Iniciantes** distribui toda a Bíblia (~31.102 versículos) proporcionalmente pelos dias restantes até 31 de dezembro do ano atual. É ideal para quem quer ler a Bíblia inteira de forma leve e sem pressa.

## Como Funciona

### 1. Cálculo Automático

```typescript
// Calcular dias até 31/12
const now = DateTime.now()
const endOfYear = DateTime.local(now.year, 12, 31, 23, 59, 59)
const totalDays = Math.ceil(endOfYear.diff(now, 'days').days)

// Calcular versículos por dia
const totalVerses = 31102 // Total de versículos na Bíblia
const versesPerDay = Math.ceil(totalVerses / totalDays)
```

**Exemplo:** Se criar o plano em 1º de junho:

- Dias restantes: ~214 dias
- Versículos por dia: 31102 / 214 = ~145 versículos/dia

### 2. Distribuição por Capítulos

O algoritmo acumula **capítulos inteiros** até atingir ou ultrapassar o número de versículos do dia:

```
Dia 1 (145 versículos alvo):
├─ Gênesis 1 (~31 versículos)
├─ Gênesis 2 (~25 versículos)
├─ Gênesis 3 (~24 versículos)
├─ Gênesis 4 (~26 versículos)
└─ Gênesis 5 (~32 versículos)
Total: 5 capítulos (~138 versículos) ✓ próximo de 145
```

**Regra importante:** Não adiciona mais capítulos quando o total já foi atingido ou excedido.

### 3. Algoritmo de Distribuição

```typescript
// Encontrar livro e capítulo inicial baseado no versículo absoluto
const startVerse = (dayNumber - 1) * versesPerDay + 1

// Acumular capítulos até atingir versesPerDay
while (versesCollected < versesPerDay) {
  const avgVersesInChapter = book.verses / book.chapters
  const chaptersNeeded = Math.ceil((versesPerDay - versesCollected) / avgVersesInChapter)

  // Adicionar capítulos
  readings.push({ bookName, startChapter, endChapter })

  versesCollected += chaptersAdded * avgVersesInChapter

  // Se atingiu o alvo, PARA
  if (versesCollected >= versesPerDay) break
}
```

## Endpoint da API

### POST /reading-plans/beginner

Cria um novo plano de leitura para iniciantes.

**Headers:**

```
Authorization: Bearer <token>
```

**Resposta Sucesso (201):**

```json
{
  "success": true,
  "message": "Plano para Iniciantes criado com sucesso",
  "data": {
    "plan": {
      "id": 123,
      "name": "Plano para Iniciantes 2024",
      "type": "beginner",
      "startDate": "2024-06-01T00:00:00.000-03:00",
      "endDate": "2024-12-31T23:59:59.000-03:00",
      "totalDays": 214,
      "versesPerDay": 146,
      "totalVerses": 31102,
      "totalChapters": 1189
    }
  }
}
```

**Erros:**

- `409 Conflict`: Usuário já possui plano ativo
- `400 Bad Request`: Poucos dias restantes no ano (< 1 dia)

## Estrutura de Dados

### BIBLE_STRUCTURE

Cada livro da Bíblia tem:

```typescript
{
  name: string,      // Nome do livro
  chapters: number,  // Quantidade de capítulos
  verses: number     // Quantidade total de versículos
}
```

**Exemplo:**

```typescript
{ name: 'Gênesis', chapters: 50, verses: 1533 },
{ name: 'Êxodo', chapters: 40, verses: 1213 },
{ name: 'Salmos', chapters: 150, verses: 2461 },
{ name: 'Mateus', chapters: 28, verses: 1071 },
// ... 66 livros
```

**Totais:**

- Antigo Testamento: 39 livros, 929 capítulos, ~23.145 versículos
- Novo Testamento: 27 livros, 260 capítulos, ~7.957 versículos
- **Total: 66 livros, 1.189 capítulos, ~31.102 versículos**

## Geração de Dias

### Primeira Execução

Gera automaticamente os **primeiros 5 dias** ao criar o plano:

```typescript
const initialDaysCount = Math.min(5, totalDays)

for (let dayNumber = 1; dayNumber <= initialDaysCount; dayNumber++) {
  const dayReadings = await this.generateDayReadings('beginner', dayNumber, versesPerDay, totalDays)

  // Salvar cada leitura no banco (ReadingProgress)
  for (const reading of dayReadings) {
    await ReadingProgress.create({
      readingPlanId: plan.id,
      day: dayNumber,
      bookName: reading.bookName,
      startChapter: reading.startChapter,
      endChapter: reading.endChapter,
      isCompleted: false,
    })
  }
}
```

### Dias Subsequentes

Gerados sob demanda usando endpoint `/reading-plans/add-next-days`.

## Exemplo Prático

**Cenário:** Criar plano em 15 de outubro de 2024

```
Data atual: 15/10/2024
Dias até 31/12: 78 dias
Versículos por dia: 31102 / 78 = 399 versículos/dia
```

**Dia 1 (399 versículos):**

```
Gênesis 1-13 (~13 capítulos × ~30 vers/cap = ~390 versículos) ✓
```

**Dia 2 (399 versículos):**

```
Gênesis 14-26 (~13 capítulos × ~30 vers/cap = ~390 versículos) ✓
```

**Progresso:**

- Após 78 dias: Toda a Bíblia lida
- Leitura leve: ~12-15 capítulos por dia
- Ritmo sustentável para iniciantes

## Vantagens

✅ **Adaptativo**: Calcula automaticamente baseado nos dias restantes  
✅ **Leve**: Distribui uniformemente, sem sobrecarga  
✅ **Completo**: Lê toda a Bíblia até o fim do ano  
✅ **Flexível**: Quanto mais cedo começar, menos versículos/dia  
✅ **Intuitivo**: Trabalha com capítulos inteiros (não frações)

## Comparação com Outros Planos

| Plano           | Base       | Distribuição          | Duração        |
| --------------- | ---------- | --------------------- | -------------- |
| **Sequencial**  | Capítulos  | Fixa (ex: 3 caps/dia) | Usuário define |
| **Intercalado** | Capítulos  | AT + NT proporcionais | Usuário define |
| **Iniciantes**  | Versículos | Automática até 31/12  | Até fim do ano |

## Logs de Debug

O sistema gera logs detalhados durante a criação:

```
🔵 [API] createBeginner - INÍCIO
👤 [API] Usuário autenticado: { id: 1, email: 'user@example.com' }
🔍 [API] Verificando planos ativos existentes...
✅ [API] Nenhum plano ativo encontrado, criando novo...
📅 [API] Dias restantes até 31/12/2024: 78
📖 [API] Total de versículos na Bíblia: 31102
📊 [API] Versículos por dia: 399 (31102 versículos / 78 dias)
💾 [API] Tentando salvar plano no banco...
✅ [API] Plano salvo com sucesso!
📚 [API] Gerando os 5 primeiros dias automaticamente...
   📖 Gerando dia 1...
   🔧 [generateDayReadings] Tipo: beginner, Dia: 1, Capítulos/dia: 399
   📍 [BEGINNER] Versículo absoluto inicial: 1
   📚 [BEGINNER] Livro inicial: Gênesis, versículo 1 do livro
   🎯 [BEGINNER] Capítulo inicial estimado: 1 (média 31 vers/cap)
   📖 [BEGINNER] Gênesis: caps 1-13 (~403 vers)
   ✅ [BEGINNER] Total: 1 bloco(s) de leitura, ~403 versículos
🎉 [API] Plano para iniciantes criado com sucesso!
```

## Integração com Mobile App

O app mobile deve chamar o endpoint após autenticação:

```typescript
const response = await api.post('/reading-plans/beginner', null, {
  headers: {
    Authorization: `Bearer ${userToken}`,
  },
})

if (response.data.success) {
  const plan = response.data.data.plan
  console.log(`Plano criado! ${plan.versesPerDay} versículos/dia durante ${plan.totalDays} dias`)
}
```
