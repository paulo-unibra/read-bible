import HymnAudioSync from '#models/hymn_audio_sync'
import type { HttpContext } from '@adonisjs/core/http'
import { searchHymnAudiosInDrive, listAllHymnsWithAudioInDrive } from '../services/google_drive_service.js'

export default class HymnAudiosController {
  /**
   * Buscar todos os áudios de um hino específico no Google Drive
   * GET /api/admin/hymn-audios/search/:hymnNumber
   */
  async searchInDrive({ params, response, request }: HttpContext) {
    try {
      const { hymnNumber } = params

      console.log(`[HymnAudiosController] Buscando áudios do hino ${hymnNumber} no Drive...`)

      const audios = await searchHymnAudiosInDrive(parseInt(hymnNumber))

      // Substituir URL do Drive por URL do nosso proxy
      const baseUrl = `${request.protocol()}://${request.hostname()}`
      const port = request.protocol() === 'https' ? '' : ':1999'
      const apiUrl = `${baseUrl}${port}`

      const audiosWithProxy = audios.map(audio => ({
        ...audio,
        downloadUrl: `${apiUrl}/hymn-audios/stream/${audio.fileId}`,
      }))

      return response.ok({
        success: true,
        data: audiosWithProxy,
      })
    } catch (error) {
      console.error('[HymnAudiosController] Erro ao buscar áudios:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao buscar áudios no Google Drive',
        error: error.message,
      })
    }
  }

  /**
   * Listar todos os áudios sincronizados de um hino
   * GET /api/hymn-audios/:hymnNumber
   * Query param: ?direct=true para URLs diretas do Drive (mobile app)
   */
  async getByHymnNumber({ params, response, request }: HttpContext) {
    try {
      const { hymnNumber } = params
      const useDirect = request.qs().direct === 'true'

      const audios = await HymnAudioSync.query()
        .where('hymn_number', hymnNumber)
        .where('is_active', true)
        .orderBy('display_order', 'asc')
        .orderBy('instrument', 'asc')

      // Se useDirect=true, usar URL direta do Drive (para mobile app)
      // Caso contrário, usar proxy (para admin panel com CORS)
      const env = (await import('#start/env')).default
      const apiKey = env.get('GOOGLE_API_KEY')

      const audiosWithUrl = audios.map(audio => {
        const downloadUrl = useDirect
          ? `https://www.googleapis.com/drive/v3/files/${audio.fileId}?alt=media&key=${apiKey}`
          : (() => {
              const baseUrl = `${request.protocol()}://${request.hostname()}`
              const port = request.protocol() === 'https' ? '' : ':1999'
              return `${baseUrl}${port}/hymn-audios/stream/${audio.fileId}`
            })()

        return {
          ...audio.serialize(),
          downloadUrl,
        }
      })

      return response.ok({
        success: true,
        data: audiosWithUrl,
      })
    } catch (error) {
      console.error('[HymnAudiosController] Erro ao buscar áudios:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao buscar áudios sincronizados',
        error: error.message,
      })
    }
  }

  /**
   * Criar ou atualizar sincronização de um áudio
   * POST /api/admin/hymn-audios
   */
  async upsert({ request, response, auth }: HttpContext) {
    try {
      const data = request.only([
        'hymnNumber',
        'instrument',
        'fileId',
        'fileName',
        'offsetMs',
        'durationMs',
        'defaultVolume',
        'defaultMuted',
        'displayOrder',
        'notes',
      ])

      const user = auth.user!

      // Buscar se já existe
      const existing = await HymnAudioSync.query()
        .where('hymn_number', data.hymnNumber)
        .where('instrument', data.instrument)
        .first()

      if (existing) {
        // Atualizar
        existing.merge({
          ...data,
          updatedBy: user.id,
        })
        await existing.save()

        return response.ok({
          success: true,
          message: 'Sincronização atualizada com sucesso',
          data: existing,
        })
      } else {
        // Criar
        const audio = await HymnAudioSync.create({
          ...data,
          updatedBy: user.id,
        })

        return response.created({
          success: true,
          message: 'Sincronização criada com sucesso',
          data: audio,
        })
      }
    } catch (error) {
      console.error('[HymnAudiosController] Erro ao salvar sincronização:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao salvar sincronização',
        error: error.message,
      })
    }
  }

  /**
   * Atualizar offset de sincronização
   * PATCH /api/admin/hymn-audios/:id/offset
   */
  async updateOffset({ params, request, response, auth }: HttpContext) {
    try {
      const { id } = params
      const { offsetMs } = request.only(['offsetMs'])
      const user = auth.user!

      const audio = await HymnAudioSync.findOrFail(id)
      audio.offsetMs = offsetMs
      audio.updatedBy = user.id
      await audio.save()

      return response.ok({
        success: true,
        message: 'Offset atualizado com sucesso',
        data: audio,
      })
    } catch (error) {
      console.error('[HymnAudiosController] Erro ao atualizar offset:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao atualizar offset',
        error: error.message,
      })
    }
  }

  /**
   * Deletar sincronização de áudio
   * DELETE /api/admin/hymn-audios/:id
   */
  async delete({ params, response }: HttpContext) {
    try {
      const { id } = params

      const audio = await HymnAudioSync.findOrFail(id)
      await audio.delete()

      return response.ok({
        success: true,
        message: 'Sincronização deletada com sucesso',
      })
    } catch (error) {
      console.error('[HymnAudiosController] Erro ao deletar sincronização:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao deletar sincronização',
        error: error.message,
      })
    }
  }

  /**
   * Listar todos os hinos que têm áudios sincronizados
   * GET /api/admin/hymn-audios/list
   */
  async listHymnsWithAudio({ response }: HttpContext) {
    try {
      // Buscar hinos que têm áudios no Drive
      const hymnsInDrive = await listAllHymnsWithAudioInDrive()

      return response.ok({
        success: true,
        data: hymnsInDrive,
      })
    } catch (error) {
      console.error('[HymnAudiosController] Erro ao listar hinos:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao listar hinos com áudio',
        error: error.message,
      })
    }
  }

  /**
   * Stream de áudio do Google Drive (proxy para evitar CORS)
   * GET /hymn-audios/stream/:fileId
   */
  async streamAudio({ params, response }: HttpContext) {
    try {
      const { fileId } = params

      console.log(`[HymnAudiosController] Streaming áudio: ${fileId}`)

      // Usar Service Account (GCS_CREDENTIALS) ao invés de OAuth
      const { google } = await import('googleapis')
      const env = (await import('#start/env')).default

      const credentials = env.get('GCS_CREDENTIALS')

      if (!credentials) {
        return response.internalServerError({
          success: false,
          message: 'GCS_CREDENTIALS não configurada',
        })
      }

      // Parse das credenciais
      const auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(credentials),
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
      })

      const drive = google.drive({ version: 'v3', auth })

      // Buscar metadados do arquivo
      const fileMeta = await drive.files.get({
        fileId: fileId,
        fields: 'name,mimeType,size',
      })

      // Fazer stream do arquivo
      const fileStream = await drive.files.get(
        {
          fileId: fileId,
          alt: 'media',
        },
        {
          responseType: 'stream',
        }
      )

      // Configurar headers
      response.header('Content-Type', fileMeta.data.mimeType || 'audio/mpeg')
      response.header('Accept-Ranges', 'bytes')
      if (fileMeta.data.size) {
        response.header('Content-Length', fileMeta.data.size)
      }
      response.header('Cache-Control', 'public, max-age=3600')
      response.header('Access-Control-Allow-Origin', '*')

      // Retornar o stream
      return response.stream(fileStream.data)

    } catch (error) {
      console.error('[HymnAudiosController] Erro ao fazer stream:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao fazer stream do áudio',
        error: error.message,
      })
    }
  }
}
