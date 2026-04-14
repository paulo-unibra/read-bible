# Configuração OAuth2 para Google Drive

Como Service Accounts não funcionam com contas Gmail pessoais (não têm quota de armazenamento), você precisa usar OAuth2 com sua própria conta.

## Passo 1: Criar credenciais OAuth no Google Cloud Console

1. Acesse: https://console.cloud.google.com/apis/credentials?project=bibliaquiz-472817

2. Clique em **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**

3. Se for sua primeira vez:
   - Clique em **"CONFIGURE CONSENT SCREEN"**
   - Escolha **"External"** (para contas pessoais)
   - Preencha:
     - App name: `Quiz da Bíblia API`
     - User support email: `prgalcantara@gmail.com`
     - Developer contact: `prgalcantara@gmail.com`
   - Clique **"Save and Continue"**
   - Em **"Scopes"**, clique **"Add or Remove Scopes"**
   - Busque e adicione: `https://www.googleapis.com/auth/drive.file`
   - Clique **"Save and Continue"**
   - Em **"Test users"**, adicione seu email: `prgalcantara@gmail.com`
   - Clique **"Save and Continue"**

4. Volte para **Credentials** e crie o OAuth client ID:
   - Application type: **"Web application"**
   - Name: `Quiz API OAuth`
   - Authorized redirect URIs: `http://localhost:3333/oauth2callback`
   - Clique **"CREATE"**

5. **IMPORTANTE**: Copie e guarde:
   - **Client ID** (ex: `123456-abc.apps.googleusercontent.com`)
   - **Client Secret** (ex: `GOCSPX-abcd1234...`)

## Passo 2: Obter Refresh Token

1. Edite o arquivo `scripts/get-oauth-token.js`:

   ```javascript
   const CLIENT_ID = 'cole-seu-client-id-aqui'
   const CLIENT_SECRET = 'cole-seu-client-secret-aqui'
   ```

2. Execute o script:

   ```bash
   node scripts/get-oauth-token.js
   ```

3. O script vai exibir uma URL. **Abra no navegador**.

4. Faça login com `prgalcantara@gmail.com`

5. Clique em **"Continuar"** mesmo com aviso de app não verificado

6. Autorize o acesso ao Google Drive

7. Você será redirecionado para `localhost:3333/oauth2callback?code=...`
   - **COPIE O CÓDIGO** da URL (a parte depois de `code=`)

8. Cole o código no terminal

9. O script vai exibir o **REFRESH_TOKEN**

## Passo 3: Configurar .env

Adicione no arquivo `.env`:

```env
GOOGLE_DRIVE_CLIENT_ID=seu-client-id
GOOGLE_DRIVE_CLIENT_SECRET=seu-client-secret
GOOGLE_DRIVE_REFRESH_TOKEN=seu-refresh-token
GOOGLE_DRIVE_FOLDER_ID=12CZeaVlNKMfO3gT5PpOFdVgvY7fEQ0Yq
```

**REMOVA** estas linhas antigas:

```env
GOOGLE_DRIVE_CREDENTIALS=...
GOOGLE_DRIVE_SHARED_FOLDER_ID=...
GOOGLE_DRIVE_USER_EMAIL=...
```

## Passo 4: Testar

Reinicie o servidor e faça uma requisição:

```bash
curl -X POST http://localhost:3333/generate-quiz \
  -H "Content-Type: application/json" \
  -d '{
    "bibleText": "Bem-aventurado o homem que não anda no conselho dos ímpios...",
    "bookName": "Salmos",
    "chapter": "1"
  }'
```

O arquivo será criado automaticamente na sua pasta do Google Drive! 🎉

## Troubleshooting

**Erro: "invalid_grant"**

- O refresh token expirou. Gere um novo executando o Passo 2 novamente.

**Erro: "Access blocked"**

- Certifique-se de ter adicionado seu email como "Test user" na tela de consentimento.

**Erro: "insufficient permissions"**

- Verifique se o scope `drive.file` foi adicionado na tela de consentimento.
