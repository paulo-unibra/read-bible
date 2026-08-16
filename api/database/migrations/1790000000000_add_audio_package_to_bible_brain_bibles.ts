import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'bible_brain_bibles'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .enum('audio_package_status', ['none', 'generating', 'ready', 'failed'])
        .defaultTo('none')
        .index()
      table.integer('audio_package_progress').unsigned().defaultTo(0)
      table.text('audio_package_error').nullable()
      table.timestamp('audio_package_generated_at').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('audio_package_status')
      table.dropColumn('audio_package_progress')
      table.dropColumn('audio_package_error')
      table.dropColumn('audio_package_generated_at')
    })
  }
}
