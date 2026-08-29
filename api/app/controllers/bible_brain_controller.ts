import BibleBrainBible from '#models/bible_brain_bible'
import BibleBrainAudioPackageService from '#services/bible_brain_audio_package_service'
import BibleBrainPackageService from '#services/bible_brain_package_service'
import bibleBrainService from '#services/bible_brain_service'
import BibleBrainTimestampsService from '#services/bible_brain_timestamps_service'
import { USFM_BOOK_ORDER } from '../utils/usfm_books.js'
import { displayLanguageName } from '../utils/bible_brain_languages.js'
import type { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'
import { createReadStream, existsSync, promises as fsPromises } from 'node:fs'
import path from 'node:path'

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
    audioPackageStatus: bible.audioPackageStatus,
    audioPackageProgress: bible.audioPackageProgress,
  }
}

export default class BibleBrainController {
  async index({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const perPage = Math.min(request.input('perPage', 30), 50)
      const search = request.input('search', '').trim()
      const languageIso = request.input('languageIso', '').trim()

      const query = BibleBrainBible.query()
        .where('is_enabled', true)
        .where((builder) => {
          builder
            .where('packageStatus', 'ready')
            .orWhere((audioBuilder) => {
              audioBuilder
                .where('has_text', false)
                .where('has_audio', true)
                .where('audioPackageStatus', 'ready')
            })
        })

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

  /**
   * GET /bible-brain/languages
   * Lista de idiomas distintos entre as bíblias visíveis publicamente
   * (habilitadas pelo admin e com pacote de texto ou áudio pronto),
   * usada para popular o filtro de idioma no app.
   */
  async languages({ response }: HttpContext) {
    try {
      const rows = await BibleBrainBible.query()
        .where('is_enabled', true)
        .where((builder) => {
          builder
            .where('packageStatus', 'ready')
            .orWhere((audioBuilder) => {
              audioBuilder
                .where('has_text', false)
                .where('has_audio', true)
                .where('audioPackageStatus', 'ready')
            })
        })
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
      console.error('[BibleBrainController] Erro ao listar idiomas:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao listar idiomas',
        error: error.message,
      })
    }
  }

  async show({ params, request, response }: HttpContext) {
    try {
      const bible = await BibleBrainBible.query()
        .where('bible_id', params.bibleId)
        .where('is_enabled', true)
        .where((builder) => {
          builder
            .where('packageStatus', 'ready')
            .orWhere((audioBuilder) => {
              audioBuilder
                .where('has_text', false)
                .where('has_audio', true)
                .where('audioPackageStatus', 'ready')
            })
        })
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

      await BibleBrainPackageService.requestPackage(params.bibleId)

      if (existing.hasAudio && existing.audioPackageStatus !== 'ready') {
        BibleBrainAudioPackageService.requestAudioPackage(params.bibleId).catch(() => {})
      }

      const bible = await BibleBrainBible.findByOrFail('bibleId', params.bibleId)
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

  async audioBooks({ params, response }: HttpContext) {
    try {
      const bible = await BibleBrainBible.query()
        .where('bible_id', params.bibleId)
        .where('is_enabled', true)
        .first()

      if (!bible) {
        return response.notFound({ success: false, message: 'Bíblia não encontrada' })
      }

      const allAudioFilesets = bible.filesets.filter((f) => f.type?.startsWith('audio'))
      const mp3AudioFilesets = allAudioFilesets.filter((f) => f.container === 'mp3' || f.codec === 'mp3')
      const audioFilesets = mp3AudioFilesets.length > 0 ? mp3AudioFilesets : allAudioFilesets

      if (audioFilesets.length === 0) {
        return response.notFound({ success: false, message: 'Esta bíblia não possui áudio disponível' })
      }

      const books = new Map<string, { bookId: string; name: string; chapters: Set<number> }>()

      for (const fileset of audioFilesets) {
        const filesetChapters = await bibleBrainService.getAudioFilesetChapters(fileset.id)
        for (const chapter of filesetChapters.data || []) {
          if (!chapter.book_id || !chapter.chapter_start) continue
          const current = books.get(chapter.book_id) || {
            bookId: chapter.book_id,
            name: chapter.book_id,
            chapters: new Set<number>(),
          }
          current.chapters.add(Number(chapter.chapter_start))
          books.set(chapter.book_id, current)
        }
      }

      return response.ok({
        success: true,
        data: [...books.values()]
          .map((book) => ({
            bookId: book.bookId,
            name: book.name,
            chapters: [...book.chapters].sort((a, b) => a - b),
          }))
          .sort((a, b) => {
            const aOrder = USFM_BOOK_ORDER.indexOf(a.bookId)
            const bOrder = USFM_BOOK_ORDER.indexOf(b.bookId)
            return (aOrder === -1 ? 999 : aOrder) - (bOrder === -1 ? 999 : bOrder)
          }),
      })
    } catch (error) {
      console.error('[BibleBrainController] Erro ao listar livros com áudio:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao listar livros com áudio',
        error: error.message,
      })
    }
  }

  async videoBooks({ params, response }: HttpContext) {
    try {
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

      const NT_BOOKS = USFM_BOOK_ORDER.slice(USFM_BOOK_ORDER.indexOf('MAT'))
      const results = await Promise.all(
        NT_BOOKS.map(async (bookId) => {
          try {
            const data = await Promise.race([
              bibleBrainService.getChapterContent(videoFilesetId!, bookId, 1),
              new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
            ])
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

  async videoSegments({ params, response }: HttpContext) {
    try {
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

      const data = await bibleBrainService.getChapterContent(videoFilesetId, params.bookId, parseInt(params.chapterNumber))

      if (!data.data || data.data.length === 0) {
        return response.notFound({ success: false, message: 'Nenhum segmento encontrado' })
      }

      const apiKey = bibleBrainService.getKey()
      const segments = await Promise.all(
        data.data.map(async (item: any) => {
          const playlistUrl = String(item.path)
          const sep = playlistUrl.includes('?') ? '&' : '?'
          const fullUrl = `${playlistUrl}${sep}key=${apiKey}&v=4`

          try {
            const masterRes = await fetch(fullUrl)
            if (!masterRes.ok) throw new Error('Failed to fetch master playlist')
            const masterText = await masterRes.text()
            const childLine = masterText.split('\n').map(l => l.trim()).find(l => l && !l.startsWith('#'))
            const baseUrl = playlistUrl.substring(0, playlistUrl.lastIndexOf('/') + 1)
            const childUrl = childLine ? `${baseUrl}${childLine}${childLine.includes('?') ? '&' : '?'}key=${apiKey}&v=4` : fullUrl

            return {
              chapter: Number(item.chapter_start) || 1,
              verseStart: Number(item.verse_start) || 1,
              verseEnd: Number(item.verse_end) || 1,
              duration: Number(item.duration) || 0,
              thumbnail: item.thumbnail || null,
              url: childUrl,
            }
          } catch {
            return null
          }
        })
      )

      const valid = segments.filter((s: any) => s !== null)
      return response.ok({ success: true, data: valid, filesetId: videoFilesetId })
    } catch (error) {
      console.error('[BibleBrainController] Erro ao listar segmentos:', error)
      return response.internalServerError({ success: false, message: 'Erro ao listar segmentos' })
    }
  }

  async videoThumbnail({ params, response }: HttpContext) {
    try {
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
        return response.notFound({ success: false, message: 'Sem vídeo disponível' })
      }

      const data = await bibleBrainService.getChapterContent(videoFilesetId, params.bookId, parseInt(params.chapterNumber))
      const thumb = data.data?.[0]?.thumbnail || null
      return response.ok({ success: true, data: { thumbnail: thumb } })
    } catch (error) {
      return response.internalServerError({ success: false, message: 'Erro ao buscar thumbnail' })
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

      const allAudioFilesets = bible.filesets.filter((f) => f.type?.startsWith('audio'))
      const mp3AudioFilesets = allAudioFilesets.filter((f) => f.container === 'mp3' || f.codec === 'mp3')
      const audioFilesets = mp3AudioFilesets.length > 0 ? mp3AudioFilesets : allAudioFilesets

      if (audioFilesets.length === 0) {
        return response.notFound({ success: false, message: 'Esta bíblia não possui áudio disponível' })
      }

      // Busca primeiro no nosso banco (importado durante a geração do pacote
      // de áudio); só cai para a API externa se ainda não tiver sido
      // importado (pacotes gerados antes deste recurso existir).
      const timestamps = await BibleBrainTimestampsService.fetchWithFallback(
        params.bibleId,
        params.bookId,
        parseInt(params.chapterNumber),
        audioFilesets.map((f) => f.id)
      )

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

      const localFile = path.join(
        app.publicPath('uploads/bible-brain-audio'),
        params.bibleId,
        params.bookId,
        `${params.chapterNumber}.mp3`
      )

      if (existsSync(localFile)) {
        const stat = await fsPromises.stat(localFile)
        // URL relativa (sem host/protocolo): o Apache expõe esta API sob o
        // prefixo "/api", que não é visível para o Node por trás do proxy.
        // Construir uma URL absoluta aqui geraria um link quebrado (sem
        // "/api"). O cliente resolve o caminho relativo usando sua própria
        // base de API.
        const url = `/bible-brain/bibles/${params.bibleId}/audio-file/${params.bookId}/${params.chapterNumber}`
        return response.ok({
          success: true,
          data: { url, duration: 0, filesize: stat.size, filesetId: null },
        })
      }

      const allAudioFilesets = bible.filesets.filter((f) => f.type?.startsWith('audio'))
      const mp3AudioFilesets = allAudioFilesets.filter((f) => f.container === 'mp3' || f.codec === 'mp3')
      const audioFilesets = mp3AudioFilesets.length > 0 ? mp3AudioFilesets : allAudioFilesets

      if (audioFilesets.length === 0) {
        return response.notFound({ success: false, message: 'Esta bíblia não possui áudio disponível' })
      }

      for (const audioFileset of audioFilesets) {
        try {
          const audioData = await bibleBrainService.getAudioChapterInfo(
            audioFileset.id,
            params.bookId,
            parseInt(params.chapterNumber)
          )

          if (!audioData.data || audioData.data.length === 0) {
            continue
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
          console.log('[BibleBrainController] Fileset sem áudio para capítulo:', {
            bibleId: params.bibleId,
            filesetId: audioFileset.id,
            bookId: params.bookId,
            chapterNumber: params.chapterNumber,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }

      return response.notFound({ success: false, message: 'Áudio não encontrado para este capítulo' })
    } catch (error) {
      console.error('[BibleBrainController] Erro ao buscar áudio:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao buscar áudio do capítulo',
        error: error.message,
      })
    }
  }

  async audioFile({ params, response }: HttpContext) {
    try {
      const bookId = String(params.bookId || '')
      const chapterNumber = String(params.chapterNumber || '')

      if (!/^[A-Z0-9]{2,4}$/i.test(bookId) || !/^\d+$/.test(chapterNumber)) {
        return response.badRequest({ success: false, message: 'Parâmetros inválidos' })
      }

      const filePath = path.join(
        app.publicPath('uploads/bible-brain-audio'),
        params.bibleId,
        bookId,
        `${chapterNumber}.mp3`
      )

      if (!existsSync(filePath)) {
        return response.notFound({ success: false, message: 'Arquivo de áudio não encontrado' })
      }

      const stat = await fsPromises.stat(filePath)

      response.header('Content-Type', 'audio/mpeg')
      response.header('Content-Length', String(stat.size))
      response.header('Accept-Ranges', 'bytes')
      response.header('Cache-Control', 'public, max-age=86400')

      return response.stream(createReadStream(filePath))
    } catch (error) {
      console.error('[BibleBrainController] Erro ao servir arquivo de áudio:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao servir arquivo de áudio',
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
