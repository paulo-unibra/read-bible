import BibleBrainBible from '#models/bible_brain_bible'
import bibleBrainService, { BibleBrainListItem } from '#services/bible_brain_service'
import { DateTime } from 'luxon'

export type BibleBrainSyncStatus = 'idle' | 'running' | 'completed' | 'failed'

interface SyncState {
  status: BibleBrainSyncStatus
  processed: number
  total: number
  currentPage: number
  totalPages: number
  startedAt: string | null
  finishedAt: string | null
  error: string | null
}

const PAGE_LIMIT = 50

/**
 * Sincroniza o catálogo de bíblias da BibleBrain com a nossa base local.
 * Roda como um job em memória (mesmo padrão do QueueService), sequencial,
 * paginando toda a listagem `/bibles` e fazendo upsert por `bible_id`.
 */
export default class BibleBrainSyncService {
  private static state: SyncState = {
    status: 'idle',
    processed: 0,
    total: 0,
    currentPage: 0,
    totalPages: 0,
    startedAt: null,
    finishedAt: null,
    error: null,
  }

  static getStatus(): SyncState {
    return { ...this.state }
  }

  static startSync(): { started: boolean; status: SyncState } {
    if (this.state.status === 'running') {
      return { started: false, status: this.getStatus() }
    }

    this.state = {
      status: 'running',
      processed: 0,
      total: 0,
      currentPage: 0,
      totalPages: 0,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      error: null,
    }

    // Roda em background; o status é consultado via polling pelo admin.
    this.runSync().catch((error) => {
      this.state.status = 'failed'
      this.state.error = error?.message || String(error)
      this.state.finishedAt = new Date().toISOString()
      console.error('[BibleBrainSyncService] Falha na sincronização:', error)
    })

    return { started: true, status: this.getStatus() }
  }

  private static async runSync() {
    console.log('[BibleBrainSyncService] Iniciando sincronização com a BibleBrain...')
    let page = 1

    while (true) {
      const response = await bibleBrainService.listBibles({ page, limit: PAGE_LIMIT })
      const pagination = response.meta?.pagination
      const total = pagination?.total ?? response.data.length
      const totalPages = pagination?.last_page ?? pagination?.total_pages ?? page

      this.state.total = total
      this.state.totalPages = totalPages
      this.state.currentPage = page

      for (const item of response.data) {
        try {
          await this.upsertBible(item)
        } catch (error) {
          console.error(`[BibleBrainSyncService] Erro ao salvar bíblia ${item.abbr}:`, error)
        }
        this.state.processed++
      }

      console.log(
        `[BibleBrainSyncService] Página ${page}/${totalPages} processada (${this.state.processed}/${total})`
      )

      if (response.data.length === 0 || page >= totalPages) {
        break
      }

      page++
      // Pequena pausa para não sobrecarregar a API externa
      await new Promise((resolve) => setTimeout(resolve, 150))
    }

    this.state.status = 'completed'
    this.state.finishedAt = new Date().toISOString()
    console.log(
      `[BibleBrainSyncService] Sincronização concluída: ${this.state.processed} bíblias processadas`
    )
  }

  private static async upsertBible(item: BibleBrainListItem) {
    const filesets = item.filesets?.['dbp-prod'] || []
    const hasText = filesets.some((f) => f.type?.startsWith('text'))
    const hasAudio = filesets.some((f) => f.type?.startsWith('audio'))

    const payload = {
      name: item.vname || item.name || item.abbr,
      languageName: item.language,
      languageIso: item.iso,
      languageId: item.language_id ?? null,
      countryId: item.country_id ?? null,
      bibleDate: item.date,
      filesets,
      hasText,
      hasAudio,
      syncedAt: DateTime.now(),
    }

    const existing = await BibleBrainBible.findBy('bibleId', item.abbr)

    if (existing) {
      existing.merge(payload)
      await existing.save()
    } else {
      await BibleBrainBible.create({
        bibleId: item.abbr,
        ...payload,
      })
    }
  }
}
