import env from '#start/env'
import { google } from 'googleapis'

/**
 * Service para integração com Google Play Developer Reporting API
 * Fornece estatísticas de instalações, crashes, ANRs, e métricas do app
 */
class GooglePlayReportingService {
  private playDeveloperReporting: any
  private auth: any
  private initializationPromise: Promise<void>
  private initialized: boolean = false

  constructor() {
    this.initializationPromise = this.initializeAuth()
  }

  /**
   * Garante que a API está inicializada antes de usar
   */
  private async ensureInitialized() {
    if (!this.initialized) {
      await this.initializationPromise
    }
  }

  /**
   * Inicializa a autenticação com Google Play Console
   */
  private async initializeAuth() {
    try {
      const credentialsEnv = env.get('GOOGLE_PLAY_CREDENTIALS')

      // Verifica se as credenciais estão configuradas
      if (!credentialsEnv || credentialsEnv === '' || credentialsEnv === 'undefined') {
        console.warn(
          '⚠️  Google Play Credentials não configuradas. Configure GOOGLE_PLAY_CREDENTIALS no .env para habilitar relatórios do Play Store.'
        )
        this.initialized = true
        return
      }

      // Carrega as credenciais do service account do env
      const credentials = JSON.parse(credentialsEnv)

      this.auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/playdeveloperreporting'],
      })

      this.playDeveloperReporting = google.playdeveloperreporting({
        version: 'v1beta1',
        auth: this.auth,
      })

      this.initialized = true
      console.log('✅ Google Play Reporting API inicializada com sucesso')
    } catch (error) {
      this.initialized = true
      console.error('❌ Erro ao inicializar Google Play Reporting:', error)
      console.error('💡 Verifique se GOOGLE_PLAY_CREDENTIALS está corretamente configurado no .env')
    }
  }

  /**
   * Busca métricas de crashes
   */
  async getCrashMetrics(packageName: string, startDate: string, endDate: string) {
    await this.ensureInitialized()

    try {
      if (!this.playDeveloperReporting) {
        throw new Error(
          'Google Play Reporting API não inicializada. Configure GOOGLE_PLAY_CREDENTIALS no .env'
        )
      }

      const parent = `apps/${packageName}`

      const response = await this.playDeveloperReporting.vitals.crashrate.query({
        name: parent,
        requestBody: {
          dimensions: ['DATE'],
          metrics: ['CRASH_RATE', 'CRASH_RATE_PER_USER_PERCENT', 'DISTINCT_CRASHES'],
          timelineSpec: {
            aggregationPeriod: 'DAILY',
            startTime: {
              year: Number.parseInt(startDate.split('-')[0]),
              month: Number.parseInt(startDate.split('-')[1]),
              day: Number.parseInt(startDate.split('-')[2]),
            },
            endTime: {
              year: Number.parseInt(endDate.split('-')[0]),
              month: Number.parseInt(endDate.split('-')[1]),
              day: Number.parseInt(endDate.split('-')[2]),
            },
          },
        },
      })

      return this.formatCrashMetrics(response.data)
    } catch (error: any) {
      if (error.status === 404) {
        throw new Error(
          `App "${packageName}" não encontrado no Google Play Console ou a Service Account não tem permissão. Verifique: 1) Se o app está publicado, 2) Se a Service Account tem acesso no Play Console`
        )
      }
      throw error
    }
  }

  /**
   * Busca métricas de ANRs (Application Not Responding)
   */
  async getAnrMetrics(packageName: string, startDate: string, endDate: string) {
    await this.ensureInitialized()

    try {
      if (!this.playDeveloperReporting) {
        throw new Error(
          'Google Play Reporting API não inicializada. Configure GOOGLE_PLAY_CREDENTIALS no .env'
        )
      }

      const parent = `apps/${packageName}`

      const response = await this.playDeveloperReporting.vitals.anrrate.query({
        name: parent,
        requestBody: {
          dimensions: ['DATE'],
          metrics: ['ANR_RATE', 'ANR_RATE_PER_USER_PERCENT', 'DISTINCT_ANRS'],
          timelineSpec: {
            aggregationPeriod: 'DAILY',
            startTime: {
              year: Number.parseInt(startDate.split('-')[0]),
              month: Number.parseInt(startDate.split('-')[1]),
              day: Number.parseInt(startDate.split('-')[2]),
            },
            endTime: {
              year: Number.parseInt(endDate.split('-')[0]),
              month: Number.parseInt(endDate.split('-')[1]),
              day: Number.parseInt(endDate.split('-')[2]),
            },
          },
        },
      })

      return this.formatAnrMetrics(response.data)
    } catch (error: any) {
      if (error.status === 404) {
        throw new Error(
          `App "${packageName}" não encontrado no Google Play Console ou a Service Account não tem permissão. Verifique: 1) Se o app está publicado, 2) Se a Service Account tem acesso no Play Console`
        )
      }
      throw error
    }
  }

  /**
   * Busca estatísticas gerais do app
   * NOTA: A API do Google Play Developer Reporting NÃO fornece dados de instalações
   * Apenas métricas de qualidade (crashes, ANRs, erros)
   */
  async getGeneralStats(packageName: string, days: number = 30) {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const formatDate = (date: Date) => date.toISOString().split('T')[0]

    try {
      const [crashMetrics, anrMetrics] = await Promise.all([
        this.getCrashMetrics(packageName, formatDate(startDate), formatDate(endDate)),
        this.getAnrMetrics(packageName, formatDate(startDate), formatDate(endDate)),
      ])

      return {
        period: {
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
          days,
        },
        installs: {
          totals: {
            installs: 0,
            uninstalls: 0,
            updates: 0,
            installEvents: 0,
          },
          timeline: [],
          _note: 'Dados de instalação não disponíveis na API do Google Play Developer Reporting',
        },
        crashes: crashMetrics,
        anrs: anrMetrics,
        generatedAt: new Date().toISOString(),
      }
    } catch (error: any) {
      // Se o erro for 404 (app não encontrado), retorna dados vazios ao invés de erro
      if (error.message?.includes('não encontrado')) {
        console.warn(
          '⚠️  Google Play: App não configurado ainda. Retornando dados vazios. Configure as permissões no Play Console para ver as métricas.'
        )
        return this.getEmptyStats(formatDate(startDate), formatDate(endDate), days)
      }

      console.error('Erro inesperado ao buscar estatísticas do Google Play:', error)

      throw error
    }
  }

  /**
   * Retorna estrutura de dados vazia quando o app não está configurado
   */
  private getEmptyStats(startDate: string, endDate: string, days: number) {
    return {
      period: {
        startDate,
        endDate,
        days,
      },
      installs: {
        totals: {
          installs: 0,
          uninstalls: 0,
          updates: 0,
          installEvents: 0,
        },
        timeline: [],
      },
      crashes: {
        averages: {
          crashRate: 0,
          crashRatePerUserPercent: 0,
        },
        totals: {
          distinctCrashes: 0,
        },
        timeline: [],
      },
      anrs: {
        averages: {
          anrRate: 0,
          anrRatePerUserPercent: 0,
        },
        totals: {
          distinctAnrs: 0,
        },
        timeline: [],
      },
      generatedAt: new Date().toISOString(),
      _note: 'Dados vazios: App não encontrado ou sem permissão. Configure no Google Play Console.',
    }
  }

  /**
   * Formata dados de crashes
   */
  private formatCrashMetrics(data: any) {
    const rows = data.rows || []

    let totalCrashRate = 0
    let totalCrashRatePerUser = 0
    let totalDistinctCrashes = 0

    const timeline = rows.map((row: any) => {
      const metrics = row.metrics || {}

      totalCrashRate += metrics.CRASH_RATE || 0
      totalCrashRatePerUser += metrics.CRASH_RATE_PER_USER_PERCENT || 0
      totalDistinctCrashes += metrics.DISTINCT_CRASHES || 0

      return {
        date: row.dimensions?.DATE,
        crashRate: metrics.CRASH_RATE || 0,
        crashRatePerUserPercent: metrics.CRASH_RATE_PER_USER_PERCENT || 0,
        distinctCrashes: metrics.DISTINCT_CRASHES || 0,
      }
    })

    const count = rows.length || 1

    return {
      averages: {
        crashRate: totalCrashRate / count,
        crashRatePerUserPercent: totalCrashRatePerUser / count,
      },
      totals: {
        distinctCrashes: totalDistinctCrashes,
      },
      timeline,
    }
  }

  /**
   * Formata dados de ANR
   */
  private formatAnrMetrics(data: any) {
    const rows = data.rows || []

    let totalAnrRate = 0
    let totalAnrRatePerUser = 0
    let totalDistinctAnrs = 0

    const timeline = rows.map((row: any) => {
      const metrics = row.metrics || {}

      totalAnrRate += metrics.ANR_RATE || 0
      totalAnrRatePerUser += metrics.ANR_RATE_PER_USER_PERCENT || 0
      totalDistinctAnrs += metrics.DISTINCT_ANRS || 0

      return {
        date: row.dimensions?.DATE,
        anrRate: metrics.ANR_RATE || 0,
        anrRatePerUserPercent: metrics.ANR_RATE_PER_USER_PERCENT || 0,
        distinctAnrs: metrics.DISTINCT_ANRS || 0,
      }
    })

    const count = rows.length || 1

    return {
      averages: {
        anrRate: totalAnrRate / count,
        anrRatePerUserPercent: totalAnrRatePerUser / count,
      },
      totals: {
        distinctAnrs: totalDistinctAnrs,
      },
      timeline,
    }
  }
}

export default new GooglePlayReportingService()
