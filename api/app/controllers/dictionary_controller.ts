import dictionaryService from '#services/dictionary_service'
import { createReadStream } from 'node:fs'
import type { HttpContext } from '@adonisjs/core/http'

export default class DictionaryController {
  async files({ response }: HttpContext) {
    try {
      const files = await dictionaryService.getFileList()
      return response.ok({ success: true, files })
    } catch (error) {
      console.error('[DictionaryController] Erro ao listar arquivos:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao listar dicionários',
        error: error.message,
      })
    }
  }

  async download({ params, response }: HttpContext) {
    try {
      const file = await dictionaryService.getFileByKey(params.dictKey)
      if (!file) {
        return response.notFound({ success: false, message: 'Dicionário não encontrado' })
      }

      response.header('Content-Type', 'application/x-sqlite3')
      response.header('Content-Disposition', `attachment; filename="${file.fileName}"`)
      response.header('Cache-Control', 'public, max-age=86400')
      response.header('Content-Length', String(file.size))

      return response.stream(createReadStream(file.filePath))
    } catch (error) {
      console.error('[DictionaryController] Erro ao baixar dicionário:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao baixar dicionário',
        error: error.message,
      })
    }
  }
  async search({ request, response }: HttpContext) {
    try {
      const q = request.input('q', '')
      const page = Number.parseInt(request.input('page', '1'))
      const perPage = Math.min(Number.parseInt(request.input('perPage', '50')), 200)

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
      const dict = request.input('dict', '') || undefined
      const entry = await dictionaryService.getWord(word, dict)
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
      const result = await dictionaryService.downloadAll(true)
      const stats = await dictionaryService.getStats()
      return response.ok({
        success: true,
        message: `Dicionários atualizados: ${result.downloaded.join(', ')}`,
        ...stats,
      })
    } catch (error) {
      console.error('[DictionaryController] Erro ao recarregar:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao recarregar dicionários',
        error: error.message,
      })
    }
  }

  async stats({ response }: HttpContext) {
    try {
      const stats = await dictionaryService.getStats()
      return response.ok({ success: true, ...stats })
    } catch (error) {
      return response.internalServerError({ success: false, message: error.message })
    }
  }
}
