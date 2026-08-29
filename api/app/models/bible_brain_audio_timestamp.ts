import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

/**
 * Timestamps por versículo (em milissegundos) para o áudio narrado de uma
 * bíblia específica da BibleBrain. Importados durante a geração do pacote
 * de áudio ("Gerar" no admin) para que o app não dependa de uma chamada ao
 * vivo na API externa da BibleBrain durante a reprodução.
 */
export default class BibleBrainAudioTimestamp extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare bibleId: string

  @column()
  declare bookId: string

  @column()
  declare chapterNumber: number

  @column()
  declare verseNumber: number

  @column()
  declare timestampMs: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
