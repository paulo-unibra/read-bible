import type { HttpContext } from '@adonisjs/core/http'
import DeepSeekService from '#services/deep_seek_service'
import CloudStorageService from '#services/cloud_storage_service'
import env from '#start/env'

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

      // Gerar quiz usando DeepSeek
      const deepSeekService = new DeepSeekService()
      const quizData = await deepSeekService.generateQuiz(bookName, chapter, bibleVersion)

      console.log('[QuizController] Quiz gerado com sucesso')

      // Upload para Google Cloud Storage (opcional)
      console.log('[QuizController] Iniciando verificação do Cloud Storage...')
      let fileUrl = null
      const gcsCredentials = env.get('GCS_CREDENTIALS', '')
      const gcsBucket = env.get('GCS_BUCKET_NAME', '')

      if (gcsCredentials && gcsBucket) {
        console.log('[QuizController] Credenciais encontradas, tentando upload...')
        try {
          const cloudStorageService = new CloudStorageService()
          const fileName = `${bibleVersion.toLowerCase()}-${bookName.toLowerCase().replace(/\s+/g, '-')}-${chapter}.json`
          console.log('[QuizController] Nome do arquivo:', fileName)
          fileUrl = await cloudStorageService.uploadQuiz(quizData, fileName)
          console.log('[QuizController] Upload para Cloud Storage realizado:', fileUrl)
        } catch (storageError) {
          console.warn('[QuizController] Erro ao fazer upload:', storageError.message)
        }
      } else {
        console.log('[QuizController] Cloud Storage não configurado - pulando upload')
      }

      console.log('[QuizController] Preparando resposta...')
      return response.ok({
        success: true,
        quiz: quizData,
        fileUrl: fileUrl,
        message: fileUrl
          ? 'Quiz gerado e salvo no Cloud Storage'
          : 'Quiz gerado (armazenamento não configurado)',
      })
    } catch (error) {
      console.error('[QuizController] Erro ao gerar quiz:', error)
      return response.internalServerError({
        error: 'Falha ao gerar quiz',
        message: error.message,
      })
    }
  }
}
