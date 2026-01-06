import env from '#start/env'
import { BaseCommand } from '@adonisjs/core/ace'
import { google } from 'googleapis'

export default class TestPlayConsole extends BaseCommand {
  static commandName = 'test:play-console'
  static description = 'Testa conexão com Google Play Console e verifica permissões'

  async run() {
    try {
      this.logger.info('🔍 Testando conexão com Google Play Console...\n')

      // Carrega credenciais
      const credentialsEnv = env.get('GOOGLE_PLAY_CREDENTIALS')

      if (!credentialsEnv || credentialsEnv === '') {
        this.logger.error('❌ GOOGLE_PLAY_CREDENTIALS não configurado no .env')
        return
      }

      const credentials = JSON.parse(credentialsEnv)
      this.logger.success('✅ Credenciais carregadas')
      this.logger.info(`📧 Service Account: ${credentials.client_email}\n`)

      // Inicializa autenticação
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/playdeveloperreporting'],
      })

      await auth.getClient()
      this.logger.success('✅ Autenticação bem-sucedida\n')

      // Tenta acessar API
      const playdeveloperreporting = google.playdeveloperreporting({
        version: 'v1beta1',
        auth: auth as any,
      })

      this.logger.info('🔍 Testando acesso ao app configurado...')
      const packageName = env.get('GOOGLE_PLAY_PACKAGE_NAME', 'com.readbible.app')
      this.logger.info(`📦 Package Name: ${packageName}\n`)

      try {
        // Tenta buscar métricas de crash dos últimos 7 dias
        const endDate = new Date()
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - 7)

        const parent = `apps/${packageName}`

        const response = await playdeveloperreporting.vitals.crashrate.query({
          name: parent,
          requestBody: {
            dimensions: ['DATE'],
            metrics: ['CRASH_RATE', 'DISTINCT_CRASHES'],
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

        this.logger.success('✅ App encontrado e acessível!')
        this.logger.info('📊 Métricas de crash disponíveis')
        this.logger.info(`   Total de pontos de dados: ${response.data.rows?.length || 0}`)
      } catch (error: any) {
        if (error.status === 404) {
          this.logger.error(`\n❌ App "${packageName}" NÃO ENCONTRADO\n`)
          this.logger.info('Possíveis causas:')
          this.logger.info('1. 📱 O app ainda não foi publicado na Google Play Store')
          this.logger.info('2. 🔐 A Service Account não tem permissão para acessar este app')
          this.logger.info('3. 📝 O package name está incorreto\n')

          this.logger.info('Como corrigir:')
          this.logger.info('1. Acesse: https://play.google.com/console/')
          this.logger.info('2. Selecione seu app')
          this.logger.info('3. Vá em: Configurações > Acesso à API')
          this.logger.info(`4. Conceda acesso para: ${credentials.client_email}`)
          this.logger.info(
            '5. Marque as permissões: "View app information" e "View financial data"\n'
          )
        } else if (error.status === 403) {
          this.logger.error('\n❌ ACESSO NEGADO\n')
          this.logger.info('A Service Account não tem as permissões necessárias.')
          this.logger.info(`Service Account: ${credentials.client_email}\n`)

          this.logger.info('Como corrigir:')
          this.logger.info('1. Acesse: https://play.google.com/console/')
          this.logger.info('2. Vá em: Configurações > Acesso à API')
          this.logger.info(`3. Encontre: ${credentials.client_email}`)
          this.logger.info('4. Conceda as permissões necessárias\n')
        } else {
          this.logger.error('\n❌ Erro ao acessar API:', error.message)
        }
      }
    } catch (error: any) {
      this.logger.error('\n❌ Erro:', error.message)
    }
  }
}
