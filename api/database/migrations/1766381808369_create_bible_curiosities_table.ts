import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'bible_curiosities'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.text('content').notNullable()
      table.string('theme', 100).nullable()
      table.date('date').notNullable().unique()
      table.boolean('is_active').defaultTo(true)
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })

    // Tabela de favoritos de curiosidades
    this.schema.createTable('bible_curiosity_favorites', (table) => {
      table.increments('id')
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE')
      table.integer('curiosity_id').unsigned().references('id').inTable('bible_curiosities').onDelete('CASCADE')
      table.timestamp('created_at')
      table.timestamp('updated_at')

      table.unique(['user_id', 'curiosity_id'])
    })
  }

  async down() {
    this.schema.dropTable('bible_curiosity_favorites')
    this.schema.dropTable(this.tableName)
  }
}
