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

      const data = await deepseekResponse.json()
      const curiosityContent = data.choices[0].message.content.trim()

      // Salvar no banco
      const curiosity = await BibleCuriosity.create({
        content: curiosityContent,
        date: DateTime.fromFormat(today, 'yyyy-MM-dd'),
        isActive: true,
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
      } else {
        await curiosity.related('favoritedBy').attach([user.id])
      }

      return response.ok({
        success: true,
        message: isFavorited
          ? 'Curiosidade removida dos favoritos'
          : 'Curiosidade adicionada aos favoritos',
        data: {
          isFavorited: !isFavorited,
        },
      })
    } catch (error) {
      console.error('Erro ao favoritar curiosidade:', error)
      return response.badRequest({
        success: false,
        message: 'Erro ao favoritar curiosidade',
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
}
