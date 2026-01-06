import ReadingPlanTemplate from '#models/reading_plan_template'
import aiLoggerService from '#services/ai_logger_service'
import type { HttpContext } from '@adonisjs/core/http'

export default class AdminReadingPlanTemplateController {
  /**
   * Lista todos os templates
   */
  async index({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const perPage = request.input('perPage', 20)
      const type = request.input('type', '')
      const isActive = request.input('isActive', '')

      const query = ReadingPlanTemplate.query()

      if (type) {
        query.where('type', type)
      }

      if (isActive !== '') {
        query.where('is_active', isActive === 'true')
      }

      const templates = await query
        .orderBy('order', 'asc')
        .orderBy('id', 'desc')
        .paginate(page, perPage)

      return response.ok({
        data: templates.all().map((template) => ({
          id: template.id,
          name: template.name,
          description: template.description,
          type: template.type,
          duration: template.duration,
          testament: template.testament,
          readingsCount: JSON.parse(template.readings).length,
          isActive: template.isActive,
          order: template.order,
          createdAt: template.createdAt.toISO(),
        })),
        meta: templates.getMeta(),
      })
    } catch (error) {
      console.error('Erro ao listar templates:', error)
      return response.internalServerError({
        error: 'Erro ao listar templates',
      })
    }
  }

  /**
   * Busca template específico
   */
  async show({ params, response }: HttpContext) {
    try {
      const template = await ReadingPlanTemplate.findOrFail(params.id)

      return response.ok({
        id: template.id,
        name: template.name,
        description: template.description,
        type: template.type,
        duration: template.duration,
        testament: template.testament,
        readings: JSON.parse(template.readings),
        isActive: template.isActive,
        order: template.order,
        createdAt: template.createdAt.toISO(),
        updatedAt: template.updatedAt.toISO(),
      })
    } catch (error) {
      console.error('Erro ao buscar template:', error)
      return response.notFound({
        error: 'Template não encontrado',
      })
    }
  }

  /**
   * Cria novo template
   */
  async store({ request, response }: HttpContext) {
    try {
      const { name, description, type, duration, testament, readings, isActive, order } =
        request.only([
          'name',
          'description',
          'type',
          'duration',
          'testament',
          'readings',
          'isActive',
          'order',
        ])

      if (!name || !description || !type || !duration || !testament || !readings) {
        return response.badRequest({
          error: 'Todos os campos são obrigatórios',
        })
      }

      const template = await ReadingPlanTemplate.create({
        name,
        description,
        type,
        duration: Number.parseInt(duration),
        testament,
        readings: JSON.stringify(readings),
        isActive: isActive ?? true,
        order: order ?? 0,
      })

      return response.created({
        id: template.id,
        message: 'Template criado com sucesso',
      })
    } catch (error) {
      console.error('Erro ao criar template:', error)
      return response.internalServerError({
        error: 'Erro ao criar template',
      })
    }
  }

  /**
   * Atualiza template
   */
  async update({ params, request, response }: HttpContext) {
    try {
      const template = await ReadingPlanTemplate.findOrFail(params.id)

      const { name, description, type, duration, testament, readings, isActive, order } =
        request.only([
          'name',
          'description',
          'type',
          'duration',
          'testament',
          'readings',
          'isActive',
          'order',
        ])

      template.merge({
        name: name || template.name,
        description: description || template.description,
        type: type || template.type,
        duration: duration ? Number.parseInt(duration) : template.duration,
        testament: testament || template.testament,
        readings: readings ? JSON.stringify(readings) : template.readings,
        isActive: isActive !== undefined ? isActive : template.isActive,
        order: order !== undefined ? order : template.order,
      })

      await template.save()

      return response.ok({
        message: 'Template atualizado com sucesso',
      })
    } catch (error) {
      console.error('Erro ao atualizar template:', error)
      return response.internalServerError({
        error: 'Erro ao atualizar template',
      })
    }
  }

  /**
   * Deleta template
   */
  async destroy({ params, response }: HttpContext) {
    try {
      const template = await ReadingPlanTemplate.findOrFail(params.id)
      await template.delete()

      return response.ok({
        message: 'Template deletado com sucesso',
      })
    } catch (error) {
      console.error('Erro ao deletar template:', error)
      return response.internalServerError({
        error: 'Erro ao deletar template',
      })
    }
  }

  /**
   * Gera um plano de leitura usando IA (DeepSeek)
   */
  async generateWithAI({ auth, request, response }: HttpContext) {
    const startTime = Date.now()
    const timestamp = new Date().toISOString()
    const user = auth.user!

    try {
      const { prompt } = request.only(['prompt'])

      console.log(`🤖 [${timestamp}] Usuário ${user.email} solicitou geração via IA`)
      console.log(`📝 Prompt: ${prompt}`)

      if (!prompt || prompt.trim().length === 0) {
        return response.badRequest({
          error: 'Instrução não pode estar vazia',
        })
      }

      // Chamar DeepSeek API
      const apiKey = process.env.DEEPSEEK_API_KEY
      if (!apiKey) {
        await aiLoggerService.logAIRequest({
          timestamp,
          userId: user.id,
          userEmail: user.email,
          prompt,
          response: null,
          success: false,
          error: 'Chave da API DeepSeek não configurada',
        })

        return response.internalServerError({
          error: 'Chave da API DeepSeek não configurada',
        })
      }

      const systemPrompt = `Você é um gerador de planos de leitura bíblica. Você conhece toda a estrutura da Bíblia:

ANTIGO TESTAMENTO (39 livros):
- Gênesis (50), Êxodo (40), Levítico (27), Números (36), Deuteronômio (34)
- Josué (24), Juízes (21), Rute (4), 1 Samuel (31), 2 Samuel (24)
- 1 Reis (22), 2 Reis (25), 1 Crônicas (29), 2 Crônicas (36), Esdras (10)
- Neemias (13), Ester (10), Jó (42), Salmos (150), Provérbios (31)
- Eclesiastes (12), Cantares (8), Isaías (66), Jeremias (52), Lamentações (5)
- Ezequiel (48), Daniel (12), Oséias (14), Joel (3), Amós (9)
- Obadias (1), Jonas (4), Miquéias (7), Naum (3), Habacuque (3)
- Sofonias (3), Ageu (2), Zacarias (14), Malaquias (4)

NOVO TESTAMENTO (27 livros):
- Mateus (28), Marcos (16), Lucas (24), João (21), Atos (28)
- Romanos (16), 1 Coríntios (16), 2 Coríntios (13), Gálatas (6), Efésios (6)
- Filipenses (4), Colossenses (4), 1 Tessalonicenses (5), 2 Tessalonicenses (3), 1 Timóteo (6)
- 2 Timóteo (4), Tito (3), Filemom (1), Hebreus (13), Tiago (5)
- 1 Pedro (5), 2 Pedro (3), 1 João (5), 2 João (1), 3 João (1)
- Judas (1), Apocalipse (22)

Gere um plano de leitura baseado na instrução do usuário. Retorne APENAS um JSON válido no seguinte formato:

{
  "name": "Nome do plano",
  "description": "Descrição clara do plano",
  "type": "custom",
  "duration": número_de_dias,
  "testament": "old" | "new" | "both",
  "isActive": true,
  "order": 0,
  "readings": [
    {
      "day": 1,
      "bookReadings": [
        {
          "book": "Nome exato do livro (como listado acima)",
          "chapters": [1, 2, 3]
        }
      ],
      "description": "Descrição opcional do dia"
    }
  ]
}

REGRAS IMPORTANTES:
1. Use EXATAMENTE os nomes dos livros como listados acima
2. Distribua os capítulos de forma equilibrada
3. Não ultrapasse o número de capítulos de cada livro
4. Dias devem ser sequenciais (1, 2, 3, ...)
5. testament deve ser: "old" (só AT), "new" (só NT) ou "both" (ambos)
6. Para planos longos (50+ dias), use descrições muito curtas (2-4 palavras) para economizar tokens
7. Retorne SOMENTE o JSON válido, sem texto adicional ou markdown`

      // Fazer chamada para DeepSeek
      const deepseekResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 8000, // Increase token limit for longer plans
        }),
      })

      if (!deepseekResponse.ok) {
        const errorData = await deepseekResponse.json()
        console.error('Erro DeepSeek:', errorData)
        return response.internalServerError({
          error: 'Erro ao comunicar com a IA',
        })
      }

      const deepseekData = (await deepseekResponse.json()) as {
        choices: Array<{ message: { content: string } }>
      }
      const aiContent = deepseekData.choices[0].message.content

      console.log(`📥 Resposta da IA recebida (${Date.now() - startTime}ms)`)
      console.log(`📄 Conteúdo (primeiros 200 chars): ${aiContent.substring(0, 200)}...`)
      console.log(`📏 Tamanho da resposta: ${aiContent.length} caracteres`)

      // Check if response was truncated (incomplete JSON)
      const isTruncated = !aiContent.trim().endsWith('}') && !aiContent.trim().endsWith('```')

      if (isTruncated) {
        console.warn('⚠️  Resposta parece estar truncada')

        await aiLoggerService.logAIRequest({
          timestamp,
          userId: user.id,
          userEmail: user.email,
          prompt,
          response: aiContent,
          success: false,
          error:
            'Resposta da IA foi truncada. Tente criar um plano com menos dias ou simplifique a instrução.',
        })

        return response.badRequest({
          error:
            'A IA não conseguiu gerar o plano completo. Tente criar um plano com menos dias (ex: 30-50 dias) ou simplifique sua instrução.',
        })
      }

      // Tentar extrair JSON da resposta (às vezes a IA adiciona texto ao redor)
      let plan
      try {
        // Remove markdown code blocks if present
        let jsonContent = aiContent.trim()
        if (jsonContent.startsWith('```json')) {
          jsonContent = jsonContent.replace(/^```json\n/, '').replace(/\n```$/, '')
        } else if (jsonContent.startsWith('```')) {
          jsonContent = jsonContent.replace(/^```\n/, '').replace(/\n```$/, '')
        }

        const jsonMatch = jsonContent.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          plan = JSON.parse(jsonMatch[0])
        } else {
          plan = JSON.parse(jsonContent)
        }

        console.log(`✅ JSON parseado com sucesso`)
        console.log(`📊 Plano: ${plan.name} - ${plan.readings?.length || 0} dias`)

        // Validar completude do plano
        const validation = this.validatePlanCompleteness(plan, prompt)
        if (!validation.isValid) {
          console.warn('⚠️ Plano gerado está incompleto:', validation.message)
          console.warn('📊 Estatísticas:', validation.stats)

          await aiLoggerService.logAIRequest({
            timestamp,
            userId: user.id,
            userEmail: user.email,
            prompt,
            response: {
              plan,
              validation,
              fullAIResponse: aiContent,
            },
            success: false,
            error: `Plano incompleto: ${validation.message}`,
          })

          return response.badRequest({
            error: `O plano gerado está incompleto. ${validation.message}\n\nTente:\n- Reduzir o número de dias (ex: 50 dias)\n- Ser mais específico na instrução\n- Especificar apenas alguns livros`,
            details: validation.stats,
          })
        }

        console.log('✅ Validação de completude passou:', validation.message)

        // Salvar log de sucesso com resposta completa
        await aiLoggerService.logAIRequest({
          timestamp,
          userId: user.id,
          userEmail: user.email,
          prompt,
          response: {
            plan,
            validation,
            fullAIResponse: aiContent,
            processingTime: Date.now() - startTime,
          },
          success: true,
        })
      } catch (parseError) {
        console.error('❌ Erro ao parsear resposta da IA')
        console.error('Resposta completa:', aiContent)

        // Salvar log de erro com resposta bruta
        await aiLoggerService.logRawAIResponse({
          timestamp,
          userId: user.id,
          prompt,
          rawResponse: aiContent,
          parseError: parseError.message,
        })

        await aiLoggerService.logAIRequest({
          timestamp,
          userId: user.id,
          userEmail: user.email,
          prompt,
          response: aiContent,
          success: false,
          error: `Erro ao parsear JSON: ${parseError.message}`,
        })

        return response.badRequest({
          error: 'IA retornou formato inválido. Tente reformular sua instrução.',
        })
      }

      // Validar estrutura básica
      if (!plan.name || !plan.description || !plan.readings || !Array.isArray(plan.readings)) {
        return response.badRequest({
          error: 'Plano gerado pela IA está incompleto',
        })
      }

      // Validar que tem pelo menos 1 leitura
      if (plan.readings.length === 0) {
        return response.badRequest({
          error: 'Plano não possui leituras',
        })
      }

      // Garantir campos obrigatórios
      plan.type = plan.type || 'custom'
      plan.isActive = true
      plan.order = 0
      plan.duration = plan.duration || plan.readings.length

      return response.ok({ plan })
    } catch (error) {
      console.error('❌ Erro inesperado ao gerar plano com IA:', error)

      // Salvar log de erro fatal
      try {
        await aiLoggerService.logAIRequest({
          timestamp: new Date().toISOString(),
          userId: auth.user?.id || 0,
          userEmail: auth.user?.email || 'unknown',
          prompt: request.input('prompt', 'N/A'),
          response: null,
          success: false,
          error: `Erro fatal: ${error.message}\n${error.stack}`,
        })
      } catch (logError) {
        console.error('❌ Erro ao salvar log:', logError)
      }

      return response.internalServerError({
        error: 'Erro ao gerar plano com IA. Tente novamente.',
      })
    }
  }

  /**
   * Validar se o plano gerado está completo baseado na instrução
   */
  private validatePlanCompleteness(
    plan: any,
    prompt: string
  ): { isValid: boolean; message: string; stats: any } {
    const promptLower = prompt.toLowerCase()

    // Definir livros do Novo Testamento (27 livros, 260 capítulos)
    const newTestamentBooks = [
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

    // Contar capítulos cobertos no plano
    const coveredBooks = new Set<string>()
    let totalChapters = 0

    for (const reading of plan.readings) {
      if (reading.bookReadings && Array.isArray(reading.bookReadings)) {
        for (const bookReading of reading.bookReadings) {
          const bookName = bookReading.book
          coveredBooks.add(bookName)

          // Contar capítulos
          if (bookReading.chapters && Array.isArray(bookReading.chapters)) {
            totalChapters += bookReading.chapters.length
          }
        }
      }
    }

    const stats: any = {
      daysGenerated: plan.readings.length,
      booksFound: coveredBooks.size,
      totalChapters,
    }

    // Se o prompt menciona "novo testamento", verificar se tem todos os 27 livros
    if (promptLower.includes('novo testamento') || promptLower.includes('nt')) {
      const missingBooks = newTestamentBooks
        .filter((book) => !coveredBooks.has(book.name))
        .map((b) => b.name)

      stats['expectedBooks'] = 27
      stats['expectedChapters'] = 260
      stats['missingBooks'] = missingBooks

      if (missingBooks.length > 0) {
        return {
          isValid: false,
          message: `Faltam ${missingBooks.length} livros do NT: ${missingBooks.slice(0, 5).join(', ')}${missingBooks.length > 5 ? '...' : ''}`,
          stats,
        }
      }

      // Verificar se tem pelo menos 85% dos capítulos (260 capítulos no NT)
      if (totalChapters < 220) {
        return {
          isValid: false,
          message: `Apenas ${totalChapters} de 260 capítulos do NT cobertos (${Math.round((totalChapters / 260) * 100)}%)`,
          stats,
        }
      }
    }

    // Se o prompt menciona "evangelhos", verificar se tem os 4
    if (promptLower.includes('evangelho')) {
      const evangelhos = ['Mateus', 'Marcos', 'Lucas', 'João']
      const missingEvangelhos = evangelhos.filter((e) => !coveredBooks.has(e))

      if (missingEvangelhos.length > 0) {
        stats['expectedBooks'] = 4
        stats['missingBooks'] = missingEvangelhos

        return {
          isValid: false,
          message: `Faltam evangelhos: ${missingEvangelhos.join(', ')}`,
          stats,
        }
      }
    }

    // Validação genérica: se tem mais de 50 dias, deve ter pelo menos 10 livros diferentes
    if (plan.readings.length >= 50 && coveredBooks.size < 10) {
      return {
        isValid: false,
        message: `Plano de ${plan.readings.length} dias tem apenas ${coveredBooks.size} livros. Esperado pelo menos 10.`,
        stats,
      }
    }

    return {
      isValid: true,
      message: `Plano válido: ${coveredBooks.size} livros, ${totalChapters} capítulos`,
      stats,
    }
  }
}
