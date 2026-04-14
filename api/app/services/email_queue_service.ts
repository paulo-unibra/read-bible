import EmailLog from '#models/email_log'
import emailService from '#services/email_service'
import { DateTime } from 'luxon'

interface EmailJob {
  userId: number | null
  email: string
  subject: string
  message: string
  userName: string
}

class EmailQueueService {
  private queue: EmailJob[] = []
  private isProcessing = false
  private readonly RATE_LIMIT_DELAY = 600 // 600ms entre envios = ~1.6 req/s (seguro para limite de 2 req/s)

  /**
   * Adiciona e-mails à fila
   */
  async addToQueue(emails: EmailJob[]) {
    this.queue.push(...emails)
    console.log(
      `📧 [EmailQueue] ${emails.length} e-mail(s) adicionado(s) à fila. Total na fila: ${this.queue.length}`
    )

    // Iniciar processamento se não estiver rodando
    if (!this.isProcessing) {
      this.processQueue()
    }
  }

  /**
   * Processa a fila de e-mails com delay para respeitar rate limit
   */
  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return
    }

    this.isProcessing = true
    console.log(`🚀 [EmailQueue] Iniciando processamento de ${this.queue.length} e-mail(s)...`)

    while (this.queue.length > 0) {
      const job = this.queue.shift()!

      try {
        console.log(`📤 [EmailQueue] Enviando e-mail para ${job.email}...`)

        await emailService.sendCustomEmail(job.email, job.subject, job.message, job.userName)

        console.log(`✅ [EmailQueue] E-mail enviado com sucesso para ${job.email}`)

        // Registrar sucesso no log
        await EmailLog.create({
          userId: job.userId,
          email: job.email,
          subject: job.subject,
          message: job.message,
          status: 'success',
          errorMessage: null,
          sentAt: DateTime.now(),
        })
      } catch (error) {
        const errorMsg = error.message || 'Erro desconhecido'
        console.error(`❌ [EmailQueue] Erro ao enviar e-mail para ${job.email}:`, errorMsg)

        // Registrar falha no log
        await EmailLog.create({
          userId: job.userId,
          email: job.email,
          subject: job.subject,
          message: job.message,
          status: 'failed',
          errorMessage: errorMsg,
          sentAt: null,
        })
      }

      // Delay para respeitar rate limit (2 req/s = 500ms mínimo)
      // Usando 600ms para ter margem de segurança
      if (this.queue.length > 0) {
        console.log(
          `⏱️  [EmailQueue] Aguardando ${this.RATE_LIMIT_DELAY}ms antes do próximo envio...`
        )
        await this.sleep(this.RATE_LIMIT_DELAY)
      }
    }

    this.isProcessing = false
    console.log(`✨ [EmailQueue] Fila processada completamente!`)
  }

  /**
   * Retorna estatísticas da fila
   */
  getStats() {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
    }
  }

  /**
   * Helper para aguardar
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

// Singleton
export default new EmailQueueService()
