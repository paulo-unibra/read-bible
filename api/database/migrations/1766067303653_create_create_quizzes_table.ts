import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'quizzes'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      
      table.string('book_name', 100).notNullable()
      table.integer('chapter').notNullable()
      table.string('bible_version', 10).notNullable()
      table.string('testament', 20).notNullable() // 'old' ou 'new'
      table.string('category', 100).notNullable()
      table.string('cloud_storage_url', 500).nullable()
      
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
      
      // Índice para buscar quizzes por livro e capítulo
      table.unique(['book_name', 'chapter', 'bible_version'])
      table.index(['book_name'])
      table.index(['testament'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}