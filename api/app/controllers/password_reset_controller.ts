import PasswordReset from '#models/password_reset'
import User from '#models/user'
import emailService from '#services/email_service'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'

export default class PasswordResetController {
  /**
   * Solicitar reset de senha
   * POST /password/forgot
   */
  async requestReset({ request, response }: HttpContext) {
    try {
      const { email } = request.only(['email'])

      if (!email) {
        return response.badRequest({
          success: false,
          message: 'Email é obrigatório',
        })
      }

      // Verificar se usuário existe
      const user = await User.findBy('email', email)
      if (!user) {
        // Por segurança, não revelar se o email existe
        return response.ok({
          success: true,
          message: 'Se o email existir, você receberá instruções para redefinir sua senha.',
        })
      }

      // Gerar token aleatório de 6 dígitos
      const token = Math.floor(100000 + Math.random() * 900000).toString()

      // Invalidar tokens anteriores não usados
      await PasswordReset.query().where('email', email).where('used', false).update({ used: true })

      // Criar novo token (expira em 30 minutos)
      await PasswordReset.create({
        email,
        token,
        expiresAt: DateTime.now().plus({ minutes: 30 }),
        used: false,
      })

      // Enviar email com o token
      try {
        await emailService.sendPasswordResetToken(email, token, user.fullName || 'Usuário')
        console.log(`[PasswordReset] E-mail enviado para ${email}`)
      } catch (emailError) {
        console.error('[PasswordReset] Erro ao enviar e-mail:', emailError)
        // Continua mesmo se o e-mail falhar, para não bloquear o usuário
      }

      return response.ok({
        success: true,
        message: 'Token de recuperação enviado para seu email.',
      })
    } catch (error) {
      console.error('[PasswordResetController] Erro ao solicitar reset:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao processar solicitação',
        error: error.message,
      })
    }
  }

  /**
   * Verificar token
   * POST /password/verify-token
   */
  async verifyToken({ request, response }: HttpContext) {
    try {
      const { email, token } = request.only(['email', 'token'])

      if (!email || !token) {
        return response.badRequest({
          success: false,
          message: 'Email e token são obrigatórios',
        })
      }

      // Buscar token válido
      const resetToken = await PasswordReset.query()
        .where('email', email)
        .where('token', token)
        .where('used', false)
        .where('expires_at', '>', DateTime.now().toSQL())
        .first()

      if (!resetToken) {
        return response.badRequest({
          success: false,
          message: 'Token inválido ou expirado',
        })
      }

      return response.ok({
        success: true,
        message: 'Token válido',
      })
    } catch (error) {
      console.error('[PasswordResetController] Erro ao verificar token:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao verificar token',
        error: error.message,
      })
    }
  }

  /**
   * Redefinir senha
   * POST /password/reset
   */
  async resetPassword({ request, response }: HttpContext) {
    try {
      const { email, token, newPassword } = request.only(['email', 'token', 'newPassword'])

      if (!email || !token || !newPassword) {
        return response.badRequest({
          success: false,
          message: 'Email, token e nova senha são obrigatórios',
        })
      }

      if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
        return response.badRequest({
          success: false,
          message: 'A senha deve ter pelo menos 8 caracteres, com letras e números',
        })
      }

      // Buscar token válido
      const resetToken = await PasswordReset.query()
        .where('email', email)
        .where('token', token)
        .where('used', false)
        .where('expires_at', '>', DateTime.now().toSQL())
        .first()

      if (!resetToken) {
        return response.badRequest({
          success: false,
          message: 'Token inválido ou expirado',
        })
      }

      // Buscar usuário
      const user = await User.findBy('email', email)
      if (!user) {
        return response.notFound({
          success: false,
          message: 'Usuário não encontrado',
        })
      }

      // Atualizar senha
      user.password = newPassword
      await user.save()

      // Marcar token como usado
      resetToken.used = true
      await resetToken.save()

      console.log(`[PasswordReset] Senha redefinida para ${email}`)

      return response.ok({
        success: true,
        message: 'Senha redefinida com sucesso!',
      })
    } catch (error) {
      console.error('[PasswordResetController] Erro ao redefinir senha:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao redefinir senha',
        error: error.message,
      })
    }
  }
}
