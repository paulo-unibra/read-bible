import BibleCuriosity from '#models/bible_curiosity'
import env from '#start/env'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'

export default class BibleCuriositiesController {
  /**
   * Gerar curiosidade bíblica usando DeepSeek
   */
  async generate({ response }: HttpContext) {
    try {
      const today = DateTime.now().toFormat('yyyy-MM-dd')

      // Verificar se já existe curiosidade para hoje
      const existing = await BibleCuriosity.query()
        .where('date', today)
        .where('isActive', true)
        .first()

      if (existing) {
        return response.ok({
          success: true,
          message: 'Curiosidade já existe para hoje',
          data: existing,
        })
      }

      // Gerar curiosidade usando DeepSeek
      const apiKey = env.get('DEEPSEEK_API_KEY')

      if (!apiKey) {
        return response.badRequest({
          success: false,
          message: 'DeepSeek API key não configurada',
        })
      }

      // Temas variados para evitar repetição
      const themes = [
        'personagens bíblicos pouco conhecidos',
        'números e simbolismos na Bíblia',
        'curiosidades sobre livros específicos da Bíblia',
        'eventos históricos mencionados na Bíblia',
        'lugares bíblicos e sua importância',
        'traduções e versões da Bíblia',
        'milagres e seus significados',
        'profecias cumpridas',
        'costumes e culturas dos tempos bíblicos',
        'animais mencionados na Bíblia',
        'comidas e bebidas na época bíblica',
        'profissões e ofícios bíblicos',
        'mulheres influentes na Bíblia',
        'reis e governantes bíblicos',
        'parábolas e seus ensinamentos',
        'versículos mais curtos ou mais longos',
        'genealogias interessantes',
        'línguas originais da Bíblia',
        'descobertas arqueológicas bíblicas',
        'salmos e seus contextos',
      ]

      const randomTheme = themes[Math.floor(Math.random() * themes.length)]
      const timestamp = Date.now()

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
              content:
                'Você é um especialista em curiosidades bíblicas. Gere curiosidades interessantes, educativas e curtas sobre a Bíblia. Cada curiosidade deve ser única e diferente das anteriores.',
            },
            {
              role: 'user',
              content: `Gere uma curiosidade bíblica curta e interessante sobre: ${randomTheme}. A curiosidade deve ter no máximo 150 caracteres, ser surpreendente e educativa. Retorne apenas o texto da curiosidade, sem aspas ou formatação adicional. ID único desta requisição: ${timestamp}`,
            },
          ],
          temperature: 1.2,
          max_tokens: 100,
        }),
      })

      if (!deepseekResponse.ok) {
        const errorText = await deepseekResponse.text()
        console.error('DeepSeek API error:', errorText)
        return response.badRequest({
          success: false,
          message: 'Erro ao gerar curiosidade',
          error: errorText,
        })
      }

      const data = (await deepseekResponse.json()) as {
        choices: Array<{ message: { content: string } }>
      }
      const curiosityContent = data.choices[0].message.content.trim()

      // Salvar no banco (inativa por padrão para revisão)
      const curiosity = await BibleCuriosity.create({
        content: curiosityContent,
        date: DateTime.fromFormat(today, 'yyyy-MM-dd'),
        isActive: false,
      })

      return response.created({
        success: true,
        message: 'Curiosidade gerada com sucesso',
        data: curiosity,
      })
    } catch (error) {
      console.error('Erro ao gerar curiosidade:', error)
      return response.badRequest({
        success: false,
        message: 'Erro ao gerar curiosidade',
        error: error.message,
      })
    }
  }

  /**
   * Obter curiosidade do dia
   */
  async getToday({ auth, response }: HttpContext) {
    try {
      const today = DateTime.now().toFormat('yyyy-MM-dd')

      const curiosity = await BibleCuriosity.query()
        .where('date', today)
        .where('is_active', true)
        .first()

      if (!curiosity) {
        return response.ok({
          success: true,
          data: null,
        })
      }

      // Verificar se o usuário favoritou
      let isFavorited = false
      if (auth.user) {
        await curiosity.load('favoritedBy')
        isFavorited = curiosity.favoritedBy.some((user) => user.id === auth.user!.id)
      }

      return response.ok({
        success: true,
        data: {
          id: curiosity.id,
          content: curiosity.content,
          theme: curiosity.theme,
          date: curiosity.date.toFormat('yyyy-MM-dd'),
          isFavorited,
        },
      })
    } catch (error) {
      console.error('Erro ao buscar curiosidade:', error)
      return response.badRequest({
        success: false,
        message: 'Erro ao buscar curiosidade',
      })
    }
  }

  /**
   * Favoritar/desfavoritar curiosidade
   */
  async toggleFavorite({ auth, params, response }: HttpContext) {
    try {
      console.log('🔄 [BibleCuriositiesController] toggleFavorite iniciado')
      
      const user = auth.user!
      console.log('👤 [BibleCuriositiesController] User ID:', user.id)
      console.log('👤 [BibleCuriositiesController] User email:', user.email)
      
      const curiosityId = params.id
      console.log('📋 [BibleCuriositiesController] Curiosity ID:', curiosityId)

      const curiosity = await BibleCuriosity.find(curiosityId)
      console.log('🔍 [BibleCuriositiesController] Curiosidade encontrada:', curiosity ? 'SIM' : 'NÃO')

      if (!curiosity) {
        console.error('❌ [BibleCuriositiesController] Curiosidade não encontrada')
        return response.notFound({
          success: false,
          message: 'Curiosidade não encontrada',
        })
      }

      console.log('📥 [BibleCuriositiesController] Carregando favoritos...')
      await curiosity.load('favoritedBy')
      console.log('📊 [BibleCuriositiesController] Favoritos carregados:', curiosity.favoritedBy.length)
      
      const isFavorited = curiosity.favoritedBy.some((u) => u.id === user.id)
      console.log('⭐ [BibleCuriositiesController] Já está favoritado?', isFavorited)

      if (isFavorited) {
        console.log('➖ [BibleCuriositiesController] Removendo dos favoritos...')
        await curiosity.related('favoritedBy').detach([user.id])
      } else {
        console.log('➕ [BibleCuriositiesController] Adicionando aos favoritos...')
        await curiosity.related('favoritedBy').attach([user.id])
      }

      const resultMessage = isFavorited
        ? 'Curiosidade removida dos favoritos'
        : 'Curiosidade adicionada aos favoritos'
      
      console.log('✅ [BibleCuriositiesController]', resultMessage)
      console.log('📤 [BibleCuriositiesController] isFavorited final:', !isFavorited)

      return response.ok({
        success: true,
        message: resultMessage,
        data: {
          isFavorited: !isFavorited,
        },
      })
    } catch (error) {
      console.error('❌ [BibleCuriositiesController] Erro ao favoritar curiosidade:', error)
      console.error('❌ [BibleCuriositiesController] Stack trace:', error instanceof Error ? error.stack : 'N/A')
      return response.badRequest({
        success: false,
        message: 'Erro ao favoritar curiosidade',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      })
    }
  }

  /**
   * Listar curiosidades favoritas do usuário
   */
  async getFavorites({ auth, response }: HttpContext) {
    try {
      const user = auth.user!

      await user.load('favoriteCuriosities')

      return response.ok({
        success: true,
        data: user.favoriteCuriosities.map((c) => ({
          id: c.id,
          content: c.content,
          theme: c.theme,
          date: c.date.toFormat('yyyy-MM-dd'),
        })),
      })
    } catch (error) {
      console.error('Erro ao buscar favoritos:', error)
      return response.badRequest({
        success: false,
        message: 'Erro ao buscar favoritos',
      })
    }
  }

  /**
   * ========================================
   * MÉTODOS ADMIN
   * ========================================
   */

  /**
   * Listar todas as curiosidades (admin)
   */
  async listAll({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 20)
      const isActive = request.input('isActive') // 'true', 'false', ou undefined (todos)

      const query = BibleCuriosity.query().orderBy('date', 'desc')

      if (isActive !== undefined) {
        query.where('isActive', isActive === 'true')
      }

      const curiosities = await query.paginate(page, limit)

      return response.ok({
        success: true,
        data: {
          data: curiosities.all().map((c) => ({
            id: c.id,
            content: c.content,
            theme: c.theme,
            date: c.date.toFormat('yyyy-MM-dd'),
            isActive: c.isActive,
            createdAt: c.createdAt.toISO(),
          })),
          meta: curiosities.getMeta(),
        },
      })
    } catch (error) {
      console.error('Erro ao listar curiosidades:', error)
      return response.badRequest({
        success: false,
        message: 'Erro ao listar curiosidades',
      })
    }
  }

  /**
   * Atualizar curiosidade (admin)
   */
  async update({ params, request, response }: HttpContext) {
    try {
      const curiosity = await BibleCuriosity.find(params.id)

      if (!curiosity) {
        return response.notFound({
          success: false,
          message: 'Curiosidade não encontrada',
        })
      }

      const { content, theme, date } = request.only(['content', 'theme', 'date'])

      if (content) curiosity.content = content
      if (theme) curiosity.theme = theme
      if (date) curiosity.date = DateTime.fromFormat(date, 'yyyy-MM-dd')

      await curiosity.save()

      return response.ok({
        success: true,
        message: 'Curiosidade atualizada com sucesso',
        data: {
          id: curiosity.id,
          content: curiosity.content,
          theme: curiosity.theme,
          date: curiosity.date.toFormat('yyyy-MM-dd'),
          isActive: curiosity.isActive,
        },
      })
    } catch (error) {
      console.error('Erro ao atualizar curiosidade:', error)
      return response.badRequest({
        success: false,
        message: 'Erro ao atualizar curiosidade',
      })
    }
  }

  /**
   * Alternar status ativo/inativo (admin)
   */
  async toggleActive({ params, response }: HttpContext) {
    try {
      const curiosity = await BibleCuriosity.find(params.id)

      if (!curiosity) {
        return response.notFound({
          success: false,
          message: 'Curiosidade não encontrada',
        })
      }

      curiosity.isActive = !curiosity.isActive
      await curiosity.save()

      return response.ok({
        success: true,
        message: `Curiosidade ${curiosity.isActive ? 'ativada' : 'desativada'} com sucesso`,
        data: {
          id: curiosity.id,
          isActive: curiosity.isActive,
        },
      })
    } catch (error) {
      console.error('Erro ao alternar status:', error)
      return response.badRequest({
        success: false,
        message: 'Erro ao alternar status',
      })
    }
  }

  /**
   * Deletar curiosidade (admin)
   */
  async delete({ params, response }: HttpContext) {
    try {
      const curiosity = await BibleCuriosity.find(params.id)

      if (!curiosity) {
        return response.notFound({
          success: false,
          message: 'Curiosidade não encontrada',
        })
      }

      await curiosity.delete()

      return response.ok({
        success: true,
        message: 'Curiosidade deletada com sucesso',
      })
    } catch (error) {
      console.error('Erro ao deletar curiosidade:', error)
      return response.badRequest({
        success: false,
        message: 'Erro ao deletar curiosidade',
      })
    }
  }
}
