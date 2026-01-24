import AudioSyncTimestamp from '#models/audio_sync_timestamp'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

export default class AudioSyncTimestampsController {
  /**
   * Salvar timestamps de sincronização para um capítulo
   * POST /audio-sync
   */
  async store({ request, response }: HttpContext) {
    try {
      const { bookId, chapterNumber, timestamps } = request.only([
        'bookId',
        'chapterNumber',
        'timestamps',
      ])

      // Validação básica
      if (!bookId || !chapterNumber || !Array.isArray(timestamps)) {
        return response.badRequest({
          error: 'bookId, chapterNumber e timestamps (array) são obrigatórios',
        })
      }

      // Usar transação para garantir atomicidade
      await db.transaction(async (trx) => {
        // Remover timestamps antigos deste capítulo
        await AudioSyncTimestamp.query({ client: trx })
          .where('book_id', bookId)
          .where('chapter_number', chapterNumber)
          .delete()

        // Inserir novos timestamps
        const records = timestamps.map((ts: { verseNumber: number; timestampMs: number }) => ({
          bookId: bookId,
          chapterNumber: chapterNumber,
          verseNumber: ts.verseNumber,
          timestampMs: ts.timestampMs,
        }))

        if (records.length > 0) {
          await AudioSyncTimestamp.createMany(records, { client: trx })
        }
      })

      return response.ok({
        success: true,
        message: `${timestamps.length} timestamps salvos com sucesso`,
      })
    } catch (error) {
      console.error('Error saving audio sync timestamps:', error)
      return response.internalServerError({
        error: 'Erro ao salvar timestamps',
      })
    }
  }

  /**
   * Buscar timestamps de sincronização de um capítulo
   * GET /audio-sync/:bookId/:chapterNumber
   */
  async show({ params, response }: HttpContext) {
    try {
      const { bookId, chapterNumber } = params

      const timestamps = await AudioSyncTimestamp.query()
        .where('book_id', bookId)
        .where('chapter_number', chapterNumber)
        .orderBy('verse_number', 'asc')

      return response.ok({
        success: true,
        data: timestamps.map((ts) => ({
          verseNumber: ts.verseNumber,
          timestampMs: ts.timestampMs,
        })),
      })
    } catch (error) {
      console.error('Error fetching audio sync timestamps:', error)
      return response.internalServerError({
        error: 'Erro ao buscar timestamps',
      })
    }
  }

  /**
   * Listar todos os capítulos com sincronização
   * GET /audio-sync/list
   */
  async list({ response }: HttpContext) {
    try {
      const syncs = await db
        .from('audio_sync_timestamps')
        .select('book_id', 'chapter_number')
        .count('* as total_verses')
        .groupBy('book_id', 'chapter_number')
        .orderBy('book_id')
        .orderBy('chapter_number')

      return response.ok({
        success: true,
        data: syncs.map((s) => ({
          bookId: s.book_id,
          chapterNumber: s.chapter_number,
          totalVerses: parseInt(s.total_verses),
        })),
      })
    } catch (error) {
      console.error('Error listing audio syncs:', error)
      return response.internalServerError({
        error: 'Erro ao listar sincronizações',
      })
    }
  }
}
