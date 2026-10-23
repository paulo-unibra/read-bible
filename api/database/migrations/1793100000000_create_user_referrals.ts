import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('invite_codes', (table) => {
      table.increments('id').primary()
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .unique()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.string('code', 12).notNullable().unique()
      table.timestamp('created_at').notNullable()
    })
    this.schema.createTable('user_referrals', (table) => {
      table.increments('id').primary()
      table
        .integer('referrer_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table
        .integer('referred_user_id')
        .unsigned()
        .nullable()
        .unique()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.integer('reward_points').unsigned().notNullable().defaultTo(5)
      table.timestamp('rewarded_at').nullable()
      table.timestamp('created_at').notNullable()
      table.index(['referrer_id', 'rewarded_at'])
    })
  }
  async down() {
    this.schema.dropTable('user_referrals')
    this.schema.dropTable('invite_codes')
  }
}
