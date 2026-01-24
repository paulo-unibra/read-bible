import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'

export default class extends BaseSeeder {
  async run() {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ')

    await db.table('plan_types').insert([
      {
        key: 'sequential',
        name: 'Sequencial',
        description: 'Leia a Bíblia do início ao fim, de Gênesis a Apocalipse',
        is_active: true,
        order: 1,
        created_at: now,
        updated_at: now,
      },
      {
        key: 'interleaved',
        name: 'Intercalado',
        description: 'Alterne entre Antigo e Novo Testamento para uma experiência equilibrada',
        is_active: true,
        order: 2,
        created_at: now,
        updated_at: now,
      },
      {
        key: 'nt-100',
        name: 'Novo Testamento em 100 Dias',
        description: 'Complete a leitura do Novo Testamento em apenas 100 dias',
        is_active: true,
        order: 3,
        created_at: now,
        updated_at: now,
      },
    ])
  }
}
