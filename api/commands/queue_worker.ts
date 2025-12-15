import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import QueueService from '#services/queue_service'

export default class QueueWorker extends BaseCommand {
  static commandName = 'queue:listen'
  static description = 'Processa a fila de jobs de questionários'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    this.logger.info('Iniciando processamento da fila...')
    this.logger.info('Pressione Ctrl+C para parar')

    // Inicia o processamento da fila
    QueueService.processQueue()

    this.logger.success('Worker da fila iniciado com sucesso!')

    // Mantém o processo rodando
    await new Promise(() => {})
  }
}
