import BibleBrainAudioTimestamp from '#models/bible_brain_audio_timestamp'
import bibleBrainService from '#services/bible_brain_service'

export interface VerseTimestamp {
  verseNumber: number
  timestampMs: number
}

/**
 * Centraliza a leitura/escrita dos timestamps de versículo por capítulo de
 * áudio das bíblias da BibleBrain. Usado tanto pela geração em massa do
 * pacote de áudio ("Gerar" no admin) quanto pelo endpoint público de
 * reprodução (fallback ao vivo + cache oportunista para pacotes antigos).
 */
export default class BibleBrainTimestampsService {
  static async getStored(
    bibleId: string,
    bookId: string,
    chapterNumber: number
  ): Promise<VerseTimestamp[]> {
    const rows = await BibleBrainAudioTimestamp.query()
      .where('bible_id', bibleId)
      .where('book_id', bookId)
      .where('chapter_number', chapterNumber)
      .orderBy('verse_number', 'asc')

    return rows.map((row) => ({ verseNumber: row.verseNumber, timestampMs: row.timestampMs }))
  }

  static async saveTimestamps(
    bibleId: string,
    bookId: string,
    chapterNumber: number,
    timestamps: VerseTimestamp[]
  ): Promise<void> {
    if (timestamps.length === 0) return

    await BibleBrainAudioTimestamp.query()
      .where('bible_id', bibleId)
      .where('book_id', bookId)
      .where('chapter_number', chapterNumber)
      .delete()

    await BibleBrainAudioTimestamp.createMany(
      timestamps.map((t) => ({
        bibleId,
        bookId,
        chapterNumber,
        verseNumber: t.verseNumber,
        timestampMs: t.timestampMs,
      }))
    )
  }

  private static parseExternalTimestamps(data: {
    data: Array<{ verse_start: number | string; timestamp: number | string }>
  }): VerseTimestamp[] {
    return (data.data || [])
      .filter((t) => Number(t.verse_start) > 0 && t.timestamp != null)
      .map((t) => ({
        verseNumber: Number(t.verse_start),
        timestampMs: Math.round(Number(t.timestamp) * 1000),
      }))
  }

  /**
   * Busca timestamps ao vivo na BibleBrain para um fileset específico e,
   * se encontrar, já salva no banco (usado durante a geração do pacote,
   * onde já sabemos exatamente qual fileset tem aquele capítulo).
   */
  static async fetchFromFilesetAndCache(
    bibleId: string,
    filesetId: string,
    bookId: string,
    chapterNumber: number
  ): Promise<VerseTimestamp[]> {
    const result = await bibleBrainService.getAudioTimestamps(filesetId, bookId, chapterNumber)
    const timestamps = this.parseExternalTimestamps(result)

    if (timestamps.length > 0) {
      await this.saveTimestamps(bibleId, bookId, chapterNumber, timestamps)
    }

    return timestamps
  }

  /**
   * Busca os timestamps de um capítulo tentando, em ordem: (1) já salvos no
   * nosso banco, (2) ao vivo na BibleBrain, testando cada fileset de áudio
   * disponível até um responder com dados. Quando a busca ao vivo funciona,
   * o resultado já é salvo para as próximas consultas não dependerem mais
   * da API externa. Usado pelo endpoint público de reprodução.
   */
  static async fetchWithFallback(
    bibleId: string,
    bookId: string,
    chapterNumber: number,
    audioFilesetIds: string[]
  ): Promise<VerseTimestamp[]> {
    const stored = await this.getStored(bibleId, bookId, chapterNumber)
    if (stored.length > 0) return stored

    for (const filesetId of audioFilesetIds) {
      try {
        const timestamps = await this.fetchFromFilesetAndCache(
          bibleId,
          filesetId,
          bookId,
          chapterNumber
        )
        if (timestamps.length > 0) return timestamps
      } catch {
        continue
      }
    }

    return []
  }
}
