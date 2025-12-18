import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'quiz_results'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      table.integer('user_id').unsigned().notNullable()
        .references('id').inTable('users').onDelete('CASCADE')

      table.integer('quiz_id').unsigned().notNullable()
        .references('id').inTable('quizzes').onDelete('CASCADE')

      table.integer('correct_answers').notNullable() // Respostas corretas
      table.integer('total_questions').notNullable() // Total de questões
      table.integer('score').notNullable() // Pontuação (0-100)
      table.integer('time_seconds').nullable() // Tempo em segundos

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      // Índices
      table.index(['user_id'])
      table.index(['quiz_id'])
      table.index(['user_id', 'quiz_id'])
      table.index(['score'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
