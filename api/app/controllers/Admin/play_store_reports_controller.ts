import googlePlayReportingService from '#services/google_play_reporting_service'
import env from '#start/env'
import type { HttpContext } from '@adonisjs/core/http'

export default class PlayStoreReportsController {
  /**
   * Retorna estatísticas gerais do Google Play Console
   */
  async generalStats({ request, response }: HttpContext) {
    try {
      const { days = 30 } = request.qs()
      const packageName = env.get('GOOGLE_PLAY_PACKAGE_NAME', 'com.biblia.foco')

      const stats = await googlePlayReportingService.getGeneralStats(
        packageName,
        Number.parseInt(days)
      )

      return response.ok({
        success: true,
        data: stats,
      })
    } catch (error) {
      console.error('Erro ao buscar estatísticas do Play Store:', error)

      // Se o erro for de API não inicializada, retorna mensagem específica
      if (error.message?.includes('não inicializada')) {
        return response.badRequest({
          success: false,
          message:
            'Google Play Reporting API não configurada. Configure GOOGLE_PLAY_CREDENTIALS no arquivo .env',
          error: error.message,
        })
      }

      return response.internalServerError({
        success: false,
        message: 'Erro ao buscar estatísticas do Play Store',
        error: error.message,
      })
    }
  }

  /**
   * Retorna métricas de instalações
   */
  async installMetrics({ request, response }: HttpContext) {
    try {
      const { startDate, endDate } = request.qs()
      const packageName = env.get('GOOGLE_PLAY_PACKAGE_NAME', 'com.biblia.foco')

      if (!startDate || !endDate) {
        return response.badRequest({
          success: false,
          message: 'startDate e endDate são obrigatórios (formato: YYYY-MM-DD)',
        })
      }

      const metrics = await googlePlayReportingService.getInstallMetrics(
        packageName,
        startDate,
        endDate
      )

      return response.ok({
        success: true,
        data: metrics,
      })
    } catch (error) {
      console.error('Erro ao buscar métricas de instalação:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao buscar métricas de instalação',
      })
    }
  }

  /**
   * Retorna métricas de crashes
   */
  async crashMetrics({ request, response }: HttpContext) {
    try {
      const { startDate, endDate } = request.qs()
      const packageName = env.get('GOOGLE_PLAY_PACKAGE_NAME', 'com.biblia.foco')

      if (!startDate || !endDate) {
        return response.badRequest({
          success: false,
          message: 'startDate e endDate são obrigatórios (formato: YYYY-MM-DD)',
        })
      }

      const metrics = await googlePlayReportingService.getCrashMetrics(
        packageName,
        startDate,
        endDate
      )

      return response.ok({
        success: true,
        data: metrics,
      })
    } catch (error) {
      console.error('Erro ao buscar métricas de crash:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao buscar métricas de crash',
      })
    }
  }

  /**
   * Retorna métricas de ANR
   */
  async anrMetrics({ request, response }: HttpContext) {
    try {
      const { startDate, endDate } = request.qs()
      const packageName = env.get('GOOGLE_PLAY_PACKAGE_NAME', 'com.biblia.foco')

      if (!startDate || !endDate) {
        return response.badRequest({
          success: false,
          message: 'startDate e endDate são obrigatórios (formato: YYYY-MM-DD)',
        })
      }

      const metrics = await googlePlayReportingService.getAnrMetrics(
        packageName,
        startDate,
        endDate
      )

      return response.ok({
        success: true,
        data: metrics,
      })
    } catch (error) {
      console.error('Erro ao buscar métricas de ANR:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao buscar métricas de ANR',
      })
    }
  }

  /**
   * TESTE: Acesso direto à API com axios (GET)
   */
  async testDirectAccess({ response }: HttpContext) {
    try {
      const packageName = env.get('GOOGLE_PLAY_PACKAGE_NAME', 'com.readbible.app')

      const result = await googlePlayReportingService.testDirectApiAccess(packageName)

      return response.ok({
        success: result.success,
        message: 'Teste de acesso direto à API',
        result,
      })
    } catch (error) {
      console.error('Erro ao testar acesso direto:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao testar acesso direto',
        error: error.message,
      })
    }
  }

  /**
   * TESTE: Query direto com axios (POST)
   */
  async testDirectQuery({ request, response }: HttpContext) {
    try {
      const { days = 7 } = request.qs()
      const packageName = env.get('GOOGLE_PLAY_PACKAGE_NAME', 'com.readbible.app')

      // Google Play API só tem dados até ontem (D-1)
      const endDate = new Date()
      endDate.setDate(endDate.getDate() - 1) // Ontem

      const startDate = new Date()
      startDate.setDate(startDate.getDate() - Number.parseInt(days) - 1) // days + 1 dia atrás

      const formatDate = (date: Date) => date.toISOString().split('T')[0]

      const result = await googlePlayReportingService.testDirectQuery(
        packageName,
        formatDate(startDate),
        formatDate(endDate)
      )

      return response.ok({
        success: result.success,
        message: 'Teste de query direto à API',
        result,
      })
    } catch (error) {
      console.error('Erro ao testar query direto:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao testar query direto',
        error: error.message,
      })
    }
  }
}
