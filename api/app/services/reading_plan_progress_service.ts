import ReadingPlan from '#models/reading_plan'
import ReadingProgress from '#models/reading_progress'

interface NextDayData {
  dayNumber: number
  readings: {
    bookName: string
    startChapter: number
    endChapter: number
  }[]
}

export default class ReadingPlanProgressService {
  /**
   * Cria um próximo dia de leitura baseado nos dados fornecidos
   */
  async createNextDay(planId: number, nextDayData: NextDayData): Promise<boolean> {
    try {
      const plan = await ReadingPlan.findOrFail(planId)

      // Verificar se já chegou no final do plano
      if (nextDayData.dayNumber > plan.totalDays) {
        console.log(`✅ [ProgressService] Plano ${planId} já está completo`)
        return false
      }

      // Verificar se o dia já existe
      const existingDay = await ReadingProgress.query()
        .where('reading_plan_id', planId)
        .where('day', nextDayData.dayNumber)
        .first()

      if (existingDay) {
        console.log(`⚠️ [ProgressService] Dia ${nextDayData.dayNumber} já existe no plano ${planId}`)
        return false
      }

      // Criar os registros de leitura para o próximo dia
      for (const bookReading of nextDayData.readings) {
        await ReadingProgress.create({
          readingPlanId: planId,
          day: nextDayData.dayNumber,
          bookName: bookReading.bookName,
          startChapter: bookReading.startChapter,
          endChapter: bookReading.endChapter,
          isCompleted: false,
        })
      }

      console.log(`✅ [ProgressService] Dia ${nextDayData.dayNumber} criado para o plano ${planId}`)
      return true
    } catch (error) {
      console.error(`❌ [ProgressService] Erro ao criar próximo dia:`, error)
      return false
    }
  }

  /**
   * Verifica quantos dias estão criados à frente do dia atual
   */
  async getDaysAheadCount(planId: number): Promise<number> {
    try {
      const plan = await ReadingPlan.findOrFail(planId)

      // Buscar o maior dia já criado
      const lastCreatedDay = await ReadingProgress.query()
        .where('reading_plan_id', planId)
        .max('day as maxDay')
        .first()

      const maxDayCreated = lastCreatedDay?.$extras?.maxDay
        ? Number(lastCreatedDay.$extras.maxDay)
        : 0

      // Retornar quantos dias estão criados à frente do dia atual
      return maxDayCreated - plan.currentDay + 1
    } catch (error) {
      console.error(`❌ [ProgressService] Erro ao contar dias à frente:`, error)
      return 0
    }
  }
}
