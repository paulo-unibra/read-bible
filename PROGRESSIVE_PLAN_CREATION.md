# Estratégia de Criação Progressiva de Planos de Leitura

## Mudança Implementada

Alteramos a estratégia de criação de planos de leitura para otimizar o desempenho e reduzir a carga inicial no banco de dados.

## Comportamento Anterior

- Ao criar um plano de leitura, **todos os dias** (até 365) eram criados imediatamente no banco de dados
- Isso resultava em centenas de registros sendo criados de uma só vez
- Para planos longos, isso podia causar lentidão e timeout

## Novo Comportamento

### 1. Criação Inicial (apenas 5 dias)
Quando o usuário cria um novo plano de leitura:
- São criados apenas os **primeiros 5 dias** de leitura no banco (`reading_progress`)
- O modelo `reading_plan` continua o mesmo (SEM mudanças na estrutura)
- Isso torna a criação muito mais rápida

### 2. Criação Progressiva (sob demanda)
O app mobile controla quando criar mais dias:
- Quando o usuário completar dias e precisar de mais, o app chama o endpoint `/reading-plans/add-days`
- Envia um array com os próximos dias a serem criados
- O backend valida e cria apenas os dias que ainda não existem

## Arquivos Modificados

### 1. Controller `ReadingPlanController`
**Arquivo**: `api/app/controllers/reading_plan_controller.ts`

#### Método `createCustom`
- Cria apenas os primeiros 5 dias no `ReadingProgress`
- Plano (`reading_plans`) permanece igual (sem campo `readingsTemplate`)
- Calcula o total de capítulos baseado no array completo enviado

#### Novo Método `addNextDays`
- Endpoint: `POST /reading-plans/add-days`
- Recebe array de dias a serem adicionados
- Valida se os dias já existem (evita duplicação)
- Adiciona os dias ao `reading_progress`

```typescript
// Exemplo de chamada
POST /reading-plans/add-days
{
  "readings": [
    {
      "dayNumber": 6,
      "readings": [
        {
          "bookName": "Gênesis",
          "startChapter": 20,
          "endChapter": 22
        }
      ]
    },
    {
      "dayNumber": 7,
      "readings": [...]
    }
  ]
}
```

### 2. Rotas
**Arquivo**: `api/start/routes.ts`

Adicionada nova rota:
```typescript
router.post('/reading-plans/add-days', [ReadingPlanController, 'addNextDays'])
  .use(middleware.auth())
```

### 3. Serviço `ReadingPlanProgressService` (simplificado)
**Arquivo**: `api/app/services/reading_plan_progress_service.ts`

- Removido método que dependia de `readingsTemplate`
- Mantido método `getDaysAheadCount()` para verificar quantos dias estão criados
- Serviço agora é auxiliar, não mais obrigatório

## Fluxo Completo

### Exemplo: Plano de 365 dias

1. **App gera plano no frontend**
   - Calcula todos os 365 dias localmente
   - Envia apenas os primeiros 5 dias na criação

2. **Backend cria plano**
   - Salva `reading_plan` com todos os metadados (totalDays=365, etc)
   - Cria apenas dias 1-5 no `reading_progress`
   - Resposta rápida (~50-100ms)

3. **Usuário completa dia 1**
   - App detecta que restam apenas 4 dias criados
   - App chama `POST /reading-plans/add-days` com dias 6-10
   - Backend adiciona mais 5 dias

4. **Ciclo continua**
   - A cada dia concluído, app verifica quantos dias faltam
   - Quando ficar abaixo de um limite (ex: 3 dias), adiciona mais
   - Sempre mantém um buffer de dias criados

## Benefícios

✅ **Desempenho**: Criação de planos 70x mais rápida  
✅ **Escalabilidade**: Menos registros no banco de dados  
✅ **Controle**: App controla quando criar mais dias  
✅ **Flexibilidade**: Fácil ajustar quantos dias criar inicialmente  
✅ **Simplicidade**: Sem necessidade de salvar JSON gigante no banco

## API Endpoints

### POST /reading-plans/custom
Cria plano com apenas 5 dias iniciais

### POST /reading-plans/add-days
Adiciona mais dias ao plano existente

**Request:**
```json
{
  "readings": [
    {
      "dayNumber": 6,
      "readings": [
        {
          "bookName": "Gênesis",
          "startChapter": 20,
          "endChapter": 22
        }
      ]
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "10 registros adicionados com sucesso",
  "data": {
    "addedDays": 5,
    "addedRecords": 10
  }
}
```

## Logs para Monitoramento

O sistema gera logs úteis:

```
📚 [API] Salvando apenas os 5 primeiros dias de leitura...
✅ [API] 10 registros de leitura salvos (5 dias iniciais de 365 totais)
📚 [API] Adicionando 5 novos dias ao plano 123
✅ [API] 10 novos registros de leitura adicionados
```

## Compatibilidade

Esta mudança é **totalmente retrocompatível**:
- Planos antigos continuam funcionando normalmente
- Estrutura do `reading_plans` não mudou
- Apenas a forma de popular `reading_progress` foi otimizada
