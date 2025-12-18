import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'quiz_questions'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('resposta_correta', 500).notNullable().alter()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('resposta_correta', 10).notNullable().alter()
    })
  }
}
