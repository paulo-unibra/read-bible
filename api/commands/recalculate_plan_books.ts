import ReadingPlanRecalculatorService from '#services/reading_plan_recalculator_service'
import { BaseCommand, args } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class RecalculatePlanBooks extends BaseCommand {
  static commandName = 'plan:recalculate-books'
  static description = 'Recalcula os livros de um plano de leitura corrigindo erros de duplicação'

  static options: CommandOptions = {
    startApp: true,
  }

  @args.string({ description: 'ID do plano de leitura a ser recalculado' })
  declare planId: string

  async run() {
    const { default: ReadingPlan } = await import('#models/reading_plan')

    this.logger.info('📚 Iniciando recálculo dos livros do plano...')

    const planIdNum = Number.parseInt(this.planId, 10)

    if (isNaN(planIdNum)) {
      this.logger.error('❌ ID do plano inválido. Deve ser um número.')
      return
    }

    // Verificar se o plano existe
    const plan = await ReadingPlan.find(planIdNum)
    if (!plan) {
      this.logger.error(`❌ Plano com ID ${planIdNum} não encontrado.`)
      return
    }

    this.logger.info(`📋 Plano encontrado: "${plan.name}"`)
    this.logger.info(`📅 Total de dias: ${plan.totalDays}`)

    // Verificar se há duplicatas
    const recalculatorService = new ReadingPlanRecalculatorService()
    const checkResult = await recalculatorService.checkPlanForDuplicateBooks(planIdNum)

    if (checkResult.hasDuplicates) {
      this.logger.warning(
        `⚠️  Encontradas duplicatas nos dias: ${checkResult.duplicateDays.join(', ')}`
      )
    } else {
      this.logger.info('✅ Nenhuma duplicata encontrada neste plano.')

      const shouldContinue = await this.prompt.confirm(
        'O plano parece estar correto. Deseja recalcular mesmo assim?'
      )

      if (!shouldContinue) {
        this.logger.info('❌ Recálculo cancelado.')
        return
      }
    }

    // Confirmar recálculo
    const shouldRecalculate = await this.prompt.confirm(
      `Deseja recalcular este plano? O progresso será mantido, mas os livros serão redistribuídos.`
    )

    if (!shouldRecalculate) {
      this.logger.info('❌ Recálculo cancelado.')
      return
    }

    // Executar recálculo
    const result = await recalculatorService.recalculatePlanBooks(planIdNum)

    if (result.success) {
      this.logger.success('✅ Plano recalculado com sucesso!')
      this.logger.info(`🔧 Leituras corrigidas: ${result.correctedReadings}`)
      this.logger.info(`📈 Progresso mantido: ${result.progressMaintained} dias`)
    } else {
      this.logger.error(`❌ Falha no recálculo: ${result.message}`)
    }
  }
}
