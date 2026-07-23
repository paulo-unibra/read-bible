import dictionaryService from '#services/dictionary_service'
import type { HttpContext } from '@adonisjs/core/http'

export default class DictionaryController {
  async search({ request, response }: HttpContext) {
    try {
      const q = request.input('q', '')
      const page = parseInt(request.input('page', '1'))
      const perPage = Math.min(parseInt(request.input('perPage', '50')), 200)

      if (!q) {
        const result = await dictionaryService.getAlphabetList(page, perPage)
        return response.ok({ success: true, ...result })
      }

      const result = await dictionaryService.search(q, page, perPage)
      return response.ok({ success: true, ...result })
    } catch (error) {
      console.error('[DictionaryController] Erro na busca:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao buscar no dicionário',
        error: error.message,
      })
    }
  }

  async word({ request, response }: HttpContext) {
    try {
      const word = request.input('w', '')
      const entry = await dictionaryService.getWord(word)
      if (!entry) {
        return response.notFound({ success: false, message: 'Palavra não encontrada' })
      }
      return response.ok({ success: true, data: entry })
    } catch (error) {
      console.error('[DictionaryController] Erro ao buscar palavra:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao buscar palavra',
        error: error.message,
      })
    }
  }

  async refresh({ response }: HttpContext) {
    try {
      const result = await dictionaryService.downloadLatest()
      const total = await dictionaryService.getTotalCount()
      return response.ok({
        success: true,
        message: `Dicionário '${result.fileName}' carregado com ${total} verbetes`,
      })
    } catch (error) {
      console.error('[DictionaryController] Erro ao recarregar:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao recarregar dicionário',
        error: error.message,
      })
    }
  }

  async stats({ response }: HttpContext) {
    try {
      const loaded = dictionaryService.ensureLoaded()
      if (!loaded) {
        return response.ok({ success: true, loaded: false, total: 0 })
      }
      const total = await dictionaryService.getTotalCount()
      return response.ok({ success: true, loaded: true, total })
    } catch (error) {
      return response.internalServerError({ success: false, message: error.message })
    }
  }
}