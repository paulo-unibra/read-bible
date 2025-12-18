import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import QuizQuestion from './quiz_question.js'

export default class Quiz extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare bookName: string

  @column()
  declare chapter: number

  @column()
  declare bibleVersion: string

  @column()
  declare testament: string

  @column()
  declare category: string

  @column()
  declare cloudStorageUrl: string | null

  @hasMany(() => QuizQuestion)
  declare questions: HasMany<typeof QuizQuestion>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}