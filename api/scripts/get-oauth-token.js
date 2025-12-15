/**
 * Script para obter OAuth2 Refresh Token do Google Drive
 * 
 * Passos:
 * 1. Execute: node scripts/get-oauth-token.js
 * 2. Acesse a URL gerada no navegador
 * 3. Faça login com sua conta do Gmail
 * 4. Copie o código de autorização da URL de retorno
 * 5. Cole o código no terminal
 * 6. Copie o refresh_token gerado para o .env
 */

import { google } from 'googleapis'
import readline from 'readline'

// Configurações OAuth
const CLIENT_ID = '475561614858-g37div7snmhi21a6u8gnina7fafsjbbp.apps.googleusercontent.com'
const CLIENT_SECRET = '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re'
const REDIRECT_URI = 'http://localhost'

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)

// Gerar URL de autorização
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/drive.file'],
  prompt: 'consent', // Força sempre retornar refresh_token
})

console.log('\n=== GOOGLE DRIVE OAUTH SETUP ===\n')
console.log('1. ANTES DE CONTINUAR: Adicione esta URI no Google Cloud Console:')
console.log('   https://console.cloud.google.com/apis/credentials/oauthclient/475561614858-g37div7snmhi21a6u8gnina7fafsjbbp.apps.googleusercontent.com?project=bibliaquiz-472817')
console.log('   - Clique em "Authorized redirect URIs"')
console.log('   - Adicione: http://localhost')
console.log('   - Clique em "SAVE"\n')
console.log('2. Depois, acesse esta URL no navegador:\n')
console.log(authUrl)
console.log('\n3. Faça login com prgalcantara@gmail.com')
console.log('4. Autorize o acesso ao Google Drive')
console.log('5. Você será redirecionado para: http://localhost/?code=...')
console.log('6. A página vai dar erro (normal!), copie o CÓDIGO da URL\n')
console.log('   Exemplo da URL: http://localhost/?code=4/0AQlEd8w...')
console.log('   Copie apenas a parte depois de "code=", até o "&" (se houver)\n')

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

rl.question('Cole o código de autorização aqui: ', async (code) => {
  try {
    // Remover espaços e quebras de linha
    const cleanCode = code.trim()
    
    const { tokens } = await oauth2Client.getToken(cleanCode)
    
    console.log('\n=== ✅ TOKENS OBTIDOS COM SUCESSO! ===\n')
    console.log('Adicione estas linhas ao seu arquivo .env:\n')
    console.log(`GOOGLE_DRIVE_CLIENT_ID=${CLIENT_ID}`)
    console.log(`GOOGLE_DRIVE_CLIENT_SECRET=${CLIENT_SECRET}`)
    console.log(`GOOGLE_DRIVE_REFRESH_TOKEN=${tokens.refresh_token}`)
    console.log(`GOOGLE_DRIVE_FOLDER_ID=12CZeaVlNKMfO3gT5PpOFdVgvY7fEQ0Yq`)
    console.log('\n✨ Pronto! Agora reinicie o servidor da API.\n')
  } catch (error) {
    console.error('\n❌ Erro ao obter tokens:', error.message)
    console.error('\nVerifique se:')
    console.error('1. Você adicionou http://localhost nas URIs de redirecionamento')
    console.error('2. O código foi copiado corretamente (sem espaços)')
    console.error('3. O código não expirou (válido por ~10 minutos)\n')
  }
  
  rl.close()
})
