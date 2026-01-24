import ReadingPlan from '#models/reading_plan'
import ReadingPlanItem from '#models/reading_plan_item'
import { BaseCommand, args } from '@adonisjs/core/ace'
import { CommandOptions } from '@adonisjs/core/types/ace'

export default class CreateRemainingReadings extends BaseCommand {
  static commandName = 'create:remaining-readings'
  static description = 'Cria as leituras restantes de um plano'

  static options: CommandOptions = {
    startApp: true,
  }

  @args.number({ description: 'ID do plano de leitura' })
  declare planId: number

  async run() {
    this.logger.info(`Criando leituras restantes para o plano ${this.planId}...`)

    const plan = await ReadingPlan.find(this.planId)

    if (!plan) {
      this.logger.error(`❌ Plano com ID ${this.planId} não encontrado`)
      return
    }

    // Buscar leituras já criadas
    const existingItems = await ReadingPlanItem.query()
      .where('reading_plan_id', this.planId)
      .orderBy('day_number', 'asc')

    const lastDayNumber =
      existingItems.length > 0 ? existingItems[existingItems.length - 1].dayNumber : 0

    if (lastDayNumber >= plan.totalDays) {
      this.logger.info('✅ Todas as leituras já foram criadas!')
      return
    }

    this.logger.info(`📚 Leituras existentes: ${existingItems.length}`)
    this.logger.info(`📅 Criando leituras do dia ${lastDayNumber + 1} até ${plan.totalDays}`)

    // Aqui você precisará recriar a lógica de divisão dos capítulos
    // Por simplicidade, vou apenas criar um placeholder
    // Você pode adaptar a lógica completa do comando anterior

    this.logger.warning(
      '⚠️  Este comando precisa ser implementado com a lógica completa de divisão de capítulos'
    )
    this.logger.info('💡 Dica: Extraia a lógica de divisão para uma classe/service reutilizável')
  }
}
