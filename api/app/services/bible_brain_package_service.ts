import BibleBrainBible, { BibleBrainFilesetSummary } from '#models/bible_brain_bible'
import bibleBrainService from '#services/bible_brain_service'
import Database from 'better-sqlite3'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import fs from 'node:fs/promises'
import { existsSync, mkdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { usfmBookIdToNumber } from '../utils/usfm_books.js'

const CHAPTER_CONCURRENCY = 6
const PROGRESS_PERSIST_STEP = 2 // só grava no banco a cada 2% de progresso

interface ChapterJob {
  bookNumber: number
  bookId: string
  chapter: number
}

/**
 * Gera (uma única vez por bíblia) um pacote .db no MESMO formato usado pelas
 * bíblias baixadas do Google Drive (tabela `Bible` com Book/Chapter/Verse/Scripture),
 * para que o app possa reutilizar 100% do fluxo de leitura já existente
 * (BibleReaderService) sem nenhuma alteração nele.
 *
 * Fluxo: busca os livros/capítulos na BibleBrain, baixa o texto capítulo a
 * capítulo (com concorrência limitada), monta o SQLite localmente e sobe
 * para o Cloud Storage. Da segunda vez em diante, o pacote já pronto é
 * reaproveitado (fica salvo em `bible_brain_bibles.package_url`).
 */
export default class BibleBrainPackageService {
  private static buildingIds = new Set<string>()

  static isBuilding(bibleId: string): boolean {
    return this.buildingIds.has(bibleId)
  }

  /**
   * Garante que a geração do pacote está em andamento (ou já pronta) e
   * retorna o estado atual do registro. Não bloqueia: a geração roda em
   * background e o cliente consulta o progresso via polling.
   */
  static async requestPackage(bibleId: string): Promise<BibleBrainBible> {
    const bible = await BibleBrainBible.findByOrFail('bibleId', bibleId)

    if (bible.packageStatus === 'ready' && bible.packageUrl) {
      return bible
    }

    if (bible.packageStatus === 'generating' || this.buildingIds.has(bibleId)) {
      return bible
    }

    if (!bible.hasText) {
      throw new Error('Esta bíblia não possui texto disponível para leitura')
    }

    bible.packageStatus = 'generating'
    bible.packageProgress = 0
    bible.packageError = null
    await bible.save()

    this.buildingIds.add(bibleId)
    this.buildPackage(bibleId).catch((error) => {
      console.error(`[BibleBrainPackageService] Erro não tratado ao gerar ${bibleId}:`, error)
    })

    return bible
  }

  private static pickBestTextFileset(
    filesets: BibleBrainFilesetSummary[]
  ): BibleBrainFilesetSummary | null {
    const textFilesets = filesets.filter((f) => f.type?.startsWith('text'))
    if (textFilesets.length === 0) return null

    const sizeRank: Record<string, number> = { C: 4, OTNT: 4, NTOT: 4, NT: 2, OT: 2, NTP: 1, OTP: 1 }
    const typeRank = (type: string) => (type === 'text_plain' ? 2 : type === 'text_format' ? 1 : 0)

    return [...textFilesets].sort((a, b) => {
      const rankDiff = typeRank(b.type) - typeRank(a.type)
      if (rankDiff !== 0) return rankDiff
      return (sizeRank[b.size || ''] || 0) - (sizeRank[a.size || ''] || 0)
    })[0]
  }

  private static async buildPackage(bibleId: string) {
    const bible = await BibleBrainBible.findByOrFail('bibleId', bibleId)
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bible-brain-'))
    const tmpFile = path.join(tmpDir, `${bibleId}.db`)
    let db: Database.Database | null = null

    try {
      const fileset = this.pickBestTextFileset(bible.filesets)
      if (!fileset) {
        throw new Error('Nenhum fileset de texto disponível para esta bíblia')
      }

      console.log(`[BibleBrainPackageService] Gerando pacote de ${bibleId} usando fileset ${fileset.id}`)

      const booksResponse = await bibleBrainService.getBooks(bibleId)
      const books = booksResponse.data.filter((b) => usfmBookIdToNumber(b.book_id) !== null)

      if (books.length === 0) {
        throw new Error('Nenhum livro do cânon protestante padrão foi encontrado para esta bíblia')
      }

      const chapterJobs: ChapterJob[] = []
      for (const book of books) {
        const bookNumber = usfmBookIdToNumber(book.book_id)!
        for (const chapter of book.chapters) {
          chapterJobs.push({ bookNumber, bookId: book.book_id, chapter })
        }
      }

      db = new Database(tmpFile)
      db.pragma('journal_mode = WAL')
      db.exec(`
        CREATE TABLE Bible (
          Book INTEGER NOT NULL,
          Chapter INTEGER NOT NULL,
          Verse INTEGER NOT NULL,
          Scripture TEXT
        );
        CREATE INDEX idx_bible_book_chapter ON Bible(Book, Chapter);
      `)

      const insertStmt = db.prepare(
        'INSERT INTO Bible (Book, Chapter, Verse, Scripture) VALUES (?, ?, ?, ?)'
      )
      const dbRef = db
      const insertMany = dbRef.transaction((rows: [number, number, number, string][]) => {
        for (const row of rows) insertStmt.run(...row)
      })

      let completed = 0
      let lastPersistedProgress = 0
      let cursor = 0

      const worker = async () => {
        while (cursor < chapterJobs.length) {
          const job = chapterJobs[cursor++]

          try {
            const content = await bibleBrainService.getChapterContent(
              fileset.id,
              job.bookId,
              job.chapter
            )
            const rows: [number, number, number, string][] = (content.data || [])
              .filter(
                (v: any) => typeof v.verse_start === 'number' && typeof v.verse_text === 'string'
              )
              .map((v: any) => [job.bookNumber, job.chapter, v.verse_start, v.verse_text])

            if (rows.length > 0) insertMany(rows)
          } catch (error) {
            console.error(
              `[BibleBrainPackageService] Erro no capítulo ${job.bookId} ${job.chapter} de ${bibleId}:`,
              error
            )
          }

          completed++
          const progress = Math.min(99, Math.round((completed / chapterJobs.length) * 100))
          if (progress - lastPersistedProgress >= PROGRESS_PERSIST_STEP) {
            lastPersistedProgress = progress
            await BibleBrainBible.query()
              .where('bibleId', bibleId)
              .update({ packageProgress: progress })
              .catch(() => {})
          }
        }
      }

      const workerCount = Math.min(CHAPTER_CONCURRENCY, chapterJobs.length)
      await Promise.all(Array.from({ length: workerCount }, () => worker()))

      const verseCount = (db.prepare('SELECT COUNT(*) as count FROM Bible').get() as { count: number })
        .count
      db.close()
      db = null

      if (verseCount === 0) {
        throw new Error('Não foi possível obter nenhum versículo desta bíblia na BibleBrain')
      }

      const packageDir = app.publicPath('uploads/bible-brain-packages')
      if (!existsSync(packageDir)) {
        mkdirSync(packageDir, { recursive: true })
      }
      const permanentPath = path.join(packageDir, `${bibleId}.db`)
      await fs.copyFile(tmpFile, permanentPath)

      const stat = await fs.stat(permanentPath)

      await BibleBrainBible.query().where('bibleId', bibleId).update({
        packageStatus: 'ready',
        packageProgress: 100,
        packageUrl: permanentPath,
        packageSize: stat.size,
        packageGeneratedAt: DateTime.now().toFormat('yyyy-MM-dd HH:mm:ss'),
        packageError: null,
      })

      console.log(
        `[BibleBrainPackageService] Pacote de ${bibleId} pronto: ${verseCount} versículos, ${stat.size} bytes`
      )
    } catch (error: any) {
      console.error(`[BibleBrainPackageService] Falha ao gerar pacote de ${bibleId}:`, error)
      await BibleBrainBible.query()
        .where('bibleId', bibleId)
        .update({
          packageStatus: 'failed',
          packageError: error?.message || String(error),
        })
        .catch(() => {})
    } finally {
      this.buildingIds.delete(bibleId)
      if (db) {
        try {
          db.close()
        } catch {
          // ignora
        }
      }
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
    }
  }
}
