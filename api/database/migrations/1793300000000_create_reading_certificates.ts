import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reading_certificates'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      // Keep earned certificates even if the original plan is removed later.
      table.integer('reading_plan_id').unsigned().notNullable().unique()
      table.string('code', 64).notNullable().unique()
      table.string('reader_name').notNullable()
      table.string('plan_name').notNullable()
      table.string('plan_type', 32).notNullable()
      table.integer('total_chapters').unsigned().notNullable()
      table.dateTime('completed_at').notNullable()
      table.timestamp('created_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
