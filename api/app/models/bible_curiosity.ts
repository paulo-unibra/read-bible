import User from '#models/user'
import { BaseModel, column, manyToMany } from '@adonisjs/lucid/orm'
import type { ManyToMany } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'

export default class BibleCuriosity extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare content: string

  @column()
  declare theme: string | null

  @column.date()
  declare date: DateTime

  @column()
  declare isActive: boolean

  @column()
  declare likesCount: number

  @column()
  declare sharesCount: number

  @manyToMany(() => User, {
    pivotTable: 'bible_curiosity_favorites',
    pivotForeignKey: 'curiosity_id',
    pivotRelatedForeignKey: 'user_id',
  })
  declare favoritedBy: ManyToMany<typeof User>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
