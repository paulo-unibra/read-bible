import BibleBrainBible from '#models/bible_brain_bible'
import BibleBrainPackageService from '#services/bible_brain_package_service'
import bibleBrainService from '#services/bible_brain_service'
import type { HttpContext } from '@adonisjs/core/http'
import { createReadStream, existsSync } from 'node:fs'

function toPublicBible(bible: BibleBrainBible, request?: HttpContext['request']) {
  let downloadUrl: string | null = null
  if (bible.packageStatus === 'ready' && request) {
    downloadUrl = `${request.protocol()}://${request.host()}/bible-brain/bibles/${bible.bibleId}/package/download`
  }

  return {
    bibleId: bible.bibleId,
    name: bible.name,
    languageName: bible.languageName,
    languageIso: bible.languageIso,
    countryId: bible.countryId,
    date: bible.bibleDate,
    hasText: bible.hasText,
    hasAudio: bible.hasAudio,
    packageStatus: bible.packageStatus,
    packageProgress: bible.packageProgress,
    downloadUrl,
    packageSize: bible.packageSize,
  }
}

export default class BibleBrainController {
  async index({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const perPage = Math.min(request.input('perPage', 30), 50)
      const search = request.input('search', '').trim()
      const languageIso = request.input('languageIso', '').trim()

      const query = BibleBrainBible.query().where('is_enabled', true)

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

      const bibles = await query.orderBy('name', 'asc').paginate(page, perPage)

      return response.ok({
        success: true,
        data: bibles.all().map((b) => toPublicBible(b, request)),
        meta: bibles.getMeta(),
      })
    } catch (error) {
      console.error('[BibleBrainController] Erro ao listar bíblias:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao listar bíblias',
        error: error.message,
      })
    }
  }

  async show({ params, request, response }: HttpContext) {
    try {
      const bible = await BibleBrainBible.query()
        .where('bible_id', params.bibleId)
        .where('is_enabled', true)
        .first()

      if (!bible) {
        return response.notFound({ success: false, message: 'Bíblia não encontrada' })
      }

      return response.ok({ success: true, data: toPublicBible(bible, request) })
    } catch (error) {
      console.error('[BibleBrainController] Erro ao buscar bíblia:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao buscar bíblia',
        error: error.message,
      })
    }
  }

  async requestPackage({ params, request, response }: HttpContext) {
    try {
      const existing = await BibleBrainBible.query()
        .where('bible_id', params.bibleId)
        .where('is_enabled', true)
        .first()

      if (!existing) {
        return response.notFound({ success: false, message: 'Bíblia não encontrada' })
      }

      const bible = await BibleBrainPackageService.requestPackage(params.bibleId)
      return response.ok({ success: true, data: toPublicBible(bible, request) })
    } catch (error) {
      console.error('[BibleBrainController] Erro ao solicitar pacote:', error)
      return response.badRequest({
        success: false,
        message: error.message || 'Erro ao preparar download da bíblia',
      })
    }
  }

  async packageStatus({ params, request, response }: HttpContext) {
    try {
      const bible = await BibleBrainBible.query()
        .where('bible_id', params.bibleId)
        .where('is_enabled', true)
        .first()

      if (!bible) {
        return response.notFound({ success: false, message: 'Bíblia não encontrada' })
      }

      return response.ok({ success: true, data: toPublicBible(bible, request) })
    } catch (error) {
      console.error('[BibleBrainController] Erro ao consultar status do pacote:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao consultar status do pacote',
        error: error.message,
      })
    }
  }

  async videoBibles({ request, response }: HttpContext) {
    try {
      const languageCode = request.input('languageCode', '').trim()
      const page = request.input('page', 1)
      const limit = Math.min(request.input('limit', 30), 50)

      const result = await bibleBrainService.listVideoBibles({
        languageCode: languageCode || undefined,
        limit,
        page,
      })

      const mapped = result.data.map((item) => {
        const videoFilesets: { id: string; type: string; size?: string }[] = []
        for (const env of Object.values(item.filesets || {})) {
          for (const fs of env as Array<{ id: string; type: string; size?: string }>) {
            if (fs.type?.startsWith('video')) {
              videoFilesets.push(fs)
            }
          }
        }
        return {
          bibleId: item.abbr,
          name: item.name,
          vname: item.vname,
          languageName: item.language,
          languageIso: item.iso,
          countryId: item.country_id || null,
          videoFilesets,
        }
      })

      return response.ok({ success: true, data: mapped })
    } catch (error) {
      console.error('[BibleBrainController] Erro ao listar vídeos:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao listar vídeos',
      })
    }
  }

  async videoChapter({ params, request, response }: HttpContext) {
    try {
      let videoFilesetId: string | null = null

      const bible = await BibleBrainBible.query()
        .where('bible_id', params.bibleId)
        .first()

      if (bible) {
        for (const fs of bible.filesets) {
          if (fs.type?.startsWith('video')) {
            videoFilesetId = fs.id
            break
          }
        }
      }

      if (!videoFilesetId) {
        const apiBible = await bibleBrainService.getBibleInfo(params.bibleId)
        for (const key of ['dbp-prod', 'dbp-vid']) {
          const filesetList = apiBible.data?.filesets?.[key]
          if (filesetList) {
            for (const fs of filesetList) {
              if (fs.type?.startsWith('video')) {
                videoFilesetId = fs.id
                break
              }
            }
            if (videoFilesetId) break
          }
        }
      }

      if (!videoFilesetId) {
        return response.notFound({ success: false, message: 'Esta bíblia não possui vídeo disponível' })
      }

      const videoData = await bibleBrainService.getChapterContent(
        videoFilesetId,
        params.bookId,
        parseInt(params.chapterNumber)
      )

      if (!videoData.data || videoData.data.length === 0) {
        return response.notFound({ success: false, message: 'Vídeo não encontrado para este capítulo' })
      }

      const chapter = videoData.data[0]

      if (!chapter.path) {
        return response.notFound({ success: false, message: 'Vídeo não encontrado para este capítulo' })
      }

      const apiKey = bibleBrainService.getKey()
      const directUrl = String(chapter.path)
      const sep = directUrl.includes('?') ? '&' : '?'
      const fullPlaylistUrl = `${directUrl}${sep}key=${apiKey}&v=4`
      const masterContent = await (await fetch(fullPlaylistUrl)).text()
      const childLine = masterContent.split('\n').map(l => l.trim()).find(l => l && !l.startsWith('#'))
      const childUrlWithParams = childLine || ''

      const proxyBase = `${request.protocol()}://${request.host()}/bible-brain/video-proxy/${videoFilesetId}/${params.bookId}/${params.chapterNumber}`
      const proxyUrl = childUrlWithParams ? `${proxyBase}/${childUrlWithParams}` : proxyBase

      return response.ok({
        success: true,
        data: {
          url: proxyUrl,
          duration: chapter.duration,
          thumbnail: chapter.thumbnail || null,
          filesetId: videoFilesetId,
        },
      })
    } catch (error) {
      console.error('[BibleBrainController] Erro ao buscar vídeo:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao buscar vídeo do capítulo',
        error: error.message,
      })
    }
  }

  async videoBooks({ params, response }: HttpContext) {
    try {
      const NT_BOOKS = ['MAT','MRK','LUK','JHN','ACT','ROM','1CO','2CO','GAL','EPH','PHP','COL','1TH','2TH','1TI','2TI','TIT','PHM','HEB','JAS','1PE','2PE','1JN','2JN','3JN','JUD','REV']
      let videoFilesetId: string | null = null

      const bible = await BibleBrainBible.query().where('bible_id', params.bibleId).first()
      if (bible) {
        for (const fs of bible.filesets) {
          if (fs.type?.startsWith('video')) { videoFilesetId = fs.id; break }
        }
      }

      if (!videoFilesetId) {
        const apiBible = await bibleBrainService.getBibleInfo(params.bibleId)
        for (const envKey of ['dbp-prod', 'dbp-vid']) {
          const filesetList = apiBible.data?.filesets?.[envKey]
          if (filesetList) {
            for (const fs of filesetList) {
              if (fs.type?.startsWith('video')) { videoFilesetId = fs.id; break }
            }
            if (videoFilesetId) break
          }
        }
      }

      if (!videoFilesetId) {
        return response.notFound({ success: false, message: 'Esta bíblia não possui vídeo disponível' })
      }

      const results = await Promise.all(
        NT_BOOKS.map(async (bookId) => {
          try {
            const data = await bibleBrainService.getChapterContent(videoFilesetId!, bookId, 1)
            if (data.data && data.data.length > 0) {
              return { bookId, name: data.data[0].book_name || bookId }
            }
          } catch {}
          return null
        })
      )

      const available = results.filter((r): r is NonNullable<typeof r> => r !== null)
      return response.ok({ success: true, data: available, filesetId: videoFilesetId })
    } catch (error) {
      console.error('[BibleBrainController] Erro ao listar livros com vídeo:', error)
      return response.internalServerError({ success: false, message: 'Erro ao listar livros' })
    }
  }

  async videoProxyPlaylist({ params, request, response }: HttpContext) {
    try {
      const { filesetId, bookId, chapterNumber } = params
      const apiKey = bibleBrainService.getKey()
      const resource = Array.isArray(params['*']) ? params['*'].join('/') : (params['*'] || '')

      const chapterData = await bibleBrainService.getChapterContent(
        filesetId, bookId, parseInt(chapterNumber)
      )

      if (!chapterData.data || chapterData.data.length === 0) {
        return response.notFound({ success: false, message: 'Vídeo não encontrado' })
      }

      const chapter = chapterData.data[0]
      const playlistUrl = String(chapter.path)
      const playlistBase = playlistUrl.substring(0, playlistUrl.lastIndexOf('/') + 1)

      if (resource && resource !== 'playlist.m3u8') {
        const sep = resource.includes('?') ? '&' : '?'
        const fullUrl = `${playlistBase}${resource}${sep}key=${apiKey}&v=4`
        const resourceResponse = await fetch(fullUrl)
        if (!resourceResponse.ok) {
          return response.badRequest({ success: false, message: 'Falha ao obter recurso do BibleBrain' })
        }
        const contentType = resource.endsWith('.m3u8')
          ? 'application/vnd.apple.mpegurl'
          : (resourceResponse.headers.get('content-type') || 'application/octet-stream')
        response.header('Content-Type', contentType)
        const text = await resourceResponse.text()
        return response.send(text)
      }

      const sep = playlistUrl.includes('?') ? '&' : '?'
      const fullUrl = `${playlistUrl}${sep}key=${apiKey}&v=4`

      const playlistResponse = await fetch(fullUrl)
      if (!playlistResponse.ok) {
        return response.badRequest({ success: false, message: 'Falha ao obter playlist do BibleBrain' })
      }

      const playlistContent = await playlistResponse.text()
      const proxyBase = `${request.protocol()}://${request.host()}/bible-brain/video-proxy/${filesetId}/${bookId}/${chapterNumber}`

      const rewritten = playlistContent.split('\n').map(line => {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) return line
        return `${proxyBase}/${trimmed}`
      }).join('\n')

      response.header('Content-Type', 'application/vnd.apple.mpegurl')
      return response.send(rewritten)
    } catch (error) {
      console.error('[BibleBrainController] Erro ao fazer proxy da playlist:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao fazer proxy da playlist de vídeo',
        error: error.message,
      })
    }
  }

  async audioTimestamps({ params, response }: HttpContext) {
    try {
      const bible = await BibleBrainBible.query()
        .where('bible_id', params.bibleId)
        .where('is_enabled', true)
        .first()

      if (!bible) {
        return response.notFound({ success: false, message: 'Bíblia não encontrada' })
      }

      const audioFilesets = bible.filesets.filter((f) => f.type?.startsWith('audio'))
      const audioFileset =
        audioFilesets.find((f) => f.container === 'mp3' || f.codec === 'mp3') ||
        audioFilesets.find((f) => f.type !== 'audio_drama_stream') ||
        audioFilesets[0]

      if (!audioFileset) {
        return response.notFound({ success: false, message: 'Esta bíblia não possui áudio disponível' })
      }

      const timestampsData = await bibleBrainService.getAudioTimestamps(
        audioFileset.id,
        params.bookId,
        parseInt(params.chapterNumber)
      )

      if (!timestampsData.data || timestampsData.data.length === 0) {
        return response.ok({ success: true, data: [] })
      }

      const timestamps = timestampsData.data
        .filter((t) => Number(t.verse_start) > 0 && t.timestamp != null)
        .map((t) => ({
          verseNumber: Number(t.verse_start),
          timestampMs: Math.round(Number(t.timestamp) * 1000),
        }))

      return response.ok({ success: true, data: timestamps })
    } catch (error) {
      console.error('[BibleBrainController] Erro ao buscar timestamps:', error)
      return response.ok({ success: true, data: [] })
    }
  }

  async audioChapter({ params, response }: HttpContext) {
    try {
      const bible = await BibleBrainBible.query()
        .where('bible_id', params.bibleId)
        .where('is_enabled', true)
        .first()

      if (!bible) {
        return response.notFound({ success: false, message: 'Bíblia não encontrada' })
      }

      const audioFilesets = bible.filesets.filter((f) => f.type?.startsWith('audio'))
      const audioFileset =
        audioFilesets.find((f) => f.container === 'mp3' || f.codec === 'mp3') ||
        audioFilesets.find((f) => f.type !== 'audio_drama_stream') ||
        audioFilesets[0]

      if (!audioFileset) {
        return response.notFound({ success: false, message: 'Esta bíblia não possui áudio disponível' })
      }

      const audioData = await bibleBrainService.getAudioChapterInfo(
        audioFileset.id,
        params.bookId,
        parseInt(params.chapterNumber)
      )

      if (!audioData.data || audioData.data.length === 0) {
        return response.notFound({ success: false, message: 'Áudio não encontrado para este capítulo' })
      }

      const chapter = audioData.data[0]

      return response.ok({
        success: true,
        data: {
          url: chapter.path,
          duration: chapter.duration,
          filesize: chapter.filesize_in_bytes,
          filesetId: audioFileset.id,
        },
      })
    } catch (error) {
      console.error('[BibleBrainController] Erro ao buscar áudio:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao buscar áudio do capítulo',
        error: error.message,
      })
    }
  }

  async download({ params, response }: HttpContext) {
    try {
      const bible = await BibleBrainBible.query()
        .where('bible_id', params.bibleId)
        .where('is_enabled', true)
        .first()

      if (!bible) {
        return response.notFound({ success: false, message: 'Bíblia não encontrada' })
      }

      if (bible.packageStatus !== 'ready' || !bible.packageUrl) {
        return response.notFound({ success: false, message: 'Pacote ainda não está pronto' })
      }

      const filePath = bible.packageUrl
      if (!existsSync(filePath)) {
        return response.notFound({ success: false, message: 'Arquivo do pacote não encontrado' })
      }

      response.header('Content-Type', 'application/x-sqlite3')
      response.header('Content-Disposition', `attachment; filename="${bible.bibleId}.db"`)
      response.header('Cache-Control', 'public, max-age=86400')
      if (bible.packageSize) {
        response.header('Content-Length', String(bible.packageSize))
      }

      return response.stream(createReadStream(filePath))
    } catch (error) {
      console.error('[BibleBrainController] Erro ao baixar pacote:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao baixar pacote',
      })
    }
  }
}
