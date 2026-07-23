import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import BibleBrainSyncService from '#services/bible_brain_sync_service'

export default class BibleBrainSync extends BaseCommand {
  static commandName = 'bible-brain:sync'
  static description = 'Sincroniza o catálogo de bíblias da BibleBrain com a base local'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    this.logger.info('Iniciando sincronização com a BibleBrain...')

    const { started } = BibleBrainSyncService.startSync()
    if (!started) {
      this.logger.warning('Uma sincronização já está em andamento.')
    }

    while (BibleBrainSyncService.getStatus().status === 'running') {
      const status = BibleBrainSyncService.getStatus()
      this.logger.info(
        `Página ${status.currentPage}/${status.totalPages || '?'} — ${status.processed}/${status.total || '?'} bíblias processadas`
      )
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }

    const finalStatus = BibleBrainSyncService.getStatus()

    if (finalStatus.status === 'completed') {
      this.logger.success(
        `Sincronização concluída: ${finalStatus.processed} bíblias processadas`
      )
    } else if (finalStatus.status === 'failed') {
      this.logger.error(`Sincronização falhou: ${finalStatus.error}`)
    }
  }
}
