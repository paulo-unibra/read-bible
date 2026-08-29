import BibleBrainBible from '#models/bible_brain_bible'
import BibleBrainAudioPackageService from '#services/bible_brain_audio_package_service'
import BibleBrainPackageService from '#services/bible_brain_package_service'
import BibleBrainSyncService from '#services/bible_brain_sync_service'
import { displayLanguageName } from '../../utils/bible_brain_languages.js'
import type { HttpContext } from '@adonisjs/core/http'

export default class AdminBibleBrainController {
  /**
   * GET /admin/bible-brain/bibles
   * Lista/busca paginada de TODAS as bíblias sincronizadas (habilitadas ou não).
   */
  async index({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const perPage = request.input('perPage', 20)
      const search = request.input('search', '').trim()
      const languageIso = request.input('languageIso', '').trim()
      const enabled = request.input('enabled', '') // 'true' | 'false' | ''
      const media = request.input('media', '') // 'text' | 'audio' | ''

      const query = BibleBrainBible.query()

      if (search) {
        query.where((builder) => {
          builder
            .where('name', 'like', `%${search}%`)
            .orWhere('language_name', 'like', `%${search}%`)
            .orWhere('bible_id', 'like', `%${search}%`)
        })
      }

      if (languageIso) {
        query.where('language_iso', languageIso)
      }

      if (enabled === 'true' || enabled === '1') {
        query.where('is_enabled', true)
      } else if (enabled === 'false' || enabled === '0') {
        query.where('is_enabled', false)
      }

      if (media === 'text') {
        query.where('has_text', true)
      } else if (media === 'audio') {
        query.where('has_audio', true)
      }

      const bibles = await query.orderBy('name', 'asc').paginate(page, perPage)

      return response.ok({
        success: true,
        data: bibles.all(),
        meta: bibles.getMeta(),
      })
    } catch (error) {
      console.error('[AdminBibleBrainController] Erro ao listar bíblias:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao listar bíblias',
        error: error.message,
      })
    }
  }

  /**
   * GET /admin/bible-brain/languages
   * Lista de idiomas distintos já sincronizados, para popular o filtro do admin.
   */
  async languages({ response }: HttpContext) {
    try {
      const rows = await BibleBrainBible.query()
        .whereNotNull('language_iso')
        .select('language_iso')
        .min('language_name as language_name')
        .groupBy('language_iso')

      return response.ok({
        success: true,
        data: rows
          .map((row) => ({
            iso: row.languageIso,
            name: displayLanguageName(row.languageIso, row.languageName),
          }))
          .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
      })
    } catch (error) {
      console.error('[AdminBibleBrainController] Erro ao listar idiomas:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao listar idiomas',
        error: error.message,
      })
    }
  }

  /**
   * POST /admin/bible-brain/sync
   * Dispara a sincronização com o catálogo da BibleBrain (job em background).
   */
  async sync({ response }: HttpContext) {
    const result = BibleBrainSyncService.startSync()
    return response.ok({ success: true, ...result })
  }

  /**
   * GET /admin/bible-brain/sync/status
   */
  async syncStatus({ response }: HttpContext) {
    return response.ok({ success: true, data: BibleBrainSyncService.getStatus() })
  }

  /**
   * PATCH /admin/bible-brain/bibles/:id/toggle
   * Habilita/desabilita uma bíblia para aparecer no app.
   */
  async toggle({ params, request, response, auth }: HttpContext) {
    try {
      const bible = await BibleBrainBible.findOrFail(params.id)
      const desired = request.input('isEnabled')

      const willEnable = typeof desired === 'boolean' ? desired : !bible.isEnabled

      const textReady = bible.hasText && bible.packageStatus === 'ready'
      const audioOnlyReady = !bible.hasText && bible.hasAudio && bible.audioPackageStatus === 'ready'

      if (willEnable && !textReady && !audioOnlyReady) {
        return response.badRequest({
          success: false,
          message:
            'Para ativar esta bíblia é necessário gerar o pacote primeiro. Clique em "Gerar" na coluna Pacote.',
        })
      }

      bible.isEnabled = willEnable
      bible.updatedBy = auth.user!.id
      await bible.save()

      return response.ok({ success: true, data: bible })
    } catch (error) {
      console.error('[AdminBibleBrainController] Erro ao alternar disponibilidade:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao atualizar disponibilidade da bíblia',
        error: error.message,
      })
    }
  }

  /**
   * POST /admin/bible-brain/bibles/:id/package
   * Permite ao admin "esquentar" o pacote de uma bíblia antes de habilitar.
   */
  async requestPackage({ params, response }: HttpContext) {
    try {
      const record = await BibleBrainBible.findOrFail(params.id)

      console.log('[AdminBibleBrainController] Solicitação de geração BibleBrain:', {
        id: record.id,
        bibleId: record.bibleId,
        name: record.name,
        hasText: record.hasText,
        hasAudio: record.hasAudio,
        packageStatus: record.packageStatus,
        audioPackageStatus: record.audioPackageStatus,
        filesets: record.filesets?.map((fileset) => ({
          id: fileset.id,
          type: fileset.type,
          size: fileset.size,
          codec: fileset.codec,
          container: fileset.container,
        })),
      })

      if (!record.hasText && !record.hasAudio) {
        return response.badRequest({
          success: false,
          message: 'Esta bíblia não possui texto nem áudio disponível',
        })
      }

      if (record.hasText) {
        console.log('[AdminBibleBrainController] Iniciando geração de pacote de texto:', record.bibleId)
        await BibleBrainPackageService.requestPackage(record.bibleId)
      }

      if (record.hasAudio && (record.audioPackageStatus !== 'ready' || !record.hasText)) {
        console.log('[AdminBibleBrainController] Iniciando importação de áudio:', record.bibleId)
        BibleBrainAudioPackageService.requestAudioPackage(record.bibleId, { force: !record.hasText }).catch(
          () => {}
        )
      } else if (record.hasAudio) {
        console.log('[AdminBibleBrainController] Áudio já estava pronto:', record.bibleId)
      }

      const updated = await BibleBrainBible.findOrFail(params.id)
      return response.ok({ success: true, data: updated })
    } catch (error) {
      console.error('[AdminBibleBrainController] Erro ao solicitar pacote:', error)
      return response.badRequest({
        success: false,
        message: error.message || 'Erro ao preparar pacote da bíblia',
      })
    }
  }
}
