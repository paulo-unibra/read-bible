/**
 * Script para testar conexão com Google Play Console
 * e listar apps disponíveis
 */

import env from '#start/env'
import { google } from 'googleapis'

async function testPlayConsole() {
  try {
    console.log('🔍 Testando conexão com Google Play Console...\n')

    // Carrega credenciais
    const credentialsEnv = env.get('GOOGLE_PLAY_CREDENTIALS')

    if (!credentialsEnv || credentialsEnv === '') {
      console.error('❌ GOOGLE_PLAY_CREDENTIALS não configurado no .env')
      process.exit(1)
    }

    const credentials = JSON.parse(credentialsEnv)
    console.log('✅ Credenciais carregadas')
    console.log(`📧 Service Account: ${credentials.client_email}\n`)

    // Inicializa autenticação
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/playdeveloperreporting'],
    })

    const authClient = await auth.getClient()
    console.log('✅ Autenticação bem-sucedida\n')

    // Tenta acessar API
    const playdeveloperreporting = google.playdeveloperreporting({
      version: 'v1beta1',
      auth: authClient as any,
    })

    console.log('🔍 Testando acesso ao app configurado...')
    const packageName = env.get('GOOGLE_PLAY_PACKAGE_NAME', 'com.readbible.app')
    console.log(`📦 Package Name: ${packageName}\n`)

    try {
      // Tenta buscar métricas de instalação dos últimos 7 dias
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 7)

      const parent = `apps/${packageName}`

      const response = await playdeveloperreporting.vitals.crashrate.query({
        name: parent,
        requestBody: {
          dimensions: [],
          metrics: ['crashRate', 'distinctUsers'],
          timelineSpec: {
            aggregationPeriod: 'DAILY',
            startTime: {
              year: startDate.getFullYear(),
              month: startDate.getMonth() + 1,
              day: startDate.getDate(),
            },
            endTime: {
              year: endDate.getFullYear(),
              month: endDate.getMonth() + 1,
              day: endDate.getDate(),
            },
          },
        },
      })

      console.log('✅ App encontrado e acessível!')
      console.log('📊 Métricas disponíveis:', response.data)
    } catch (error: any) {
      if (error.status === 404) {
        console.error(`\n❌ App "${packageName}" NÃO ENCONTRADO\n`)
        console.log('Possíveis causas:')
        console.log('1. 📱 O app ainda não foi publicado na Google Play Store')
        console.log('2. 🔐 A Service Account não tem permissão para acessar este app')
        console.log('3. 📝 O package name está incorreto\n')

        console.log('Como corrigir:')
        console.log('1. Acesse: https://play.google.com/console/')
        console.log('2. Selecione seu app')
        console.log('3. Vá em: Configurações > Acesso à API')
        console.log(`4. Conceda acesso para: ${credentials.client_email}`)
        console.log('5. Marque as permissões: "View app information" e "View financial data"\n')

        console.log('📋 Apps que você tem no Play Console devem ser associados manualmente!')
      } else if (error.status === 403) {
        console.error('\n❌ ACESSO NEGADO\n')
        console.log('A Service Account não tem as permissões necessárias.')
        console.log(`Service Account: ${credentials.client_email}\n`)

        console.log('Como corrigir:')
        console.log('1. Acesse: https://play.google.com/console/')
        console.log('2. Vá em: Configurações > Acesso à API')
        console.log(`3. Encontre: ${credentials.client_email}`)
        console.log('4. Conceda as permissões necessárias\n')
      } else {
        console.error('\n❌ Erro ao acessar API:', error.message)
      }
    }
  } catch (error: any) {
    console.error('\n❌ Erro:', error.message)
    process.exit(1)
  }
}

// Executa o teste
testPlayConsole()
