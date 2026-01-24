import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'notes'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE')
      table.integer('book_id').notNullable()
      table.string('book_name', 100).notNullable()
      table.integer('chapter_number').notNullable()
      table.json('verse_numbers').notNullable() // Array de números dos versículos
      table.text('verse_text').notNullable()
      table.text('note').notNullable()
      table.boolean('is_private').defaultTo(true)

      table.timestamp('created_at')
      table.timestamp('updated_at')

      // Índices para melhorar performance
      table.index(['user_id', 'book_id', 'chapter_number'])
      table.index(['user_id', 'created_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
