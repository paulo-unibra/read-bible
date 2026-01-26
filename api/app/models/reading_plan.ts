import ReadingProgress from '#models/reading_progress'
import User from '#models/user'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'

export default class ReadingPlan extends BaseModel {
  static table = 'reading_plans'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare name: string

  @column()
  declare type: 'yearly' | 'custom' | 'sequential' | 'interleaved' | 'beginner'

  @column.dateTime()
  declare startDate: DateTime

  @column.dateTime()
  declare endDate: DateTime

  @column()
  declare isActive: boolean

  @column()
  declare currentDay: number

  @column()
  declare totalDays: number

  @column()
  declare chaptersPerDay: number

  @column()
  declare totalChapters: number

  @column()
  declare completedChapters: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @hasMany(() => ReadingProgress, {
    foreignKey: 'readingPlanId',
  })
  declare progress: HasMany<typeof ReadingProgress>
}
