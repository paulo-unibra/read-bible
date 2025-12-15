import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import ReadingPlan from '#models/reading_plan'

export default class ReadingProgress extends BaseModel {
  static table = 'reading_progress'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare readingPlanId: number

  @column()
  declare day: number

  @column()
  declare bookName: string

  @column()
  declare startChapter: number

  @column()
  declare endChapter: number

  @column()
  declare isCompleted: boolean

  @column.dateTime()
  declare completedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => ReadingPlan)
  declare readingPlan: BelongsTo<typeof ReadingPlan>
}
