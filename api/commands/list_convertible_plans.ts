import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class ListConvertiblePlans extends BaseCommand {
  static commandName = 'plan:list-convertible'
  static description = 'Lista todos os planos de leitura com mais de 365 dias'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const { default: ReadingPlan } = await import('#models/reading_plan')

    this.logger.info('🔍 Buscando planos com mais de 365 dias...\n')

    const plans = await ReadingPlan.query()
      .where('total_days', '>', 365)
      .preload('user')
      .orderBy('total_days', 'desc')

    if (plans.length === 0) {
      this.logger.info('✅ Nenhum plano com mais de 365 dias encontrado.')
      return
    }

    this.logger.info(`📊 Encontrados ${plans.length} plano(s) convertível(is):\n`)

    const table = this.ui.table()
    table.head(['ID', 'Nome', 'Usuário', 'Dias', 'Ativo', 'Progresso'])

    for (const plan of plans) {
      table.row([
        plan.id.toString(),
        plan.name,
        plan.user.email,
        plan.totalDays.toString(),
        plan.isActive ? '✅' : '❌',
        `${plan.completedChapters || 0} capítulos`,
      ])
    }

    table.render()

    this.logger.info(
      '\n💡 Para converter um plano, use: node ace plan:convert-to-365 <PLAN_ID>'
    )
  }
}
