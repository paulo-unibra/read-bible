import Quiz from '#models/quiz'
import QuizResult from '#models/quiz_result'
import User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'

export default class QuizResultController {
  /**
   * Salvar resultado do quiz
   * POST /quiz-results
   */
  async store({ request, response, auth }: HttpContext) {
    try {
      const user = auth.user!
      const { quizId, correctAnswers, totalQuestions, timeSeconds } = request.only([
        'quizId',
        'correctAnswers',
        'totalQuestions',
        'timeSeconds',
      ])

      console.log('[QuizResultController] Salvando resultado:', {
        userId: user.id,
        quizId,
        correctAnswers,
        totalQuestions,
      })

      if (!quizId || correctAnswers === undefined || !totalQuestions) {
        return response.badRequest({
          success: false,
          message: 'quizId, correctAnswers e totalQuestions são obrigatórios',
        })
      }

      // Verificar se o quiz existe
      const quiz = await Quiz.find(quizId)
      if (!quiz) {
        return response.notFound({
          success: false,
          message: 'Quiz não encontrado',
        })
      }

      // Calcular score (0-100)
      const score = Math.round((correctAnswers / totalQuestions) * 100)

      const result = await QuizResult.create({
        userId: user.id,
        quizId,
        correctAnswers,
        totalQuestions,
        score,
        timeSeconds: timeSeconds || null,
      })

      console.log('[QuizResultController] Resultado salvo com ID:', result.id)

      return response.created({
        success: true,
        result: {
          id: result.id,
          quizId: result.quizId,
          correctAnswers: result.correctAnswers,
          totalQuestions: result.totalQuestions,
          score: result.score,
          timeSeconds: result.timeSeconds,
          createdAt: result.createdAt,
        },
        message: 'Resultado salvo com sucesso',
      })
    } catch (error) {
      console.error('[QuizResultController] Erro ao salvar resultado:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao salvar resultado',
        error: error.message,
      })
    }
  }

  /**
   * Buscar histórico de resultados do usuário
   * GET /quiz-results/me
   */
  async myResults({ response, auth }: HttpContext) {
    try {
      const user = auth.user!

      const results = await QuizResult.query()
        .where('user_id', user.id)
        .preload('quiz')
        .orderBy('created_at', 'desc')

      return response.ok({
        success: true,
        results: results.map((r) => ({
          id: r.id,
          quiz: {
            id: r.quiz.id,
            bookName: r.quiz.bookName,
            chapter: r.quiz.chapter,
            bibleVersion: r.quiz.bibleVersion,
          },
          correctAnswers: r.correctAnswers,
          totalQuestions: r.totalQuestions,
          score: r.score,
          timeSeconds: r.timeSeconds,
          createdAt: r.createdAt,
        })),
      })
    } catch (error) {
      console.error('[QuizResultController] Erro ao buscar resultados:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao buscar resultados',
        error: error.message,
      })
    }
  }

  /**
   * Ranking geral de quizzes
   * GET /quiz-results/ranking
   */
  async ranking({ request, response }: HttpContext) {
    try {
      const { limit = 50 } = request.qs()

      // Buscar top usuários por pontuação média
      const results = await QuizResult.query()
        .select('user_id')
        .avg('score as avg_score')
        .count('* as total_quizzes')
        .sum('correct_answers as total_correct')
        .sum('total_questions as total_questions')
        .groupBy('user_id')
        .orderBy('avg_score', 'desc')
        .limit(limit)

      console.log('[QuizResultController] Results raw:', JSON.stringify(results[0]))

      // Se não há resultados, retornar ranking vazio
      if (results.length === 0) {
        console.log('[QuizResultController] Nenhum resultado encontrado, retornando ranking vazio')
        return response.ok({
          success: true,
          ranking: [],
        })
      }

      // Buscar dados dos usuários
      const userIds = results.map((r) => r.userId || r.$extras.user_id)
      console.log('[QuizResultController] UserIds encontrados:', userIds)

      if (userIds.length === 0) {
        console.log('[QuizResultController] UserIds vazio, retornando ranking vazio')
        return response.ok({
          success: true,
          ranking: [],
        })
      }

      const users = await User.query().whereIn('id', userIds)

      const ranking = results.map((r, index) => {
        const userId = r.userId || r.$extras.user_id
        const user = users.find((u) => u.id === userId)
        return {
          position: index + 1,
          userId: userId,
          userName: user?.fullName || 'Usuário',
          avgScore: Math.round(r.$extras.avg_score),
          totalQuizzes: r.$extras.total_quizzes,
          totalCorrect: r.$extras.total_correct,
          totalQuestions: r.$extras.total_questions,
        }
      })

      return response.ok({
        success: true,
        ranking,
      })
    } catch (error) {
      console.error('[QuizResultController] Erro ao buscar ranking:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao buscar ranking',
        error: error.message,
      })
    }
  }

  /**
   * Estatísticas do usuário
   * GET /quiz-results/stats
   */
  async stats({ response, auth }: HttpContext) {
    try {
      const user = auth.user!

      const stats = await QuizResult.query()
        .where('user_id', user.id)
        .select('user_id')
        .avg('score as avg_score')
        .count('* as total_quizzes')
        .sum('correct_answers as total_correct')
        .sum('total_questions as total_questions')
        .first()

      if (!stats) {
        return response.ok({
          success: true,
          stats: {
            avgScore: 0,
            totalQuizzes: 0,
            totalCorrect: 0,
            totalQuestions: 0,
          },
        })
      }

      return response.ok({
        success: true,
        stats: {
          avgScore: Math.round(stats.$extras.avg_score || 0),
          totalQuizzes: stats.$extras.total_quizzes || 0,
          totalCorrect: stats.$extras.total_correct || 0,
          totalQuestions: stats.$extras.total_questions || 0,
        },
      })
    } catch (error) {
      console.error('[QuizResultController] Erro ao buscar estatísticas:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao buscar estatísticas',
        error: error.message,
      })
    }
  }
}
