import env from '#start/env'
import axios from 'axios'
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

      console.log('🔍 Buscando crash metrics...')
      console.log('📦 Package:', packageName)
      console.log('📅 Período:', startDate, 'até', endDate)
      console.log('🔑 Auth configurado:', !!this.auth)
      console.log('🔌 API inicializada:', !!this.playDeveloperReporting)
      console.log('🎯 URL da requisição:', `apps/${packageName}/crashRateMetricSet:query`)

      const response = await this.playDeveloperReporting.vitals.crashrate.query({
        name: parent,
        requestBody: {
          dimensions: [], // Sem dimensões para pegar agregado total
          metrics: [
            'crashRate',
            'crashRate7dUserWeighted',
            'crashRate28dUserWeighted',
            'distinctUsers',
          ],
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

      console.log('✅ Crash metrics obtidos com sucesso')
      return this.formatCrashMetrics(response.data)
    } catch (error: any) {
      console.error('❌ Erro ao buscar crash metrics:')
      console.error('   Status:', error.status || error.code)
      console.error('   Mensagem:', error.message)
      console.error(
        '   Detalhes:',
        JSON.stringify(error.errors || error.response?.data || {}, null, 2)
      )

      if (error.status === 404 || error.code === 404) {
        throw new Error(
          `App "${packageName}" não encontrado no Google Play Console ou a Service Account não tem permissão. Verifique: 1) Se o app está publicado, 2) Se a Service Account tem acesso no Play Console, 3) Se já passaram 24-48h desde a configuração`
        )
      }
      if (error.status === 403 || error.code === 403) {
        throw new Error(
          `Service Account não tem permissão para acessar "${packageName}". Vá no Play Console → Configurações → Acesso à API → Conceda acesso para play-store-reporting@nutotia.iam.gserviceaccount.com`
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
          dimensions: [], // Sem dimensões para pegar agregado total
          metrics: ['anrRate', 'anrRate7dUserWeighted', 'anrRate28dUserWeighted', 'distinctUsers'],
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
    // Google Play API só tem dados até ontem (D-1)
    const endDate = new Date()
    endDate.setDate(endDate.getDate() - 1) // Ontem

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days - 1) // days + 1 dia atrás

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
          '⚠️  Google Play: App configurado mas sem dados ainda. Isso é normal para apps novos ou com poucos usuários. Aguarde 24-48h após o lançamento.'
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
          crashRate7dUserWeighted: 0,
          crashRate28dUserWeighted: 0,
        },
        totals: {
          distinctUsers: 0,
        },
        timeline: [],
      },
      anrs: {
        averages: {
          anrRate: 0,
          anrRate7dUserWeighted: 0,
          anrRate28dUserWeighted: 0,
        },
        totals: {
          distinctUsers: 0,
        },
        timeline: [],
      },
      _note:
        'Dados ainda não disponíveis. A API do Google Play precisa de 24-48h após o lançamento e volume mínimo de usuários.',
      generatedAt: new Date().toISOString(),
    }
  }

  /**
   * Formata dados de crashes
   */
  private formatCrashMetrics(data: any) {
    const rows = data.rows || []

    let totalCrashRate = 0
    let totalCrashRate7d = 0
    let totalCrashRate28d = 0
    let totalDistinctUsers = 0

    const timeline = rows.map((row: any) => {
      const metricsArray = row.metrics || []

      // Converter array de métricas para objeto
      const metricsObj: any = {}
      metricsArray.forEach((m: any) => {
        metricsObj[m.metric] = Number.parseFloat(m.decimalValue?.value || '0')
      })

      totalCrashRate += metricsObj.crashRate || 0
      totalCrashRate7d += metricsObj.crashRate7dUserWeighted || 0
      totalCrashRate28d += metricsObj.crashRate28dUserWeighted || 0
      totalDistinctUsers += metricsObj.distinctUsers || 0

      return {
        crashRate: metricsObj.crashRate || 0,
        crashRate7dUserWeighted: metricsObj.crashRate7dUserWeighted || 0,
        crashRate28dUserWeighted: metricsObj.crashRate28dUserWeighted || 0,
        distinctUsers: metricsObj.distinctUsers || 0,
      }
    })

    const count = rows.length || 1

    return {
      averages: {
        crashRate: totalCrashRate / count,
        crashRate7dUserWeighted: totalCrashRate7d / count,
        crashRate28dUserWeighted: totalCrashRate28d / count,
      },
      totals: {
        distinctUsers: totalDistinctUsers,
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
    let totalAnrRate7d = 0
    let totalAnrRate28d = 0
    let totalDistinctUsers = 0

    const timeline = rows.map((row: any) => {
      const metricsArray = row.metrics || []

      // Converter array de métricas para objeto
      const metricsObj: any = {}
      metricsArray.forEach((m: any) => {
        metricsObj[m.metric] = Number.parseFloat(m.decimalValue?.value || '0')
      })

      totalAnrRate += metricsObj.anrRate || 0
      totalAnrRate7d += metricsObj.anrRate7dUserWeighted || 0
      totalAnrRate28d += metricsObj.anrRate28dUserWeighted || 0
      totalDistinctUsers += metricsObj.distinctUsers || 0

      return {
        anrRate: metricsObj.anrRate || 0,
        anrRate7dUserWeighted: metricsObj.anrRate7dUserWeighted || 0,
        anrRate28dUserWeighted: metricsObj.anrRate28dUserWeighted || 0,
        distinctUsers: metricsObj.distinctUsers || 0,
      }
    })

    const count = rows.length || 1

    return {
      averages: {
        anrRate: totalAnrRate / count,
        anrRate7dUserWeighted: totalAnrRate7d / count,
        anrRate28dUserWeighted: totalAnrRate28d / count,
      },
      totals: {
        distinctUsers: totalDistinctUsers,
      },
      timeline,
    }
  }

  /**
   * MÉTODO ALTERNATIVO: Testa acesso direto à API usando axios
   * Útil para debug e verificar se o problema é com googleapis ou com a API
   */
  async testDirectApiAccess(packageName: string) {
    await this.ensureInitialized()

    try {
      if (!this.auth) {
        throw new Error('Auth não inicializado')
      }

      console.log('🧪 Testando acesso direto à API com axios...')
      console.log('📦 Package:', packageName)

      // Obtém o access token do GoogleAuth
      const client = await this.auth.getClient()
      const accessToken = await client.getAccessToken()

      if (!accessToken.token) {
        throw new Error('Não foi possível obter access token')
      }

      console.log('🔑 Access token obtido:', accessToken.token.substring(0, 50) + '...')

      // Tenta acessar diretamente a API
      const url = `https://playdeveloperreporting.googleapis.com/v1beta1/apps/${packageName}/crashRateMetricSet`

      console.log('🌐 URL:', url)

      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${accessToken.token}`,
          'Content-Type': 'application/json',
        },
        validateStatus: () => true, // Aceita qualquer status para vermos o erro
      })

      console.log('📨 Status:', response.status)
      console.log('📨 Status Text:', response.statusText)
      console.log('📦 Data:', JSON.stringify(response.data, null, 2))
      console.log('📋 Headers:', JSON.stringify(response.headers, null, 2))

      return {
        success: response.status >= 200 && response.status < 300,
        status: response.status,
        statusText: response.statusText,
        data: response.data,
        headers: response.headers,
      }
    } catch (error: any) {
      console.error('❌ Erro no teste direto:')
      console.error('   Mensagem:', error.message)
      console.error('   Response:', error.response?.data)
      console.error('   Status:', error.response?.status)
      console.error('   Headers:', error.response?.headers)

      return {
        success: false,
        error: error.message,
        response: error.response?.data,
        status: error.response?.status,
        headers: error.response?.headers,
      }
    }
  }

  /**
   * MÉTODO ALTERNATIVO 2: Query com axios (POST)
   */
  async testDirectQuery(packageName: string, startDate: string, endDate: string) {
    await this.ensureInitialized()

    try {
      if (!this.auth) {
        throw new Error('Auth não inicializado')
      }

      console.log('🧪 Testando query direto com axios...')
      console.log('📦 Package:', packageName)
      console.log('📅 Período:', startDate, 'até', endDate)

      // Obtém o access token
      const client = await this.auth.getClient()
      const accessToken = await client.getAccessToken()

      if (!accessToken.token) {
        throw new Error('Não foi possível obter access token')
      }

      // URL para query
      const url = `https://playdeveloperreporting.googleapis.com/v1beta1/apps/${packageName}/crashRateMetricSet:query`

      console.log('🌐 URL:', url)

      const requestBody = {
        dimensions: [], // Sem dimensões para pegar agregado total
        metrics: [
          'crashRate',
          'crashRate7dUserWeighted',
          'crashRate28dUserWeighted',
          'distinctUsers',
        ],
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
      }

      console.log('📤 Request Body:', JSON.stringify(requestBody, null, 2))

      const response = await axios.post(url, requestBody, {
        headers: {
          'Authorization': `Bearer ${accessToken.token}`,
          'Content-Type': 'application/json',
        },
        validateStatus: () => true,
      })

      console.log('📨 Status:', response.status)
      console.log('📨 Status Text:', response.statusText)
      console.log('📦 Data:', JSON.stringify(response.data, null, 2))

      return {
        success: response.status >= 200 && response.status < 300,
        status: response.status,
        statusText: response.statusText,
        data: response.data,
      }
    } catch (error: any) {
      console.error('❌ Erro no teste direto query:')
      console.error('   Mensagem:', error.message)
      console.error('   Response:', error.response?.data)
      console.error('   Status:', error.response?.status)

      return {
        success: false,
        error: error.message,
        response: error.response?.data,
        status: error.response?.status,
      }
    }
  }
}

export default new GooglePlayReportingService()
