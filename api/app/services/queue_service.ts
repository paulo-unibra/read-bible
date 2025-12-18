import DeepSeekService from '#services/deep_seek_service'
import CloudStorageService from '#services/cloud_storage_service'
import env from '#start/env'

interface QueueJob {
  id: string
  bookName: string
  chapter: string
  bibleVersion: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  createdAt: Date
  completedAt?: Date
  fileUrl?: string
  error?: string
}

interface BookJob {
  id: string
  bookName: string
  bibleVersion: string
  totalChapters: number
  completedChapters: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  jobs: QueueJob[]
  createdAt: Date
  completedAt?: Date
}

export default class QueueService {
  private static bookJobs: Map<string, BookJob> = new Map()
  private static isProcessing = false

  // Mapeamento de livros e seus capítulos
  private static bookChapters: Record<string, number> = {
    // Antigo Testamento
    'Gênesis': 50, 'Êxodo': 40, 'Levítico': 27, 'Números': 36, 'Deuteronômio': 34,
    'Josué': 24, 'Juízes': 21, 'Rute': 4, '1 Samuel': 31, '2 Samuel': 24,
    '1 Reis': 22, '2 Reis': 25, '1 Crônicas': 29, '2 Crônicas': 36, 'Esdras': 10,
    'Neemias': 13, 'Ester': 10, 'Jó': 42, 'Salmos': 150, 'Provérbios': 31,
    'Eclesiastes': 12, 'Cantares': 8, 'Isaías': 66, 'Jeremias': 52, 'Lamentações': 5,
    'Ezequiel': 48, 'Daniel': 12, 'Oséias': 14, 'Joel': 3, 'Amós': 9,
    'Obadias': 1, 'Jonas': 4, 'Miquéias': 7, 'Naum': 3, 'Habacuque': 3,
    'Sofonias': 3, 'Ageu': 2, 'Zacarias': 14, 'Malaquias': 4,
    
    // Novo Testamento
    'Mateus': 28, 'Marcos': 16, 'Lucas': 24, 'João': 21, 'Atos': 28,
    'Romanos': 16, '1 Coríntios': 16, '2 Coríntios': 13, 'Gálatas': 6, 'Efésios': 6,
    'Filipenses': 4, 'Colossenses': 4, '1 Tessalonicenses': 5, '2 Tessalonicenses': 3,
    '1 Timóteo': 6, '2 Timóteo': 4, 'Tito': 3, 'Filemom': 1, 'Hebreus': 13,
    'Tiago': 5, '1 Pedro': 5, '2 Pedro': 3, '1 João': 5, '2 João': 1,
    '3 João': 1, 'Judas': 1, 'Apocalipse': 22
  }

  static createBookJob(bookName: string, bibleVersion: string): BookJob {
    const totalChapters = this.bookChapters[bookName]
    
    if (!totalChapters) {
      throw new Error(`Livro "${bookName}" não encontrado. Verifique o nome.`)
    }

    const jobId = `${bookName}-${bibleVersion}-${Date.now()}`
    const jobs: QueueJob[] = []

    // Criar jobs para cada capítulo
    for (let chapter = 1; chapter <= totalChapters; chapter++) {
      jobs.push({
        id: `${jobId}-cap${chapter}`,
        bookName,
        chapter: String(chapter),
        bibleVersion,
        status: 'pending',
        createdAt: new Date(),
      })
    }

    const bookJob: BookJob = {
      id: jobId,
      bookName,
      bibleVersion,
      totalChapters,
      completedChapters: 0,
      status: 'pending',
      jobs,
      createdAt: new Date(),
    }

    this.bookJobs.set(jobId, bookJob)
    console.log(`[Queue] Job criado: ${bookName} - ${totalChapters} capítulos`)

    // Iniciar processamento se não estiver rodando
    if (!this.isProcessing) {
      this.processQueue()
    }

    return bookJob
  }

  static getBookJob(jobId: string): BookJob | undefined {
    return this.bookJobs.get(jobId)
  }

  static getAllBookJobs(): BookJob[] {
    return Array.from(this.bookJobs.values())
  }

  static async processQueue() {
    if (this.isProcessing) return

    this.isProcessing = true
    console.log('[Queue] Iniciando processamento da fila...')

    while (true) {
      // Buscar próximo job pendente
      const bookJob = this.findNextPendingBookJob()
      if (!bookJob) {
        console.log('[Queue] Nenhum job pendente. Aguardando...')
        break
      }

      bookJob.status = 'processing'
      console.log(`[Queue] Processando: ${bookJob.bookName} (${bookJob.totalChapters} capítulos)`)

      // Processar cada capítulo
      for (const job of bookJob.jobs) {
        if (job.status !== 'pending') continue

        try {
          job.status = 'processing'
          console.log(`[Queue] Gerando quiz: ${job.bookName} ${job.chapter}`)

          const deepSeekService = new DeepSeekService()
          const quizData = await deepSeekService.generateQuiz(
            job.bookName,
            job.chapter,
            job.bibleVersion
          )

          // Upload para Cloud Storage
          const gcsCredentials = env.get('GCS_CREDENTIALS', '')
          const gcsBucket = env.get('GCS_BUCKET_NAME', '')

          if (gcsCredentials && gcsBucket) {
            const cloudStorageService = new CloudStorageService()
            const fileName = `${job.bibleVersion.toLowerCase()}-${job.bookName.toLowerCase().replace(/\s+/g, '-')}-${job.chapter}.json`
            job.fileUrl = await cloudStorageService.uploadQuiz(quizData, fileName)
          }

          job.status = 'completed'
          job.completedAt = new Date()
          bookJob.completedChapters++

          console.log(`[Queue] ✓ Capítulo ${job.chapter} concluído (${bookJob.completedChapters}/${bookJob.totalChapters})`)

          // Aguardar 2 segundos entre requisições (rate limit)
          await new Promise(resolve => setTimeout(resolve, 2000))

        } catch (error) {
          console.error(`[Queue] ✗ Erro no capítulo ${job.chapter}:`, error.message)
          job.status = 'failed'
          job.error = error.message
          job.completedAt = new Date()
        }
      }

      // Atualizar status do book job
      const allCompleted = bookJob.jobs.every(j => j.status === 'completed')
      const anyFailed = bookJob.jobs.some(j => j.status === 'failed')

      if (allCompleted) {
        bookJob.status = 'completed'
      } else if (anyFailed) {
        bookJob.status = 'failed'
      }

      bookJob.completedAt = new Date()
      console.log(`[Queue] Livro ${bookJob.bookName} finalizado: ${bookJob.completedChapters}/${bookJob.totalChapters} capítulos`)
    }

    this.isProcessing = false
    console.log('[Queue] Processamento concluído.')
  }

  private static findNextPendingBookJob(): BookJob | undefined {
    for (const bookJob of this.bookJobs.values()) {
      if (bookJob.status === 'pending') {
        return bookJob
      }
    }
    return undefined
  }

  static getAvailableBooks(): string[] {
    return Object.keys(this.bookChapters)
  }
}
