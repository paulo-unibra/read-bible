# Como Habilitar a Google Drive API

O erro indica que a Google Drive API não está habilitada no projeto do Google Cloud. Siga estes passos:

## Passo 1: Acesse o Console do Google Cloud

Abra o link fornecido no erro:

```
https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=137706116480
```

**OU** acesse manualmente:

1. Vá para https://console.cloud.google.com/
2. Selecione o projeto "nutotia" (ID: 137706116480)
3. No menu lateral, clique em "APIs e Serviços" > "Biblioteca"
4. Busque por "Google Drive API"

## Passo 2: Habilitar a API

1. Clique em "Google Drive API"
2. Clique no botão **"ATIVAR"** (ou "ENABLE")
3. Aguarde alguns segundos para a ativação ser concluída

## Passo 3: Verificar Permissões

Após habilitar, verifique se a Service Account tem acesso à pasta:

1. Acesse a pasta do Google Drive: https://drive.google.com/drive/folders/12CZeaVlNKMfO3gT5PpOFdVgvY7fEQ0Yq
2. Clique em "Compartilhar"
3. Adicione o email da Service Account: `quiz-da-b-blia@nutotia.iam.gserviceaccount.com`
4. Dê permissão de **Editor** (para criar/atualizar arquivos)
5. Clique em "Enviar"

## Passo 4: Testar Novamente

Após habilitar a API e compartilhar a pasta, aguarde 1-2 minutos e teste novamente:

```bash
curl -X POST http://localhost:3333/generate-quiz \
  -H "Content-Type: application/json" \
  -d '{
    "bibleText": "Texto do Salmo 1...",
    "bookName": "Salmos",
    "chapter": "1"
  }'
```

## Outras APIs que Podem Ser Necessárias

Se houver outros erros, você também pode precisar habilitar:

- Google Sheets API (se usar planilhas no futuro)
- Cloud Storage API (se usar buckets)

## Solução Temporária

Se não quiser configurar o Google Drive agora, a API já está preparada para funcionar sem ele. O quiz será gerado e retornado normalmente, apenas sem o upload automático.
