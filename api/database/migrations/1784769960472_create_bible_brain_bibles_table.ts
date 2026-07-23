import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'bible_brain_bibles'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      // Identificação na BibleBrain (Digital Bible Platform)
      table.string('bible_id', 20).notNullable().unique() // ex: "PORARC"
      table.string('name', 255).notNullable()

      // Idioma / país
      table.string('language_name', 191).nullable()
      table.string('language_iso', 10).nullable().index()
      table.integer('language_id').unsigned().nullable()
      table.string('country_id', 10).nullable()
      table.string('bible_date', 20).nullable()

      // Resumo dos filesets (dbp-prod) retornados pela listagem da API, em JSON
      table.text('filesets', 'longtext').nullable()
      table.boolean('has_text').defaultTo(false).index()
      table.boolean('has_audio').defaultTo(false).index()

      // Controle de disponibilidade no app (definido pelo admin)
      table.boolean('is_enabled').defaultTo(false).index()

      // Geração do pacote SQLite (download completo) para o app
      table
        .enum('package_status', ['none', 'generating', 'ready', 'failed'])
        .defaultTo('none')
        .index()
      table.integer('package_progress').unsigned().defaultTo(0)
      table.string('package_url', 500).nullable()
      table.bigInteger('package_size').unsigned().nullable()
      table.text('package_error').nullable()
      table.timestamp('package_generated_at').nullable()

      // Auditoria
      table.integer('updated_by').unsigned().nullable()
      table.foreign('updated_by').references('users.id').onDelete('SET NULL')
      table.timestamp('synced_at').nullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
