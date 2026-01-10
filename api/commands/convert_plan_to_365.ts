import ReadingPlanConverterService from '#services/reading_plan_converter_service'
import { BaseCommand, args } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class ConvertPlanTo365 extends BaseCommand {
  static commandName = 'plan:convert-to-365'
  static description = 'Converte um plano de leitura para 365 dias mantendo o progresso'

  static options: CommandOptions = {
    startApp: true,
  }

  @args.string({ description: 'ID do plano de leitura a ser convertido' })
  declare planId: string

  async run() {
    const { default: ReadingPlan } = await import('#models/reading_plan')

    this.logger.info('🔄 Iniciando conversão do plano para 365 dias...')

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
    this.logger.info(`📊 Total de dias atual: ${plan.totalDays}`)

    if (plan.totalDays <= 365) {
      this.logger.warning(
        `⚠️  O plano já tem ${plan.totalDays} dias. Apenas planos com mais de 365 dias podem ser convertidos.`
      )
      return
    }

    // Confirmar conversão
    const shouldConvert = await this.prompt.confirm(
      `Deseja realmente converter este plano de ${plan.totalDays} dias para 365 dias? O progresso será mantido.`
    )

    if (!shouldConvert) {
      this.logger.info('❌ Conversão cancelada.')
      return
    }

    // Executar conversão
    const converterService = new ReadingPlanConverterService()
    const result = await converterService.convertTo365Days(planIdNum)

    if (result.success) {
      this.logger.success('✅ Plano convertido com sucesso!')
      this.logger.info(`📊 Dias anteriores: ${result.oldTotalDays}`)
      this.logger.info(`📊 Novos dias: ${result.newTotalDays}`)
      this.logger.info(`✅ Progresso mantido: ${result.progressMaintained} leituras`)
    } else {
      this.logger.error(`❌ Falha na conversão: ${result.message}`)
    }
  }
}
