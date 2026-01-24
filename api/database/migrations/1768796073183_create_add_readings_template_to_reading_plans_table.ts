import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reading_plans'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.specificType('readings_template', 'LONGTEXT').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('readings_template')
    })
  }
}