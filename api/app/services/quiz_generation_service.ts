import Quiz from '#models/quiz'
import QuizQuestion from '#models/quiz_question'
import QuizGenerationJob from '#models/quiz_generation_job'
import DeepSeekService from '#services/deep_seek_service'
import { DateTime } from 'luxon'

export default class QuizGenerationService {
  /**
   * Processa a geração de quizzes em background
   */
  async processJob(jobId: number) {
    const job = await QuizGenerationJob.findOrFail(jobId)

    console.log(`[JOB ${jobId}] 🚀 Iniciando processamento`)
    console.log(`[JOB ${jobId}] 📖 Livro: ${job.bookName}`)
    console.log(`[JOB ${jobId}] 📚 Versão: ${job.bibleVersion}`)
    console.log(`[JOB ${jobId}] 📝 Total de capítulos: ${job.totalChapters}`)

    try {
      job.status = 'processing'
      await job.save()

      const deepSeekService = new DeepSeekService()
      const createdQuizzes: number[] = []
      const errors: string[] = []

      // Se chapter foi especificado, gera apenas um
      if (job.chapter !== null) {
        console.log(`[JOB ${jobId}] 📄 Gerando apenas capítulo ${job.chapter}`)
        
        await this.generateSingleQuiz(
          job.bookName,
          job.chapter,
          job.bibleVersion,
          deepSeekService,
          createdQuizzes,
          errors
        )
        
        job.processedChapters = 1
        job.progress = 100
      } else {
        // Gera para todos os capítulos
        console.log(`[JOB ${jobId}] 🔄 Gerando livro completo...`)
        
        for (let chapterNum = 1; chapterNum <= job.totalChapters; chapterNum++) {
          console.log(`[JOB ${jobId}] ⏳ Processando capítulo ${chapterNum}/${job.totalChapters}...`)
          
          await this.generateSingleQuiz(
            job.bookName,
            chapterNum,
            job.bibleVersion,
            deepSeekService,
            createdQuizzes,
            errors
          )

          job.processedChapters = chapterNum
          job.progress = Math.round((chapterNum / job.totalChapters) * 100)
          job.createdQuizzes = JSON.stringify(createdQuizzes)
          job.errors = errors.length > 0 ? JSON.stringify(errors) : null
          await job.save()

          console.log(`[JOB ${jobId}] ✅ Capítulo ${chapterNum} processado (${job.progress}%)`)

          // Pequeno delay para não sobrecarregar a API
          await this.delay(1000)
        }
      }

      job.status = 'completed'
      job.completedAt = DateTime.now()
      job.createdQuizzes = JSON.stringify(createdQuizzes)
      job.errors = errors.length > 0 ? JSON.stringify(errors) : null
      await job.save()

      console.log(`[JOB ${jobId}] 🎉 Processamento concluído!`)
      console.log(`[JOB ${jobId}] ✅ Capítulos criados: ${createdQuizzes.length}`)
      console.log(`[JOB ${jobId}] ⚠️  Erros: ${errors.length}`)
    } catch (error) {
      console.error(`[JOB ${jobId}] ❌ Erro ao processar job:`, error)
      job.status = 'failed'
      job.errors = JSON.stringify([error.message])
      await job.save()
    }
  }

  private async generateSingleQuiz(
    bookName: string,
    chapter: number,
    bibleVersion: string,
    deepSeekService: DeepSeekService,
    createdQuizzes: number[],
    errors: string[]
  ) {
    try {
      // Verificar se quiz já existe
      const existingQuiz = await Quiz.query()
        .where('book_name', bookName)
        .where('chapter', chapter)
        .where('bible_version', bibleVersion)
        .first()

      if (existingQuiz) {
        const msg = `Capítulo ${chapter}: já existe`
        console.log(`   ⚠️  ${msg}`)
        errors.push(msg)
        return
      }

      console.log(`   🤖 Gerando com IA: ${bookName} ${chapter} (${bibleVersion})`)

      // Gerar quiz usando DeepSeek
      const quizData = await deepSeekService.generateQuiz(
        bookName,
        chapter.toString(),
        bibleVersion
      )

      console.log(`   💾 Salvando ${quizData.questions.length} questões no banco...`)

      // Determinar testamento
      const testament = this.getTestament(bookName)

      // Salvar quiz no banco
      const quiz = await Quiz.create({
        bookName,
        chapter,
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

      createdQuizzes.push(chapter)
      console.log(`   ✅ Quiz criado com sucesso! (ID: ${quiz.id})`)
    } catch (error) {
      const msg = `Capítulo ${chapter}: ${error.message}`
      console.error(`   ❌ ${msg}`)
      errors.push(msg)
    }
  }

  private getTestament(bookName: string): 'old' | 'new' {
    const oldTestamentBooks = [
      'Gênesis', 'Êxodo', 'Levítico', 'Números', 'Deuteronômio',
      'Josué', 'Juízes', 'Rute', '1 Samuel', '2 Samuel',
      '1 Reis', '2 Reis', '1 Crônicas', '2 Crônicas', 'Esdras',
      'Neemias', 'Ester', 'Jó', 'Salmos', 'Provérbios',
      'Eclesiastes', 'Cânticos', 'Isaías', 'Jeremias', 'Lamentações',
      'Ezequiel', 'Daniel', 'Oséias', 'Joel', 'Amós',
      'Obadias', 'Jonas', 'Miquéias', 'Naum', 'Habacuque',
      'Sofonias', 'Ageu', 'Zacarias', 'Malaquias'
    ]

    return oldTestamentBooks.includes(bookName) ? 'old' : 'new'
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
