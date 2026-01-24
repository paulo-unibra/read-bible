import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import User from './user.js'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class Note extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare bookId: number

  @column()
  declare bookName: string

  @column()
  declare chapterNumber: number

  @column({
    prepare: (value: number[]) => JSON.stringify(value),
    consume: (value: string) => JSON.parse(value),
  })
  declare verseNumbers: number[]

  @column()
  declare verseText: string

  @column()
  declare note: string

  @column()
  declare isPrivate: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}