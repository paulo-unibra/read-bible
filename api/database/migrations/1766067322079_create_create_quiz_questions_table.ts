import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'quiz_questions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      
      table.integer('quiz_id').unsigned().notNullable()
        .references('id').inTable('quizzes').onDelete('CASCADE')
      
      table.string('question_id', 50).notNullable() // ID único da questão (ex: "q1", "q2")
      table.text('pergunta').notNullable()
      table.json('alternativas').notNullable() // Array de strings
      table.string('resposta_correta', 10).notNullable() // Ex: "a", "b", "c", "d"
      table.integer('order').notNullable() // Ordem da questão no quiz
      
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
      
      // Índices
      table.index(['quiz_id'])
      table.index(['quiz_id', 'order'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}