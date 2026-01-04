import QuizResult from '#models/quiz_result'
import ReadingPlan from '#models/reading_plan'
import ReadingProgress from '#models/reading_progress'
import User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

export default class ReportController {
  /**
   * Retorna estatísticas gerais do sistema
   */
  async getGeneralStats({ response }: HttpContext) {
    try {
      // Total de usuários cadastrados
      const totalUsers = await User.query().count('* as total')
      const totalUsersCount = Number(totalUsers[0].$extras.total)

      // Usuários com plano de leitura ativo
      const usersWithActivePlan = await db
        .from('reading_plans')
        .where('is_active', true)
        .countDistinct('user_id as total')
      const usersWithActivePlanCount = Number(usersWithActivePlan[0].total)

      // Usuários com leitura em dia (completaram a leitura de hoje)
      const today = new Date().toISOString().split('T')[0]
      const usersUpToDate = await db
        .from('reading_progress')
        .whereRaw('DATE(completed_at) = ?', [today])
        .where('is_completed', true)
        .countDistinct('reading_plan_id as total')
      const usersUpToDateCount = Number(usersUpToDate[0].total)

      // Total de planos de leitura criados
      const totalPlans = await ReadingPlan.query().count('* as total')
      const totalPlansCount = Number(totalPlans[0].$extras.total)

      // Total de dias de leitura completados
      const totalCompletedDays = await ReadingProgress.query()
        .where('is_completed', true)
        .whereNotNull('completed_at')
        .count('* as total')
      const totalCompletedDaysCount = Number(totalCompletedDays[0].$extras.total)

      // Usuários que completaram algum plano (completed_chapters >= total_chapters)
      const usersWithCompletedPlan = await db
        .from('reading_plans')
        .whereRaw('completed_chapters >= total_chapters')
        .countDistinct('user_id as total')
      const usersWithCompletedPlanCount = Number(usersWithCompletedPlan[0].total)

      // Total de questionários respondidos
      const totalQuizResults = await QuizResult.query().count('* as total')
      const totalQuizResultsCount = Number(totalQuizResults[0].$extras.total)

      // Usuários que já responderam questionários
      const usersWithQuizResults = await db.from('quiz_results').countDistinct('user_id as total')
      const usersWithQuizResultsCount = Number(usersWithQuizResults[0].total)

      // Média de acertos nos questionários
      const avgScore = await QuizResult.query().avg('score as avg')
      const avgScoreValue = Number(avgScore[0].$extras.avg) || 0

      // Usuários cadastrados nos últimos 30 dias
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const newUsers = await User.query()
        .where('created_at', '>=', thirtyDaysAgo.toISOString())
        .count('* as total')
      const newUsersCount = Number(newUsers[0].$extras.total)

      // Usuários ativos nos últimos 7 dias (que completaram alguma leitura)
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const activeUsers = await db
        .from('reading_progress')
        .where('completed_at', '>=', sevenDaysAgo.toISOString())
        .where('is_completed', true)
        .countDistinct('reading_plan_id as total')
      const activeUsersCount = Number(activeUsers[0].total)

      // Planos de leitura por tipo
      const plansByType = await db
        .from('reading_plans')
        .select('type')
        .count('* as total')
        .groupBy('type')

      const planTypeStats = plansByType.reduce(
        (acc, item) => {
          acc[item.type] = Number(item.total)
          return acc
        },
        {} as Record<string, number>
      )

      return response.ok({
        users: {
          total: totalUsersCount,
          withActivePlan: usersWithActivePlanCount,
          upToDate: usersUpToDateCount,
          withCompletedPlan: usersWithCompletedPlanCount,
          withQuizResults: usersWithQuizResultsCount,
          newInLast30Days: newUsersCount,
          activeInLast7Days: activeUsersCount,
        },
        readingPlans: {
          total: totalPlansCount,
          totalCompletedDays: totalCompletedDaysCount,
          byType: planTypeStats,
        },
        quizzes: {
          totalResults: totalQuizResultsCount,
          averageScore: Math.round(avgScoreValue * 100) / 100,
        },
        generatedAt: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Erro ao gerar relatório:', error)
      return response.internalServerError({
        error: 'Erro ao gerar relatório de estatísticas',
      })
    }
  }
}
