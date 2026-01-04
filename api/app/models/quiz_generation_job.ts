import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export default class QuizGenerationJob extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare bookName: string

  @column()
  declare bibleVersion: string

  @column()
  declare chapter: number | null

  @column()
  declare totalChapters: number

  @column()
  declare processedChapters: number

  @column()
  declare createdQuizzes: string // JSON array de capítulos criados

  @column()
  declare errors: string | null // JSON array de erros

  @column()
  declare status: 'pending' | 'processing' | 'completed' | 'failed'

  @column()
  declare progress: number // 0-100

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @column.dateTime()
  declare completedAt: DateTime | null
}
