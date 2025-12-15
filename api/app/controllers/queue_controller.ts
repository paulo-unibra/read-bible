import type { HttpContext } from '@adonisjs/core/http'
import QueueService from '#services/queue_service'

export default class QueueController {
  // Criar job para gerar quizzes de todo um livro
  async createBookJob({ request, response }: HttpContext) {
    try {
      const { bookName, bibleVersion } = request.only(['bookName', 'bibleVersion'])

      if (!bookName || !bibleVersion) {
        return response.badRequest({
          error: 'bookName e bibleVersion são obrigatórios',
        })
      }

      const bookJob = QueueService.createBookJob(bookName, bibleVersion)

      return response.created({
        success: true,
        message: `Job criado para ${bookName} - ${bookJob.totalChapters} capítulos serão processados`,
        jobId: bookJob.id,
        bookJob: {
          id: bookJob.id,
          bookName: bookJob.bookName,
          bibleVersion: bookJob.bibleVersion,
          totalChapters: bookJob.totalChapters,
          completedChapters: bookJob.completedChapters,
          status: bookJob.status,
          createdAt: bookJob.createdAt,
        },
      })
    } catch (error) {
      console.error('[QueueController] Erro ao criar job:', error)
      return response.badRequest({
        error: error.message,
      })
    }
  }

  // Consultar status de um job
  async getJobStatus({ params, response }: HttpContext) {
    const { jobId } = params
    const bookJob = QueueService.getBookJob(jobId)

    if (!bookJob) {
      return response.notFound({
        error: 'Job não encontrado',
      })
    }

    return response.ok({
      success: true,
      bookJob: {
        id: bookJob.id,
        bookName: bookJob.bookName,
        bibleVersion: bookJob.bibleVersion,
        totalChapters: bookJob.totalChapters,
        completedChapters: bookJob.completedChapters,
        status: bookJob.status,
        createdAt: bookJob.createdAt,
        completedAt: bookJob.completedAt,
        progress: `${bookJob.completedChapters}/${bookJob.totalChapters}`,
        jobs: bookJob.jobs.map((j) => ({
          chapter: j.chapter,
          status: j.status,
          fileUrl: j.fileUrl,
          error: j.error,
        })),
      },
    })
  }

  // Listar todos os jobs
  async listJobs({ response }: HttpContext) {
    const allJobs = QueueService.getAllBookJobs()

    return response.ok({
      success: true,
      total: allJobs.length,
      jobs: allJobs.map((job) => ({
        id: job.id,
        bookName: job.bookName,
        bibleVersion: job.bibleVersion,
        totalChapters: job.totalChapters,
        completedChapters: job.completedChapters,
        status: job.status,
        progress: `${job.completedChapters}/${job.totalChapters}`,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
      })),
    })
  }

  // Listar livros disponíveis
  async listBooks({ response }: HttpContext) {
    const books = QueueService.getAvailableBooks()

    return response.ok({
      success: true,
      total: books.length,
      books,
    })
  }
}
