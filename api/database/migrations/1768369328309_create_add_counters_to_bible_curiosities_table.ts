import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'bible_curiosities'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('likes_count').unsigned().defaultTo(0)
      table.integer('shares_count').unsigned().defaultTo(0)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('likes_count')
      table.dropColumn('shares_count')
    })
  }
}