import BibleBrainBible, { BibleBrainFilesetSummary } from '#models/bible_brain_bible'
import bibleBrainService from '#services/bible_brain_service'
import BibleBrainTimestampsService from '#services/bible_brain_timestamps_service'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import fs from 'node:fs/promises'
import { createWriteStream, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'

const AUDIO_DOWNLOAD_CONCURRENCY = 4
const API_CALL_DELAY_MS = 1200

interface AudioChapterJob {
  filesetId: string
  bookId: string
  chapter: number
  url: string
  duration: number
  filesize: number
}

export default class BibleBrainAudioPackageService {
  private static buildingIds = new Set<string>()

  static isBuilding(bibleId: string): boolean {
    return this.buildingIds.has(bibleId)
  }

  static async requestAudioPackage(
    bibleId: string,
    options: { force?: boolean } = {}
  ): Promise<BibleBrainBible> {
    const bible = await BibleBrainBible.findByOrFail('bibleId', bibleId)

    console.log('[BibleBrainAudioPackageService] requestAudioPackage:', {
      bibleId,
      name: bible.name,
      hasAudio: bible.hasAudio,
      audioPackageStatus: bible.audioPackageStatus,
      isAlreadyBuilding: this.buildingIds.has(bibleId),
      force: options.force === true,
    })

    if (bible.audioPackageStatus === 'ready' && !options.force) {
      console.log('[BibleBrainAudioPackageService] Áudio já pronto, ignorando nova geração:', bibleId)
      return bible
    }

    if (bible.audioPackageStatus === 'generating' || this.buildingIds.has(bibleId)) {
      console.log('[BibleBrainAudioPackageService] Áudio já em geração, ignorando nova geração:', bibleId)
      return bible
    }

    if (!bible.hasAudio) {
      throw new Error('Esta bíblia não possui áudio disponível')
    }

    bible.audioPackageStatus = 'generating'
    bible.audioPackageProgress = 0
    bible.audioPackageError = null
    await bible.save()

    this.buildingIds.add(bibleId)
    this.buildAudioPackage(bibleId).catch((error) => {
      console.error(`[BibleBrainAudioPackageService] Erro ao gerar áudio ${bibleId}:`, error)
    })

    return bible
  }

  private static getAudioFilesets(filesets: BibleBrainFilesetSummary[]): BibleBrainFilesetSummary[] {
    const audioFilesets = filesets.filter((f) => f.type?.startsWith('audio'))
    const mp3Filesets = audioFilesets.filter((f) => f.container === 'mp3' || f.codec === 'mp3')
    return mp3Filesets.length > 0 ? mp3Filesets : audioFilesets
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Importa (se ainda não estiverem salvos) os timestamps por versículo do
   * capítulo, para que a reprodução no app não precise consultar a API da
   * BibleBrain ao vivo. Não é crítico: se falhar, o áudio continua válido.
   */
  private static async importTimestampsForChapter(
    bibleId: string,
    job: AudioChapterJob
  ): Promise<boolean> {
    try {
      const existing = await BibleBrainTimestampsService.getStored(bibleId, job.bookId, job.chapter)
      if (existing.length > 0) {
        return false
      }

      const timestamps = await BibleBrainTimestampsService.fetchFromFilesetAndCache(
        bibleId,
        job.filesetId,
        job.bookId,
        job.chapter
      )

      if (timestamps.length > 0) {
        console.log('[BibleBrainAudioPackageService] Timestamps importados:', {
          bibleId,
          filesetId: job.filesetId,
          bookId: job.bookId,
          chapter: job.chapter,
          verses: timestamps.length,
        })
        return true
      }

      console.log('[BibleBrainAudioPackageService] Nenhum timestamp disponível para o capítulo:', {
        bibleId,
        filesetId: job.filesetId,
        bookId: job.bookId,
        chapter: job.chapter,
      })
      return false
    } catch (error) {
      console.log('[BibleBrainAudioPackageService] Falha ao importar timestamps do capítulo:', {
        bibleId,
        filesetId: job.filesetId,
        bookId: job.bookId,
        chapter: job.chapter,
        error: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  }

  private static async buildAudioPackage(bibleId: string) {
    let totalChapters = 0
    let completed = 0
    let downloaded = 0
    let timestampsImported = 0
    let lastPersistedProgress = 0

    try {
      const bible = await BibleBrainBible.findByOrFail('bibleId', bibleId)

      const audioFilesets = this.getAudioFilesets(bible.filesets)
      if (audioFilesets.length === 0) {
        throw new Error('Nenhum fileset de áudio disponível para esta bíblia')
      }

      console.log('[BibleBrainAudioPackageService] Filesets de áudio escolhidos:', {
        bibleId,
        audioFilesets,
        availableAudioFilesets: bible.filesets.filter((f) => f.type?.startsWith('audio')),
      })

      const audioDir = path.join(app.publicPath('uploads/bible-brain-audio'), bibleId)
      if (!existsSync(audioDir)) {
        mkdirSync(audioDir, { recursive: true })
      }

      const jobsByKey = new Map<string, AudioChapterJob>()
      for (const fileset of audioFilesets) {
        const filesetChapters = await bibleBrainService.getAudioFilesetChapters(fileset.id)
        console.log('[BibleBrainAudioPackageService] Capítulos retornados pelo fileset:', {
          bibleId,
          filesetId: fileset.id,
          total: filesetChapters.data?.length || 0,
          sample: filesetChapters.data?.slice(0, 10).map((chapter) => ({
            bookId: chapter.book_id,
            chapter: chapter.chapter_start,
            filesize: chapter.filesize_in_bytes,
          })),
        })

        for (const chapter of filesetChapters.data || []) {
          if (!chapter.book_id || !chapter.chapter_start || !chapter.path) continue
          const key = `${chapter.book_id}-${chapter.chapter_start}`
          jobsByKey.set(key, {
            filesetId: fileset.id,
            bookId: chapter.book_id,
            chapter: Number(chapter.chapter_start),
            url: chapter.path,
            duration: Number(chapter.duration || 0),
            filesize: Number(chapter.filesize_in_bytes || 0),
          })
        }
      }

      const chapterJobs = [...jobsByKey.values()].sort(
        (a, b) => a.bookId.localeCompare(b.bookId) || a.chapter - b.chapter
      )
      totalChapters = chapterJobs.length

      console.log('[BibleBrainAudioPackageService] Jobs de áudio preparados:', {
        bibleId,
        totalChapters,
        sample: chapterJobs.slice(0, 10),
      })

      if (totalChapters === 0) {
        throw new Error('Nenhum capítulo encontrado para esta bíblia')
      }

      const progress = () => {
        const pct = Math.min(99, Math.round((completed / totalChapters) * 100))
        if (pct - lastPersistedProgress >= 2) {
          lastPersistedProgress = pct
          BibleBrainBible.query()
            .where('bibleId', bibleId)
            .update({ audioPackageProgress: pct })
            .catch(() => {})
        }
      }

      let cursor = 0

      const worker = async () => {
        while (cursor < chapterJobs.length) {
          const job = chapterJobs[cursor++]

          try {
            const bookDir = path.join(audioDir, job.bookId)
            if (!existsSync(bookDir)) {
              mkdirSync(bookDir, { recursive: true })
            }

            const filePath = path.join(bookDir, `${job.chapter}.mp3`)

            if (existsSync(filePath)) {
              const stat = await fs.stat(filePath)
              if (stat.size > 1024) {
                downloaded++
                console.log('[BibleBrainAudioPackageService] Arquivo já existe, mantendo:', {
                  bibleId,
                  filesetId: job.filesetId,
                  bookId: job.bookId,
                  chapter: job.chapter,
                  bytes: stat.size,
                  filePath,
                })
                if (await this.importTimestampsForChapter(bibleId, job)) {
                  timestampsImported++
                }
                completed++
                progress()
                continue
              }
            }

            console.log('[BibleBrainAudioPackageService] Baixando áudio:', {
              bibleId,
              filesetId: job.filesetId,
              bookId: job.bookId,
              chapter: job.chapter,
              duration: job.duration,
              filesize: job.filesize,
              url: job.url,
            })

            const response = await fetch(job.url)
            if (!response.ok || !response.body) {
              console.log('[BibleBrainAudioPackageService] Falha HTTP ao baixar áudio:', {
                bibleId,
                filesetId: job.filesetId,
                bookId: job.bookId,
                chapter: job.chapter,
                status: response.status,
                hasBody: Boolean(response.body),
              })
              completed++
              progress()
              continue
            }

            const fileStream = createWriteStream(filePath)
            await pipeline(response.body as any, fileStream)

            const stat = await fs.stat(filePath)
            if (stat.size > 1024) {
              downloaded++
              console.log('[BibleBrainAudioPackageService] Áudio salvo:', {
                bibleId,
                filesetId: job.filesetId,
                bookId: job.bookId,
                chapter: job.chapter,
                bytes: stat.size,
                filePath,
              })
              if (await this.importTimestampsForChapter(bibleId, job)) {
                timestampsImported++
              }
            } else {
              console.log('[BibleBrainAudioPackageService] Arquivo salvo muito pequeno:', {
                bibleId,
                filesetId: job.filesetId,
                bookId: job.bookId,
                chapter: job.chapter,
                bytes: stat.size,
                filePath,
              })
            }

            completed++
            progress()
          } catch (error) {
            console.error(
              `[BibleBrainAudioPackageService] Erro no capítulo ${job.bookId} ${job.chapter}:`,
              error
            )
            completed++
            progress()
          }

          await this.sleep(API_CALL_DELAY_MS)
        }
      }

      const workerCount = Math.min(AUDIO_DOWNLOAD_CONCURRENCY, chapterJobs.length)
      await Promise.all(Array.from({ length: workerCount }, () => worker()))

      if (downloaded === 0) {
        throw new Error('Nenhum arquivo de áudio foi baixado para esta bíblia')
      }

      await BibleBrainBible.query().where('bibleId', bibleId).update({
        audioPackageStatus: 'ready',
        audioPackageProgress: 100,
        audioPackageGeneratedAt: DateTime.now().toFormat('yyyy-MM-dd HH:mm:ss'),
        audioPackageError: null,
      })

      console.log(
        `[BibleBrainAudioPackageService] Áudio de ${bibleId} pronto: ${downloaded}/${totalChapters} capítulos baixados, ${timestampsImported} capítulos com timestamps importados`
      )
    } catch (error: any) {
      console.error(`[BibleBrainAudioPackageService] Falha ao baixar áudio de ${bibleId}:`, error)
      await BibleBrainBible.query()
        .where('bibleId', bibleId)
        .update({
          audioPackageStatus: 'failed',
          audioPackageError: error?.message || String(error),
        })
        .catch(() => {})
    } finally {
      this.buildingIds.delete(bibleId)
    }
  }
}
