import env from '#start/env'
import { Resend } from 'resend'

class EmailService {
  private resend: Resend

  constructor() {
    this.resend = new Resend(env.get('RESEND_API_KEY'))
  }

  async sendPasswordResetToken(email: string, token: string, userName: string) {
    const fromEmail = env.get('RESEND_FROM_EMAIL')
    const fromName = env.get('RESEND_FROM_NAME', 'Bíblia em Foco')

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .container {
              background-color: #f9f9f9;
              border-radius: 10px;
              padding: 30px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .header h1 {
              color: #2196F3;
              margin: 0;
              font-size: 28px;
            }
            .token-box {
              background-color: #fff;
              border: 2px solid #2196F3;
              border-radius: 8px;
              padding: 20px;
              text-align: center;
              margin: 30px 0;
            }
            .token {
              font-size: 36px;
              font-weight: bold;
              letter-spacing: 8px;
              color: #2196F3;
              font-family: 'Courier New', monospace;
            }
            .info {
              background-color: #e3f2fd;
              border-left: 4px solid #2196F3;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              font-size: 14px;
              color: #666;
            }
            .warning {
              color: #f44336;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📖 Bíblia em Foco</h1>
            </div>

            <p>Olá, <strong>${userName}</strong>!</p>

            <p>Você solicitou a recuperação de senha da sua conta no aplicativo <strong>Bíblia em Foco</strong>.</p>

            <div class="token-box">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">Seu código de recuperação é:</p>
              <div class="token">${token}</div>
            </div>

            <div class="info">
              <p style="margin: 0;"><strong>⏰ Atenção:</strong> Este código expira em <strong>30 minutos</strong>.</p>
            </div>

            <p>Digite este código no aplicativo para redefinir sua senha.</p>

            <p class="warning">⚠️ Se você não solicitou esta recuperação, ignore este e-mail.</p>

            <div class="footer">
              <p>Este é um e-mail automático, por favor não responda.</p>
              <p>© ${new Date().getFullYear()} Bíblia em Foco - Todos os direitos reservados</p>
            </div>
          </div>
        </body>
        </html>
      `

    const textContent = `
Olá, ${userName}!

Você solicitou a recuperação de senha da sua conta no aplicativo Bíblia em Foco.

Seu código de recuperação é: ${token}

ATENÇÃO: Este código expira em 30 minutos.

Digite este código no aplicativo para redefinir sua senha.

⚠️ Se você não solicitou esta recuperação, ignore este e-mail.

---
Este é um e-mail automático, por favor não responda.
© ${new Date().getFullYear()} Bíblia em Foco - Todos os direitos reservados
      `.trim()

    try {
      const { data, error } = await this.resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: email,
        subject: 'Código de Recuperação de Senha - Bíblia em Foco',
        html: htmlContent,
        text: textContent,
      })

      if (error) {
        console.error('❌ Erro ao enviar e-mail:', error)
        throw error
      }

      console.log('✅ E-mail enviado com sucesso:', data?.id)
      return { success: true, messageId: data?.id }
    } catch (error) {
      console.error('❌ Erro ao enviar e-mail:', error)
      throw error
    }
  }

  async verifyConnection() {
    try {
      // Resend não tem um método de verificação, então vamos simular
      if (!env.get('RESEND_API_KEY')) {
        throw new Error('RESEND_API_KEY não configurada')
      }
      console.log('✅ Resend configurado e pronto para enviar e-mails')
      return true
    } catch (error) {
      console.error('❌ Erro na configuração do Resend:', error)
      return false
    }
  }

  /**
   * Envia e-mail personalizado sobre status de leitura
   */
  async sendReadingStatusEmail(
    email: string,
    userName: string,
    status: 'em_dia' | 'adiantado' | 'atrasado',
    statusDetails: {
      planName: string
      daysCompleted: number
      expectedDays: number
      totalDays: number
      percentComplete: number
    }
  ) {
    // Debug dos valores recebidos
    console.log('📧 [EmailService] Enviando e-mail:', {
      email,
      userName,
      status,
      statusDetails: {
        planName: statusDetails.planName,
        daysCompleted: statusDetails.daysCompleted,
        expectedDays: statusDetails.expectedDays,
        totalDays: statusDetails.totalDays,
        percentComplete: statusDetails.percentComplete,
      },
      tipos: {
        daysCompleted: typeof statusDetails.daysCompleted,
        expectedDays: typeof statusDetails.expectedDays,
        totalDays: typeof statusDetails.totalDays,
        percentComplete: typeof statusDetails.percentComplete,
      },
    })

    const isDev = env.get('NODE_ENV') !== 'production'
    const recipient = isDev ? env.get('TEST_EMAIL_RECIPIENT', email) : email

    const statusConfig = {
      em_dia: {
        emoji: '✅',
        title: 'Parabéns! Sua leitura está em dia',
        color: '#4CAF50',
        message: 'Continue assim! Você está mantendo o ritmo perfeito de leitura.',
        encouragement:
          'Sua dedicação é inspiradora. A Palavra de Deus está transformando sua vida a cada dia!',
      },
      adiantado: {
        emoji: '🌟',
        title: 'Excelente! Você está adiantado',
        color: '#2196F3',
        message: 'Você está lendo mais do que o planejado! Que exemplo maravilhoso de dedicação.',
        encouragement:
          'Sua sede pela Palavra de Deus é admirável. Continue nessa jornada abençoada!',
      },
      atrasado: {
        emoji: '📖',
        title: 'Não desista! Volte à leitura',
        color: '#FF9800',
        message:
          'Sabemos que a vida pode ser corrida, mas a Palavra de Deus está esperando por você.',
        encouragement:
          'Não há atraso que não possa ser recuperado. Deus te espera de braços abertos!',
      },
    }

    const config = statusConfig[status]
    const progressPercent = Math.round(statusDetails.percentComplete)

    const mailOptions = {
      from: `"${env.get('SMTP_FROM_NAME')}" <${env.get('SMTP_FROM')}>`,
      to: recipient,
      subject: `${config.emoji} ${config.title} - Bíblia em Foco`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f5f5f5;
            }
            .container {
              background-color: #ffffff;
              border-radius: 12px;
              padding: 40px;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 3px solid ${config.color};
              padding-bottom: 20px;
            }
            .header h1 {
              color: ${config.color};
              margin: 0;
              font-size: 28px;
            }
            .greeting {
              font-size: 18px;
              margin-bottom: 20px;
            }
            .status-box {
              background: linear-gradient(135deg, ${config.color}15 0%, ${config.color}05 100%);
              border-left: 4px solid ${config.color};
              border-radius: 8px;
              padding: 25px;
              margin: 25px 0;
            }
            .status-title {
              font-size: 24px;
              font-weight: bold;
              color: ${config.color};
              margin-bottom: 15px;
            }
            .stats-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 15px;
              margin: 20px 0;
            }
            .stat-card {
              background-color: #f9f9f9;
              border-radius: 8px;
              padding: 15px;
              text-align: center;
            }
            .stat-number {
              font-size: 32px;
              font-weight: bold;
              color: ${config.color};
              display: block;
            }
            .stat-label {
              font-size: 14px;
              color: #666;
              margin-top: 5px;
            }
            .progress-bar {
              background-color: #e0e0e0;
              border-radius: 10px;
              height: 20px;
              margin: 20px 0;
              overflow: hidden;
            }
            .progress-fill {
              background: linear-gradient(90deg, ${config.color} 0%, ${config.color}cc 100%);
              height: 100%;
              width: ${progressPercent}%;
              transition: width 0.3s ease;
              display: flex;
              align-items: center;
              justify-content: flex-end;
              padding-right: 10px;
              color: white;
              font-weight: bold;
              font-size: 12px;
            }
            .message-box {
              background-color: #f9f9f9;
              border-radius: 8px;
              padding: 20px;
              margin: 25px 0;
              font-style: italic;
            }
            .cta-button {
              display: inline-block;
              background-color: ${config.color};
              color: white;
              padding: 15px 30px;
              border-radius: 8px;
              text-decoration: none;
              font-weight: bold;
              margin: 20px 0;
              text-align: center;
            }
            .footer {
              text-align: center;
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e0e0e0;
              font-size: 14px;
              color: #666;
            }
            .verse {
              background-color: #f0f4f8;
              border-left: 3px solid ${config.color};
              padding: 15px;
              margin: 20px 0;
              font-style: italic;
              color: #555;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${config.emoji} Bíblia em Foco</h1>
            </div>

            <div class="greeting">
              <p>Olá, <strong>${userName}</strong>! 👋</p>
            </div>

            <div class="status-box">
              <div class="status-title">${config.title}</div>
              <p>${config.message}</p>
            </div>

            <div class="stats-grid">
              <div class="stat-card">
                <span class="stat-number">${statusDetails.daysCompleted}</span>
                <span class="stat-label">Dias Lidos</span>
              </div>
              <div class="stat-card">
                <span class="stat-number">${statusDetails.expectedDays}</span>
                <span class="stat-label">Dias Esperados</span>
              </div>
            </div>

            <div class="progress-bar">
              <div class="progress-fill">${progressPercent}%</div>
            </div>

            <p style="text-align: center; color: #666; font-size: 14px;">
              ${statusDetails.daysCompleted} de ${statusDetails.totalDays} dias completados
            </p>

            <div class="verse">
              "Lâmpada para os meus pés é a tua palavra e, luz para os meus caminhos."
              <br><strong>Salmos 119:105</strong>
            </div>

            <div class="message-box">
              <p><strong>${config.encouragement}</strong></p>
            </div>

            <div style="text-align: center;">
              <p>Continue sua jornada de leitura no app:</p>
              <a href="#" class="cta-button">Abrir Bíblia em Foco</a>
            </div>

            <div class="footer">
              <p><strong>Plano de Leitura:</strong> ${statusDetails.planName}</p>
              <p style="margin-top: 20px;">Este é um e-mail automático, por favor não responda.</p>
              <p>© ${new Date().getFullYear()} Bíblia em Foco - Todos os direitos reservados</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Olá, ${userName}!

${config.emoji} ${config.title}

${config.message}

Estatísticas do seu plano "${statusDetails.planName}":
- Dias lidos: ${statusDetails.daysCompleted}
- Dias esperados: ${statusDetails.expectedDays}
- Progresso: ${progressPercent}% (${statusDetails.daysCompleted} de ${statusDetails.totalDays} dias)

${config.encouragement}

"Lâmpada para os meus pés é a tua palavra e, luz para os meus caminhos."
Salmos 119:105

Continue sua jornada no app Bíblia em Foco!

---
Este é um e-mail automático, por favor não responda.
© ${new Date().getFullYear()} Bíblia em Foco - Todos os direitos reservados
      `.trim(),
    }

    try {
      const info = await this.transporter.sendMail(mailOptions)
      console.log(`✅ E-mail de ${status} enviado para ${recipient}:`, info.messageId)
      return { success: true, messageId: info.messageId, recipient }
    } catch (error) {
      console.error(`❌ Erro ao enviar e-mail de ${status}:`, error)
      throw error
    }
  }
}

export default new EmailService()
