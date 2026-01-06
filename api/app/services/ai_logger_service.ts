import fs from 'node:fs/promises'
import path from 'node:path'

export class AILoggerService {
  private logsDir: string

  constructor() {
    this.logsDir = path.join(process.cwd(), 'logs')
  }

  /**
   * Salva o log de uma requisição à IA
   */
  async logAIRequest(data: {
    timestamp: string
    userId: number
    userEmail: string
    prompt: string
    response: any
    success: boolean
    error?: string
  }): Promise<void> {
    try {
      // Garantir que o diretório existe
      await fs.mkdir(this.logsDir, { recursive: true })

      // Nome do arquivo com timestamp
      const filename = `ai-request-${Date.now()}.json`
      const filepath = path.join(this.logsDir, filename)

      // Salvar JSON formatado
      await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf-8')

      console.log(`📝 Log salvo em: ${filepath}`)

      // Também adicionar ao arquivo de log geral
      const logLine = `\n[${data.timestamp}] ${data.success ? '✅ SUCCESS' : '❌ ERROR'} - User: ${data.userEmail} - ${data.success ? 'Plan generated' : data.error}\n`
      const generalLogPath = path.join(this.logsDir, 'ai-requests.log')

      await fs.appendFile(generalLogPath, logLine, 'utf-8')
    } catch (error) {
      console.error('❌ Erro ao salvar log:', error)
      // Não lançar erro para não afetar a operação principal
    }
  }

  /**
   * Salva resposta bruta da IA para debug
   */
  async logRawAIResponse(data: {
    timestamp: string
    userId: number
    prompt: string
    rawResponse: string
    parsed?: any
    parseError?: string
  }): Promise<void> {
    try {
      await fs.mkdir(this.logsDir, { recursive: true })

      const filename = `ai-raw-${Date.now()}.json`
      const filepath = path.join(this.logsDir, filename)

      await fs.writeFile(
        filepath,
        JSON.stringify(
          {
            ...data,
            rawResponsePreview: data.rawResponse.substring(0, 500) + '...',
            fullRawResponse: data.rawResponse,
          },
          null,
          2
        ),
        'utf-8'
      )

      console.log(`📝 Raw response salva em: ${filepath}`)
    } catch (error) {
      console.error('❌ Erro ao salvar raw response:', error)
    }
  }
}

export default new AILoggerService()
