import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'bible_brain_audio_timestamps'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      // Identificação da bíblia (BibleBrain) e da posição do versículo
      table.string('bible_id', 20).notNullable()
      table.string('book_id', 10).notNullable() // código USFM, ex: "MAT"
      table.integer('chapter_number').unsigned().notNullable()
      table.integer('verse_number').unsigned().notNullable()
      table.integer('timestamp_ms').unsigned().notNullable()

      // Índice único para evitar duplicatas e permitir upsert
      // (nome explícito e curto: o nome padrão gerado excede o limite do MySQL)
      table.unique(['bible_id', 'book_id', 'chapter_number', 'verse_number'], {
        indexName: 'bbat_bible_book_chapter_verse_unique',
      })

      // Índice para buscar todos os versículos de um capítulo
      table.index(['bible_id', 'book_id', 'chapter_number'], 'bbat_bible_book_chapter_idx')

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
