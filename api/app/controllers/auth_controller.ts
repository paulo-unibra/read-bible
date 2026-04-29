import User from '#models/user'
import { loginValidator, registerValidator } from '#validators/auth'
import type { HttpContext } from '@adonisjs/core/http'
import { cuid } from '@adonisjs/core/helpers'
import app from '@adonisjs/core/services/app'
import { unlink } from 'node:fs/promises'
import { createReadStream, existsSync } from 'node:fs'
import path from 'node:path'

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
          message: 'Email já cadastrado',
        })
      }

      // Criar usuário
      const user = await User.create({
        fullName: data.name,
        email: data.email,
        password: data.password,
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
            email: user.email,
          },
          token: token.value!.release(),
        },
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Erro ao cadastrar usuário',
        error: error.messages || error.message,
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
            email: user.email,
          },
          token: token.value!.release(),
        },
      })
    } catch (error) {
      return response.unauthorized({
        success: false,
        message: 'Email ou senha incorretos',
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
        message: 'Logout realizado com sucesso',
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Erro ao fazer logout',
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
          email: user.email,
          profilePicture: user.profilePicture || null,
        },
      })
    } catch (error) {
      return response.unauthorized({
        success: false,
        message: 'Não autenticado',
      })
    }
  }

  /**
   * Obter estatísticas do usuário
   */
  async stats({ auth, response }: HttpContext) {
    try {
      const user = auth.user!

      // Carregar planos de leitura do usuário
      await user.load('readingPlans')

      // Buscar plano ativo
      const activePlan = user.readingPlans.find((plan) => plan.isActive)

      let stats = {
        totalChaptersRead: 0,
        totalQuizzesCompleted: 0,
        currentStreak: 0,
        longestStreak: 0,
        readingStatus: 'sem-plano' as 'em-dia' | 'atrasado' | 'sem-plano',
        daysLate: 0,
        completedDays: 0,
        totalDays: 0,
        planProgress: 0,
      }

      if (activePlan) {
        // Buscar todas as leituras do plano
        const { default: db } = await import('@adonisjs/lucid/services/db')

        const planReadings = await db
          .from('reading_progress')
          .where('reading_plan_id', activePlan.id)
          .orderBy('day')

        // Contar leituras completadas
        const completedReadings = planReadings.filter((r: any) => r.is_completed)

        // Calcular capítulos lidos
        const totalChaptersRead = completedReadings.reduce((sum: number, reading: any) => {
          return sum + (reading.end_chapter - reading.start_chapter + 1)
        }, 0)

        // Calcular dias únicos completados
        const completedDaysSet = new Set(completedReadings.map((r: any) => r.day))
        const completedDays = completedDaysSet.size

        // Calcular total de dias do plano
        const totalDaysSet = new Set(planReadings.map((r: any) => r.day))
        const totalDays = totalDaysSet.size

        // Calcular streaks (sequência de dias consecutivos)
        const { currentStreak, longestStreak } = this.calculateStreaks(planReadings)

        // Calcular status de leitura
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const planStartDate = new Date(activePlan.startDate.toJSDate())
        planStartDate.setHours(0, 0, 0, 0)

        const daysPassed = Math.floor(
          (today.getTime() - planStartDate.getTime()) / (1000 * 60 * 60 * 24)
        )

        const expectedDayByDate = Math.min(daysPassed + 1, totalDays)
        const isLate = completedDays < expectedDayByDate - 1
        const daysLate = isLate ? expectedDayByDate - 1 - completedDays : 0

        stats = {
          totalChaptersRead,
          currentStreak,
          longestStreak,
          readingStatus: isLate ? 'atrasado' : 'em-dia',
          daysLate,
          completedDays,
          totalDays,
          planProgress: totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0,
          totalQuizzesCompleted: 0, // Será calculado abaixo
        }
      }

      // Buscar questionários completados (score >= 7)
      const { default: db } = await import('@adonisjs/lucid/services/db')
      const quizResults = await db
        .from('quiz_results')
        .where('user_id', user.id)
        .where('score', '>=', 7)
        .count('* as total')

      stats.totalQuizzesCompleted = quizResults[0]?.total || 0

      return response.ok({
        success: true,
        data: stats,
      })
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error)
      return response.badRequest({
        success: false,
        message: 'Erro ao buscar estatísticas do usuário',
      })
    }
  }

  /**
   * Calcular sequências de dias consecutivos
   */
  private calculateStreaks(planReadings: any[]) {
    // Agrupar por dia e verificar se está completo
    const dayMap = new Map<number, boolean>()

    for (const reading of planReadings) {
      const day = reading.day
      if (!dayMap.has(day)) {
        dayMap.set(day, true)
      }
      // Se alguma leitura do dia não está completa, o dia não está completo
      if (!reading.is_completed) {
        dayMap.set(day, false)
      }
    }

    // Converter para array ordenado
    const days = Array.from(dayMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([day, isCompleted]) => ({ day, isCompleted }))

    let currentStreak = 0
    let longestStreak = 0
    let tempStreak = 0

    for (let i = 0; i < days.length; i++) {
      if (days[i].isCompleted) {
        tempStreak++
        if (tempStreak > longestStreak) {
          longestStreak = tempStreak
        }
      } else {
        // Se chegou em um dia não completado, resetar streak temporário
        if (i === 0 || !days[i - 1].isCompleted) {
          tempStreak = 0
        } else {
          currentStreak = tempStreak
          tempStreak = 0
        }
      }
    }

    // Se terminou com uma sequência, ela é a atual
    if (tempStreak > 0) {
      currentStreak = tempStreak
    }

    return { currentStreak, longestStreak }
  }

  /**
   * Atualizar perfil do usuário
   */
  async updateProfile({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const { name } = request.only(['name'])

      if (name) {
        user.fullName = name
        await user.save()
      }

      return response.ok({
        success: true,
        message: 'Perfil atualizado com sucesso',
        data: {
          id: user.id,
          name: user.fullName,
          email: user.email,
          profilePicture: user.profilePicture || null,
        },
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Erro ao atualizar perfil',
      })
    }
  }

  /**
   * Upload de foto de perfil
   */
  async uploadProfilePicture({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!

      const image = request.file('image', {
        size: '5mb',
        extnames: ['jpg', 'jpeg', 'png', 'webp'],
      })

      if (!image) {
        return response.badRequest({
          success: false,
          message: 'Nenhuma imagem enviada',
        })
      }

      if (!image.isValid) {
        return response.badRequest({
          success: false,
          message: image.errors.map((e) => e.message).join(', '),
        })
      }

      // Remover imagem anterior se existir
      if (user.profilePicture) {
        const oldFileName = path.basename(user.profilePicture)
        const oldFilePath = app.publicPath(`uploads/profile-pictures/${oldFileName}`)
        if (existsSync(oldFilePath)) {
          await unlink(oldFilePath)
        }
      }

      // Gerar nome único para o arquivo
      const fileName = `${cuid()}.${image.extname}`

      // Mover o arquivo para o diretório de uploads
      await image.move(app.publicPath('uploads/profile-pictures'), {
        name: fileName,
        overwrite: true,
      })

      // Salvar o caminho relativo no banco
      const relativePath = `/uploads/profile-pictures/${fileName}`
      user.profilePicture = relativePath
      await user.save()

      return response.ok({
        success: true,
        message: 'Foto de perfil atualizada com sucesso',
        data: {
          profilePicture: relativePath,
        },
      })
    } catch (error) {
      console.error('Erro ao fazer upload da foto de perfil:', error)
      return response.badRequest({
        success: false,
        message: 'Erro ao fazer upload da imagem',
      })
    }
  }

  /**
   * Servir foto de perfil publicamente
   */
  async getProfilePicture({ params, response }: HttpContext) {
    try {
      const fileName = String(params.fileName || '').trim()

      if (!fileName || !/^[a-z0-9_-]+\.(jpg|jpeg|png|webp)$/i.test(fileName)) {
        return response.badRequest({
          success: false,
          message: 'Nome de arquivo inválido',
        })
      }

      const filePath = app.publicPath(`uploads/profile-pictures/${fileName}`)
      if (!existsSync(filePath)) {
        return response.notFound({
          success: false,
          message: 'Imagem não encontrada',
        })
      }

      const ext = path.extname(fileName).toLowerCase()
      const contentTypeByExt: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
      }

      response.header(
        'Content-Type',
        contentTypeByExt[ext] || 'application/octet-stream'
      )
      response.header('Cache-Control', 'public, max-age=86400')

      return response.stream(createReadStream(filePath))
    } catch (error) {
      console.error('Erro ao servir foto de perfil:', error)
      return response.status(500).send({
        success: false,
        message: 'Erro ao carregar imagem de perfil',
      })
    }
  }

  /**
   * Remover foto de perfil
   */
  async removeProfilePicture({ auth, response }: HttpContext) {
    try {
      const user = auth.user!

      if (user.profilePicture) {
        const oldFileName = path.basename(user.profilePicture)
        const oldFilePath = app.publicPath(`uploads/profile-pictures/${oldFileName}`)
        if (existsSync(oldFilePath)) {
          await unlink(oldFilePath)
        }
        user.profilePicture = null
        await user.save()
      }

      return response.ok({
        success: true,
        message: 'Foto de perfil removida com sucesso',
      })
    } catch (error) {
      console.error('Erro ao remover foto de perfil:', error)
      return response.badRequest({
        success: false,
        message: 'Erro ao remover a foto de perfil',
      })
    }
  }
}
