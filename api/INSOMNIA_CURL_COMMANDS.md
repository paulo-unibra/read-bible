# Comandos cURL para testar Google Play API no Insomnia

## ⚠️ Importante

A autenticação do Google Play usa OAuth2 com Service Account, que requer:

1. Gerar um JWT (JSON Web Token) assinado
2. Trocar o JWT por um Access Token
3. Usar o Access Token nas requisições

**O Insomnia tem suporte nativo para isso!** Siga os passos abaixo:

---

## 📋 Passo 1: Configurar OAuth2 no Insomnia

### 1. Crie uma nova requisição no Insomnia

**Método:** `POST`  
**URL:** `https://playdeveloperreporting.googleapis.com/v1beta1/apps/com.readbible.app/crashRateMetricSet:query`

### 2. Configure a autenticação (Aba "Auth")

- **Type:** `OAuth 2.0`
- **Grant Type:** `Service Account`
- **Assertion Type:** `urn:ietf:params:oauth:grant-type:jwt-bearer`

### 3. Preencha os campos com as credenciais do .env

Você precisa extrair do `GOOGLE_PLAY_CREDENTIALS`:

```json
{
  "type": "service_account",
  "project_id": "nutotia",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...",
  "client_email": "play-store-reporting@nutotia.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs"
}
```

**No Insomnia:**

- **Token URL:** `https://oauth2.googleapis.com/token`
- **Client Email:** `play-store-reporting@nutotia.iam.gserviceaccount.com`
- **Private Key:** Cole a chave privada completa (com `-----BEGIN PRIVATE KEY-----` e `-----END PRIVATE KEY-----`)
- **Scope:** `https://www.googleapis.com/auth/playdeveloperreporting`

---

## 📋 Passo 2: Configurar o Body da Requisição

**Content-Type:** `application/json`

**Body (JSON):**

```json
{
  "dimensions": ["DATE"],
  "metrics": ["CRASH_RATE", "CRASH_RATE_PER_USER_PERCENT", "DISTINCT_CRASHES"],
  "timelineSpec": {
    "aggregationPeriod": "DAILY",
    "startTime": {
      "year": 2026,
      "month": 1,
      "day": 1
    },
    "endTime": {
      "year": 2026,
      "month": 1,
      "day": 5
    }
  }
}
```

---

## 🔧 Alternativa: Usar comando Node.js

Se preferir testar direto no terminal:

```bash
cd /home/paulo-trabalho/Documentos/PROJETOS_PESSOAIS/ReadBible/api
node ace test:play-console
```

---

## 🚀 Endpoints Disponíveis

### 1. **Crash Rate (Taxa de Crashes)**

```
POST https://playdeveloperreporting.googleapis.com/v1beta1/apps/com.readbible.app/crashRateMetricSet:query
```

**Body:**

```json
{
  "dimensions": ["DATE"],
  "metrics": ["CRASH_RATE", "CRASH_RATE_PER_USER_PERCENT", "DISTINCT_CRASHES"],
  "timelineSpec": {
    "aggregationPeriod": "DAILY",
    "startTime": { "year": 2026, "month": 1, "day": 1 },
    "endTime": { "year": 2026, "month": 1, "day": 5 }
  }
}
```

### 2. **ANR Rate (Application Not Responding)**

```
POST https://playdeveloperreporting.googleapis.com/v1beta1/apps/com.readbible.app/anrRateMetricSet:query
```

**Body:**

```json
{
  "dimensions": ["DATE"],
  "metrics": ["ANR_RATE", "ANR_RATE_PER_USER_PERCENT", "DISTINCT_ANRS"],
  "timelineSpec": {
    "aggregationPeriod": "DAILY",
    "startTime": { "year": 2026, "month": 1, "day": 1 },
    "endTime": { "year": 2026, "month": 1, "day": 5 }
  }
}
```

### 3. **Search Apps (Pesquisar apps acessíveis)**

```
GET https://playdeveloperreporting.googleapis.com/v1beta1/apps:search
```

Sem body (apenas headers de autenticação).

---

## 🔑 Como pegar o Access Token manualmente (cURL)

Se o Insomnia não funcionar, você pode gerar o token manualmente:

### Passo 1: Criar o JWT

Isso é complexo pois requer assinar com a chave privada. Use este script Node.js:

```javascript
const { google } = require('googleapis')
const credentials = JSON.parse(process.env.GOOGLE_PLAY_CREDENTIALS)

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/playdeveloperreporting'],
})

auth
  .getAccessToken()
  .then((token) => {
    console.log('Access Token:', token)
  })
  .catch((err) => {
    console.error('Erro:', err)
  })
```

### Passo 2: Usar o token no cURL

```bash
curl -X POST \
  'https://playdeveloperreporting.googleapis.com/v1beta1/apps/com.readbible.app/crashRateMetricSet:query' \
  -H 'Authorization: Bearer SEU_ACCESS_TOKEN_AQUI' \
  -H 'Content-Type: application/json' \
  -d '{
    "dimensions": ["DATE"],
    "metrics": ["CRASH_RATE", "CRASH_RATE_PER_USER_PERCENT", "DISTINCT_CRASHES"],
    "timelineSpec": {
      "aggregationPeriod": "DAILY",
      "startTime": {"year": 2026, "month": 1, "day": 1},
      "endTime": {"year": 2026, "month": 1, "day": 5}
    }
  }'
```

---

## 🎯 Resposta Esperada

### Sucesso (200):

```json
{
  "rows": [
    {
      "dimensions": ["2026-01-01"],
      "metrics": {
        "crashRate": 0.01,
        "crashRatePerUserPercent": 1.5,
        "distinctCrashes": 5
      }
    }
  ]
}
```

### Erro 404:

```json
{
  "error": {
    "code": 404,
    "message": "App com.readbible.app not found",
    "status": "NOT_FOUND"
  }
}
```

Se receber 404, significa que o app ainda não está disponível na API (não publicado ou permissões não propagadas).

---

## 💡 Dicas

1. **Insomnia é mais fácil** para OAuth2 com Service Account
2. Se quiser cURL puro, você precisa gerar o JWT manualmente (complexo)
3. O comando `node ace test:play-console` já faz tudo isso automaticamente
4. O 404 atual é esperado se o app não estiver publicado ainda

---

## 📞 Troubleshooting

**Erro "invalid_grant":**

- Chave privada incorreta ou malformada
- Verifique se copiou o `-----BEGIN` e `-----END` completos

**Erro 403 "Permission denied":**

- Service Account sem permissão no Play Console
- Vá em: Play Console → Configurações → Acesso à API

**Erro 404 "Not found":**

- App não publicado ou não visível para a API
- Permissões ainda propagando (aguarde até 48h)
