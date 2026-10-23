import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('tamagoshi_points', (table) => {
      table.boolean('free_reading').notNullable().defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable('tamagoshi_points', (table) => {
      table.dropColumn('free_reading')
    })
  }
}
