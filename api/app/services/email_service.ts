import nodemailer from 'nodemailer'
import env from '#start/env'

class EmailService {
  private transporter: nodemailer.Transporter

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: env.get('SMTP_HOST'),
      port: env.get('SMTP_PORT'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: env.get('SMTP_USER'),
        pass: env.get('SMTP_PASSWORD'),
      },
    })
  }

  async sendPasswordResetToken(email: string, token: string, userName: string) {
    const mailOptions = {
      from: `"${env.get('SMTP_FROM_NAME')}" <${env.get('SMTP_FROM')}>`,
      to: email,
      subject: 'Código de Recuperação de Senha - Bíblia em Foco',
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
      `,
      text: `
Olá, ${userName}!

Você solicitou a recuperação de senha da sua conta no aplicativo Bíblia em Foco.

Seu código de recuperação é: ${token}

ATENÇÃO: Este código expira em 30 minutos.

Digite este código no aplicativo para redefinir sua senha.

⚠️ Se você não solicitou esta recuperação, ignore este e-mail.

---
Este é um e-mail automático, por favor não responda.
© ${new Date().getFullYear()} Bíblia em Foco - Todos os direitos reservados
      `.trim(),
    }

    try {
      const info = await this.transporter.sendMail(mailOptions)
      console.log('✅ E-mail enviado com sucesso:', info.messageId)
      return { success: true, messageId: info.messageId }
    } catch (error) {
      console.error('❌ Erro ao enviar e-mail:', error)
      throw error
    }
  }

  async verifyConnection() {
    try {
      await this.transporter.verify()
      console.log('✅ Servidor SMTP pronto para enviar e-mails')
      return true
    } catch (error) {
      console.error('❌ Erro na conexão SMTP:', error)
      return false
    }
  }
}

export default new EmailService()
