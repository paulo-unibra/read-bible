import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'quiz_generation_jobs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('book_name').notNullable()
      table.string('bible_version').notNullable()
      table.integer('chapter').nullable()
      table.integer('total_chapters').notNullable()
      table.integer('processed_chapters').defaultTo(0)
      table.text('created_quizzes').nullable() // JSON array
      table.text('errors').nullable() // JSON array
      table.enum('status', ['pending', 'processing', 'completed', 'failed']).defaultTo('pending')
      table.integer('progress').defaultTo(0)
      table.timestamp('created_at')
      table.timestamp('updated_at')
      table.timestamp('completed_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
