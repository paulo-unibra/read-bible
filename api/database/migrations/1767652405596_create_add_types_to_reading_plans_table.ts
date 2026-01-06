import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reading_plans'

  async up() {
    this.schema.raw(`
      ALTER TABLE ${this.tableName} 
      MODIFY COLUMN type ENUM('yearly', 'custom', 'sequential', 'interleaved') NOT NULL
    `)
  }

  async down() {
    this.schema.raw(`
      ALTER TABLE ${this.tableName} 
      MODIFY COLUMN type ENUM('yearly', 'custom') NOT NULL
    `)
  }
}