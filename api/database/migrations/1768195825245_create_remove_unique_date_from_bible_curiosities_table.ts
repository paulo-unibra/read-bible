import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'bible_curiosities'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropUnique(['date'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.unique(['date'])
    })
  }
}