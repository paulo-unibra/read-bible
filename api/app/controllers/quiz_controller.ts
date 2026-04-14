import Quiz from '#models/quiz'
import QuizQuestion from '#models/quiz_question'
import DeepSeekService from '#services/deep_seek_service'
import type { HttpContext } from '@adonisjs/core/http'

export default class QuizController {
  async generate({ request, response }: HttpContext) {
    console.log('[QuizController] Iniciando geração de quiz...')
    try {
      const { bookName, chapter, bibleVersion } = request.only([
        'bookName',
        'chapter',
        'bibleVersion',
      ])

      console.log('[QuizController] Dados recebidos:', {
        bookName,
        chapter,
        bibleVersion,
      })

      if (!bookName || !chapter || !bibleVersion) {
        console.log('[QuizController] Validação falhou - todos os campos são obrigatórios')
        return response.badRequest({
          error: 'bookName, chapter e bibleVersion são obrigatórios (ex: NVI, ARC, ARA, NVT)',
        })
      }

      // Verificar se quiz já existe no banco
      const existingQuiz = await Quiz.query()
        .where('book_name', bookName)
        .where('chapter', chapter)
        .where('bible_version', bibleVersion)
        .preload('questions')
        .first()

      if (existingQuiz) {
        console.log('[QuizController] Quiz já existe no banco, retornando cached')
        return response.ok({
          success: true,
          quiz: {
            name: `${bookName} ${chapter}`,
            category: existingQuiz.category,
            questions: existingQuiz.questions.map((q) => ({
              id: q.questionId,
              pergunta: q.pergunta,
              alternativas: q.alternativas,
              respostaCorreta: q.respostaCorreta,
            })),
          },
          message: 'Quiz recuperado do banco de dados',
          cached: true,
        })
      }

      // Gerar quiz usando DeepSeek
      // Gerar quiz usando DeepSeek
      const deepSeekService = new DeepSeekService()
      const quizData = await deepSeekService.generateQuiz(bookName, chapter, bibleVersion)

      console.log('[QuizController] Quiz gerado com sucesso')

      // Salvar quiz no banco de dados
      console.log('[QuizController] Salvando quiz no banco de dados...')
      const testament = this.getTestament(bookName)

      const quiz = await Quiz.create({
        bookName,
        chapter: parseInt(chapter),
        bibleVersion,
        testament,
        category: quizData.category,
        cloudStorageUrl: null,
      })

      // Salvar questões
      for (let i = 0; i < quizData.questions.length; i++) {
        const question = quizData.questions[i]
        await QuizQuestion.create({
          quizId: quiz.id,
          questionId: question.id,
          pergunta: question.pergunta,
          alternativas: question.alternativas,
          respostaCorreta: question.respostaCorreta,
          order: i + 1,
        })
      }

      console.log('[QuizController] Quiz salvo no banco com sucesso, ID:', quiz.id)

      console.log('[QuizController] Preparando resposta...')
      return response.ok({
        success: true,
        quiz: quizData,
        quizId: quiz.id,
        message: 'Quiz gerado e salvo no banco de dados',
      })
    } catch (error) {
      console.error('[QuizController] Erro ao gerar quiz:', error)
      return response.internalServerError({
        error: 'Falha ao gerar quiz',
        message: error.message,
      })
    }
  }

  /**
   * Determinar testamento baseado no livro
   */
  private getTestament(bookName: string): string {
    const oldTestamentBooks = [
      'Gênesis',
      'Êxodo',
      'Levítico',
      'Números',
      'Deuteronômio',
      'Josué',
      'Juízes',
      'Rute',
      '1 Samuel',
      '2 Samuel',
      '1 Reis',
      '2 Reis',
      '1 Crônicas',
      '2 Crônicas',
      'Esdras',
      'Neemias',
      'Ester',
      'Jó',
      'Salmos',
      'Provérbios',
      'Eclesiastes',
      'Cantares',
      'Isaías',
      'Jeremias',
      'Lamentações',
      'Ezequiel',
      'Daniel',
      'Oséias',
      'Joel',
      'Amós',
      'Obadias',
      'Jonas',
      'Miquéias',
      'Naum',
      'Habacuque',
      'Sofonias',
      'Ageu',
      'Zacarias',
      'Malaquias',
    ]

    return oldTestamentBooks.includes(bookName) ? 'old' : 'new'
  }

  /**
   * Listar todos os quizzes disponíveis
   */
  async list({ request, response }: HttpContext) {
    try {
      const { testament, bookName, bibleVersion } = request.qs()

      const query = Quiz.query().preload('questions', (q) => q.orderBy('order', 'asc'))

      if (testament) {
        query.where('testament', testament)
      }

      if (bookName) {
        query.where('book_name', bookName)
      }

      if (bibleVersion) {
        query.where('bible_version', bibleVersion)
      }

      const quizzes = await query.orderBy('created_at', 'desc')

      return response.ok({
        success: true,
        quizzes: quizzes.map((quiz) => ({
          id: quiz.id,
          bookName: quiz.bookName,
          chapter: quiz.chapter,
          bibleVersion: quiz.bibleVersion,
          testament: quiz.testament,
          category: quiz.category,
          questionsCount: quiz.questions.length,
          createdAt: quiz.createdAt,
        })),
      })
    } catch (error) {
      console.error('[QuizController] Erro ao listar quizzes:', error)
      return response.internalServerError({
        error: 'Falha ao listar quizzes',
        message: error.message,
      })
    }
  }

  /**
   * Buscar quiz específico
   */
  async show({ params, response }: HttpContext) {
    try {
      const quiz = await Quiz.query()
        .where('id', params.id)
        .preload('questions', (q) => q.orderBy('order', 'asc'))
        .firstOrFail()

      return response.ok({
        success: true,
        quiz: {
          id: quiz.id,
          name: `${quiz.bookName} ${quiz.chapter}`,
          bookName: quiz.bookName,
          chapter: quiz.chapter,
          bibleVersion: quiz.bibleVersion,
          testament: quiz.testament,
          category: quiz.category,
          questions: quiz.questions.map((q) => ({
            id: q.questionId,
            pergunta: q.pergunta,
            alternativas: q.alternativas,
            respostaCorreta: q.respostaCorreta,
          })),
          createdAt: quiz.createdAt,
        },
      })
    } catch (error) {
      console.error('[QuizController] Erro ao buscar quiz:', error)
      return response.notFound({
        error: 'Quiz não encontrado',
      })
    }
  }
}
