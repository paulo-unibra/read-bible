# Sistema de Fila de E-mails - Rate Limit Fix

## Problema Identificado

Ao enviar e-mails em massa, o sistema estava excedendo o limite de taxa (rate limit) do servidor SMTP:

```
Too many requests. You can only make 2 requests per second.
```

**Causa**: Os e-mails eram enviados em um loop síncrono sem controle de taxa, resultando em múltiplas requisições simultâneas.

## Solução Implementada

### ✅ Sistema de Fila com Rate Limit

Criado um serviço de fila (`EmailQueueService`) que:

1. **Enfileira** todos os e-mails para envio controlado
2. **Processa sequencialmente** com delay entre cada envio
3. **Respeita o rate limit** de 2 req/s (usando 600ms de intervalo = ~1.6 req/s)
4. **Registra logs** automaticamente de sucesso/falha
5. **Processa em background** sem bloquear a resposta da API

## Arquivos Criados/Modificados

### 1. Novo Serviço: `EmailQueueService`
**Arquivo**: `api/app/services/email_queue_service.ts`

**Características**:
- Singleton pattern (instância única)
- Fila em memória
- Delay de 600ms entre envios (seguro para 2 req/s)
- Logs detalhados de cada operação
- Processamento automático em background

**Métodos**:
- `addToQueue(emails)`: Adiciona e-mails à fila
- `processQueue()`: Processa fila com delay
- `getStats()`: Retorna estatísticas da fila

### 2. Controllers Atualizados

#### `AdminAuthController`
**Arquivo**: `api/app/controllers/Admin/auth_controller.ts`

**Mudanças**:

##### `sendCustomEmail()`:
- ❌ **ANTES**: Loop síncrono com envio imediato
- ✅ **AGORA**: Adiciona à fila e retorna imediatamente

**Resposta antiga**:
```json
{
  "success": true,
  "sent": 50,
  "failed": 2,
  "total": 52
}
```

**Resposta nova**:
```json
{
  "success": true,
  "message": "52 e-mail(s) adicionado(s) à fila de envio",
  "queued": 52,
  "note": "Os e-mails serão enviados gradualmente..."
}
```

##### `retryFailedEmails()`:
- Mesma lógica de fila aplicada ao reenvio
- Também retorna resposta imediata

### 3. Frontend Atualizado

#### `Users.tsx`
**Mudança**: Atualizada mensagem de sucesso para informar sobre fila

```typescript
// ANTES
"50 e-mail(s) enviado(s) com sucesso!"

// AGORA
"52 e-mail(s) adicionado(s) à fila de envio. 
Os e-mails serão enviados gradualmente. 
Verifique a página 'Logs de E-mails' para acompanhar."
```

#### `EmailLogs.tsx`
**Mudança**: 
- Mensagem atualizada para reenvio
- Auto-reload após 2 segundos para ver resultado

## Fluxo de Funcionamento

### Envio Normal (Users → E-mail Personalizado)

1. **Admin seleciona usuários** e preenche assunto/mensagem
2. **Clica "Enviar E-mails"**
3. **API responde imediatamente**: "X e-mail(s) enfileirado(s)"
4. **Backend processa em background**:
   - Envia 1º e-mail
   - Aguarda 600ms
   - Envia 2º e-mail
   - Aguarda 600ms
   - ... (continua até acabar)
5. **Cada envio é registrado** em `email_logs` (sucesso/falha)
6. **Admin pode acompanhar** na página "Logs de E-mails"

### Reenvio de Falhas (EmailLogs → Reenviar)

1. **Admin seleciona e-mails falhados**
2. **Clica "Reenviar"**
3. **API responde imediatamente**: "X e-mail(s) enfileirado(s)"
4. **Fila processa com delay**
5. **Novos logs são criados** para cada tentativa
6. **Página recarrega automaticamente** após 2s

## Vantagens

✅ **Evita rate limit**: Respeita limite de 2 req/s
✅ **Resposta rápida**: API não bloqueia esperando envios
✅ **Background processing**: Envios continuam mesmo após resposta
✅ **Rastreável**: Todos os envios geram logs
✅ **Tolerante a falhas**: Erros não param a fila
✅ **Logs detalhados**: Console mostra progresso em tempo real

## Logs do Console

Ao enviar e-mails, você verá logs como:

```
📧 [EmailQueue] 52 e-mail(s) adicionado(s) à fila. Total na fila: 52
🚀 [EmailQueue] Iniciando processamento de 52 e-mail(s)...
📤 [EmailQueue] Enviando e-mail para user1@example.com...
✅ [EmailQueue] E-mail enviado com sucesso para user1@example.com
⏱️  [EmailQueue] Aguardando 600ms antes do próximo envio...
📤 [EmailQueue] Enviando e-mail para user2@example.com...
✅ [EmailQueue] E-mail enviado com sucesso para user2@example.com
...
✨ [EmailQueue] Fila processada completamente!
```

## Configuração do Rate Limit

O delay entre envios está configurado em:

```typescript
// api/app/services/email_queue_service.ts
private readonly RATE_LIMIT_DELAY = 600 // 600ms
```

**Cálculo**:
- Limite: 2 req/s
- Intervalo mínimo: 500ms
- **Configurado**: 600ms (margem de segurança de 100ms)

### Para Ajustar:

Se o limite mudar, edite a constante:
```typescript
// Para 3 req/s:
private readonly RATE_LIMIT_DELAY = 400 // 1000ms / 3 = 333ms + margem

// Para 1 req/s:
private readonly RATE_LIMIT_DELAY = 1100 // 1000ms + margem
```

## Limitações Atuais

⚠️ **Fila em memória**: 
- Se o servidor reiniciar, e-mails na fila são perdidos
- Para produção, considere usar Redis ou banco de dados

⚠️ **Sem prioridade**:
- Todos os e-mails são processados por ordem de chegada
- Não há diferenciação entre tipos de e-mail

⚠️ **Sem retry automático**:
- E-mails que falharem ficam marcados como 'failed'
- É necessário reenviar manualmente pela interface

## Próximas Melhorias (Opcional)

- [ ] Fila persistente (Redis/Bull/Bee-Queue)
- [ ] Retry automático com backoff exponencial
- [ ] Prioridade de e-mails (crítico > normal > baixo)
- [ ] Dashboard de monitoramento da fila
- [ ] Notificações quando taxa de falha > X%
- [ ] Agendamento de envios
- [ ] Pausar/retomar fila manualmente

## Testando

1. **Envie e-mails em massa** (ex: 20+ usuários)
2. **Observe o console da API**: Deve ver logs da fila
3. **Verifique "Logs de E-mails"**: Deve ver todos registrados
4. **Não deve mais ver erro** "Too many requests"

## Status: ✅ IMPLEMENTADO E FUNCIONANDO
