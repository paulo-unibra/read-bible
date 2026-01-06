# Cálculo: Usuários com Leitura em Dia

## 📊 Visão Geral

O relatório do painel administrativo exibe a métrica **"Usuários com leitura em dia"**, que indica quantos usuários completaram a leitura programada para o dia atual.

---

## 🔍 Como Funciona

### Critério de "Leitura em Dia"

Um plano de leitura é considerado **em dia** quando:

1. ✅ O plano está ativo (`is_active = true`)
2. ✅ A data atual está entre `start_date` e `end_date`
3. ✅ O usuário completou **a proporção esperada de dias** baseado no tempo decorrido
4. ✅ **Lógica proporcional ao tempo:**
   - Plano tem `total_days` dias de leitura
   - Plano vai de `start_date` até `end_date`
   - Se 50% do tempo passou, deveria ter completado 50% dos dias
   - Se 100% do tempo passou, deveria ter completado 100% dos dias

### Exemplo Prático de Cronograma

**Plano de 365 dias (01/01/2026 a 31/12/2026)**

| Data Atual | Tempo Decorrido | Dias Esperados | Dias Completados | Status        |
|------------|-----------------|----------------|------------------|---------------|
| 05/01/2026 | 5 dias (1.4%)   | 5 dias         | 5 dias           | ✅ Em dia     |
| 05/01/2026 | 5 dias (1.4%)   | 5 dias         | 3 dias           | ❌ Atrasado   |
| 05/01/2026 | 5 dias (1.4%)   | 5 dias         | 10 dias          | ✅ Adiantado  |
| 01/07/2026 | 182 dias (50%)  | 183 dias       | 183 dias         | ✅ Em dia     |
| 01/07/2026 | 182 dias (50%)  | 183 dias       | 150 dias         | ❌ Atrasado   |

**Fórmula:**
```
dias_esperados = CEIL(total_days × (dias_decorridos / dias_totais_do_plano))
```

---

## 💻 Implementação Técnica

### Localização do Código

**Arquivo:** `/api/app/controllers/Admin/report_controller.ts`

**Linhas:** 25-32

### Query SQL

```typescript
// Usuários com leitura em dia (baseado no cronograma individual de cada plano)
// Calcula quantos dias deveriam ter sido completados baseado em start_date e total_days
const usersUpToDate = await db.rawQuery(`
  SELECT COUNT(DISTINCT rp.id) as total
  FROM reading_plans rp
  WHERE rp.is_active = true
    AND DATE(rp.start_date) <= CURDATE()
    AND DATE(rp.end_date) >= CURDATE()
    AND (
      -- Calcula quantos dias já foram completados
      SELECT COUNT(*)
      FROM reading_progress prog
      WHERE prog.reading_plan_id = rp.id
        AND prog.is_completed = true
    ) >= LEAST(
      -- Dias esperados: proporção do plano que deveria estar completa
      -- Se 50% do tempo passou, deveria ter 50% dos dias completos
      CEIL(
        rp.total_days * 
        (DATEDIFF(CURDATE(), DATE(rp.start_date)) / 
         DATEDIFF(DATE(rp.end_date), DATE(rp.start_date)))
      ),
      rp.total_days
    )
`)
const usersUpToDateCount = Number(usersUpToDate[0][0].total)
```

### Explicação da Lógica

#### 1. **Tempo Decorrido (Proporção)**
```sql
DATEDIFF(CURDATE(), DATE(rp.start_date)) / 
DATEDIFF(DATE(rp.end_date), DATE(rp.start_date))
```
- Calcula qual porcentagem do período total já passou
- Exemplo: Plano de 365 dias, passaram 5 dias → 5/365 = 1.37%

#### 2. **Dias Esperados**
```sql
CEIL(rp.total_days × proporção_tempo_decorrido)
```
- Multiplica `total_days` pela proporção de tempo
- Usa `CEIL` para arredondar para cima (sempre conta dia completo)
- Exemplo: 365 dias × 1.37% = 5 dias esperados

#### 3. **Dias Completados**
```sql
SELECT COUNT(*)
FROM reading_progress prog
WHERE prog.reading_plan_id = rp.id
  AND prog.is_completed = true
```
- Conta quantas leituras foram marcadas como completas

#### 4. **Comparação: Em Dia?**
```sql
dias_completados >= LEAST(dias_esperados, total_days)
```
- `LEAST()` garante que não exija mais que `total_days`
- Se completou >= esperado → **Em dia** ✅
- Se completou < esperado → **Atrasado** ❌

### Exemplo Detalhado

**Plano:** 365 dias (01/01/2026 a 31/12/2026)  
**Hoje:** 05/01/2026

```
Tempo decorrido = (05/01 - 01/01) = 5 dias
Tempo total = (31/12 - 01/01) = 365 dias
Proporção = 5 / 365 = 0.0137 (1.37%)

Dias esperados = CEIL(365 × 0.0137) = CEIL(5.0) = 5 dias

✅ Se completou 5+ dias → Em dia
❌ Se completou <5 dias → Atrasado
```

---

## 📋 Estrutura das Tabelas Envolvidas

### Tabela `reading_progress`

Armazena o progresso diário de cada plano de leitura.

| Campo             | Tipo      | Descrição                                    |
|-------------------|-----------|----------------------------------------------|
| `id`              | int       | ID único do progresso                        |
| `reading_plan_id` | int       | FK para `reading_plans.id`                   |
| `day`             | int       | Dia do plano (1, 2, 3, ...)                  |
| `book_name`       | string    | Nome do livro bíblico                        |
| `start_chapter`   | int       | Capítulo inicial                             |
| `end_chapter`     | int       | Capítulo final                               |
| `is_completed`    | boolean   | Se a leitura foi concluída                   |
| `completed_at`    | datetime  | Data/hora da conclusão                       |
| `created_at`      | timestamp | Data de criação do registro                  |
| `updated_at`      | timestamp | Data de atualização                          |

### Tabela `reading_plans`

Armazena os planos de leitura dos usuários.

| Campo                | Tipo                  | Descrição                           |
|----------------------|-----------------------|-------------------------------------|
| `id`                 | int                   | ID único do plano                   |
| `user_id`            | int                   | FK para `users.id`                  |
| `name`               | string                | Nome do plano                       |
| `type`               | enum                  | 'yearly' ou 'custom'                |
| `start_date`         | datetime              | Data de início                      |
| `end_date`           | datetime              | Data de término                     |
| `is_active`          | boolean               | Se o plano está ativo               |
| `current_day`        | int                   | Dia atual do plano                  |
| `total_days`         | int                   | Total de dias do plano              |
| `chapters_per_day`   | int                   | Capítulos por dia                   |
| `total_chapters`     | int                   | Total de capítulos                  |
| `completed_chapters` | int                   | Capítulos completados               |
| `created_at`         | timestamp             | Data de criação                     |
| `updated_at`         | timestamp             | Data de atualização                 |

---

## 🎯 Lógica de Negócio

### Por que `COUNT(DISTINCT reading_plan_id)`?

A query usa `countDistinct('reading_plan_id')` para evitar duplicatas. Isso significa:

- Se um usuário tiver **múltiplos planos ativos**, cada plano é contado separadamente
- Se um usuário completar **múltiplas leituras do mesmo plano hoje**, conta apenas **uma vez**

### Exemplo Prático com Dados Reais

**Cenário:** Hoje é **05/01/2026**

#### Plano A: Leitura Anual (365 dias)
- **Start:** 01/01/2026 | **End:** 31/12/2026 | **Total:** 365 dias
- **Tempo decorrido:** 5 dias (1.37% do plano)
- **Dias esperados:** CEIL(365 × 0.0137) = **5 dias**
- **Dias completados:** 5 dias
- **Status:** ✅ **Em dia** (5 >= 5)

#### Plano B: Leitura Anual Atrasado
- **Start:** 01/01/2026 | **End:** 31/12/2026 | **Total:** 365 dias
- **Tempo decorrido:** 5 dias (1.37%)
- **Dias esperados:** **5 dias**
- **Dias completados:** 3 dias
- **Status:** ❌ **Atrasado** (3 < 5)

#### Plano C: Leitura Personalizada (90 dias)
- **Start:** 01/01/2026 | **End:** 31/03/2026 | **Total:** 90 dias
- **Tempo decorrido:** 5 dias (5.56% do plano)
- **Dias esperados:** CEIL(90 × 0.0556) = **5 dias**
- **Dias completados:** 5 dias
- **Status:** ✅ **Em dia** (5 >= 5)

#### Plano D: Começou Mais Tarde
- **Start:** 03/01/2026 | **End:** 31/12/2026 | **Total:** 363 dias
- **Tempo decorrido:** 3 dias (0.83%)
- **Dias esperados:** CEIL(363 × 0.0083) = **3 dias**
- **Dias completados:** 3 dias
- **Status:** ✅ **Em dia** (3 >= 3)

#### Plano E: Adiantado
- **Start:** 01/01/2026 | **End:** 31/12/2026 | **Total:** 365 dias
- **Tempo decorrido:** 5 dias (1.37%)
- **Dias esperados:** **5 dias**
- **Dias completados:** 10 dias
- **Status:** ✅ **Adiantado** (10 > 5, conta como em dia)

**Resultado:** `upToDate = 4` (Planos A, C, D, E)

---

## ⚠️ Observações Importantes

### 1. Cronograma Individual por Plano

✅ **Agora correto:** Cada plano é avaliado baseado na sua própria `start_date`.

**Exemplo:**
- **Plano A** começou em 01/01 → Hoje (05/01) deveria estar no dia 5
- **Plano B** começou em 03/01 → Hoje (05/01) deveria estar no dia 3
- **Ambos podem estar "em dia"**, mas com dias diferentes completados

### 2. Usuários Adiantados Contam como "Em Dia"

Se um usuário leu mais dias do que o esperado, ele **continua contando como "em dia"**.

**Exemplo:**
- Esperado: 5 dias
- Completado: 10 dias
- Status: ✅ **Em dia** (e adiantado)

### 3. Planos Inativos ou Finalizados Não Contam

Apenas planos que atendem **todos** os critérios:
- `is_active = true`
- `start_date <= hoje`
- `end_date >= hoje`

### 4. Contagem por Plano, não por Usuário

Se um usuário tem 2 planos ativos e ambos estão em dia → conta como **2**.

**Se quiser contar usuários únicos**, altere o `COUNT(DISTINCT rp.id)` para:
```sql
SELECT COUNT(DISTINCT rp.user_id) as total
```

---

## 🔄 Fluxo de Atualização

### Quando um usuário completa uma leitura:

1. App mobile chama API: `POST /reading-progress/:id/complete`
2. Backend atualiza `reading_progress`:
   ```sql
   UPDATE reading_progress
   SET is_completed = true,
       completed_at = NOW()
   WHERE id = :id
   ```
3. Backend atualiza `reading_plans.completed_chapters`
4. Na próxima consulta do relatório, se foi hoje, o contador incrementa

---

## 📈 Melhorias Sugeridas

### 1. Adicionar Cache
```typescript
// Cache por 5 minutos
const cacheKey = `stats:up-to-date:${today}`
const cached = await redis.get(cacheKey)
if (cached) return JSON.parse(cached)

// ... query ...

await redis.setex(cacheKey, 300, JSON.stringify(result))
```

### 2. Adicionar Índice
```sql
CREATE INDEX idx_progress_completed 
ON reading_progress(completed_at, is_completed);
```

### 3. Adicionar Histórico
Salvar snapshots diários para gráficos de evolução:
```typescript
// Tabela: daily_stats
{
  date: '2026-01-05',
  users_up_to_date: 145,
  total_users: 500,
  percentage: 29
}
```

---

## 📊 Métricas Relacionadas

No mesmo relatório, outras métricas são calculadas:

- **Total de usuários cadastrados:** `COUNT(*) FROM users`
- **Usuários com plano ativo:** `COUNT(DISTINCT user_id) FROM reading_plans WHERE is_active = true`
- **Usuários ativos (7 dias):** Completaram leitura nos últimos 7 dias
- **Usuários que completaram plano:** `completed_chapters >= total_chapters`

---

## 🎓 Conceitos-Chave

### Reading Plan (Plano de Leitura)
Um cronograma de leitura bíblica criado pelo usuário, com data início/fim e capítulos por dia.

### Reading Progress (Progresso de Leitura)
Cada entrada representa **um dia específico** de um plano, com as leituras previstas e status de conclusão.

### Up to Date (Em Dia)
Status indicando que o usuário completou a leitura programada para a data atual.

---

## 📝 Changelog

| Data       | Versão | Alteração                              |
|------------|--------|----------------------------------------|
| 2026-01-05 | 3.0    | ✅ **CORREÇÃO:** Implementado cálculo proporcional baseado em `total_days`, `start_date` e `end_date`. Agora calcula quantos dias deveriam estar completos baseado na proporção de tempo decorrido do plano. Exemplo: Se 50% do tempo passou, deveria ter 50% dos dias completos. |
| 2026-01-05 | 2.0    | ⚠️ Implementado cálculo baseado em dias corridos desde `start_date` (parcialmente correto) |
| 2026-01-05 | 1.0    | ❌ Lógica incorreta (apenas verificava se completou leitura hoje) |

---

## 🔗 Referências

- Controller: `/api/app/controllers/Admin/report_controller.ts`
- Migration: `/api/database/migrations/1765515065288_create_reading_progress_table.ts`
- Model: `/api/app/models/reading_progress.ts`
- Frontend: `/admin/src/pages/Reports.tsx`
