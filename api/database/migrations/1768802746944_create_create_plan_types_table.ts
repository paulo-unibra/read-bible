import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'plan_types'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('key', 50).notNullable().unique() // 'sequential', 'interleaved', 'nt-100'
      table.string('name', 100).notNullable() // 'Sequencial', 'Intercalado', etc
      table.text('description').nullable()
      table.boolean('is_active').defaultTo(true)
      table.integer('order').defaultTo(0)
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}