import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import Quiz from './quiz.js'

export default class QuizQuestion extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare quizId: number

  @column()
  declare questionId: string

  @column()
  declare pergunta: string

  @column({
    prepare: (value: string[]) => JSON.stringify(value),
    consume: (value: string) => {
      if (typeof value === 'string') {
        try {
          return JSON.parse(value)
        } catch (error) {
          console.error('[QuizQuestion] Erro ao parsear alternativas:', value)
          return []
        }
      }
      return Array.isArray(value) ? value : []
    },
  })
  declare alternativas: string[]

  @column()
  declare respostaCorreta: string

  @column()
  declare order: number

  @belongsTo(() => Quiz)
  declare quiz: BelongsTo<typeof Quiz>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
