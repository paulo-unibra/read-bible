import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import User from './user.js'

export default class HymnAudioSync extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare hymnNumber: number

  @column()
  declare instrument: string

  @column()
  declare fileId: string

  @column()
  declare fileName: string

  @column()
  declare offsetMs: number

  @column()
  declare durationMs: number | null

  @column({
    consume: (value: string) => parseFloat(value),
    serialize: (value: number) => value,
  })
  declare defaultVolume: number

  @column({
    consume: (value: number) => Boolean(value),
    serialize: (value: boolean) => value,
  })
  declare defaultMuted: boolean

  @column()
  declare displayOrder: number

  @column({
    consume: (value: number) => Boolean(value),
    serialize: (value: boolean) => value,
  })
  declare isActive: boolean

  @column()
  declare notes: string | null

  @column()
  declare updatedBy: number | null

  @belongsTo(() => User, {
    foreignKey: 'updatedBy',
  })
  declare updater: BelongsTo<typeof User>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
