import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class ReadingPlanTemplate extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare description: string

  @column()
  declare type: 'annual' | 'custom' | 'sequential' | 'thematic'

  @column()
  declare duration: number // dias para completar

  @column()
  declare testament: 'old' | 'new' | 'both'

  @column()
  declare readings: string // JSON array de leituras diárias

  @column()
  declare isActive: boolean

  @column()
  declare order: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
