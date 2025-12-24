import { BaseCommand } from '@adonisjs/core/ace'
import emailService from '#services/email_service'
import { CommandOptions } from '@adonisjs/core/types/ace'

export default class TestEmail extends BaseCommand {
  static commandName = 'test:email'
  static description = 'Testa o envio de e-mail de recuperação de senha'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    this.logger.info('🧪 Testando serviço de e-mail...')

    try {
      // Verificar conexão SMTP
      this.logger.info('📡 Verificando conexão SMTP...')
      const connected = await emailService.verifyConnection()

      if (!connected) {
        this.logger.error('❌ Falha na conexão SMTP')
        return
      }

      // Enviar e-mail de teste
      this.logger.info('📧 Enviando e-mail de teste...')
      const testEmail = 'pr1999ricardo@gmail.com'
      const testToken = '123456'
      const testName = 'Usuário Teste'

      await emailService.sendPasswordResetToken(testEmail, testToken, testName)

      this.logger.success(`✅ E-mail de teste enviado com sucesso para ${testEmail}`)
      this.logger.info(`📋 Token de teste: ${testToken}`)
    } catch (error) {
      this.logger.error('❌ Erro ao enviar e-mail de teste:')
      this.logger.error(error.message)
    }
  }
}
