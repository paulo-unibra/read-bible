import ReadingPlan from '#models/reading_plan'
import ReadingProgress from '#models/reading_progress'
import { DateTime } from 'luxon'

/**
 * Serviço para converter planos de leitura com mais de 365 dias para exatamente 365 dias,
 * redistribuindo as leituras de forma proporcional sem perder o progresso já realizado.
 */
export default class ReadingPlanConverterService {
  /**
   * Converte um plano de leitura para 365 dias mantendo o progresso atual
   */
  async convertTo365Days(planId: number): Promise<{
    success: boolean
    message: string
    oldTotalDays?: number
    newTotalDays?: number
    progressMaintained?: number
  }> {
    try {
      // Buscar plano
      const plan = await ReadingPlan.findOrFail(planId)

      // Verificar se o plano tem mais de 365 dias
      if (plan.totalDays <= 365) {
        return {
          success: false,
          message: `O plano já tem ${plan.totalDays} dias. Apenas planos com mais de 365 dias podem ser convertidos.`,
        }
      }

      const oldTotalDays = plan.totalDays

      // Buscar todas as leituras do plano
      const allReadings = await ReadingProgress.query()
        .where('reading_plan_id', planId)
        .orderBy('day', 'asc')

      // Buscar leituras completadas
      const completedReadings = allReadings.filter((r) => r.isCompleted)

      console.log(`📊 Plano ${planId}: ${oldTotalDays} dias → 365 dias`)
      console.log(`✅ Progresso atual: ${completedReadings.length}/${allReadings.length} leituras`)

      // Calcular proporção de compressão
      const compressionRatio = 365 / oldTotalDays

      // Criar mapa de novos dias baseado na proporção
      const dayMapping = new Map<number, number>()
      for (let oldDay = 1; oldDay <= oldTotalDays; oldDay++) {
        const newDay = Math.ceil(oldDay * compressionRatio)
        dayMapping.set(oldDay, newDay)
      }

      // Agrupar leituras por novo dia
      const newDayGroups = new Map<number, typeof allReadings>()
      for (const reading of allReadings) {
        const newDay = dayMapping.get(reading.day) || reading.day
        if (!newDayGroups.has(newDay)) {
          newDayGroups.set(newDay, [])
        }
        newDayGroups.get(newDay)!.push(reading)
      }

      console.log(`🔄 Redistribuindo ${allReadings.length} leituras em 365 dias...`)

      // Deletar todas as leituras antigas
      await ReadingProgress.query().where('reading_plan_id', planId).delete()

      // Criar novas leituras redistribuídas
      let progressMaintained = 0
      for (const [newDay, readings] of newDayGroups.entries()) {
        for (const reading of readings) {
          await ReadingProgress.create({
            readingPlanId: planId,
            day: newDay,
            bookName: reading.bookName,
            startChapter: reading.startChapter,
            endChapter: reading.endChapter,
            isCompleted: reading.isCompleted,
            completedAt: reading.completedAt,
          })

          if (reading.isCompleted) {
            progressMaintained++
          }
        }
      }

      // Calcular novo currentDay baseado no progresso
      const maxCompletedDay = Array.from(newDayGroups.entries())
        .filter(([_, readings]) => readings.some((r) => r.isCompleted))
        .map(([day, _]) => day)
        .sort((a, b) => b - a)[0] || 1

      // Atualizar o plano
      // Ajustar startDate para o primeiro dia do ANO ATUAL (não do ano do plano)
      const currentYear = DateTime.now().year
      const newStartDate = DateTime.local(currentYear, 1, 1, 0, 0, 0)
      const newEndDate = DateTime.local(currentYear, 12, 31, 23, 59, 59)

      console.log(`📅 Ajustando datas para o ano atual (${currentYear}):`)
      console.log(`   Anterior: ${plan.startDate.toISODate()} → ${plan.endDate.toISODate()}`)
      console.log(`   Nova: ${newStartDate.toISODate()} → ${newEndDate.toISODate()}`)

      plan.startDate = newStartDate
      plan.endDate = newEndDate
      plan.totalDays = 365
      plan.currentDay = Math.min(maxCompletedDay + 1, 365)
      await plan.save()

      console.log(`✅ Conversão completa! Novo currentDay: ${plan.currentDay}`)
      console.log(`📈 Progresso mantido: ${progressMaintained} leituras completadas`)

      return {
        success: true,
        message: 'Plano convertido com sucesso para 365 dias!',
        oldTotalDays,
        newTotalDays: 365,
        progressMaintained,
      }
    } catch (error) {
      console.error('❌ Erro ao converter plano:', error)
      return {
        success: false,
        message: `Erro ao converter plano: ${error.message}`,
      }
    }
  }

  /**
   * Lista todos os planos que podem ser convertidos (> 365 dias)
   */
  async listConvertiblePlans(): Promise<ReadingPlan[]> {
    return await ReadingPlan.query().where('total_days', '>', 365).orderBy('total_days', 'desc')
  }
}
