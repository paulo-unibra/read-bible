import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'audit_logs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      table
        .integer('user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.string('action', 100).notNullable()
      table.string('entity_type', 50).notNullable()
      table.integer('entity_id').unsigned().nullable()
      table.json('details').nullable()
      table.string('ip_address', 45).nullable()
      table.string('user_agent', 255).nullable()
      table.timestamp('created_at', { useTz: true })

      table.index(['user_id'])
      table.index(['action'])
      table.index(['entity_type', 'entity_id'])
      table.index(['created_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}