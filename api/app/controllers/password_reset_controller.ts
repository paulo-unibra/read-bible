import PasswordReset from '#models/password_reset'
import AuditLog from '#models/audit_log'
import User from '#models/user'
import emailService from '#services/email_service'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import { randomInt } from 'node:crypto'
import { matchesPublicToken, hashPublicToken } from '#utils/public_token'

const genericResetMessage =
  'Se o email estiver cadastrado, você receberá instruções para redefinir sua senha.'

export default class PasswordResetController {
  /**
   * Solicitar reset de senha
   * POST /password/forgot
   */
  async requestReset({ request, response }: HttpContext) {
    try {
      const email = String(request.input('email', '')).trim().toLowerCase()

      if (!email) {
        return response.badRequest({
          success: false,
          message: 'Email é obrigatório',
        })
      }

      // Verificar se usuário existe
      const user = await User.findBy('email', email)
      if (!user) return response.ok({ success: true, message: genericResetMessage })

      const recentRequest = await PasswordReset.query()
        .where('email', email)
        .orderBy('created_at', 'desc')
        .first()
      if (recentRequest && Date.now() - recentRequest.createdAt.toMillis() < 2 * 60_000) {
        return response.ok({ success: true, message: genericResetMessage })
      }

      // Gerar token aleatório de 6 dígitos usando CSPRNG.
      const token = randomInt(100000, 1000000).toString()
      const hashedToken = hashPublicToken(token)

      // Invalidar tokens anteriores não usados
      await PasswordReset.query().where('email', email).where('used', false).update({ used: true })

      await AuditLog.create({
        userId: user.id,
        action: 'password.request_reset',
        entityType: 'user',
        entityId: user.id,
        details: { email },
        ipAddress: request.ip(),
        userAgent: request.header('user-agent') || null,
      })

      // Criar novo token (expira em 30 minutos)
      await PasswordReset.create({
        email,
        token: hashedToken,
        expiresAt: DateTime.now().plus({ minutes: 15 }),
        used: false,
        attempts: 0,
      })

      void emailService
        .sendPasswordResetToken(email, token, user.fullName || 'Usuário')
        .catch((emailError) => console.error('[PasswordReset] Erro ao enviar e-mail:', emailError))

      return response.ok({ success: true, message: genericResetMessage })
    } catch (error) {
      console.error('[PasswordResetController] Erro ao solicitar reset:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao processar solicitação',
      })
    }
  }

  /**
   * Verificar token
   * POST /password/verify-token
   */
  async verifyToken({ request, response }: HttpContext) {
    try {
      const email = String(request.input('email', '')).trim().toLowerCase()
      const token = String(request.input('token', '')).trim()

      if (!email || !token) {
        return response.badRequest({
          success: false,
          message: 'Email e token são obrigatórios',
        })
      }

      const resetToken = await PasswordReset.query()
        .where('email', email)
        .where('used', false)
        .where('expires_at', '>', DateTime.now().toSQL())
        .orderBy('created_at', 'desc')
        .first()

      if (!resetToken || resetToken.attempts >= 5) {
        return response.badRequest({
          success: false,
          message: 'Token inválido ou expirado',
        })
      }

      if (!matchesPublicToken(resetToken.token, token)) {
        const updated = await PasswordReset.query()
          .where('id', resetToken.id)
          .where('used', false)
          .where('attempts', '<', 5)
          .increment('attempts', 1)
        if (updated) {
          const current = await PasswordReset.find(resetToken.id)
          if (current && current.attempts >= 5) {
            current.used = true
            await current.save()
          }
        }
        return response.badRequest({ success: false, message: 'Token inválido ou expirado' })
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
      })
    }
  }

  /**
   * Redefinir senha
   * POST /password/reset
   */
  async resetPassword({ request, response }: HttpContext) {
    try {
      const email = String(request.input('email', '')).trim().toLowerCase()
      const token = String(request.input('token', '')).trim()
      const newPassword = String(request.input('newPassword', ''))

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

      const resetToken = await PasswordReset.query()
        .where('email', email)
        .where('used', false)
        .where('expires_at', '>', DateTime.now().toSQL())
        .orderBy('created_at', 'desc')
        .first()

      if (!resetToken || resetToken.attempts >= 5) {
        return response.badRequest({
          success: false,
          message: 'Token inválido ou expirado',
        })
      }

      if (!matchesPublicToken(resetToken.token, token)) {
        const updated = await PasswordReset.query()
          .where('id', resetToken.id)
          .where('used', false)
          .where('attempts', '<', 5)
          .increment('attempts', 1)
        if (updated) {
          const current = await PasswordReset.find(resetToken.id)
          if (current && current.attempts >= 5) {
            current.used = true
            await current.save()
          }
        }
        return response.badRequest({ success: false, message: 'Token inválido ou expirado' })
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

      await AuditLog.create({
        userId: user.id,
        action: 'password.reset',
        entityType: 'user',
        entityId: user.id,
        details: { email: user.email },
        ipAddress: request.ip(),
        userAgent: request.header('user-agent') || null,
      })

      // Marcar token como usado
      resetToken.used = true
      await resetToken.save()

      return response.ok({
        success: true,
        message: 'Senha redefinida com sucesso!',
      })
    } catch (error) {
      console.error('[PasswordResetController] Erro ao redefinir senha:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao redefinir senha',
      })
    }
  }
}
