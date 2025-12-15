# Configuração Google Cloud Storage

Google Cloud Storage funciona perfeitamente com Service Accounts e tem 5GB gratuitos!

## Passo 1: Criar Bucket no Cloud Storage

1. Acesse: https://console.cloud.google.com/storage/browser?project=bibliaquiz-472817

2. Clique em **"CREATE BUCKET"** (Criar bucket)

3. Configure:
   - **Name**: `bibliaquiz-files` (ou outro nome único global)
   - **Location type**: `Region`
   - **Region**: `us-east1` (ou mais próximo de você)
   - **Storage class**: `Standard`
   - **Access control**: `Fine-grained` (recomendado)
   - **Protection tools**: Desmarque tudo (para desenvolvimento)

4. Clique em **"CREATE"**

## Passo 2: Dar Permissão ao Service Account

1. No bucket criado, vá em **"PERMISSIONS"** (Permissões)

2. Clique em **"GRANT ACCESS"** (Conceder acesso)

3. Configure:
   - **New principals**: `b-blia-em-jogo@bibliaquiz-472817.iam.gserviceaccount.com`
   - **Role**: `Storage Object Admin`

4. Clique em **"SAVE"**

## Passo 3: Configurar .env

O `.env` já está configurado! Apenas certifique-se de que o nome do bucket está correto:

```env
GCS_BUCKET_NAME=bibliaquiz-files
GCS_CREDENTIALS={"type": "service_account",...}
```

## Passo 4: Testar

Reinicie o servidor e faça uma requisição:

```bash
curl -X POST http://localhost:1999/generate-quiz \
  -H "Content-Type: application/json" \
  -d '{
    "bibleText": "Bem-aventurado o homem que não anda no conselho dos ímpios...",
    "bookName": "Salmos",
    "chapter": "1"
  }'
```

O arquivo será salvo em:
`https://storage.googleapis.com/bibliaquiz-files/quizzes/salmos-1.json`

## Vantagens do Cloud Storage

✅ **Funciona com Service Account** (sem problemas de quota)
✅ **5GB gratuitos** (suficiente para milhões de quizzes JSON)
✅ **URLs públicas** (fácil acesso pelo app mobile)
✅ **Mais rápido** que Google Drive API
✅ **Melhor para arquivos** (Drive é para documentos)

## Acessar os arquivos

Você pode ver todos os arquivos em:
https://console.cloud.google.com/storage/browser/bibliaquiz-files?project=bibliaquiz-472817

Ou diretamente via URL pública:
`https://storage.googleapis.com/bibliaquiz-files/quizzes/[nome-do-livro]-[capitulo].json`
