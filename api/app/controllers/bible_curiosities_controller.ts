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
      const today = DateTime.now().setZone('America/Sao_Paulo').toFormat('yyyy-MM-dd')

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
      const today = DateTime.now().setZone('America/Sao_Paulo').toFormat('yyyy-MM-dd')

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

      const result = {
        id: curiosity.id,
        content: curiosity.content,
        theme: curiosity.theme,
        date: curiosity.date.toFormat('yyyy-MM-dd'),
        isFavorited,
        likesCount: curiosity.likesCount || 0,
        sharesCount: curiosity.sharesCount || 0,
      }

      return response.ok({
        success: true,
        data: result,
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
      const user = auth.user!
      const curiosityId = params.id
      const curiosity = await BibleCuriosity.find(curiosityId)

      if (!curiosity) {
        return response.notFound({
          success: false,
          message: 'Curiosidade não encontrada',
        })
      }

      await curiosity.load('favoritedBy')

      const isFavorited = curiosity.favoritedBy.some((u) => u.id === user.id)

      if (isFavorited) {
        await curiosity.related('favoritedBy').detach([user.id])
        curiosity.likesCount = Math.max(0, (curiosity.likesCount || 0) - 1)
        await curiosity.save()
      } else {
        await curiosity.related('favoritedBy').attach([user.id])
        curiosity.likesCount = (curiosity.likesCount || 0) + 1
        await curiosity.save()
      }

      const resultMessage = isFavorited
        ? 'Curiosidade removida dos favoritos'
        : 'Curiosidade adicionada aos favoritos'

      return response.ok({
        success: true,
        message: resultMessage,
        data: {
          isFavorited: !isFavorited,
          likesCount: curiosity.likesCount || 0,
          sharesCount: curiosity.sharesCount || 0,
        },
      })
    } catch (error) {
      console.error('❌ [BibleCuriositiesController] Erro ao favoritar curiosidade:', error)
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
   * Registrar compartilhamento
   */
  async registerShare({ params, response }: HttpContext) {
    try {
      const curiosityId = params.id
      const curiosity = await BibleCuriosity.find(curiosityId)

      if (!curiosity) {
        return response.notFound({
          success: false,
          message: 'Curiosidade não encontrada',
        })
      }

      curiosity.sharesCount = (curiosity.sharesCount || 0) + 1
      await curiosity.save()

      return response.ok({
        success: true,
        message: 'Compartilhamento registrado',
        data: {
          sharesCount: curiosity.sharesCount,
        },
      })
    } catch (error) {
      console.error('Erro ao registrar compartilhamento:', error)
      return response.badRequest({
        success: false,
        message: 'Erro ao registrar compartilhamento',
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
      const requestedOrderBy = request.input('orderBy', 'id')
      const requestedOrder = request.input('order', 'desc')
      const allowedOrderColumns = ['id', 'date', 'created_at', 'likes_count', 'shares_count']
      const orderBy = allowedOrderColumns.includes(requestedOrderBy) ? requestedOrderBy : 'id'
      const order = requestedOrder === 'asc' ? 'asc' : 'desc'

      const query = BibleCuriosity.query().orderBy(orderBy, order)

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
            createdAt: c.createdAt ? c.createdAt.toISO() : null,
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
   * Criar nova curiosidade manualmente (admin)
   */
  async store({ request, response }: HttpContext) {
    try {
      const { content, theme, date, isActive } = request.only([
        'content',
        'theme',
        'date',
        'isActive',
      ])

      if (!content || !date) {
        return response.badRequest({
          success: false,
          message: 'Conteúdo e data são obrigatórios',
        })
      }

      const curiosity = await BibleCuriosity.create({
        content,
        theme: theme || null,
        date: DateTime.fromFormat(date, 'yyyy-MM-dd'),
        isActive: isActive !== undefined ? isActive : true,
        likesCount: 0,
        sharesCount: 0,
      })

      return response.created({
        success: true,
        message: 'Curiosidade criada com sucesso',
        data: {
          id: curiosity.id,
          content: curiosity.content,
          theme: curiosity.theme,
          date: curiosity.date.toFormat('yyyy-MM-dd'),
          isActive: curiosity.isActive,
        },
      })
    } catch (error) {
      console.error('Erro ao criar curiosidade:', error)
      return response.badRequest({
        success: false,
        message: 'Erro ao criar curiosidade',
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

  /**
   * Deletar múltiplas curiosidades em lote (admin)
   */
  async bulkDelete({ request, response }: HttpContext) {
    try {
      const { ids } = request.only(['ids'])

      if (!Array.isArray(ids) || ids.length === 0) {
        return response.badRequest({
          success: false,
          message: 'IDs inválidos ou vazios',
        })
      }

      // Deletar todas as curiosidades com os IDs fornecidos
      const deleted = await BibleCuriosity.query().whereIn('id', ids).delete()

      return response.ok({
        success: true,
        message: `${deleted} curiosidade(s) deletada(s) com sucesso`,
        data: {
          deletedCount: deleted,
        },
      })
    } catch (error) {
      console.error('Erro ao deletar curiosidades em lote:', error)
      return response.badRequest({
        success: false,
        message: 'Erro ao deletar curiosidades em lote',
      })
    }
  }
}
