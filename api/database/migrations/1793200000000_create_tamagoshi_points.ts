import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('tamagoshi_profiles', (table) => {
      table
        .integer('user_id')
        .unsigned()
        .primary()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.string('name', 24).notNullable()
      table.integer('seed').unsigned().notNullable()
      table.integer('catalog_version').unsigned().notNullable().defaultTo(2)
      table.timestamp('activated_at').notNullable()
    })
    this.schema.createTable('tamagoshi_points', (table) => {
      table.increments('id').primary()
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('user_id')
        .inTable('tamagoshi_profiles')
        .onDelete('CASCADE')
      table.string('source', 16).notNullable()
      table.string('event_key', 64).notNullable()
      table.integer('points').unsigned().notNullable()
      table.string('score_month', 7).notNullable()
      table.string('score_day', 10).notNullable()
      table.timestamp('earned_at').notNullable()
      table.unique(['user_id', 'source', 'event_key'])
      table.index(['score_month', 'user_id'])
    })
  }
  async down() {
    this.schema.dropTable('tamagoshi_points')
    this.schema.dropTable('tamagoshi_profiles')
  }
}
