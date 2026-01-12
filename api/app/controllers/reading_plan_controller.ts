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
  { name: 'Apocalipse', chapters: 22 },
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
          message: 'Você já possui um plano de leitura ativo',
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
        completedChapters: 0,
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
            totalChapters: plan.totalChapters,
          },
        },
      })
    } catch (error) {
      console.error('Erro ao criar plano:', error)
      return response.badRequest({
        success: false,
        message: 'Erro ao criar plano de leitura',
        error: error.message,
      })
    }
  }

  /**
   * Criar plano de leitura customizado (sequencial ou intercalado)
   */
  async createCustom({ auth, request, response }: HttpContext) {
    try {
      console.log('🔵 [API] createCustom - INÍCIO')
      const user = auth.user!
      console.log('👤 [API] Usuário autenticado:', { id: user.id, email: user.email })

      const { name, type, startDate, endDate, totalDays, readings } = request.only([
        'name',
        'type',
        'startDate',
        'endDate',
        'totalDays',
        'readings',
      ])

      console.log('📦 [API] Dados recebidos:', {
        name,
        type,
        startDate,
        endDate,
        totalDays,
        readingsCount: readings?.length || 0,
      })

      // Verificar se já existe um plano ativo
      console.log('🔍 [API] Verificando planos ativos existentes...')
      const existingPlan = await ReadingPlan.query()
        .where('user_id', user.id)
        .where('is_active', true)
        .first()

      if (existingPlan) {
        console.log('⚠️ [API] Usuário já possui plano ativo:', existingPlan.id)
        return response.conflict({
          success: false,
          message: 'Você já possui um plano de leitura ativo',
        })
      }

      console.log('✅ [API] Nenhum plano ativo encontrado, criando novo...')

      // Criar plano customizado
      const planData = {
        userId: user.id,
        name:
          name ||
          `Plano ${type === 'sequential' ? 'Sequencial' : 'Intercalado'} ${DateTime.now().year}`,
        type: type || 'custom',
        startDate: DateTime.fromISO(startDate),
        endDate: DateTime.fromISO(endDate),
        isActive: true,
        currentDay: 1,
        totalDays: totalDays,
        chaptersPerDay: 0, // Será calculado depois
        totalChapters: 0, // Será calculado depois
        completedChapters: 0,
      }

      console.log('💾 [API] Salvando plano no banco:', planData)
      const plan = await ReadingPlan.create(planData)
      console.log('✅ [API] Plano salvo com ID:', plan.id)

      // Salvar leituras customizadas se fornecidas
      if (readings && Array.isArray(readings)) {
        console.log(`📚 [API] Salvando ${readings.length} dias de leitura...`)
        let totalChapters = 0
        let savedCount = 0

        for (const reading of readings) {
          // Criar um registro separado para cada livro do dia (intercalado AT + NT)
          for (const bookReading of reading.readings) {
            await ReadingProgress.create({
              readingPlanId: plan.id,
              day: reading.dayNumber,
              bookName: bookReading.bookName,
              startChapter: bookReading.startChapter,
              endChapter: bookReading.endChapter,
              isCompleted: false,
            })

            savedCount++

            // Contar capítulos deste livro
            totalChapters += bookReading.endChapter - bookReading.startChapter + 1
          }

          if (reading.dayNumber % 50 === 0) {
            console.log(
              `   📖 [API] Processados ${reading.dayNumber}/${readings.length} dias (${savedCount} registros)...`
            )
          }
        }

        console.log(
          `✅ [API] ${savedCount} registros de leitura salvos (${readings.length} dias). Total de capítulos: ${totalChapters}`
        )

        // Atualizar totais
        plan.totalChapters = totalChapters
        plan.chaptersPerDay = Math.ceil(totalChapters / totalDays)
        await plan.save()
        console.log('✅ [API] Plano atualizado com totais')
      } else {
        console.log('⚠️ [API] Nenhuma leitura fornecida')
      }

      console.log('🎉 [API] Plano customizado criado com sucesso!')
      return response.created({
        success: true,
        message: 'Plano de leitura customizado criado com sucesso',
        data: {
          plan: {
            id: plan.id,
            name: plan.name,
            type: plan.type,
            startDate: plan.startDate.toISO(),
            endDate: plan.endDate.toISO(),
            totalDays: plan.totalDays,
            totalChapters: plan.totalChapters,
          },
        },
      })
    } catch (error) {
      console.error('❌ [API] ERRO ao criar plano customizado:', error)
      console.error('❌ [API] Stack trace:', error.stack)
      return response.badRequest({
        success: false,
        message: 'Erro ao criar plano de leitura customizado',
        error: error.message,
      })
    }
  }

  /**
   * Obter plano ativo do usuário
   */
  async getActive({ auth, response }: HttpContext) {
    try {
      console.log('=== GET ACTIVE PLAN API START ===')
      const user = auth.user!
      console.log('User ID:', user.id)

      const plan = await ReadingPlan.query()
        .where('user_id', user.id)
        .where('is_active', true)
        .first()

      console.log('Plan found:', !!plan)
      if (plan) {
        console.log('Plan details:', {
          id: plan.id,
          name: plan.name,
          currentDay: plan.currentDay,
          totalDays: plan.totalDays,
          isActive: plan.isActive,
          startDate: plan.startDate?.toISO(),
        })
      }

      if (!plan) {
        console.log('=== NO PLAN FOUND - RETURNING NULL ===')
        return response.ok({
          success: true,
          data: null,
        })
      }

      // Buscar leitura do dia atual
      const todayReading = await ReadingProgress.query()
        .where('reading_plan_id', plan.id)
        .where('day', plan.currentDay)
        .where('is_completed', false)

      console.log('Today reading count:', todayReading.length)
      console.log('Current day:', plan.currentDay)

      // Contar quantos dias foram realmente concluídos
      // Buscar dias distintos que foram concluídos
      const completedDaysResult = await ReadingProgress.query()
        .where('reading_plan_id', plan.id)
        .where('is_completed', true)
        .select('day')
        .groupBy('day')

      const completedDays = completedDaysResult.length

      console.log('Completed days query result count:', completedDays)
      console.log('Completed days:', completedDays)

      const responseData = {
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
            completedDays: completedDays,
            startDate: plan.startDate.toISO(),
            progress: Math.round((plan.completedChapters / plan.totalChapters) * 100),
          },
          todayReadings: todayReading.map((r) => ({
            id: r.id,
            day: r.day,
            bookName: r.bookName,
            startChapter: r.startChapter,
            endChapter: r.endChapter,
            isCompleted: r.isCompleted,
          })),
        },
      }

      console.log('=== RESPONSE DATA ===')
      console.log(JSON.stringify(responseData, null, 2))
      console.log('=== GET ACTIVE PLAN API END ===')

      return response.ok(responseData)
    } catch (error) {
      console.error('=== ERROR IN GET ACTIVE PLAN ===')
      console.error('Error details:', error)
      console.error('Error stack:', error.stack)
      return response.badRequest({
        success: false,
        message: 'Erro ao buscar plano de leitura',
      })
    }
  }

  /**
   * Marcar leitura do dia como concluída
   */
  async completeDay({ auth, request, response }: HttpContext) {
    try {
      console.log('TESTEE COMPLETE DAY')
      const user = auth.user!
      const { day } = request.only(['day'])

      console.log('DAY: ', day)

      const plan = await ReadingPlan.query()
        .where('user_id', user.id)
        .where('is_active', true)
        .first()

      if (!plan) {
        return response.notFound({
          success: false,
          message: 'Plano de leitura não encontrado',
        })
      }

      // Buscar leituras do dia
      const readings = await ReadingProgress.query()
        .where('reading_plan_id', plan.id)
        .where('day', day)

      // Marcar como concluídas e calcular total de capítulos
      const now = DateTime.now()
      let chaptersCompleted = 0

      for (const reading of readings) {
        // Calcular quantos capítulos nesta leitura
        const chaptersInReading = reading.endChapter - reading.startChapter + 1
        chaptersCompleted += chaptersInReading

        reading.isCompleted = true
        reading.completedAt = now
        await reading.save()
      }

      // Atualizar plano
      plan.completedChapters += chaptersCompleted
      plan.currentDay = day + 1
      await plan.save()

      return response.ok({
        success: true,
        message: 'Leitura do dia concluída!',
        data: {
          completedChapters: plan.completedChapters,
          progress: Math.round((plan.completedChapters / plan.totalChapters) * 100),
        },
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Erro ao marcar leitura como concluída',
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
      let chaptersForToday = 0

      // Distribuir capítulos para o dia atual
      while (chaptersForToday < chaptersPerDay && bookIndex < BIBLE_STRUCTURE.length) {
        const book = BIBLE_STRUCTURE[bookIndex]
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
          isCompleted: false,
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
      if (
        chaptersDistributed >= BIBLE_STRUCTURE.reduce((sum, b) => sum + b.chapters, 0) ||
        currentDay > totalDays
      ) {
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
          data: [],
        })
      }

      const history = await ReadingProgress.query()
        .where('reading_plan_id', plan.id)
        .where('is_completed', true)
        .orderBy('updated_at', 'desc')
        .limit(30)

      return response.ok({
        success: true,
        data: history.map((h) => ({
          id: h.id,
          day: h.day,
          bookName: h.bookName,
          startChapter: h.startChapter,
          endChapter: h.endChapter,
          isCompleted: h.isCompleted,
          completedAt: h.completedAt?.toISO(),
          updatedAt: h.updatedAt.toISO(),
        })),
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Erro ao buscar histórico',
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
          data: [],
        })
      }

      const history = await ReadingProgress.query()
        .where('reading_plan_id', plan.id)
        .orderBy('day', 'asc')
        .limit(100)

      return response.ok({
        success: true,
        data: history.map((h) => ({
          id: h.id,
          day: h.day,
          bookName: h.bookName,
          startChapter: h.startChapter,
          endChapter: h.endChapter,
          isCompleted: h.isCompleted,
          completedAt: h.completedAt?.toISO(),
          updatedAt: h.updatedAt.toISO(),
        })),
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Erro ao buscar histórico completo',
      })
    }
  }

  /**
   * Buscar todas as leituras do plano (para exportação)
   */
  async getAllReadings({ auth, response }: HttpContext) {
    try {
      const user = auth.user!

      const plan = await ReadingPlan.query()
        .where('user_id', user.id)
        .where('is_active', true)
        .first()

      if (!plan) {
        return response.notFound({
          success: false,
          message: 'Plano de leitura não encontrado',
        })
      }

      const allReadings = await ReadingProgress.query()
        .where('reading_plan_id', plan.id)
        .orderBy('day', 'asc')

      return response.ok({
        success: true,
        data: allReadings.map((r) => ({
          id: r.id,
          day: r.day,
          bookName: r.bookName,
          startChapter: r.startChapter,
          endChapter: r.endChapter,
          isCompleted: r.isCompleted,
          completedAt: r.completedAt ? r.completedAt.toISO() : null,
          updatedAt: r.updatedAt.toISO(),
        })),
      })
    } catch (error) {
      console.error('Erro ao buscar todas as leituras:', error)
      return response.badRequest({
        success: false,
        message: 'Erro ao buscar todas as leituras',
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
          message: 'Plano de leitura não encontrado',
        })
      }

      // Buscar leituras do dia
      const readings = await ReadingProgress.query()
        .where('reading_plan_id', plan.id)
        .where('day', day)

      if (readings.length === 0) {
        return response.notFound({
          success: false,
          message: 'Leitura não encontrada',
        })
      }

      // Calcular quantos capítulos serão desmarcados
      let chaptersToUnmark = 0
      for (const reading of readings) {
        if (reading.isCompleted) {
          chaptersToUnmark += reading.endChapter - reading.startChapter + 1
        }
      }

      // Desmarcar as leituras
      await ReadingProgress.query().where('reading_plan_id', plan.id).where('day', day).update({
        isCompleted: false,
        completedAt: null,
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
        message: 'Leitura desmarcada com sucesso',
      })
    } catch (error) {
      console.error('Erro ao desmarcar leitura:', error)
      return response.badRequest({
        success: false,
        message: 'Erro ao desmarcar leitura',
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
          message: 'Plano de leitura não encontrado',
        })
      }

      // Excluir progresso de leitura (CASCADE vai fazer isso automaticamente)
      await ReadingProgress.query().where('reading_plan_id', plan.id).delete()

      // Excluir plano
      await plan.delete()

      return response.ok({
        success: true,
        message: 'Plano de leitura excluído com sucesso',
      })
    } catch (error) {
      console.error('Erro ao excluir plano:', error)
      return response.badRequest({
        success: false,
        message: 'Erro ao excluir plano de leitura',
      })
    }
  }

  /**
   * Retorna ranking global de usuários baseado no desempenho de leitura
   */
  async getRanking({ response }: HttpContext) {
    try {
      const plans = await ReadingPlan.query()
        .preload('user')
        .preload('progress', (query) => {
          query.where('is_completed', true).orderBy('completed_at', 'asc')
        })
        .where('is_active', true)
        .orderBy('completed_chapters', 'desc')

      const ranking = plans.map((plan, index) => {
        const user = plan.user
        const progress = plan.progress

        // Calcular estatísticas
        const totalDaysRead = progress.length
        const averageChaptersPerDay =
          totalDaysRead > 0 ? (plan.completedChapters / totalDaysRead).toFixed(1) : '0.0'

        // Encontrar horário mais comum de leitura
        const readingHours = progress
          .map((p) => {
            if (p.completedAt) {
              const dt =
                p.completedAt instanceof DateTime
                  ? p.completedAt
                  : DateTime.fromJSDate(p.completedAt)
              return dt.hour
            }
            return null
          })
          .filter((h) => h !== null)

        const mostCommonHour =
          readingHours.length > 0
            ? Math.round(readingHours.reduce((a, b) => a + b, 0) / readingHours.length)
            : null

        // Calcular sequência atual (streak)
        let currentStreak = 0

        for (let i = 0; i < plan.totalDays; i++) {
          const dayProgress = progress.find((p) => p.day === plan.currentDay - i)
          if (dayProgress && dayProgress.isCompleted) {
            currentStreak++
          } else {
            break
          }
        }

        // Última leitura
        const lastProgress = progress.length > 0 ? progress[progress.length - 1] : null
        const lastReading = lastProgress?.completedAt
          ? (lastProgress.completedAt instanceof DateTime
              ? lastProgress.completedAt
              : DateTime.fromJSDate(lastProgress.completedAt)
            ).toFormat('dd/MM/yyyy HH:mm')
          : null

        return {
          position: index + 1,
          userName: user?.fullName || 'Usuário',
          userEmail: user?.email || '',
          planName: plan.name,
          completedChapters: plan.completedChapters,
          totalChapters: plan.totalChapters,
          progressPercentage: Math.round((plan.completedChapters / plan.totalChapters) * 100),
          currentDay: plan.currentDay,
          totalDays: plan.totalDays,
          totalDaysRead,
          averageChaptersPerDay: Number.parseFloat(averageChaptersPerDay),
          currentStreak,
          mostCommonHour,
          lastReading,
          startDate: plan.startDate.toFormat('dd/MM/yyyy'),
          endDate: plan.endDate.toFormat('dd/MM/yyyy'),
        }
      })

      return response.ok({
        success: true,
        data: ranking,
      })
    } catch (error) {
      console.error('Erro ao buscar ranking:', error)
      return response.badRequest({
        success: false,
        message: 'Erro ao buscar ranking',
      })
    }
  }

  /**
   * Retorna página HTML com ranking de usuários
   */
  async getRankingPage({ response }: HttpContext) {
    try {
      const plans = await ReadingPlan.query()
        .preload('user')
        .preload('progress', (query) => {
          query.where('is_completed', true).orderBy('completed_at', 'asc')
        })
        .where('is_active', true)
        .orderBy('completed_chapters', 'desc')

      const ranking = plans.map((plan, index) => {
        const user = plan.user
        const progress = plan.progress

        const totalDaysRead = progress.length
        const averageChaptersPerDay =
          totalDaysRead > 0 ? (plan.completedChapters / totalDaysRead).toFixed(1) : '0.0'

        const readingHours = progress
          .map((p) => {
            if (p.completedAt) {
              const dt =
                p.completedAt instanceof DateTime
                  ? p.completedAt
                  : DateTime.fromJSDate(p.completedAt)
              return dt.hour
            }
            return null
          })
          .filter((h) => h !== null)

        const mostCommonHour =
          readingHours.length > 0
            ? Math.round(readingHours.reduce((a, b) => a + b, 0) / readingHours.length)
            : null

        let currentStreak = 0
        for (let i = 0; i < plan.totalDays; i++) {
          const dayProgress = progress.find((p) => p.day === plan.currentDay - i)
          if (dayProgress && dayProgress.isCompleted) {
            currentStreak++
          } else {
            break
          }
        }

        const lastProgressItem = progress.length > 0 ? progress[progress.length - 1] : null
        const lastReading = lastProgressItem?.completedAt
          ? (lastProgressItem.completedAt instanceof DateTime
              ? lastProgressItem.completedAt
              : DateTime.fromJSDate(lastProgressItem.completedAt)
            ).toFormat('dd/MM/yyyy HH:mm')
          : 'Nunca'

        return {
          position: index + 1,
          userName: user?.fullName || 'Usuário',
          completedChapters: plan.completedChapters,
          totalChapters: plan.totalChapters,
          progressPercentage: Math.round((plan.completedChapters / plan.totalChapters) * 100),
          currentDay: plan.currentDay,
          totalDays: plan.totalDays,
          totalDaysRead,
          averageChaptersPerDay,
          currentStreak,
          mostCommonHour: mostCommonHour ? `${mostCommonHour}:00` : 'N/A',
          lastReading,
        }
      })

      const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ranking de Leitura Bíblica</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
    }

    .header {
      background: white;
      border-radius: 16px;
      padding: 32px;
      margin-bottom: 24px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
      text-align: center;
    }

    .header h1 {
      color: #667eea;
      font-size: 36px;
      margin-bottom: 8px;
    }

    .header p {
      color: #666;
      font-size: 16px;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .stat-card {
      background: white;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    }

    .stat-card h3 {
      color: #999;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 8px;
      text-transform: uppercase;
    }

    .stat-card p {
      color: #333;
      font-size: 28px;
      font-weight: bold;
    }

    .ranking-table {
      background: white;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    thead {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    th {
      padding: 16px;
      text-align: left;
      font-weight: 600;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    td {
      padding: 16px;
      border-bottom: 1px solid #f0f0f0;
    }

    tbody tr:hover {
      background: #f8f9ff;
    }

    tbody tr:last-child td {
      border-bottom: none;
    }

    .position {
      font-weight: bold;
      font-size: 20px;
      color: #667eea;
      width: 60px;
      text-align: center;
    }

    .position.gold { color: #FFD700; }
    .position.silver { color: #C0C0C0; }
    .position.bronze { color: #CD7F32; }

    .user-name {
      font-weight: 600;
      color: #333;
      font-size: 16px;
    }

    .progress-bar {
      width: 100%;
      height: 8px;
      background: #f0f0f0;
      border-radius: 4px;
      overflow: hidden;
      margin-top: 4px;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
      transition: width 0.3s ease;
    }

    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      background: #667eea;
      color: white;
    }

    .badge.streak {
      background: #f59e0b;
    }

    .badge.time {
      background: #10b981;
    }

    .stat-value {
      color: #666;
      font-size: 14px;
    }

    @media (max-width: 768px) {
      .header h1 {
        font-size: 24px;
      }

      table {
        font-size: 12px;
      }

      th, td {
        padding: 8px;
      }

      .hide-mobile {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🏆 Ranking de Leitura Bíblica</h1>
      <p>Desempenho dos usuários na jornada de leitura</p>
    </div>

    <div class="stats">
      <div class="stat-card">
        <h3>Total de Leitores</h3>
        <p>${ranking.length}</p>
      </div>
      <div class="stat-card">
        <h3>Capítulos Lidos</h3>
        <p>${ranking.reduce((sum, r) => sum + r.completedChapters, 0)}</p>
      </div>
      <div class="stat-card">
        <h3>Média de Progresso</h3>
        <p>${ranking.length > 0 ? Math.round(ranking.reduce((sum, r) => sum + r.progressPercentage, 0) / ranking.length) : 0}%</p>
      </div>
      <div class="stat-card">
        <h3>Maior Sequência</h3>
        <p>${ranking.length > 0 ? Math.max(...ranking.map((r) => r.currentStreak)) : 0} dias</p>
      </div>
    </div>

    <div class="ranking-table">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Usuário</th>
            <th>Progresso</th>
            <th class="hide-mobile">Dias de Leitura</th>
            <th class="hide-mobile">Média/Dia</th>
            <th class="hide-mobile">Sequência</th>
            <th class="hide-mobile">Horário Comum</th>
            <th>Última Leitura</th>
          </tr>
        </thead>
        <tbody>
          ${ranking
            .map(
              (r) => `
            <tr>
              <td class="position ${r.position === 1 ? 'gold' : r.position === 2 ? 'silver' : r.position === 3 ? 'bronze' : ''}">${r.position}º</td>
              <td>
                <div class="user-name">${r.userName}</div>
                <div class="stat-value">${r.currentDay}/${r.totalDays} dias</div>
              </td>
              <td>
                <div class="stat-value">${r.completedChapters}/${r.totalChapters} capítulos</div>
                <div class="progress-bar">
                  <div class="progress-fill" style="width: ${r.progressPercentage}%"></div>
                </div>
              </td>
              <td class="hide-mobile">
                <span class="badge">${r.totalDaysRead} dias</span>
              </td>
              <td class="hide-mobile">
                <span class="stat-value">${r.averageChaptersPerDay} cap/dia</span>
              </td>
              <td class="hide-mobile">
                <span class="badge streak">🔥 ${r.currentStreak}</span>
              </td>
              <td class="hide-mobile">
                <span class="badge time">🕐 ${r.mostCommonHour}</span>
              </td>
              <td>
                <span class="stat-value">${r.lastReading}</span>
              </td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>
      `

      return response.header('Content-Type', 'text/html; charset=utf-8').send(html)
    } catch (error) {
      console.error('Erro ao gerar página de ranking:', error)
      return response.status(500).send('<h1>Erro ao carregar ranking</h1>')
    }
  }

  /**
   * Listar usuários com planos de leitura incorretos (com menos dias do que deveriam)
   * GET /api/admin/reading-plans/incorrect
   */
  async listIncorrectPlans({ response }: HttpContext) {
    try {
      // Buscar todos os planos ativos
      const plans = await ReadingPlan.query()
        .where('is_active', true)
        .preload('user')
        .preload('progress')

      const totalChapters = BIBLE_STRUCTURE.reduce((sum, book) => sum + book.chapters, 0)
      const incorrectPlans: any[] = []

      for (const plan of plans) {
        const startDate = plan.startDate
        const endDate = plan.endDate

        // Calcular quantos dias DEVERIAM existir entre start_date e end_date
        const expectedDays = Math.ceil(endDate.diff(startDate, 'days').days)

        // Contar quantos dias REALMENTE existem no reading_progress
        const daysInProgress = new Set(plan.progress.map(p => p.day))
        const maxDayInProgress = Math.max(...Array.from(daysInProgress), 0)
        const actualProgressDays = daysInProgress.size

        // Verificar se está incorreto:
        // 1. Se o número de dias no progress é menor que o esperado
        // 2. Se o max day é menor que expected days (faltam dias no final)
        const missingDays = expectedDays - maxDayInProgress
        const isIncorrect = missingDays > 5 || actualProgressDays < (expectedDays * 0.95)

        if (isIncorrect) {
          // Contar quantos dias já foram lidos
          const completedDays = new Set(
            plan.progress.filter(p => p.isCompleted).map(p => p.day)
          ).size

          // Contar capítulos completados
          const completedChapters = plan.progress
            .filter(p => p.isCompleted)
            .reduce((sum, p) => sum + (p.endChapter - p.startChapter + 1), 0)

          let issue = ''
          if (missingDays > 5) {
            issue = `Faltam ${missingDays} dias no plano (deveria ter ${expectedDays} dias, mas tem apenas ${maxDayInProgress})`
          } else {
            const missingProgressDays = expectedDays - actualProgressDays
            issue = `Faltam ${missingProgressDays} registros de dias (esperado: ${expectedDays}, encontrado: ${actualProgressDays})`
          }

          incorrectPlans.push({
            planId: plan.id,
            userId: plan.userId,
            userName: plan.user.fullName,
            userEmail: plan.user.email,
            planName: plan.name,
            startDate: plan.startDate.toISO(),
            endDate: plan.endDate.toISO(),
            totalDays: plan.totalDays,
            expectedDays: expectedDays,
            actualDays: maxDayInProgress,
            progressRecords: actualProgressDays,
            missingDays: missingDays,
            chaptersPerDay: plan.chaptersPerDay,
            totalChapters: plan.totalChapters,
            completedDays: completedDays,
            completedChapters: completedChapters,
            progressPercentage: Math.round((completedChapters / totalChapters) * 100),
            issue: issue,
          })
        }
      }

      return response.ok({
        success: true,
        data: {
          total: incorrectPlans.length,
          plans: incorrectPlans.sort((a, b) => b.missingDays - a.missingDays),
        },
      })
    } catch (error) {
      console.error('Erro ao listar planos incorretos:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao listar planos incorretos',
        error: error.message,
      })
    }
  }

  /**
   * Recalcular plano de leitura mantendo o progresso já realizado
   * POST /api/admin/reading-plans/:planId/recalculate
   */
  async recalculatePlan({ params, response }: HttpContext) {
    try {
      const { planId } = params

      // Buscar plano
      const plan = await ReadingPlan.query()
        .where('id', planId)
        .preload('progress')
        .firstOrFail()

      console.log(`[RecalculatePlan] Recalculando plano ${planId}...`)

      // Buscar progresso completado
      const completedProgress = plan.progress.filter(p => p.isCompleted)
      const completedDays = new Set(completedProgress.map(p => p.day))

      console.log(`[RecalculatePlan] Progresso atual: ${completedProgress.length} registros completados em ${completedDays.size} dias`)

      // Mapear o que já foi lido (livro + capítulos)
      const completedChaptersMap = new Map<string, Set<number>>()

      for (const progress of completedProgress) {
        if (!completedChaptersMap.has(progress.bookName)) {
          completedChaptersMap.set(progress.bookName, new Set())
        }
        const chaptersSet = completedChaptersMap.get(progress.bookName)!
        for (let ch = progress.startChapter; ch <= progress.endChapter; ch++) {
          chaptersSet.add(ch)
        }
      }

      // Calcular total de capítulos completados
      let totalCompletedChapters = 0
      for (const chapters of completedChaptersMap.values()) {
        totalCompletedChapters += chapters.size
      }

      console.log(`[RecalculatePlan] Total de capítulos já lidos: ${totalCompletedChapters}`)

      // MANTER o período original do plano (não recalcular até fim do ano)
      const originalStartDate = plan.startDate
      const originalEndDate = plan.endDate
      const originalTotalDays = Math.ceil(originalEndDate.diff(originalStartDate, 'days').days)

      console.log(`[RecalculatePlan] Mantendo período original: ${originalTotalDays} dias (${originalStartDate.toISO()} até ${originalEndDate.toISO()})`)

      const totalChapters = BIBLE_STRUCTURE.reduce((sum, book) => sum + book.chapters, 0)
      const remainingChapters = totalChapters - totalCompletedChapters

      // Calcular quantos dias faltam criar
      const maxDayCompleted = Math.max(...completedDays, 0)
      const daysToCreate = originalTotalDays - maxDayCompleted

      console.log(`[RecalculatePlan] Último dia completado: ${maxDayCompleted}, dias totais: ${originalTotalDays}, faltam criar: ${daysToCreate}`)

      // Usar 4 capítulos por dia como padrão, ajustando os últimos dias se necessário
      const baseChaptersPerDay = 4
      const daysWithBaseChapters = Math.floor(remainingChapters / baseChaptersPerDay)
      const remainingChaptersInLastDay = remainingChapters % baseChaptersPerDay

      console.log(`[RecalculatePlan] Distribuição: ${daysWithBaseChapters} dias com ${baseChaptersPerDay} cap/dia + último dia com ${remainingChaptersInLastDay} capítulos`)

      // Deletar APENAS os registros NÃO completados
      const deletedCount = await ReadingProgress.query()
        .where('reading_plan_id', planId)
        .where('is_completed', false)
        .delete()

      console.log(`[RecalculatePlan] ${deletedCount} registros não completados deletados`)

      // Gerar nova distribuição começando de onde parou
      let currentDay = Math.max(...completedDays, 0) + 1
      let bookIndex = 0
      let currentChapter = 1

      // Pular livros/capítulos já completados
      for (let i = 0; i < BIBLE_STRUCTURE.length; i++) {
        const book = BIBLE_STRUCTURE[i]
        const completedInBook = completedChaptersMap.get(book.name) || new Set()

        if (completedInBook.size === 0) {
          // Livro não iniciado
          bookIndex = i
          currentChapter = 1
          break
        } else if (completedInBook.size < book.chapters) {
          // Livro parcialmente lido - encontrar próximo capítulo não lido
          bookIndex = i
          for (let ch = 1; ch <= book.chapters; ch++) {
            if (!completedInBook.has(ch)) {
              currentChapter = ch
              break
            }
          }
          break
        }
        // Livro completamente lido, continuar para o próximo
      }

      console.log(`[RecalculatePlan] Reiniciando de: ${BIBLE_STRUCTURE[bookIndex]?.name} cap ${currentChapter}, dia ${currentDay}`)

      // Gerar novos registros de progresso com distribuição inteligente
      let newRecordsCount = 0
      let chaptersDistributed = 0

      while (bookIndex < BIBLE_STRUCTURE.length && currentDay <= originalTotalDays) {
        // Calcular quantos capítulos colocar neste dia
        const chaptersRemaining = remainingChapters - chaptersDistributed
        const daysRemaining = originalTotalDays - currentDay + 1

        // Usar 4 cap/dia, mas ajustar nos últimos dias se necessário
        let chaptersForToday: number
        if (daysRemaining === 1) {
          // Último dia: colocar todos os capítulos restantes
          chaptersForToday = chaptersRemaining
        } else if (chaptersRemaining <= daysRemaining * baseChaptersPerDay) {
          // Estamos próximos do fim, distribuir uniformemente
          chaptersForToday = Math.ceil(chaptersRemaining / daysRemaining)
        } else {
          // Ainda longe do fim, usar base de 4 cap/dia
          chaptersForToday = baseChaptersPerDay
        }

        let chaptersAddedToday = 0

        while (chaptersAddedToday < chaptersForToday && bookIndex < BIBLE_STRUCTURE.length) {
          const book = BIBLE_STRUCTURE[bookIndex]
          const completedInBook = completedChaptersMap.get(book.name) || new Set()

          // Pular capítulos já lidos
          while (currentChapter <= book.chapters && completedInBook.has(currentChapter)) {
            currentChapter++
          }

          if (currentChapter > book.chapters) {
            bookIndex++
            currentChapter = 1
            continue
          }

          const chaptersRemainingInBook = book.chapters - currentChapter + 1
          const chaptersNeeded = chaptersForToday - chaptersAddedToday
          const chaptersToAdd = Math.min(chaptersRemainingInBook, chaptersNeeded)

          const startChapter = currentChapter
          const endChapter = currentChapter + chaptersToAdd - 1

          await ReadingProgress.create({
            readingPlanId: planId,
            day: currentDay,
            bookName: book.name,
            startChapter: startChapter,
            endChapter: endChapter,
            isCompleted: false,
          })

          newRecordsCount++
          chaptersAddedToday += chaptersToAdd
          chaptersDistributed += chaptersToAdd
          currentChapter += chaptersToAdd

          if (currentChapter > book.chapters) {
            bookIndex++
            currentChapter = 1
          }
        }

        currentDay++
      }

      console.log(`[RecalculatePlan] ${newRecordsCount} novos registros criados, ${chaptersDistributed} capítulos distribuídos`)

      // Atualizar plano (mantendo datas originais)
      plan.totalDays = originalTotalDays
      plan.chaptersPerDay = baseChaptersPerDay
      plan.totalChapters = totalChapters
      plan.completedChapters = totalCompletedChapters
      await plan.save()

      console.log(`[RecalculatePlan] Plano atualizado com sucesso!`)

      return response.ok({
        success: true,
        message: 'Plano recalculado com sucesso mantendo o progresso',
        data: {
          plan: {
            id: plan.id,
            name: plan.name,
            startDate: plan.startDate.toISO(),
            endDate: plan.endDate.toISO(),
            totalDays: plan.totalDays,
            chaptersPerDay: plan.chaptersPerDay,
            completedChapters: totalCompletedChapters,
            remainingChapters: remainingChapters,
          },
          changes: {
            deletedRecords: deletedCount,
            newRecords: newRecordsCount,
            keptCompletedRecords: completedProgress.length,
            chaptersDistributed: chaptersDistributed,
          },
        },
      })
    } catch (error) {
      console.error('Erro ao recalcular plano:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao recalcular plano de leitura',
        error: error.message,
      })
    }
  }
}
