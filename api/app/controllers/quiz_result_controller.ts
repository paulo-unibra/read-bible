import Quiz from '#models/quiz'
import QuizResult from '#models/quiz_result'
import User from '#models/user'
import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'

export default class QuizResultController {
  /**
   * Salvar resultado do quiz
   * POST /quiz-results
   */
  async store({ request, response, auth }: HttpContext) {
    try {
      const user = auth.user!
      const quizId = Number(request.input('quizId'))
      const answers = request.input('answers')
      const timeSeconds = Number(request.input('timeSeconds'))

      if (
        !Number.isSafeInteger(quizId) ||
        quizId <= 0 ||
        !Array.isArray(answers) ||
        !Number.isInteger(timeSeconds) ||
        timeSeconds < 0 ||
        timeSeconds > 7200
      ) {
        return response.badRequest({
          success: false,
          message: 'Dados do resultado inválidos',
        })
      }

      const quiz = await Quiz.query().where('id', quizId).preload('questions').first()
      if (!quiz) {
        return response.notFound({
          success: false,
          message: 'Quiz não encontrado',
        })
      }

      const questions = quiz.questions
      if (questions.length === 0 || answers.length !== questions.length) {
        return response.badRequest({
          success: false,
          message: 'É necessário enviar uma resposta para cada questão',
        })
      }

      const outcome = await db.transaction(async (trx) => {
        await User.query({ client: trx }).where('id', user.id).forUpdate().firstOrFail()

        const previousResult = await QuizResult.query({ client: trx })
          .where('user_id', user.id)
          .where('quiz_id', quizId)
          .first()

        if (previousResult) {
          return { result: previousResult, alreadyRecorded: true, invalidAnswers: false }
        }

        const questionById = new Map(questions.map((question) => [question.questionId, question]))
        const seenQuestionIds = new Set<string>()
        let correctAnswers = 0

        for (const submitted of answers) {
          if (
            !submitted ||
            typeof submitted.questionId !== 'string' ||
            typeof submitted.answer !== 'string' ||
            seenQuestionIds.has(submitted.questionId)
          ) {
            return { result: null, alreadyRecorded: false, invalidAnswers: true }
          }

          const question = questionById.get(submitted.questionId)
          if (
            !question ||
            (submitted.answer !== '' && !question.alternativas.includes(submitted.answer))
          ) {
            return { result: null, alreadyRecorded: false, invalidAnswers: true }
          }

          seenQuestionIds.add(submitted.questionId)
          if (submitted.answer !== '' && submitted.answer === question.respostaCorreta) {
            correctAnswers += 1
          }
        }

        if (seenQuestionIds.size !== questions.length) {
          return { result: null, alreadyRecorded: false, invalidAnswers: true }
        }

        const totalQuestions = questions.length
        const score = Math.round((correctAnswers / totalQuestions) * 100)
        const result = await QuizResult.create(
          {
            userId: user.id,
            quizId,
            correctAnswers,
            totalQuestions,
            score,
            timeSeconds,
          },
          { client: trx }
        )

        return { result, alreadyRecorded: false, invalidAnswers: false }
      })

      if (outcome.invalidAnswers || !outcome.result) {
        return response.badRequest({ success: false, message: 'Respostas inválidas' })
      }

      const responseBody = {
        success: true,
        result: {
          id: outcome.result.id,
          quizId: outcome.result.quizId,
          correctAnswers: outcome.result.correctAnswers,
          totalQuestions: outcome.result.totalQuestions,
          score: outcome.result.score,
          timeSeconds: outcome.result.timeSeconds,
          createdAt: outcome.result.createdAt,
        },
        message: 'Resultado salvo com sucesso',
        alreadyRecorded: outcome.alreadyRecorded,
      }

      return outcome.alreadyRecorded ? response.ok(responseBody) : response.created(responseBody)
    } catch (error) {
      console.error('[QuizResultController] Erro ao salvar resultado:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao salvar resultado',
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
      const requestedLimit = Number.parseInt(String(request.input('limit', '50')))
      const limit = Number.isFinite(requestedLimit)
        ? Math.min(Math.max(requestedLimit, 1), 100)
        : 50

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

      if (results.length === 0) {
        return response.ok({
          success: true,
          ranking: [],
        })
      }

      const ranking = results.map((r, index) => {
        return {
          position: index + 1,
          userName: `Leitor ${index + 1}`,
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
