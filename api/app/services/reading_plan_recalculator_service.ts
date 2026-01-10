import ReadingPlan from '#models/reading_plan'
import ReadingProgress from '#models/reading_progress'

/**
 * Estrutura da Bíblia com número de capítulos por livro
 */
const BIBLE_STRUCTURE = [
  { id: 1, name: 'Gênesis', chapters: 50 },
  { id: 2, name: 'Êxodo', chapters: 40 },
  { id: 3, name: 'Levítico', chapters: 27 },
  { id: 4, name: 'Números', chapters: 36 },
  { id: 5, name: 'Deuteronômio', chapters: 34 },
  { id: 6, name: 'Josué', chapters: 24 },
  { id: 7, name: 'Juízes', chapters: 21 },
  { id: 8, name: 'Rute', chapters: 4 },
  { id: 9, name: '1 Samuel', chapters: 31 },
  { id: 10, name: '2 Samuel', chapters: 24 },
  { id: 11, name: '1 Reis', chapters: 22 },
  { id: 12, name: '2 Reis', chapters: 25 },
  { id: 13, name: '1 Crônicas', chapters: 29 },
  { id: 14, name: '2 Crônicas', chapters: 36 },
  { id: 15, name: 'Esdras', chapters: 10 },
  { id: 16, name: 'Neemias', chapters: 13 },
  { id: 17, name: 'Ester', chapters: 10 },
  { id: 18, name: 'Jó', chapters: 42 },
  { id: 19, name: 'Salmos', chapters: 150 },
  { id: 20, name: 'Provérbios', chapters: 31 },
  { id: 21, name: 'Eclesiastes', chapters: 12 },
  { id: 22, name: 'Cantares', chapters: 8 },
  { id: 23, name: 'Isaías', chapters: 66 },
  { id: 24, name: 'Jeremias', chapters: 52 },
  { id: 25, name: 'Lamentações', chapters: 5 },
  { id: 26, name: 'Ezequiel', chapters: 48 },
  { id: 27, name: 'Daniel', chapters: 12 },
  { id: 28, name: 'Oséias', chapters: 14 },
  { id: 29, name: 'Joel', chapters: 3 },
  { id: 30, name: 'Amós', chapters: 9 },
  { id: 31, name: 'Obadias', chapters: 1 },
  { id: 32, name: 'Jonas', chapters: 4 },
  { id: 33, name: 'Miquéias', chapters: 7 },
  { id: 34, name: 'Naum', chapters: 3 },
  { id: 35, name: 'Habacuque', chapters: 3 },
  { id: 36, name: 'Sofonias', chapters: 3 },
  { id: 37, name: 'Ageu', chapters: 2 },
  { id: 38, name: 'Zacarias', chapters: 14 },
  { id: 39, name: 'Malaquias', chapters: 4 },
  { id: 40, name: 'Mateus', chapters: 28 },
  { id: 41, name: 'Marcos', chapters: 16 },
  { id: 42, name: 'Lucas', chapters: 24 },
  { id: 43, name: 'João', chapters: 21 },
  { id: 44, name: 'Atos', chapters: 28 },
  { id: 45, name: 'Romanos', chapters: 16 },
  { id: 46, name: '1 Coríntios', chapters: 16 },
  { id: 47, name: '2 Coríntios', chapters: 13 },
  { id: 48, name: 'Gálatas', chapters: 6 },
  { id: 49, name: 'Efésios', chapters: 6 },
  { id: 50, name: 'Filipenses', chapters: 4 },
  { id: 51, name: 'Colossenses', chapters: 4 },
  { id: 52, name: '1 Tessalonicenses', chapters: 5 },
  { id: 53, name: '2 Tessalonicenses', chapters: 3 },
  { id: 54, name: '1 Timóteo', chapters: 6 },
  { id: 55, name: '2 Timóteo', chapters: 4 },
  { id: 56, name: 'Tito', chapters: 3 },
  { id: 57, name: 'Filemom', chapters: 1 },
  { id: 58, name: 'Hebreus', chapters: 13 },
  { id: 59, name: 'Tiago', chapters: 5 },
  { id: 60, name: '1 Pedro', chapters: 5 },
  { id: 61, name: '2 Pedro', chapters: 3 },
  { id: 62, name: '1 João', chapters: 5 },
  { id: 63, name: '2 João', chapters: 1 },
  { id: 64, name: '3 João', chapters: 1 },
  { id: 65, name: 'Judas', chapters: 1 },
  { id: 66, name: 'Apocalipse', chapters: 22 },
]

/**
 * Serviço para recalcular os livros de um plano de leitura,
 * corrigindo erros onde o mesmo livro aparecia múltiplas vezes no mesmo dia
 */
export default class ReadingPlanRecalculatorService {
  /**
   * Recalcula os livros de um plano de leitura mantendo o progresso
   */
  async recalculatePlanBooks(planId: number): Promise<{
    success: boolean
    message: string
    correctedReadings?: number
    progressMaintained?: number
  }> {
    try {
      // Buscar plano
      const plan = await ReadingPlan.findOrFail(planId)

      console.log(`📚 Recalculando livros do plano ${planId}: "${plan.name}"`)

      // Buscar todas as leituras do plano
      const allReadings = await ReadingProgress.query()
        .where('reading_plan_id', planId)
        .orderBy('day', 'asc')
        .orderBy('id', 'asc')

      // Buscar leituras completadas para preservar
      const completedReadings = allReadings.filter((r) => r.isCompleted)
      console.log(`✅ Progresso atual: ${completedReadings.length}/${allReadings.length} leituras`)

      // Calcular total de capítulos da Bíblia
      const totalChapters = BIBLE_STRUCTURE.reduce((sum, book) => sum + book.chapters, 0)

      // Calcular capítulos por dia
      const chaptersPerDay = Math.ceil(totalChapters / plan.totalDays)

      console.log(`📖 Total de capítulos: ${totalChapters}`)
      console.log(`📅 Total de dias: ${plan.totalDays}`)
      console.log(`📊 Capítulos por dia: ${chaptersPerDay}`)

      // Gerar novas leituras sequenciais corretas
      const newReadings = this.generateSequentialReadings(plan.totalDays, chaptersPerDay)

      console.log(`🔄 Geradas ${newReadings.length} novas leituras`)

      // Mapear leituras antigas completadas por dia
      const completedByDay = new Map<number, ReadingProgress[]>()
      for (const reading of completedReadings) {
        if (!completedByDay.has(reading.day)) {
          completedByDay.set(reading.day, [])
        }
        completedByDay.get(reading.day)!.push(reading)
      }

      // Deletar todas as leituras antigas
      await ReadingProgress.query().where('reading_plan_id', planId).delete()

      // Criar novas leituras mantendo o status de completude
      let progressMaintained = 0
      let correctedReadings = 0

      for (const newReading of newReadings) {
        const oldCompletedReadings = completedByDay.get(newReading.day) || []
        const wasCompleted = oldCompletedReadings.length > 0

        // Se o dia estava completado, marca a nova leitura como completada
        const completedAt = wasCompleted ? oldCompletedReadings[0].completedAt : null

        await ReadingProgress.create({
          readingPlanId: planId,
          day: newReading.day,
          bookName: newReading.bookName,
          startChapter: newReading.startChapter,
          endChapter: newReading.endChapter,
          isCompleted: wasCompleted,
          completedAt: completedAt,
        })

        if (wasCompleted) {
          progressMaintained++
        }

        // Verificar se houve correção (mudança de livro)
        const hadWrongBook = oldCompletedReadings.some(
          (old) => old.bookName !== newReading.bookName
        )
        if (hadWrongBook) {
          correctedReadings++
        }
      }

      console.log(`✅ Recálculo completo!`)
      console.log(`📈 Progresso mantido: ${progressMaintained} dias`)
      console.log(`🔧 Leituras corrigidas: ${correctedReadings}`)

      return {
        success: true,
        message: 'Plano recalculado com sucesso!',
        correctedReadings,
        progressMaintained,
      }
    } catch (error) {
      console.error('❌ Erro ao recalcular plano:', error)
      return {
        success: false,
        message: `Erro ao recalcular plano: ${error.message}`,
      }
    }
  }

  /**
   * Gera leituras sequenciais da Bíblia
   */
  private generateSequentialReadings(
    totalDays: number,
    chaptersPerDay: number
  ): Array<{
    day: number
    bookName: string
    startChapter: number
    endChapter: number
  }> {
    const readings: Array<{
      day: number
      bookName: string
      startChapter: number
      endChapter: number
    }> = []

    let currentDay = 1
    let currentBookIndex = 0
    let currentChapter = 1
    let chaptersReadToday = 0

    while (currentDay <= totalDays && currentBookIndex < BIBLE_STRUCTURE.length) {
      const book = BIBLE_STRUCTURE[currentBookIndex]
      const startChapter = currentChapter
      const chaptersLeftInBook = book.chapters - currentChapter + 1
      const chaptersLeftToday = chaptersPerDay - chaptersReadToday

      // Quantos capítulos ler deste livro hoje
      const chaptersToRead = Math.min(chaptersLeftInBook, chaptersLeftToday)
      const endChapter = startChapter + chaptersToRead - 1

      readings.push({
        day: currentDay,
        bookName: book.name,
        startChapter,
        endChapter,
      })

      chaptersReadToday += chaptersToRead
      currentChapter += chaptersToRead

      // Se terminou o livro, vai para o próximo
      if (currentChapter > book.chapters) {
        currentBookIndex++
        currentChapter = 1
      }

      // Se completou os capítulos do dia, vai para o próximo dia
      if (chaptersReadToday >= chaptersPerDay) {
        currentDay++
        chaptersReadToday = 0
      }
    }

    return readings
  }

  /**
   * Verifica se um plano tem leituras com problemas de livros duplicados
   */
  async checkPlanForDuplicateBooks(planId: number): Promise<{
    hasDuplicates: boolean
    duplicateDays: number[]
  }> {
    const readings = await ReadingProgress.query()
      .where('reading_plan_id', planId)
      .orderBy('day', 'asc')

    const dayMap = new Map<number, Set<string>>()
    const duplicateDays: number[] = []

    for (const reading of readings) {
      if (!dayMap.has(reading.day)) {
        dayMap.set(reading.day, new Set())
      }

      const booksInDay = dayMap.get(reading.day)!
      if (booksInDay.has(reading.bookName)) {
        if (!duplicateDays.includes(reading.day)) {
          duplicateDays.push(reading.day)
        }
      }
      booksInDay.add(reading.bookName)
    }

    return {
      hasDuplicates: duplicateDays.length > 0,
      duplicateDays: duplicateDays.sort((a, b) => a - b),
    }
  }
}
