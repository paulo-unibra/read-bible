import ReadingPlan from '#models/reading_plan'
import ReadingProgress from '#models/reading_progress'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import { BIBLE_VERSES_PER_CHAPTER, getVersesInRange } from '../utils/bible_verses_per_chapter.js'

// Estrutura completa da Bíblia com todos os capítulos e versículos
const BIBLE_STRUCTURE = [
  // Antigo Testamento
  { name: 'Gênesis', chapters: 50, verses: 1533 },
  { name: 'Êxodo', chapters: 40, verses: 1213 },
  { name: 'Levítico', chapters: 27, verses: 859 },
  { name: 'Números', chapters: 36, verses: 1288 },
  { name: 'Deuteronômio', chapters: 34, verses: 959 },
  { name: 'Josué', chapters: 24, verses: 658 },
  { name: 'Juízes', chapters: 21, verses: 618 },
  { name: 'Rute', chapters: 4, verses: 85 },
  { name: '1 Samuel', chapters: 31, verses: 810 },
  { name: '2 Samuel', chapters: 24, verses: 695 },
  { name: '1 Reis', chapters: 22, verses: 816 },
  { name: '2 Reis', chapters: 25, verses: 719 },
  { name: '1 Crônicas', chapters: 29, verses: 942 },
  { name: '2 Crônicas', chapters: 36, verses: 822 },
  { name: 'Esdras', chapters: 10, verses: 280 },
  { name: 'Neemias', chapters: 13, verses: 406 },
  { name: 'Ester', chapters: 10, verses: 167 },
  { name: 'Jó', chapters: 42, verses: 1070 },
  { name: 'Salmos', chapters: 150, verses: 2461 },
  { name: 'Provérbios', chapters: 31, verses: 915 },
  { name: 'Eclesiastes', chapters: 12, verses: 222 },
  { name: 'Cantares', chapters: 8, verses: 117 },
  { name: 'Isaías', chapters: 66, verses: 1292 },
  { name: 'Jeremias', chapters: 52, verses: 1364 },
  { name: 'Lamentações', chapters: 5, verses: 154 },
  { name: 'Ezequiel', chapters: 48, verses: 1273 },
  { name: 'Daniel', chapters: 12, verses: 357 },
  { name: 'Oséias', chapters: 14, verses: 197 },
  { name: 'Joel', chapters: 3, verses: 73 },
  { name: 'Amós', chapters: 9, verses: 146 },
  { name: 'Obadias', chapters: 1, verses: 21 },
  { name: 'Jonas', chapters: 4, verses: 48 },
  { name: 'Miquéias', chapters: 7, verses: 105 },
  { name: 'Naum', chapters: 3, verses: 47 },
  { name: 'Habacuque', chapters: 3, verses: 56 },
  { name: 'Sofonias', chapters: 3, verses: 53 },
  { name: 'Ageu', chapters: 2, verses: 38 },
  { name: 'Zacarias', chapters: 14, verses: 211 },
  { name: 'Malaquias', chapters: 4, verses: 55 },
  // Novo Testamento
  { name: 'Mateus', chapters: 28, verses: 1071 },
  { name: 'Marcos', chapters: 16, verses: 678 },
  { name: 'Lucas', chapters: 24, verses: 1151 },
  { name: 'João', chapters: 21, verses: 879 },
  { name: 'Atos', chapters: 28, verses: 1007 },
  { name: 'Romanos', chapters: 16, verses: 433 },
  { name: '1 Coríntios', chapters: 16, verses: 437 },
  { name: '2 Coríntios', chapters: 13, verses: 257 },
  { name: 'Gálatas', chapters: 6, verses: 149 },
  { name: 'Efésios', chapters: 6, verses: 155 },
  { name: 'Filipenses', chapters: 4, verses: 104 },
  { name: 'Colossenses', chapters: 4, verses: 95 },
  { name: '1 Tessalonicenses', chapters: 5, verses: 89 },
  { name: '2 Tessalonicenses', chapters: 3, verses: 47 },
  { name: '1 Timóteo', chapters: 6, verses: 113 },
  { name: '2 Timóteo', chapters: 4, verses: 83 },
  { name: 'Tito', chapters: 3, verses: 46 },
  { name: 'Filemom', chapters: 1, verses: 25 },
  { name: 'Hebreus', chapters: 13, verses: 303 },
  { name: 'Tiago', chapters: 5, verses: 108 },
  { name: '1 Pedro', chapters: 5, verses: 105 },
  { name: '2 Pedro', chapters: 3, verses: 61 },
  { name: '1 João', chapters: 5, verses: 105 },
  { name: '2 João', chapters: 1, verses: 13 },
  { name: '3 João', chapters: 1, verses: 14 },
  { name: 'Judas', chapters: 1, verses: 25 },
  { name: 'Apocalipse', chapters: 22, verses: 404 },
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
   * AGORA: Backend gera os dias automaticamente, app só envia metadados
   */
  async createCustom({ auth, request, response }: HttpContext) {
    try {
      console.log('🔵 [API] createCustom - INÍCIO')
      const user = auth.user!
      console.log('👤 [API] Usuário autenticado:', { id: user.id, email: user.email })

      const { name, type, startDate, endDate, totalDays } = request.only([
        'name',
        'type',
        'startDate',
        'endDate',
        'totalDays',
      ])

      console.log('📦 [API] Dados recebidos:')
      console.log('   name:', name)
      console.log('   type:', type)
      console.log('   startDate:', startDate)
      console.log('   endDate:', endDate)
      console.log('   totalDays:', totalDays)

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

      // Calcular capítulos por dia baseado no tipo de plano
      let totalBibleChapters: number
      let chaptersPerDay: number

      if (type === 'interleaved') {
        // Para intercalado, ambos AT e NT devem terminar no mesmo dia
        // AT: 929 capítulos, NT: 260 capítulos
        const atChapters = BIBLE_STRUCTURE.slice(0, 39).reduce(
          (sum, book) => sum + book.chapters,
          0
        )
        const ntChapters = BIBLE_STRUCTURE.slice(39).reduce((sum, book) => sum + book.chapters, 0)

        const atChaptersPerDay = Math.ceil(atChapters / totalDays)
        const ntChaptersPerDay = Math.ceil(ntChapters / totalDays)

        totalBibleChapters = atChapters + ntChapters
        chaptersPerDay = atChaptersPerDay + ntChaptersPerDay

        console.log(`📖 [API] Intercalado - AT: ${atChapters} caps, NT: ${ntChapters} caps`)
        console.log(
          `📊 [API] Capítulos por dia: AT ${atChaptersPerDay} + NT ${ntChaptersPerDay} = ${chaptersPerDay} total`
        )
      } else {
        // Para sequencial, calcular baseado no total da Bíblia
        totalBibleChapters = BIBLE_STRUCTURE.reduce((sum, book) => sum + book.chapters, 0)
        chaptersPerDay = Math.ceil(totalBibleChapters / totalDays)

        console.log(`📖 [API] Total de capítulos da Bíblia: ${totalBibleChapters}`)
        console.log(
          `📊 [API] Capítulos por dia necessários: ${chaptersPerDay} (${totalBibleChapters} capítulos / ${totalDays} dias)`
        )
      }

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
        chaptersPerDay: chaptersPerDay,
        totalChapters: totalBibleChapters,
        completedChapters: 0,
      }

      console.log('💾 [API] Tentando salvar plano no banco...')
      console.log('   Plan Data:', JSON.stringify(planData, null, 2))

      const plan = await ReadingPlan.create(planData)
      console.log('✅ [API] Plano salvo com sucesso!')
      console.log('   ID do plano:', plan.id)
      console.log('   Nome:', plan.name)
      console.log('   Tipo:', plan.type)
      console.log('   Total dias:', plan.totalDays)

      // NOVA LÓGICA: Gerar os 5 primeiros dias automaticamente
      console.log(`📚 [API] Gerando os 5 primeiros dias automaticamente...`)
      let savedCount = 0
      const initialDaysCount = Math.min(5, totalDays)

      for (let dayNumber = 1; dayNumber <= initialDaysCount; dayNumber++) {
        console.log(`   📖 Gerando dia ${dayNumber}...`)

        const dayReadings = await this.generateDayReadings(
          plan.type,
          dayNumber,
          plan.chaptersPerDay,
          plan.totalDays,
          plan.id
        )

        if (!dayReadings || dayReadings.length === 0) {
          console.log(`   ⚠️ Não foi possível gerar leituras para o dia ${dayNumber}`)
          continue
        }

        console.log(`   📚 Dia ${dayNumber} terá ${dayReadings.length} leitura(s)`)

        for (const bookReading of dayReadings) {
          console.log(
            `      💾 Salvando: ${bookReading.bookName} cap ${bookReading.startChapter}-${bookReading.endChapter}`
          )

          const progressRecord = await ReadingProgress.create({
            readingPlanId: plan.id,
            day: dayNumber,
            bookName: bookReading.bookName,
            startChapter: bookReading.startChapter,
            endChapter: bookReading.endChapter,
            isCompleted: false,
          })

          console.log(`      ✅ Registro ${progressRecord.id} salvo`)
          savedCount++
        }
      }

      console.log(`✅ [API] ${savedCount} registros dos primeiros ${initialDaysCount} dias criados`)

      // Salvar plano com totais já calculados
      await plan.save()
      console.log('✅ [API] Plano salvo com totais calculados')

      console.log('🎉 [API] Plano customizado criado com sucesso!')
      console.log('📤 [API] Enviando resposta ao cliente...')

      const responseData = {
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
      }

      console.log('📤 [API] Resposta:', JSON.stringify(responseData, null, 2))
      console.log('🔵 [API] createCustom - FIM')

      return response.created(responseData)
    } catch (error) {
      console.error('❌ [API] ERRO FATAL ao criar plano customizado!')
      console.error('❌ [API] Tipo do erro:', error?.constructor?.name)
      console.error('❌ [API] Mensagem:', error?.message)
      console.error('❌ [API] Stack trace completo:')
      console.error(error?.stack)

      return response.badRequest({
        success: false,
        message: 'Erro ao criar plano de leitura customizado',
        error: error.message,
        errorType: error?.constructor?.name,
      })
    }
  }

  /**
   * Criar plano de leitura para iniciantes (Leia toda a Bíblia até o fim do ano de forma leve)
   * Distribui ~31.102 versículos proporcionalmente pelos dias restantes até 31/12
   */
  async createBeginner({ auth, response }: HttpContext) {
    try {
      console.log('🔵 [API] createBeginner - INÍCIO')
      const user = auth.user!
      console.log('👤 [API] Usuário autenticado:', { id: user.id, email: user.email })

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

      // Calcular dias até o fim do ano
      const now = DateTime.now()
      const endOfYear = DateTime.local(now.year, 12, 31, 23, 59, 59)
      const totalDays = Math.ceil(endOfYear.diff(now, 'days').days)

      if (totalDays <= 0) {
        return response.badRequest({
          success: false,
          message:
            'Não é possível criar plano para iniciantes com tão poucos dias restantes no ano',
        })
      }

      console.log(`📅 [API] Dias restantes até 31/12/${now.year}: ${totalDays}`)

      // Calcular total de versículos da Bíblia
      const totalVerses = BIBLE_STRUCTURE.reduce((sum, book) => sum + book.verses, 0)
      console.log(`📖 [API] Total de versículos na Bíblia: ${totalVerses}`)

      // Calcular versículos por dia (arredonda para cima)
      const versesPerDay = Math.ceil(totalVerses / totalDays)
      console.log(
        `📊 [API] Versículos por dia: ${versesPerDay} (${totalVerses} versículos / ${totalDays} dias)`
      )

      // Calcular total de capítulos (para estatísticas)
      const totalChapters = BIBLE_STRUCTURE.reduce((sum, book) => sum + book.chapters, 0)

      // Criar plano para iniciantes
      const planData = {
        userId: user.id,
        name: `Plano para Iniciantes ${now.year}`,
        type: 'beginner' as const,
        startDate: now,
        endDate: endOfYear,
        isActive: true,
        currentDay: 1,
        totalDays: totalDays,
        chaptersPerDay: versesPerDay, // Usando esse campo para armazenar versículos/dia
        totalChapters: totalChapters,
        completedChapters: 0,
      }

      console.log('💾 [API] Tentando salvar plano no banco...')
      console.log('   Plan Data:', JSON.stringify(planData, null, 2))

      const plan = await ReadingPlan.create(planData)
      console.log('✅ [API] Plano salvo com sucesso!')
      console.log('   ID do plano:', plan.id)
      console.log('   Nome:', plan.name)
      console.log('   Tipo:', plan.type)
      console.log('   Total dias:', plan.totalDays)
      console.log('   Versículos por dia:', versesPerDay)

      // Gerar os 5 primeiros dias automaticamente
      console.log(`📚 [API] Gerando os 5 primeiros dias automaticamente...`)
      let savedCount = 0
      const initialDaysCount = Math.min(5, totalDays)

      for (let dayNumber = 1; dayNumber <= initialDaysCount; dayNumber++) {
        console.log(`   📖 Gerando dia ${dayNumber}...`)

        const dayReadings = await this.generateDayReadings(
          'beginner',
          dayNumber,
          versesPerDay,
          plan.totalDays,
          plan.id
        )

        if (!dayReadings || dayReadings.length === 0) {
          console.log(`   ⚠️ Não foi possível gerar leituras para o dia ${dayNumber}`)
          continue
        }

        console.log(`   📚 Dia ${dayNumber} terá ${dayReadings.length} leitura(s)`)

        for (const bookReading of dayReadings) {
          console.log(
            `      💾 Salvando: ${bookReading.bookName} cap ${bookReading.startChapter}-${bookReading.endChapter}`
          )

          const progressRecord = await ReadingProgress.create({
            readingPlanId: plan.id,
            day: dayNumber,
            bookName: bookReading.bookName,
            startChapter: bookReading.startChapter,
            endChapter: bookReading.endChapter,
            isCompleted: false,
          })

          console.log(`      ✅ Registro ${progressRecord.id} salvo`)
          savedCount++
        }
      }

      console.log(`✅ [API] ${savedCount} registros dos primeiros ${initialDaysCount} dias criados`)

      // Salvar plano com totais já calculados
      await plan.save()
      console.log('✅ [API] Plano salvo com totais calculados')

      console.log('🎉 [API] Plano para iniciantes criado com sucesso!')
      console.log('📤 [API] Enviando resposta ao cliente...')

      const responseData = {
        success: true,
        message: 'Plano para Iniciantes criado com sucesso',
        data: {
          plan: {
            id: plan.id,
            name: plan.name,
            type: plan.type,
            startDate: plan.startDate.toISO(),
            endDate: plan.endDate.toISO(),
            totalDays: plan.totalDays,
            versesPerDay: versesPerDay,
            totalVerses: totalVerses,
            totalChapters: plan.totalChapters,
          },
        },
      }

      console.log('📤 [API] Resposta:', JSON.stringify(responseData, null, 2))
      console.log('🔵 [API] createBeginner - FIM')

      return response.created(responseData)
    } catch (error) {
      console.error('❌ [API] ERRO FATAL ao criar plano para iniciantes!')
      console.error('❌ [API] Tipo do erro:', error?.constructor?.name)
      console.error('❌ [API] Mensagem:', error?.message)
      console.error('❌ [API] Stack trace completo:')
      console.error(error?.stack)

      return response.badRequest({
        success: false,
        message: 'Erro ao criar plano de leitura para iniciantes',
        error: error.message,
        errorType: error?.constructor?.name,
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

      console.log('🔄 [API] Verificando se precisa criar próximos dias...')

      // Buscar quantos dias estão criados à frente
      const lastDay = await ReadingProgress.query()
        .where('reading_plan_id', plan.id)
        .max('day as maxDay')
        .first()

      const lastDayNumber = lastDay?.$extras?.maxDay ? Number(lastDay.$extras.maxDay) : 0
      const daysAhead = lastDayNumber - plan.currentDay + 1

      console.log(
        `📊 [API] Dias criados à frente: ${daysAhead} (último dia: ${lastDayNumber}, dia atual: ${plan.currentDay})`
      )

      // Se temos menos de 5 dias à frente, criar mais
      if (daysAhead < 5) {
        const daysToCreate = 5 - daysAhead
        console.log(`🔨 [API] Criando ${daysToCreate} novos dias automaticamente...`)

        const startDay = lastDayNumber + 1
        const endDay = Math.min(startDay + daysToCreate - 1, plan.totalDays)

        for (let dayNumber = startDay; dayNumber <= endDay; dayNumber++) {
          console.log(`   📖 Auto-gerando dia ${dayNumber}...`)

          const dayReadings = await this.generateDayReadings(
            plan.type,
            dayNumber,
            plan.chaptersPerDay,
            plan.totalDays,
            plan.id
          )

          if (!dayReadings || dayReadings.length === 0) {
            console.log(`   ⚠️ Não foi possível gerar leituras para o dia ${dayNumber}`)
            break
          }

          for (const bookReading of dayReadings) {
            console.log(
              `      💾 Auto-salvando: ${bookReading.bookName} cap ${bookReading.startChapter}-${bookReading.endChapter}`
            )

            await ReadingProgress.create({
              readingPlanId: plan.id,
              day: dayNumber,
              bookName: bookReading.bookName,
              startChapter: bookReading.startChapter,
              endChapter: bookReading.endChapter,
              isCompleted: false,
            })
          }
        }

        console.log(`✅ [API] ${endDay - startDay + 1} novos dias criados automaticamente`)
      } else {
        console.log(`✅ [API] Já tem ${daysAhead} dias à frente, não precisa criar mais`)
      }

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
   * Adicionar próximos dias ao plano (gerados automaticamente pelo backend)
   */
  async addNextDays({ auth, request, response }: HttpContext) {
    try {
      console.log('🔵 [API] addNextDays - INÍCIO')
      const user = auth.user!
      console.log('👤 [API] Usuário:', user.id)

      const { count } = request.only(['count'])
      const daysToAdd = count || 5

      console.log('📊 [API] Dias a adicionar:', daysToAdd)

      const plan = await ReadingPlan.query()
        .where('user_id', user.id)
        .where('is_active', true)
        .first()

      if (!plan) {
        console.log('❌ [API] Plano não encontrado')
        return response.notFound({
          success: false,
          message: 'Plano de leitura não encontrado',
        })
      }

      console.log('📖 [API] Plano encontrado:', {
        id: plan.id,
        type: plan.type,
        currentDay: plan.currentDay,
        totalDays: plan.totalDays,
      })

      // Buscar o maior dia já criado
      const lastDay = await ReadingProgress.query()
        .where('reading_plan_id', plan.id)
        .max('day as maxDay')
        .first()

      const lastDayNumber = lastDay?.$extras?.maxDay ? Number(lastDay.$extras.maxDay) : 0
      console.log('📅 [API] Último dia criado:', lastDayNumber)
      console.log('📅 [API] Próximo dia a criar:', lastDayNumber + 1)

      // Gerar próximos dias
      let savedCount = 0
      const startDay = lastDayNumber + 1
      const endDay = Math.min(startDay + daysToAdd - 1, plan.totalDays)

      console.log(`🔨 [API] Gerando dias ${startDay} até ${endDay}...`)

      for (let dayNumber = startDay; dayNumber <= endDay; dayNumber++) {
        console.log(`   📖 Gerando dia ${dayNumber}...`)

        // Gerar leitura baseada no tipo do plano
        const dayReadings = await this.generateDayReadings(
          plan.type,
          dayNumber,
          plan.chaptersPerDay,
          plan.totalDays,
          plan.id
        )

        if (!dayReadings || dayReadings.length === 0) {
          console.log(`   ⚠️ Não foi possível gerar leituras para o dia ${dayNumber}`)
          break
        }

        console.log(`   📚 Dia ${dayNumber} terá ${dayReadings.length} leitura(s)`)

        // Criar registros para este dia
        for (const bookReading of dayReadings) {
          console.log(
            `      💾 Salvando: ${bookReading.bookName} cap ${bookReading.startChapter}-${bookReading.endChapter}`
          )

          const record = await ReadingProgress.create({
            readingPlanId: plan.id,
            day: dayNumber,
            bookName: bookReading.bookName,
            startChapter: bookReading.startChapter,
            endChapter: bookReading.endChapter,
            isCompleted: false,
          })

          console.log(`      ✅ Registro ${record.id} salvo`)
          savedCount++
        }
      }

      console.log(`✅ [API] Total de registros adicionados: ${savedCount}`)
      console.log('🔵 [API] addNextDays - FIM')

      return response.ok({
        success: true,
        message: `${savedCount} registros adicionados com sucesso`,
        data: {
          addedDays: endDay - startDay + 1,
          addedRecords: savedCount,
          lastDayCreated: endDay,
        },
      })
    } catch (error) {
      console.error('❌ [API] ERRO FATAL ao adicionar dias!')
      console.error('❌ [API] Tipo:', error?.constructor?.name)
      console.error('❌ [API] Mensagem:', error?.message)
      console.error('❌ [API] Stack:', error?.stack)

      return response.badRequest({
        success: false,
        message: 'Erro ao adicionar dias ao plano',
        error: error.message,
      })
    }
  }

  /**
   * Gera as leituras de um dia específico baseado no tipo do plano
   */
  private async generateDayReadings(
    planType: string,
    dayNumber: number,
    chaptersPerDay: number,
    totalDays: number,
    planId?: number
  ) {
    console.log(
      `🔧 [generateDayReadings] Tipo: ${planType}, Dia: ${dayNumber}, Capítulos/dia: ${chaptersPerDay}, Total dias: ${totalDays}`
    )

    if (planType === 'beginner') {
      // Leitura baseada em versículos: distribui ~31.102 versículos proporcionalmente
      // chaptersPerDay aqui na verdade é versesPerDay
      let versesPerDay = chaptersPerDay

      console.log(`\n   ╔════════════════════════════════════════════════════════════`)
      console.log(`   ║ 🔍 DEBUG PLANO FÁCIL DE LER - DIA ${dayNumber}`)
      console.log(`   ╠════════════════════════════════════════════════════════════`)
      console.log(`   ║ 📖 Versículos por dia (alvo inicial): ${versesPerDay}`)

      // CORREÇÃO: Para dia > 1, buscar onde o dia anterior parou
      let startVerse: number = (dayNumber - 1) * versesPerDay + 1 // Valor padrão
      let bookIndex: number = 0
      let currentChapter: number = 1
      let shouldRecalculate = false

      if (dayNumber > 1 && planId) {
        console.log(`   ║ 🔍 Buscando último capítulo do dia ${dayNumber - 1}...`)

        // Buscar último registro do dia anterior
        const lastReading = await ReadingProgress.query()
          .where('reading_plan_id', planId)
          .where('day', dayNumber - 1)
          .orderBy('id', 'desc')
          .first()

        if (lastReading) {
          console.log(
            `   ║ 📚 Último registro do dia anterior: ${lastReading.bookName} ${lastReading.startChapter}-${lastReading.endChapter}`
          )

          // Encontrar o índice do livro
          bookIndex = BIBLE_VERSES_PER_CHAPTER.findIndex((b) => b.name === lastReading.bookName)

          if (bookIndex !== -1) {
            const book = BIBLE_VERSES_PER_CHAPTER[bookIndex]

            // O próximo dia começa DEPOIS do último capítulo lido
            if (lastReading.endChapter >= book.chapters.length) {
              // Se terminou o livro, vai para o próximo livro
              bookIndex++

              console.log(
                `   ║ ⏭️  Livro anterior completo, indo para: ${BIBLE_VERSES_PER_CHAPTER[bookIndex]?.name || 'FIM'}`
              )

              // 🔥 NOVA LÓGICA: Se está chegando em Romanos, recalcular versículos por dia
              if (BIBLE_VERSES_PER_CHAPTER[bookIndex]?.name === 'Romanos') {
                console.log(`   ║`)
                console.log(`   ║ 🔥 RECALCULANDO: Chegou em Romanos!`)
                console.log(`   ║`)
                shouldRecalculate = true
              }
            } else {
              // Continua no mesmo livro, próximo capítulo
              currentChapter = lastReading.endChapter + 1
              console.log(`   ║ ➡️  Continuando em ${book.name}, capítulo ${currentChapter}`)
            }

            // Calcular versículo absoluto baseado na posição real
            startVerse = 0
            for (let i = 0; i < bookIndex; i++) {
              startVerse += BIBLE_VERSES_PER_CHAPTER[i].chapters.reduce((sum, v) => sum + v, 0)
            }
            for (let c = 0; c < currentChapter - 1; c++) {
              startVerse += book.chapters[c]
            }
            startVerse += 1 // Versículo é 1-based

            console.log(`   ║ 📍 Versículo absoluto inicial (real): ${startVerse}`)

            // 🔥 RECALCULAR versículos por dia se necessário
            if (shouldRecalculate) {
              // Calcular total de versículos da Bíblia
              const totalBibleVerses = BIBLE_VERSES_PER_CHAPTER.reduce(
                (sum, bk) => sum + bk.chapters.reduce((s, v) => s + v, 0),
                0
              )

              // Versículos restantes = Total da Bíblia - Versículo atual
              const remainingVerses = totalBibleVerses - startVerse + 1

              // Dias restantes = Total de dias - Dia atual + 1
              const remainingDays = totalDays - dayNumber + 1

              // Novo cálculo: versículos por dia = versículos restantes / dias restantes
              const oldVersesPerDay = versesPerDay
              versesPerDay = Math.ceil(remainingVerses / remainingDays)

              console.log(`   ║`)
              console.log(`   ║ 📊 RECÁLCULO DE VERSÍCULOS POR DIA:`)
              console.log(`   ║ ├─ Total da Bíblia: ${totalBibleVerses} versículos`)
              console.log(`   ║ ├─ Versículos lidos: ${startVerse - 1}`)
              console.log(`   ║ ├─ Versículos restantes: ${remainingVerses}`)
              console.log(`   ║ ├─ Dias restantes: ${remainingDays}`)
              console.log(`   ║ ├─ Versículos/dia ANTIGO: ${oldVersesPerDay}`)
              console.log(`   ║ └─ Versículos/dia NOVO: ${versesPerDay}`)
              console.log(`   ║`)
            }
          }
        } else {
          console.log(`   ║ ⚠️  Dia anterior não encontrado, usando cálculo padrão`)
          startVerse = (dayNumber - 1) * versesPerDay + 1
        }
      } else {
        // Dia 1
        console.log(`   ║ 📍 Versículo absoluto inicial: ${startVerse}`)
        console.log(
          `   ║    (Cálculo: (dia ${dayNumber} - 1) × ${versesPerDay} + 1 = ${startVerse})`
        )
      }

      console.log(`   ╚════════════════════════════════════════════════════════════\n`)

      // Se não foi encontrado via histórico, calcular usando o versículo absoluto
      if (dayNumber === 1 || !planId) {
        let absoluteVerse = 0

        // Primeiro, encontrar o livro onde começa este dia
        for (const [i, book] of BIBLE_VERSES_PER_CHAPTER.entries()) {
          const bookTotalVerses = book.chapters.reduce((sum, v) => sum + v, 0)
          if (absoluteVerse + bookTotalVerses >= startVerse) {
            bookIndex = i
            break
          }
          absoluteVerse += bookTotalVerses
        }

        const book = BIBLE_VERSES_PER_CHAPTER[bookIndex]
        const verseInBook = startVerse - absoluteVerse // Versículo dentro deste livro (1-based)
        const bookTotalVerses = book.chapters.reduce((sum, v) => sum + v, 0)

        console.log(`   📚 Livro inicial encontrado: ${book.name}`)
        console.log(`      ├─ Total de versículos no livro: ${bookTotalVerses}`)
        console.log(`      ├─ Total de capítulos no livro: ${book.chapters.length}`)
        console.log(`      └─ Versículo inicial dentro do livro: ${verseInBook}\n`)

        // Encontrar qual capítulo contém este versículo usando dados reais
        currentChapter = 1
        let versesAccumulated = 0
        for (let c = 0; c < book.chapters.length; c++) {
          versesAccumulated += book.chapters[c]
          if (versesAccumulated >= verseInBook) {
            currentChapter = c + 1
            break
          }
        }

        console.log(`   🎯 Capítulo inicial encontrado: ${currentChapter}`)
        console.log(`      └─ Usando contagem REAL de versículos\n`)
      } else {
        const book = BIBLE_VERSES_PER_CHAPTER[bookIndex]
        console.log(`   📚 Livro inicial (via histórico): ${book.name}`)
        console.log(`   🎯 Capítulo inicial (via histórico): ${currentChapter}\n`)
      }

      // Coletar capítulos até atingir o total de versículos desejado
      const readings = []
      let versesCollected = 0
      let currentBookIndex = bookIndex
      let chapterStart = currentChapter
      let iterationCount = 0

      console.log(`   ╔════════════════════════════════════════════════════════════`)
      console.log(`   ║ 🔄 COLETANDO CAPÍTULOS`)
      console.log(`   ║ Alvo: ${versesPerDay} versículos`)
      console.log(`   ╚════════════════════════════════════════════════════════════\n`)

      const MAX_ITERATIONS = 100 // Proteção contra loop infinito

      while (versesCollected < versesPerDay && currentBookIndex < BIBLE_VERSES_PER_CHAPTER.length) {
        iterationCount++

        // PROTEÇÃO: Se passou de 100 iterações, algo está errado
        if (iterationCount > MAX_ITERATIONS) {
          console.log(`   ❌ ERRO: Limite de iterações atingido (${MAX_ITERATIONS})`)
          console.log(`   ❌ Parando para evitar loop infinito`)
          break
        }

        console.log(`   ┌─ Iteração ${iterationCount} ────────────────────────────────`)

        const currentBook = BIBLE_VERSES_PER_CHAPTER[currentBookIndex]
        const totalChaptersInBook = currentBook.chapters.length

        // Limite máximo: 25% acima do alvo
        const maxVersesAllowed = Math.ceil(versesPerDay * 1.25)
        console.log(
          `   │  📊 Limite máximo permitido: ${maxVersesAllowed} versículos (125% do alvo)`
        )

        // Adicionar capítulos um por um até atingir o alvo
        let chaptersToAdd = 0
        let versesInBatch = 0

        // Calcular quantos capítulos adicionar deste livro
        for (let c = chapterStart; c <= totalChaptersInBook; c++) {
          const versesInThisChapter = currentBook.chapters[c - 1]
          const potentialTotal = versesCollected + versesInBatch + versesInThisChapter

          console.log(
            `   │     🔍 Testando cap ${c}: ${versesInThisChapter} vers → Total seria ${potentialTotal}`
          )

          // REGRA 1: Se já temos algum versículo e adicionar este excederia 25%, PARA
          if (versesCollected + versesInBatch > 0 && potentialTotal > maxVersesAllowed) {
            console.log(
              `   │     ❌ Capítulo ${c} REJEITADO: ${potentialTotal} > ${maxVersesAllowed} (limite 25%)`
            )
            break
          }

          // REGRA 2: Se adicionar este capítulo atingir ou ultrapassar o alvo, adiciona e PARA
          versesInBatch += versesInThisChapter
          chaptersToAdd++
          console.log(`   │     ✅ Capítulo ${c} ACEITO: batch agora tem ${versesInBatch} vers`)

          if (versesCollected + versesInBatch >= versesPerDay) {
            console.log(
              `   │     🎯 Alvo atingido! Total: ${versesCollected + versesInBatch} >= ${versesPerDay}`
            )
            break
          }
        }

        // PROTEÇÃO CONTRA LOOP INFINITO: Se não conseguiu adicionar nenhum capítulo,
        // significa que já chegamos próximo do alvo e nenhum capítulo cabe mais
        if (chaptersToAdd === 0) {
          console.log(`   │  ⚠️  Nenhum capítulo pôde ser adicionado (todos excedem limite)`)
          console.log(`   │  🎯 Parando aqui com ${versesCollected} versículos`)
          console.log(`   └────────────────────────────────────────────────────────\n`)
          break
        }

        const chapterEnd = chapterStart + chaptersToAdd - 1

        // Obter contagem real de versículos
        const realVerses = getVersesInRange(currentBook.name, chapterStart, chapterEnd)

        console.log(`   │  📖 Livro: ${currentBook.name}`)
        console.log(`   │  📝 Versículos restantes para alvo: ${versesPerDay - versesCollected}`)
        console.log(`   │  📚 Capítulos disponíveis: ${totalChaptersInBook - chapterStart + 1}`)
        console.log(`   │  ✅ Capítulos a pegar: ${chaptersToAdd}`)
        console.log(`   │  📖 Range: ${chapterStart}-${chapterEnd}`)
        console.log(`   │  📊 Versículos REAIS neste bloco: ${realVerses}`)

        readings.push({
          bookName: currentBook.name,
          startChapter: chapterStart,
          endChapter: chapterEnd,
        })

        const oldVersesCollected = versesCollected
        versesCollected += realVerses

        console.log(`   │  💹 Progresso: ${oldVersesCollected} → ${versesCollected} versículos`)
        console.log(
          `   │  🎯 Status: ${versesCollected}/${versesPerDay} (${((versesCollected / versesPerDay) * 100).toFixed(1)}%)`
        )
        console.log(
          `   │  ${versesCollected <= maxVersesAllowed ? '✓' : '⚠️'} Dentro do limite: ${versesCollected} ${versesCollected <= maxVersesAllowed ? '≤' : '>'} ${maxVersesAllowed}`
        )

        // Só para quando atingir ou ultrapassar o alvo OU terminar o livro
        if (versesCollected >= versesPerDay) {
          console.log(`   │  ✓ ALVO ATINGIDO! ${versesCollected} >= ${versesPerDay}`)
          console.log(`   └────────────────────────────────────────────────────────\n`)
          break
        }

        // Se terminamos o livro, vamos para o próximo
        if (chapterEnd >= totalChaptersInBook) {
          console.log(`   │  ⏭️  Livro completo! Indo para próximo livro...`)
          console.log(`   └────────────────────────────────────────────────────────\n`)
          currentBookIndex++
          chapterStart = 1
        } else {
          // Ainda há capítulos no livro, continua do próximo
          console.log(`   │  ➡️  Continuando no mesmo livro (cap ${chapterEnd + 1})`)
          console.log(`   └────────────────────────────────────────────────────────\n`)
          chapterStart = chapterEnd + 1
        }
      }

      console.log(`   ╔════════════════════════════════════════════════════════════`)
      console.log(`   ║ ✅ RESULTADO FINAL - DIA ${dayNumber}`)
      console.log(`   ╠════════════════════════════════════════════════════════════`)
      console.log(`   ║ 📚 Total de blocos: ${readings.length}`)
      console.log(`   ║ 📖 Total de versículos: ~${versesCollected}`)
      console.log(`   ║ 🎯 Alvo era: ${versesPerDay} versículos`)
      console.log(`   ║ 📊 Percentual: ${((versesCollected / versesPerDay) * 100).toFixed(1)}%`)
      console.log(
        `   ║ ${versesCollected >= versesPerDay ? '✓' : '✗'} Status: ${versesCollected >= versesPerDay ? 'ALVO ATINGIDO' : 'ABAIXO DO ALVO'}`
      )
      console.log(`   ╚════════════════════════════════════════════════════════════\n`)

      return readings
    } else if (planType === 'sequential') {
      // Leitura sequencial: lê a Bíblia em ordem, X capítulos por dia
      const startChapter = (dayNumber - 1) * chaptersPerDay + 1

      console.log(`   Capítulo absoluto inicial: ${startChapter}`)

      // Encontrar livro e capítulo inicial
      let absoluteChapter = 0
      let bookIndex = 0
      let bookStartChapter = 1

      for (const [i, book] of BIBLE_STRUCTURE.entries()) {
        if (absoluteChapter + book.chapters >= startChapter) {
          bookIndex = i
          bookStartChapter = startChapter - absoluteChapter
          break
        }
        absoluteChapter += book.chapters
      }

      console.log(
        `   Livro inicial: ${BIBLE_STRUCTURE[bookIndex].name}, capítulo: ${bookStartChapter}`
      )

      // Coletar leituras (pode abranger múltiplos livros)
      const readings = []
      let chaptersCollected = 0
      let currentBookIndex = bookIndex
      let currentChapter = bookStartChapter

      while (chaptersCollected < chaptersPerDay && currentBookIndex < BIBLE_STRUCTURE.length) {
        const book = BIBLE_STRUCTURE[currentBookIndex]
        const chaptersRemaining = book.chapters - currentChapter + 1
        const chaptersToTake = Math.min(chaptersPerDay - chaptersCollected, chaptersRemaining)

        console.log(
          `   📖 ${book.name}: capítulos ${currentChapter}-${currentChapter + chaptersToTake - 1} (${chaptersToTake} caps)`
        )

        readings.push({
          bookName: book.name,
          startChapter: currentChapter,
          endChapter: currentChapter + chaptersToTake - 1,
        })

        chaptersCollected += chaptersToTake

        // Se terminou o livro, vai para o próximo
        if (currentChapter + chaptersToTake - 1 >= book.chapters) {
          currentBookIndex++
          currentChapter = 1
        } else {
          currentChapter += chaptersToTake
        }
      }

      console.log(
        `   ✅ Total: ${readings.length} bloco(s) de leitura, ${chaptersCollected} capítulos`
      )
      return readings
    } else if (planType === 'interleaved') {
      // Leitura intercalada: AT e NT avançam proporcionalmente para terminar juntos
      const atBooks = BIBLE_STRUCTURE.slice(0, 39) // Gênesis até Malaquias
      const ntBooks = BIBLE_STRUCTURE.slice(39) // Mateus até Apocalipse

      const totalAtChapters = atBooks.reduce((sum, book) => sum + book.chapters, 0) // 929
      const totalNtChapters = ntBooks.reduce((sum, book) => sum + book.chapters, 0) // 260

      // Calcular posição exata usando proporção do dia
      // AT: capítulo inicial = (dayNumber-1) * 929 / totalDays
      //     capítulo final = dayNumber * 929 / totalDays
      // NT: capítulo inicial = (dayNumber-1) * 260 / totalDays
      //     capítulo final = dayNumber * 260 / totalDays

      const atStartChapter = Math.floor(((dayNumber - 1) * totalAtChapters) / totalDays) + 1
      const atEndChapter = Math.floor((dayNumber * totalAtChapters) / totalDays)
      const atChaptersThisDay = atEndChapter - atStartChapter + 1

      const ntStartChapter = Math.floor(((dayNumber - 1) * totalNtChapters) / totalDays) + 1
      const ntEndChapter = Math.floor((dayNumber * totalNtChapters) / totalDays)
      const ntChaptersThisDay = ntEndChapter - ntStartChapter + 1

      console.log(
        `   Dia ${dayNumber}/${totalDays}: AT ${atChaptersThisDay} caps (${atStartChapter}-${atEndChapter}), NT ${ntChaptersThisDay} caps (${ntStartChapter}-${ntEndChapter})`
      )

      const readings = []

      // Coletar capítulos do AT (baseado na posição calculada)
      if (atStartChapter <= totalAtChapters) {
        let atAbsoluteChapter = 0
        let atBookIndex = 0
        let atBookStartChapter = 1

        for (const [i, atBook] of atBooks.entries()) {
          if (atAbsoluteChapter + atBook.chapters >= atStartChapter) {
            atBookIndex = i
            atBookStartChapter = atStartChapter - atAbsoluteChapter
            break
          }
          atAbsoluteChapter += atBook.chapters
        }

        // Coletar capítulos do AT
        let atChaptersCollected = 0
        let currentAtIndex = atBookIndex
        let currentAtChapter = atBookStartChapter

        while (atChaptersCollected < atChaptersThisDay && currentAtIndex < atBooks.length) {
          const book = atBooks[currentAtIndex]
          const chaptersRemaining = book.chapters - currentAtChapter + 1
          const chaptersToTake = Math.min(
            atChaptersThisDay - atChaptersCollected,
            chaptersRemaining
          )

          console.log(
            `   📖 AT: ${book.name} ${currentAtChapter}-${currentAtChapter + chaptersToTake - 1}`
          )

          readings.push({
            bookName: book.name,
            startChapter: currentAtChapter,
            endChapter: currentAtChapter + chaptersToTake - 1,
          })

          atChaptersCollected += chaptersToTake

          if (currentAtChapter + chaptersToTake - 1 >= book.chapters) {
            currentAtIndex++
            currentAtChapter = 1
          } else {
            currentAtChapter += chaptersToTake
          }
        }
      }

      // Coletar capítulos do NT (baseado na posição calculada)
      if (ntStartChapter <= totalNtChapters) {
        let ntAbsoluteChapter = 0
        let ntBookIndex = 0
        let ntBookStartChapter = 1

        for (const [i, ntBook] of ntBooks.entries()) {
          if (ntAbsoluteChapter + ntBook.chapters >= ntStartChapter) {
            ntBookIndex = i
            ntBookStartChapter = ntStartChapter - ntAbsoluteChapter
            break
          }
          ntAbsoluteChapter += ntBook.chapters
        }

        // Coletar capítulos do NT
        let ntChaptersCollected = 0
        let currentNtIndex = ntBookIndex
        let currentNtChapter = ntBookStartChapter

        while (ntChaptersCollected < ntChaptersThisDay && currentNtIndex < ntBooks.length) {
          const book = ntBooks[currentNtIndex]
          const chaptersRemaining = book.chapters - currentNtChapter + 1
          const chaptersToTake = Math.min(
            ntChaptersThisDay - ntChaptersCollected,
            chaptersRemaining
          )

          console.log(
            `   📖 NT: ${book.name} ${currentNtChapter}-${currentNtChapter + chaptersToTake - 1}`
          )

          readings.push({
            bookName: book.name,
            startChapter: currentNtChapter,
            endChapter: currentNtChapter + chaptersToTake - 1,
          })

          ntChaptersCollected += chaptersToTake

          if (currentNtChapter + chaptersToTake - 1 >= book.chapters) {
            currentNtIndex++
            currentNtChapter = 1
          } else {
            currentNtChapter += chaptersToTake
          }
        }
      }

      console.log(`   ✅ Intercalado: ${readings.length} bloco(s) de leitura`)
      return readings
    }

    console.log(`   ⚠️ Tipo de plano desconhecido: ${planType}`)
    return []
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
        const daysInProgress = new Set(plan.progress.map((p) => p.day))
        const maxDayInProgress = Math.max(...Array.from(daysInProgress), 0)
        const actualProgressDays = daysInProgress.size

        // Verificar se está incorreto:
        // 1. Se o número de dias no progress é menor que o esperado
        // 2. Se o max day é menor que expected days (faltam dias no final)
        const missingDays = expectedDays - maxDayInProgress
        const isIncorrect = missingDays > 5 || actualProgressDays < expectedDays * 0.95

        if (isIncorrect) {
          // Contar quantos dias já foram lidos
          const completedDays = new Set(
            plan.progress.filter((p) => p.isCompleted).map((p) => p.day)
          ).size

          // Contar capítulos completados
          const completedChapters = plan.progress
            .filter((p) => p.isCompleted)
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
      const plan = await ReadingPlan.query().where('id', planId).preload('progress').firstOrFail()

      console.log(`[RecalculatePlan] Recalculando plano ${planId}...`)

      // Buscar progresso completado
      const completedProgress = plan.progress.filter((p) => p.isCompleted)
      const completedDays = new Set(completedProgress.map((p) => p.day))

      console.log(
        `[RecalculatePlan] Progresso atual: ${completedProgress.length} registros completados em ${completedDays.size} dias`
      )

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

      console.log(
        `[RecalculatePlan] Mantendo período original: ${originalTotalDays} dias (${originalStartDate.toISO()} até ${originalEndDate.toISO()})`
      )

      const totalChapters = BIBLE_STRUCTURE.reduce((sum, book) => sum + book.chapters, 0)
      const remainingChapters = totalChapters - totalCompletedChapters

      // Calcular quantos dias faltam criar
      const maxDayCompleted = Math.max(...completedDays, 0)
      const daysToCreate = originalTotalDays - maxDayCompleted

      console.log(
        `[RecalculatePlan] Último dia completado: ${maxDayCompleted}, dias totais: ${originalTotalDays}, faltam criar: ${daysToCreate}`
      )

      // Usar 4 capítulos por dia como padrão, ajustando os últimos dias se necessário
      const baseChaptersPerDay = 4
      const daysWithBaseChapters = Math.floor(remainingChapters / baseChaptersPerDay)
      const remainingChaptersInLastDay = remainingChapters % baseChaptersPerDay

      console.log(
        `[RecalculatePlan] Distribuição: ${daysWithBaseChapters} dias com ${baseChaptersPerDay} cap/dia + último dia com ${remainingChaptersInLastDay} capítulos`
      )

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
      for (const [i, book] of BIBLE_STRUCTURE.entries()) {
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

      console.log(
        `[RecalculatePlan] Reiniciando de: ${BIBLE_STRUCTURE[bookIndex]?.name} cap ${currentChapter}, dia ${currentDay}`
      )

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

      console.log(
        `[RecalculatePlan] ${newRecordsCount} novos registros criados, ${chaptersDistributed} capítulos distribuídos`
      )

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

  /**
   * Listar todos os planos de leitura (Admin)
   */
  async listAllPlans({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 20)
      const isActive = request.input('isActive')
      const search = request.input('search')

      const query = ReadingPlan.query()
        .preload('user', (userQuery) => {
          userQuery.select('id', 'full_name', 'email')
        })
        .orderBy('created_at', 'desc')

      // Filtrar por status
      if (isActive !== undefined) {
        query.where('is_active', isActive === 'true' || isActive === true)
      }

      // Buscar por nome do plano ou email do usuário
      if (search) {
        query
          .whereHas('user', (userQuery) => {
            userQuery.whereILike('email', `%${search}%`).orWhereILike('full_name', `%${search}%`)
          })
          .orWhereILike('name', `%${search}%`)
      }

      const plans = await query.paginate(page, limit)

      // Adicionar estatísticas de cada plano
      const plansWithStats = await Promise.all(
        plans.map(async (plan) => {
          const progressCount = await ReadingProgress.query()
            .where('reading_plan_id', plan.id)
            .count('* as total')

          const completedCount = await ReadingProgress.query()
            .where('reading_plan_id', plan.id)
            .where('is_completed', true)
            .count('* as total')

          return {
            id: plan.id,
            name: plan.name,
            type: plan.type,
            startDate: plan.startDate.toISO(),
            endDate: plan.endDate.toISO(),
            isActive: plan.isActive,
            currentDay: plan.currentDay,
            totalDays: plan.totalDays,
            completedChapters: plan.completedChapters,
            totalChapters: plan.totalChapters,
            createdAt: plan.createdAt.toISO(),
            user: {
              id: plan.user.id,
              name: plan.user.fullName,
              email: plan.user.email,
            },
            stats: {
              totalProgress: progressCount[0].$extras.total,
              completedDays: completedCount[0].$extras.total,
              completionPercentage:
                plan.totalDays > 0
                  ? Math.round((completedCount[0].$extras.total / plan.totalDays) * 100)
                  : 0,
            },
          }
        })
      )

      return response.ok({
        success: true,
        data: {
          plans: plansWithStats,
          meta: plans.getMeta(),
        },
      })
    } catch (error) {
      console.error('Erro ao listar planos:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao listar planos de leitura',
        error: error.message,
      })
    }
  }

  /**
   * Desabilitar plano de leitura (Admin)
   */
  async disablePlan({ params, response }: HttpContext) {
    try {
      const plan = await ReadingPlan.find(params.planId)

      if (!plan) {
        return response.notFound({
          success: false,
          message: 'Plano de leitura não encontrado',
        })
      }

      plan.isActive = false
      await plan.save()

      return response.ok({
        success: true,
        message: 'Plano desabilitado com sucesso',
        data: {
          planId: plan.id,
          isActive: plan.isActive,
        },
      })
    } catch (error) {
      console.error('Erro ao desabilitar plano:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao desabilitar plano de leitura',
        error: error.message,
      })
    }
  }

  /**
   * Reativar plano de leitura (Admin)
   */
  async enablePlan({ params, response }: HttpContext) {
    try {
      const plan = await ReadingPlan.find(params.planId)

      if (!plan) {
        return response.notFound({
          success: false,
          message: 'Plano de leitura não encontrado',
        })
      }

      // Verificar se o usuário já tem outro plano ativo
      const existingActivePlan = await ReadingPlan.query()
        .where('user_id', plan.userId)
        .where('is_active', true)
        .where('id', '!=', plan.id)
        .first()

      if (existingActivePlan) {
        return response.conflict({
          success: false,
          message: 'Este usuário já possui outro plano ativo',
        })
      }

      plan.isActive = true
      await plan.save()

      return response.ok({
        success: true,
        message: 'Plano reativado com sucesso',
        data: {
          planId: plan.id,
          isActive: plan.isActive,
        },
      })
    } catch (error) {
      console.error('Erro ao reativar plano:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao reativar plano de leitura',
        error: error.message,
      })
    }
  }
}
