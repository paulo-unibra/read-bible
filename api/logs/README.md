# Sistema de Logs da IA

Este diretório armazena logs de todas as requisições feitas à API do DeepSeek para geração de planos de leitura.

## Estrutura de Arquivos

### 1. `ai-request-{timestamp}.json`
Logs detalhados de cada requisição individual.

**Estrutura:**
```json
{
  "timestamp": "2026-01-06T10:30:00.000Z",
  "userId": 1,
  "userEmail": "admin@example.com",
  "prompt": "Crie um plano de 30 dias para ler o Novo Testamento",
  "response": {
    "plan": {
      "name": "NT em 30 Dias",
      "description": "...",
      "readings": [...]
    },
    "fullAIResponse": "resposta completa da IA...",
    "processingTime": 3500
  },
  "success": true,
  "error": null
}
```

### 2. `ai-raw-{timestamp}.json`
Logs das respostas brutas da IA quando há erro de parsing.

**Estrutura:**
```json
{
  "timestamp": "2026-01-06T10:30:00.000Z",
  "userId": 1,
  "prompt": "Instrução do usuário",
  "rawResponsePreview": "Primeiros 500 caracteres...",
  "fullRawResponse": "Resposta completa não parseada",
  "parseError": "Unexpected token..."
}
```

### 3. `ai-requests.log`
Log consolidado com resumo de todas as requisições.

**Formato:**
```
[2026-01-06T10:30:00.000Z] ✅ SUCCESS - User: admin@example.com - Plan generated
[2026-01-06T10:35:00.000Z] ❌ ERROR - User: admin@example.com - Erro ao parsear JSON
```

## Debugging

### Ver últimas requisições
```bash
tail -f logs/ai-requests.log
```

### Ver última requisição detalhada
```bash
ls -t logs/ai-request-*.json | head -1 | xargs cat | jq .
```

### Ver erros de parsing
```bash
ls -t logs/ai-raw-*.json | head -5
```

### Buscar requisições de um usuário
```bash
grep "user@example.com" logs/ai-requests.log
```

## Quando Verificar

1. **Erro "IA retornou formato inválido"**: 
   - Verifique `ai-raw-{timestamp}.json` mais recente
   - Veja o que a IA retornou e ajuste o prompt do sistema

2. **Plano gerado incorretamente**:
   - Verifique `ai-request-{timestamp}.json`
   - Analise o `fullAIResponse` para ver o que a IA entendeu

3. **Lentidão nas respostas**:
   - Veja o `processingTime` nos logs
   - Se > 5000ms, pode ser problema de rede ou quota da API

## Limpeza

Os arquivos de log NÃO são versionados no Git (`.gitignore`).

Para limpar logs antigos:
```bash
# Manter apenas logs dos últimos 7 dias
find logs -name "*.json" -mtime +7 -delete
find logs -name "*.log" -mtime +7 -delete
```

## Privacidade

⚠️ **ATENÇÃO**: Os logs contêm:
- Emails de usuários
- Prompts (instruções dos usuários)
- Respostas completas da IA

**Não compartilhe** esses arquivos publicamente sem remover informações sensíveis.
