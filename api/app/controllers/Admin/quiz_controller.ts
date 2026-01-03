import Quiz from '#models/quiz'
import QuizQuestion from '#models/quiz_question'
import DeepSeekService from '#services/deep_seek_service'
import type { HttpContext } from '@adonisjs/core/http'

export default class AdminQuizController {
  /**
   * Lista todos os quizzes (paginado)
   */
  async index({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const perPage = request.input('perPage', 20)
      const search = request.input('search', '')
      const testament = request.input('testament', '')
      const bibleVersion = request.input('bibleVersion', '')
      const bookName = request.input('bookName', '')

      const query = Quiz.query().preload('questions')

      if (search) {
        query.where('book_name', 'like', `%${search}%`)
      }

      if (bookName) {
        query.where('book_name', bookName)
      }

      if (testament) {
        query.where('testament', testament)
      }

      if (bibleVersion) {
        query.where('bible_version', bibleVersion)
      }

      const quizzes = await query
        .orderBy('book_name', 'asc')
        .orderBy('chapter', 'asc')
        .paginate(page, perPage)

      return response.ok({
        data: quizzes.all().map((quiz) => ({
          id: quiz.id,
          bookName: quiz.bookName,
          chapter: quiz.chapter,
          bibleVersion: quiz.bibleVersion,
          testament: quiz.testament,
          category: quiz.category,
          questionsCount: quiz.questions.length,
          createdAt: quiz.createdAt.toISO(),
          updatedAt: quiz.updatedAt.toISO(),
        })),
        meta: quizzes.getMeta(),
      })
    } catch (error) {
      console.error('Erro ao listar quizzes:', error)
      return response.internalServerError({
        error: 'Erro ao listar quizzes',
      })
    }
  }

  /**
   * Busca quiz específico com questões
   */
  async show({ params, response }: HttpContext) {
    try {
      const quiz = await Quiz.query()
        .where('id', params.id)
        .preload('questions', (q) => q.orderBy('order', 'asc'))
        .firstOrFail()

      return response.ok({
        id: quiz.id,
        bookName: quiz.bookName,
        chapter: quiz.chapter,
        bibleVersion: quiz.bibleVersion,
        testament: quiz.testament,
        category: quiz.category,
        cloudStorageUrl: quiz.cloudStorageUrl,
        questions: quiz.questions.map((q) => ({
          id: q.id,
          questionId: q.questionId,
          pergunta: q.pergunta,
          alternativas: q.alternativas,
          respostaCorreta: q.respostaCorreta,
          order: q.order,
        })),
        createdAt: quiz.createdAt.toISO(),
        updatedAt: quiz.updatedAt.toISO(),
      })
    } catch (error) {
      console.error('Erro ao buscar quiz:', error)
      return response.notFound({
        error: 'Quiz não encontrado',
      })
    }
  }

  /**
   * Cria novo quiz manualmente
   */
  async store({ request, response }: HttpContext) {
    try {
      const { bookName, chapter, bibleVersion, testament, category, questions } = request.only([
        'bookName',
        'chapter',
        'bibleVersion',
        'testament',
        'category',
        'questions',
      ])

      if (!bookName || !chapter || !bibleVersion) {
        return response.badRequest({
          error: 'bookName, chapter e bibleVersion são obrigatórios',
        })
      }

      // Verificar se quiz já existe
      const existingQuiz = await Quiz.query()
        .where('book_name', bookName)
        .where('chapter', chapter)
        .where('bible_version', bibleVersion)
        .first()

      if (existingQuiz) {
        return response.conflict({
          error: 'Quiz já existe para este livro, capítulo e versão',
        })
      }

      // Criar quiz
      const quiz = await Quiz.create({
        bookName,
        chapter: Number.parseInt(chapter),
        bibleVersion,
        testament: testament || this.getTestament(bookName),
        category: category || 'geral',
        cloudStorageUrl: null,
      })

      // Criar questões se fornecidas
      if (questions && Array.isArray(questions)) {
        for (const [i, question] of questions.entries()) {
          await QuizQuestion.create({
            quizId: quiz.id,
            questionId: question.questionId || `q${i + 1}`,
            pergunta: question.pergunta,
            alternativas: question.alternativas,
            respostaCorreta: question.respostaCorreta,
            order: i + 1,
          })
        }
      }

      // Recarregar com questões
      await quiz.load('questions')

      return response.created({
        id: quiz.id,
        message: 'Quiz criado com sucesso',
      })
    } catch (error) {
      console.error('Erro ao criar quiz:', error)
      return response.internalServerError({
        error: 'Erro ao criar quiz',
      })
    }
  }

  /**
   * Atualiza quiz existente
   */
  async update({ params, request, response }: HttpContext) {
    try {
      const quiz = await Quiz.findOrFail(params.id)

      const { bookName, chapter, bibleVersion, testament, category, questions } = request.only([
        'bookName',
        'chapter',
        'bibleVersion',
        'testament',
        'category',
        'questions',
      ])

      // Atualizar dados básicos
      quiz.merge({
        bookName: bookName || quiz.bookName,
        chapter: chapter ? Number.parseInt(chapter) : quiz.chapter,
        bibleVersion: bibleVersion || quiz.bibleVersion,
        testament: testament || quiz.testament,
        category: category || quiz.category,
      })

      await quiz.save()

      // Atualizar questões se fornecidas
      if (questions && Array.isArray(questions)) {
        // Deletar questões antigas
        await QuizQuestion.query().where('quiz_id', quiz.id).delete()

        // Criar novas questões
        for (const [i, question] of questions.entries()) {
          await QuizQuestion.create({
            quizId: quiz.id,
            questionId: question.questionId || `q${i + 1}`,
            pergunta: question.pergunta,
            alternativas: question.alternativas,
            respostaCorreta: question.respostaCorreta,
            order: i + 1,
          })
        }
      }

      return response.ok({
        message: 'Quiz atualizado com sucesso',
      })
    } catch (error) {
      console.error('Erro ao atualizar quiz:', error)
      return response.internalServerError({
        error: 'Erro ao atualizar quiz',
      })
    }
  }

  /**
   * Deleta quiz
   */
  async destroy({ params, response }: HttpContext) {
    try {
      const quiz = await Quiz.findOrFail(params.id)

      // Deletar questões associadas
      await QuizQuestion.query().where('quiz_id', quiz.id).delete()

      // Deletar quiz
      await quiz.delete()

      return response.ok({
        message: 'Quiz deletado com sucesso',
      })
    } catch (error) {
      console.error('Erro ao deletar quiz:', error)
      return response.internalServerError({
        error: 'Erro ao deletar quiz',
      })
    }
  }

  /**
   * Gera quiz usando IA (DeepSeek)
   */
  async generateWithAI({ request, response }: HttpContext) {
    try {
      const { bookName, chapter, bibleVersion } = request.only([
        'bookName',
        'chapter',
        'bibleVersion',
      ])

      if (!bookName || !chapter || !bibleVersion) {
        return response.badRequest({
          error: 'bookName, chapter e bibleVersion são obrigatórios',
        })
      }

      // Verificar se quiz já existe
      const existingQuiz = await Quiz.query()
        .where('book_name', bookName)
        .where('chapter', chapter)
        .where('bible_version', bibleVersion)
        .first()

      if (existingQuiz) {
        return response.conflict({
          error: 'Quiz já existe para este livro, capítulo e versão. Edite ou delete o existente.',
        })
      }

      // Gerar quiz usando DeepSeek
      const deepSeekService = new DeepSeekService()
      const quizData = await deepSeekService.generateQuiz(bookName, chapter, bibleVersion)

      // Salvar quiz no banco
      const testament = this.getTestament(bookName)
      const quiz = await Quiz.create({
        bookName,
        chapter: Number.parseInt(chapter),
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

      return response.created({
        id: quiz.id,
        message: 'Quiz gerado com IA com sucesso',
        questionsCount: quizData.questions.length,
      })
    } catch (error) {
      console.error('Erro ao gerar quiz com IA:', error)
      return response.internalServerError({
        error: 'Erro ao gerar quiz com IA',
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
   * Obter estatísticas dos quizzes
   */
  async stats({ response }: HttpContext) {
    try {
      const total = await Quiz.query().count('* as total')
      const byTestament = await Quiz.query()
        .select('testament')
        .count('* as count')
        .groupBy('testament')

      const byVersion = await Quiz.query()
        .select('bible_version')
        .count('* as count')
        .groupBy('bible_version')

      return response.ok({
        total: total[0].$extras.total,
        byTestament: byTestament.map((item) => ({
          testament: item.testament,
          count: item.$extras.count,
        })),
        byVersion: byVersion.map((item) => ({
          version: item.bibleVersion,
          count: item.$extras.count,
        })),
      })
    } catch (error) {
      console.error('Erro ao obter estatísticas:', error)
      return response.internalServerError({
        error: 'Erro ao obter estatísticas',
      })
    }
  }
}
