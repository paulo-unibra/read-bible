import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import { loginValidator, registerValidator } from '#validators/auth'

export default class AuthController {
  /**
   * Registrar novo usuário
   */
  async register({ request, response }: HttpContext) {
    try {
      const data = await request.validateUsing(registerValidator)

      // Verificar se email já existe
      const existingUser = await User.findBy('email', data.email)
      if (existingUser) {
        return response.conflict({
          success: false,
          message: 'Email já cadastrado'
        })
      }

      // Criar usuário
      const user = await User.create({
        fullName: data.name,
        email: data.email,
        password: data.password
      })

      // Gerar token de acesso
      const token = await User.accessTokens.create(user)

      return response.created({
        success: true,
        message: 'Usuário cadastrado com sucesso',
        data: {
          user: {
            id: user.id,
            name: user.fullName,
            email: user.email
          },
          token: token.value!.release()
        }
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Erro ao cadastrar usuário',
        error: error.messages || error.message
      })
    }
  }

  /**
   * Fazer login
   */
  async login({ request, response }: HttpContext) {
    try {
      const { email, password } = await request.validateUsing(loginValidator)

      // Verificar credenciais
      const user = await User.verifyCredentials(email, password)

      // Gerar token
      const token = await User.accessTokens.create(user)

      return response.ok({
        success: true,
        message: 'Login realizado com sucesso',
        data: {
          user: {
            id: user.id,
            name: user.fullName,
            email: user.email
          },
          token: token.value!.release()
        }
      })
    } catch (error) {
      return response.unauthorized({
        success: false,
        message: 'Email ou senha incorretos'
      })
    }
  }

  /**
   * Fazer logout
   */
  async logout({ auth, response }: HttpContext) {
    try {
      const user = auth.user!
      await User.accessTokens.delete(user, user.currentAccessToken.identifier)

      return response.ok({
        success: true,
        message: 'Logout realizado com sucesso'
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Erro ao fazer logout'
      })
    }
  }

  /**
   * Obter dados do usuário autenticado
   */
  async me({ auth, response }: HttpContext) {
    try {
      const user = auth.user!

      return response.ok({
        success: true,
        data: {
          id: user.id,
          name: user.fullName,
          email: user.email
        }
      })
    } catch (error) {
      return response.unauthorized({
        success: false,
        message: 'Não autenticado'
      })
    }
  }
}
