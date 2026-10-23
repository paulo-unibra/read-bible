import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('users', (table) => {
      table.boolean('email_verified').notNullable().defaultTo(true)
    })

    this.schema.alterTable('password_resets', (table) => {
      table.integer('attempts').notNullable().defaultTo(0)
    })

    this.schema.createTable('email_verifications', (table) => {
      table.increments('id').primary()
      table.integer('user_id').unsigned().notNullable().references('users.id').onDelete('CASCADE')
      table.string('token_hash', 64).notNullable()
      table.integer('attempts').notNullable().defaultTo(0)
      table.boolean('used').notNullable().defaultTo(false)
      table.timestamp('expires_at').notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
      table.index(['user_id', 'used'])
    })
  }

  async down() {
    this.schema.dropTable('email_verifications')
    this.schema.alterTable('password_resets', (table) => {
      table.dropColumn('attempts')
    })
    this.schema.alterTable('users', (table) => {
      table.dropColumn('email_verified')
    })
  }
}
