import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'hymn_audio_syncs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      // Identificação do hino
      table.integer('hymn_number').unsigned().notNullable().index()

      // Identificação do instrumento/faixa
      table.string('instrument', 50).notNullable()

      // Arquivo de áudio
      table.string('file_id', 255).notNullable() // ID do arquivo no Google Drive
      table.string('file_name', 255).notNullable()

      // Informações de sincronização (em milissegundos)
      table.integer('offset_ms').defaultTo(0) // Offset de início (positivo = atrasa, negativo = adianta)
      table.integer('duration_ms').nullable() // Duração do áudio

      // Controle de volume padrão
      table.decimal('default_volume', 3, 2).defaultTo(1.0) // 0.0 a 1.0
      table.boolean('default_muted').defaultTo(false)

      // Ordem de exibição
      table.integer('display_order').defaultTo(0)

      // Metadados
      table.boolean('is_active').defaultTo(true)
      table.text('notes').nullable() // Notas sobre a sincronização

      // Auditoria
      table.integer('updated_by').unsigned().nullable()
      table.foreign('updated_by').references('users.id').onDelete('SET NULL')

      table.timestamp('created_at')
      table.timestamp('updated_at')

      // Índice único para evitar duplicatas
      table.unique(['hymn_number', 'instrument'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
