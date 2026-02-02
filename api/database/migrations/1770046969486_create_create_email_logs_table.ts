import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'email_logs'

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
      table.string('email', 255).notNullable()
      table.string('subject', 500).notNullable()
      table.text('message').notNullable()
      table.enum('status', ['success', 'failed']).notNullable()
      table.text('error_message').nullable()
      table.timestamp('sent_at').nullable()

      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })

      table.index(['status'])
      table.index(['email'])
      table.index(['sent_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
