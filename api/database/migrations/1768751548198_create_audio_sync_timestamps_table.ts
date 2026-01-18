import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'audio_sync_timestamps'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.integer('book_id').unsigned().notNullable()
      table.integer('chapter_number').unsigned().notNullable()
      table.integer('verse_number').unsigned().notNullable()
      table.integer('timestamp_ms').unsigned().notNullable() // Timestamp em milissegundos

      // Índice único para evitar duplicatas
      table.unique(['book_id', 'chapter_number', 'verse_number'])

      // Índice para buscar por capítulo
      table.index(['book_id', 'chapter_number'])

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
