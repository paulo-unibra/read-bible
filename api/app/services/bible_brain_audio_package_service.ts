import BibleBrainBible, { BibleBrainFilesetSummary } from '#models/bible_brain_bible'
import bibleBrainService from '#services/bible_brain_service'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import fs from 'node:fs/promises'
import { createWriteStream, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'

const AUDIO_DOWNLOAD_CONCURRENCY = 4
const API_CALL_DELAY_MS = 1200

export default class BibleBrainAudioPackageService {
  private static buildingIds = new Set<string>()

  static isBuilding(bibleId: string): boolean {
    return this.buildingIds.has(bibleId)
  }

  static async requestAudioPackage(bibleId: string): Promise<BibleBrainBible> {
    const bible = await BibleBrainBible.findByOrFail('bibleId', bibleId)

    if (bible.audioPackageStatus === 'ready') {
      return bible
    }

    if (bible.audioPackageStatus === 'generating' || this.buildingIds.has(bibleId)) {
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

  private static pickBestAudioFileset(
    filesets: BibleBrainFilesetSummary[]
  ): BibleBrainFilesetSummary | null {
    const audioFilesets = filesets.filter((f) => f.type?.startsWith('audio'))
    if (audioFilesets.length === 0) return null

    return (
      audioFilesets.find((f) => f.container === 'mp3' || f.codec === 'mp3') ||
      audioFilesets.find((f) => f.type !== 'audio_drama_stream') ||
      audioFilesets[0]
    )
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private static async buildAudioPackage(bibleId: string) {
    let totalChapters = 0
    let completed = 0
    let lastPersistedProgress = 0

    try {
      const bible = await BibleBrainBible.findByOrFail('bibleId', bibleId)

      const fileset = this.pickBestAudioFileset(bible.filesets)
      if (!fileset) {
        throw new Error('Nenhum fileset de áudio disponível para esta bíblia')
      }

      const audioDir = path.join(app.publicPath('uploads/bible-brain-audio'), bibleId)
      if (!existsSync(audioDir)) {
        mkdirSync(audioDir, { recursive: true })
      }

      const booksResponse = await bibleBrainService.getBooks(bibleId)
      const books = booksResponse.data

      const chapterJobs: { bookId: string; chapter: number }[] = []
      for (const book of books) {
        for (const chapter of book.chapters) {
          chapterJobs.push({ bookId: book.book_id, chapter })
        }
      }
      totalChapters = chapterJobs.length

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
                completed++
                progress()
                continue
              }
            }

            const audioInfo = await bibleBrainService.getAudioChapterInfo(
              fileset.id,
              job.bookId,
              job.chapter
            )

            if (!audioInfo.data || audioInfo.data.length === 0) {
              completed++
              progress()
              continue
            }

            const downloadUrl = audioInfo.data[0].path

            const response = await fetch(downloadUrl)
            if (!response.ok || !response.body) {
              completed++
              progress()
              continue
            }

            const fileStream = createWriteStream(filePath)
            await pipeline(response.body as any, fileStream)

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

      await BibleBrainBible.query().where('bibleId', bibleId).update({
        audioPackageStatus: 'ready',
        audioPackageProgress: 100,
        audioPackageGeneratedAt: DateTime.now().toFormat('yyyy-MM-dd HH:mm:ss'),
        audioPackageError: null,
      })

      console.log(
        `[BibleBrainAudioPackageService] Áudio de ${bibleId} pronto: ${totalChapters} capítulos baixados`
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
