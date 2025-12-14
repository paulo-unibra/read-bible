import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reading_progress'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('reading_plan_id').unsigned().references('id').inTable('reading_plans').onDelete('CASCADE')
      table.integer('day').notNullable()
      table.string('book_name').notNullable()
      table.integer('start_chapter').notNullable()
      table.integer('end_chapter').notNullable()
      table.boolean('is_completed').defaultTo(false)
      table.dateTime('completed_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
      
      table.index(['reading_plan_id', 'day'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
