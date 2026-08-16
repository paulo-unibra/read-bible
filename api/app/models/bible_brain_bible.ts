import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import User from './user.js'

export interface BibleBrainFilesetSummary {
  id: string
  type: string
  size?: string | null
  codec?: string | null
  bitrate?: string | null
  container?: string | null
}

export type BibleBrainPackageStatus = 'none' | 'generating' | 'ready' | 'failed'

export default class BibleBrainBible extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare bibleId: string

  @column()
  declare name: string

  @column()
  declare languageName: string | null

  @column()
  declare languageIso: string | null

  @column()
  declare languageId: number | null

  @column()
  declare countryId: string | null

  @column()
  declare bibleDate: string | null

  @column({
    consume: (value: string | null) => {
      if (!value) return []
      try {
        return JSON.parse(value) as BibleBrainFilesetSummary[]
      } catch {
        return []
      }
    },
    prepare: (value: BibleBrainFilesetSummary[] | null | undefined) =>
      JSON.stringify(value || []),
  })
  declare filesets: BibleBrainFilesetSummary[]

  @column({
    consume: (value: number) => Boolean(value),
    serialize: (value: boolean) => value,
  })
  declare hasText: boolean

  @column({
    consume: (value: number) => Boolean(value),
    serialize: (value: boolean) => value,
  })
  declare hasAudio: boolean

  @column({
    consume: (value: number) => Boolean(value),
    serialize: (value: boolean) => value,
  })
  declare isEnabled: boolean

  @column()
  declare packageStatus: BibleBrainPackageStatus

  @column()
  declare packageProgress: number

  @column()
  declare packageUrl: string | null

  @column()
  declare packageSize: number | null

  @column()
  declare packageError: string | null

  @column.dateTime()
  declare packageGeneratedAt: DateTime | null

  @column()
  declare audioPackageStatus: BibleBrainPackageStatus

  @column()
  declare audioPackageProgress: number

  @column()
  declare audioPackageError: string | null

  @column.dateTime()
  declare audioPackageGeneratedAt: DateTime | null

  @column()
  declare updatedBy: number | null

  @belongsTo(() => User, {
    foreignKey: 'updatedBy',
  })
  declare updater: BelongsTo<typeof User>

  @column.dateTime()
  declare syncedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
