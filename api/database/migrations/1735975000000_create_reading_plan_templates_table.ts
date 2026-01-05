import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reading_plan_templates'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name').notNullable()
      table.text('description').notNullable()
      table.enum('type', ['annual', 'custom', 'sequential', 'thematic']).notNullable()
      table.integer('duration').notNullable() // dias
      table.enum('testament', ['old', 'new', 'both']).notNullable()
      table.text('readings').notNullable() // JSON array
      table.boolean('is_active').defaultTo(true)
      table.integer('order').defaultTo(0)
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
