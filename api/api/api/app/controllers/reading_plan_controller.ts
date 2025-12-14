import ReadingPlan from '#models/reading_plan'
import ReadingProgress from '#models/reading_progress'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'

// Estrutura completa da Bíblia com todos os capítulos
const BIBLE_STRUCTURE = [
  // Antigo Testamento
  { name: 'Gênesis', chapters: 50 },
  { name: 'Êxodo', chapters: 40 },
  { name: 'Levítico', chapters: 27 },
  { name: 'Números', chapters: 36 },
  { name: 'Deuteronômio', chapters: 34 },
  { name: 'Josué', chapters: 24 },
  { name: 'Juízes', chapters: 21 },
  { name: 'Rute', chapters: 4 },
  { name: '1 Samuel', chapters: 31 },
  { name: '2 Samuel', chapters: 24 },
  { name: '1 Reis', chapters: 22 },
  { name: '2 Reis', chapters: 25 },
  { name: '1 Crônicas', chapters: 29 },
  { name: '2 Crônicas', chapters: 36 },
  { name: 'Esdras', chapters: 10 },
  { name: 'Neemias', chapters: 13 },
  { name: 'Ester', chapters: 10 },
  { name: 'Jó', chapters: 42 },
  { name: 'Salmos', chapters: 150 },
  { name: 'Provérbios', chapters: 31 },
  { name: 'Eclesiastes', chapters: 12 },
  { name: 'Cantares', chapters: 8 },
  { name: 'Isaías', chapters: 66 },
  { name: 'Jeremias', chapters: 52 },
  { name: 'Lamentações', chapters: 5 },
  { name: 'Ezequiel', chapters: 48 },
  { name: 'Daniel', chapters: 12 },
  { name: 'Oséias', chapters: 14 },
  { name: 'Joel', chapters: 3 },
  { name: 'Amós', chapters: 9 },
  { name: 'Obadias', chapters: 1 },
  { name: 'Jonas', chapters: 4 },
  { name: 'Miquéias', chapters: 7 },
  { name: 'Naum', chapters: 3 },
  { name: 'Habacuque', chapters: 3 },
  { name: 'Sofonias', chapters: 3 },
  { name: 'Ageu', chapters: 2 },
  { name: 'Zacarias', chapters: 14 },
  { name: 'Malaquias', chapters: 4 },
  // Novo Testamento
  { name: 'Mateus', chapters: 28 },
  { name: 'Marcos', chapters: 16 },
  { name: 'Lucas', chapters: 24 },
  { name: 'João', chapters: 21 },
  { name: 'Atos', chapters: 28 },
  { name: 'Romanos', chapters: 16 },
  { name: '1 Coríntios', chapters: 16 },
  { name: '2 Coríntios', chapters: 13 },
  { name: 'Gálatas', chapters: 6 },
  { name: 'Efésios', chapters: 6 },
  { name: 'Filipenses', chapters: 4 },
  { name: 'Colossenses', chapters: 4 },
  { name: '1 Tessalonicenses', chapters: 5 },
  { name: '2 Tessalonicenses', chapters: 3 },
  { name: '1 Timóteo', chapters: 6 },
  { name: '2 Timóteo', chapters: 4 },
  { name: 'Tito', chapters: 3 },
  { name: 'Filemom', chapters: 1 },
  { name: 'Hebreus', chapters: 13 },
  { name: 'Tiago', chapters: 5 },
  { name: '1 Pedro', chapters: 5 },
  { name: '2 Pedro', chapters: 3 },
  { name: '1 João', chapters: 5 },
  { name: '2 João', chapters: 1 },
  { name: '3 João', chapters: 1 },
  { name: 'Judas', chapters: 1 },
  { name: 'Apocalipse', chapters: 22 }
]

export default class ReadingPlanController {
  /**
   * Criar plano de leitura anual
   */
  async create({ auth, response }: HttpContext) {
    try {
      const user = auth.user!

      // Verificar se já existe um plano ativo
      const existingPlan = await ReadingPlan.query()
        .where('user_id', user.id)
        .where('is_active', true)
        .first()

      if (existingPlan) {
        return response.conflict({
          success: false,
          message: 'Você já possui um plano de leitura ativo'
        })
      }

      const now = DateTime.now()
      let endDate: DateTime
      let planYear: number

      // Calcular fim do ano atual
      const endOfCurrentYear = DateTime.local(now.year, 12, 31, 23, 59, 59)
      const daysUntilEndOfCurrentYear = Math.ceil(endOfCurrentYear.diff(now, 'days').days)

      // Se há menos de 90 dias para o fim do ano atual, criar plano até o fim do próximo ano
      if (daysUntilEndOfCurrentYear < 90) {
        endDate = DateTime.local(now.year + 1, 12, 31, 23, 59, 59)
        planYear = now.year + 1
      } else {
        endDate = endOfCurrentYear
        planYear = now.year
      }

      // Calcular dias totais do plano
      const totalDays = Math.ceil(endDate.diff(now, 'days').days)

      // Calcular total de capítulos da Bíblia
      const totalChapters = BIBLE_STRUCTURE.reduce((sum, book) => sum + book.chapters, 0)

      // Calcular capítulos por dia
      const chaptersPerDay = Math.ceil(totalChapters / totalDays)

      // Criar plano de leitura
      const plan = await ReadingPlan.create({
        userId: user.id,
        name: `Toda a Bíblia até o fim de ${planYear}`,
        type: 'yearly',
        startDate: now,
        endDate: endDate,
        isActive: true,
        currentDay: 1,
        totalDays: totalDays,
        chaptersPerDay: chaptersPerDay,
        totalChapters: totalChapters,
        completedChapters: 0
      })

      // Gerar progresso diário
      await this.generateDailyProgress(plan.id, totalDays, chaptersPerDay)

      return response.created({
        success: true,
        message: 'Plano de leitura criado com sucesso',
        data: {
          plan: {
            id: plan.id,
            name: plan.name,
            startDate: plan.startDate.toISO(),
            endDate: plan.endDate.toISO(),
            totalDays: plan.totalDays,
            chaptersPerDay: plan.chaptersPerDay,
            totalChapters: plan.totalChapters
          }
        }
      })
    } catch (error) {
      console.error('Erro ao criar plano:', error)
      return response.badRequest({
        success: false,
        message: 'Erro ao criar plano de leitura',
        error: error.message
      })
    }
  }

  /**
   * Obter plano ativo do usuário
   */
  async getActive({ auth, response }: HttpContext) {
    try {
      const user = auth.user!

      const plan = await ReadingPlan.query()
        .where('user_id', user.id)
        .where('is_active', true)
        .first()

      if (!plan) {
        return response.ok({
          success: true,
          data: null
        })
      }

      // Buscar leitura do dia atual
      const todayReading = await ReadingProgress.query()
        .where('reading_plan_id', plan.id)
        .where('day', plan.currentDay)
        .where('is_completed', false)
        .first()

      return response.ok({
        success: true,
        data: {
          plan: {
            id: plan.id,
            name: plan.name,
            currentDay: plan.currentDay,
            totalDays: plan.totalDays,
            chaptersPerDay: plan.chaptersPerDay,
            completedChapters: plan.completedChapters,
            totalChapters: plan.totalChapters,
            progress: Math.round((plan.completedChapters / plan.totalChapters) * 100)
          },
          todayReading: todayReading ? {
            day: todayReading.day,
            bookName: todayReading.bookName,
            startChapter: todayReading.startChapter,
            endChapter: todayReading.endChapter,
            isCompleted: todayReading.isCompleted
          } : null
        }
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Erro ao buscar plano de leitura'
      })
    }
  }

  /**
   * Marcar leitura do dia como concluída
   */
  async completeDay({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const { day } = request.only(['day'])

      const plan = await ReadingPlan.query()
        .where('user_id', user.id)
        .where('is_active', true)
        .first()

      if (!plan) {
        return response.notFound({
          success: false,
          message: 'Plano de leitura não encontrado'
        })
      }

      // Buscar leituras do dia
      const readings = await ReadingProgress.query()
        .where('reading_plan_id', plan.id)
        .where('day', day)

      // Marcar como concluídas
      const now = DateTime.now()
      for (const reading of readings) {
        reading.isCompleted = true
        reading.completedAt = now
        await reading.save()
      }

      // Atualizar plano
      plan.completedChapters += readings.length
      plan.currentDay = day + 1
      await plan.save()

      return response.ok({
        success: true,
        message: 'Leitura do dia concluída!',
        data: {
          completedChapters: plan.completedChapters,
          progress: Math.round((plan.completedChapters / plan.totalChapters) * 100)
        }
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Erro ao marcar leitura como concluída'
      })
    }
  }

  /**
   * Gerar progresso diário dividindo os capítulos
   */
  private async generateDailyProgress(planId: number, totalDays: number, chaptersPerDay: number) {
    let currentDay = 1
    let chaptersDistributed = 0
    let bookIndex = 0
    let currentChapter = 1

    while (bookIndex < BIBLE_STRUCTURE.length) {
      const book = BIBLE_STRUCTURE[bookIndex]
      let chaptersForToday = 0

      // Distribuir capítulos para o dia atual
      while (chaptersForToday < chaptersPerDay && bookIndex < BIBLE_STRUCTURE.length) {
        const chaptersRemaining = book.chapters - currentChapter + 1
        const chaptersNeeded = chaptersPerDay - chaptersForToday
        const chaptersToAdd = Math.min(chaptersRemaining, chaptersNeeded)

        const startChapter = currentChapter
        const endChapter = currentChapter + chaptersToAdd - 1

        // Criar registro de progresso
        await ReadingProgress.create({
          readingPlanId: planId,
          day: currentDay,
          bookName: book.name,
          startChapter: startChapter,
          endChapter: endChapter,
          isCompleted: false
        })

        chaptersForToday += chaptersToAdd
        chaptersDistributed += chaptersToAdd
        currentChapter += chaptersToAdd

        // Se terminou o livro, passar para o próximo
        if (currentChapter > book.chapters) {
          bookIndex++
          currentChapter = 1
        }
      }

      currentDay++

      // Parar se já distribuiu todos os capítulos ou atingiu o limite de dias
      if (chaptersDistributed >= BIBLE_STRUCTURE.reduce((sum, b) => sum + b.chapters, 0) || currentDay > totalDays) {
        break
      }
    }
  }

  /**
   * Obter histórico de leituras (últimas 30 concluídas)
   */
  async getHistory({ auth, response }: HttpContext) {
    try {
      const user = auth.user!

      const plan = await ReadingPlan.query()
        .where('user_id', user.id)
        .where('is_active', true)
        .first()

      if (!plan) {
        return response.ok({
          success: true,
          data: []
        })
      }

      const history = await ReadingProgress.query()
        .where('reading_plan_id', plan.id)
        .where('is_completed', true)
        .orderBy('updated_at', 'desc')
        .limit(30)

      return response.ok({
        success: true,
        data: history.map(h => ({
          id: h.id,
          day: h.day,
          bookName: h.bookName,
          startChapter: h.startChapter,
          endChapter: h.endChapter,
          isCompleted: h.isCompleted,
          completedAt: h.completedAt?.toISO(),
          updatedAt: h.updatedAt.toISO()
        }))
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Erro ao buscar histórico'
      })
    }
  }

  /**
   * Obter histórico completo (últimas 100 leituras, incluindo não concluídas)
   */
  async getAllHistory({ auth, response }: HttpContext) {
    try {
      const user = auth.user!

      const plan = await ReadingPlan.query()
        .where('user_id', user.id)
        .where('is_active', true)
        .first()

      if (!plan) {
        return response.ok({
          success: true,
          data: []
        })
      }

      const history = await ReadingProgress.query()
        .where('reading_plan_id', plan.id)
        .orderBy('updated_at', 'desc')
        .limit(100)

      return response.ok({
        success: true,
        data: history.map(h => ({
          id: h.id,
          day: h.day,
          bookName: h.bookName,
          startChapter: h.startChapter,
          endChapter: h.endChapter,
          isCompleted: h.isCompleted,
          completedAt: h.completedAt?.toISO(),
          updatedAt: h.updatedAt.toISO()
        }))
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Erro ao buscar histórico completo'
      })
    }
  }

  /**
   * Desmarcar leitura de um dia
   */
  async unmarkDay({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const { day } = request.only(['day'])

      const plan = await ReadingPlan.query()
        .where('user_id', user.id)
        .where('is_active', true)
        .first()

      if (!plan) {
        return response.notFound({
          success: false,
          message: 'Plano de leitura não encontrado'
        })
      }

      // Buscar leituras do dia
      const readings = await ReadingProgress.query()
        .where('reading_plan_id', plan.id)
        .where('day', day)

      if (readings.length === 0) {
        return response.notFound({
          success: false,
          message: 'Leitura não encontrada'
        })
      }

      // Calcular quantos capítulos serão desmarcados
      let chaptersToUnmark = 0
      for (const reading of readings) {
        if (reading.isCompleted) {
          chaptersToUnmark += (reading.endChapter - reading.startChapter + 1)
        }
      }

      // Desmarcar as leituras
      await ReadingProgress.query()
        .where('reading_plan_id', plan.id)
        .where('day', day)
        .update({
          isCompleted: false,
          completedAt: null
        })

      // Atualizar plano
      plan.completedChapters = Math.max(0, plan.completedChapters - chaptersToUnmark)

      // Se estávamos no dia seguinte, voltar para este dia
      if (plan.currentDay > day) {
        plan.currentDay = day
      }

      await plan.save()

      return response.ok({
        success: true,
        message: 'Leitura desmarcada com sucesso'
      })
    } catch (error) {
      console.error('Erro ao desmarcar leitura:', error)
      return response.badRequest({
        success: false,
        message: 'Erro ao desmarcar leitura'
      })
    }
  }

  /**
   * Excluir plano de leitura
   */
  async deletePlan({ auth, response }: HttpContext) {
    try {
      const user = auth.user!

      const plan = await ReadingPlan.query()
        .where('user_id', user.id)
        .where('is_active', true)
        .first()

      if (!plan) {
        return response.notFound({
          success: false,
          message: 'Plano de leitura não encontrado'
        })
      }

      // Excluir progresso de leitura (CASCADE vai fazer isso automaticamente)
      await ReadingProgress.query()
        .where('reading_plan_id', plan.id)
        .delete()

      // Excluir plano
      await plan.delete()

      return response.ok({
        success: true,
        message: 'Plano de leitura excluído com sucesso'
      })
    } catch (error) {
      console.error('Erro ao excluir plano:', error)
      return response.badRequest({
        success: false,
        message: 'Erro ao excluir plano de leitura'
      })
    }
  }
}
