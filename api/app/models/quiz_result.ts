import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from './user.js'
import Quiz from './quiz.js'

export default class QuizResult extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare quizId: number

  @column()
  declare correctAnswers: number

  @column()
  declare totalQuestions: number

  @column()
  declare score: number

  @column()
  declare timeSeconds: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Quiz)
  declare quiz: BelongsTo<typeof Quiz>
}
