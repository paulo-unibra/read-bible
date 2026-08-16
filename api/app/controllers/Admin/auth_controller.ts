import AuditLog from '#models/audit_log'
import EmailLog from '#models/email_log'
import Permission from '#models/permission'
import Role from '#models/role'
import User from '#models/user'
import emailQueueService from '#services/email_queue_service'
import ReadingPlanConverterService from '#services/reading_plan_converter_service'
import ReadingPlanRecalculatorService from '#services/reading_plan_recalculator_service'
import type { HttpContext } from '@adonisjs/core/http'
import hash from '@adonisjs/core/services/hash'

export default class AuthController {
  /**
   * Login para painel administrativo
   * Verifica se usuário tem permissão "acessar_painel_administrativo"
   */
  async login({ request, response }: HttpContext) {
    const { email, password } = request.only(['email', 'password'])

    try {
      // Buscar usuário por email
      const user = await User.findBy('email', email)

      if (!user) {
        await AuditLog.create({
          userId: null,
          action: 'admin.login_failed',
          entityType: 'user',
          entityId: null,
          details: { email, reason: 'user_not_found' },
          ipAddress: request.ip(),
          userAgent: request.header('user-agent') || null,
        }).catch(() => {})

        return response.unauthorized({
          error: 'Credenciais inválidas',
        })
      }

      // Verificar senha
      const isPasswordValid = await hash.verify(user.password, password)

      if (!isPasswordValid) {
        await AuditLog.create({
          userId: user.id,
          action: 'admin.login_failed',
          entityType: 'user',
          entityId: user.id,
          details: { email, reason: 'wrong_password' },
          ipAddress: request.ip(),
          userAgent: request.header('user-agent') || null,
        }).catch(() => {})

        return response.unauthorized({
          error: 'Credenciais inválidas',
        })
      }

      // Carregar roles do usuário
      await user.load('roles')

      // Verificar se tem permissão para acessar painel
      const hasAccess = await user.hasPermission('acessar_painel_administrativo')

      if (!hasAccess) {
        return response.forbidden({
          error: 'Você não tem permissão para acessar o painel administrativo',
        })
      }

      await AuditLog.create({
        userId: user.id,
        action: 'admin.login',
        entityType: 'user',
        entityId: user.id,
        details: { email },
        ipAddress: request.ip(),
        userAgent: request.header('user-agent') || null,
      }).catch(() => {})

      // Gerar token de acesso
      const token = await User.accessTokens.create(user, ['admin:*'], {
        expiresIn: '7 days',
      })

      // Extrair permissões de todas as roles
      const permissions = user.roles.flatMap((role) => role.permissions)
      const uniquePermissions = [...new Set(permissions)]

      return response.ok({
        type: 'bearer',
        token: token.value!.release(),
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          roles: user.roles.map((role) => ({
            id: role.id,
            name: role.name,
            slug: role.slug,
          })),
          permissions: uniquePermissions,
        },
      })
    } catch (error) {
      console.error('Erro no login admin:', error)
      return response.internalServerError({
        error: 'Erro ao processar login',
      })
    }
  }

  /**
   * Logout do painel administrativo
   */
  async logout({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    await User.accessTokens.delete(user, user.currentAccessToken.identifier)

    return response.ok({ message: 'Logout realizado com sucesso' })
  }

  /**
   * Retorna informações do usuário autenticado
   */
  async me({ auth, response }: HttpContext) {
    try {
      const user = auth.getUserOrFail()
      await user.load('roles')

      const permissions = user.roles.flatMap((role) => role.permissions)
      const uniquePermissions = [...new Set(permissions)]

      return response.ok({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        roles: user.roles.map((role) => ({
          id: role.id,
          name: role.name,
          slug: role.slug,
        })),
        permissions: uniquePermissions,
      })
    } catch (error) {
      return response.unauthorized({ error: 'Não autenticado' })
    }
  }

  /**
   * Lista todos os usuários do sistema com status de leitura
   */
  async listUsers({ request, response }: HttpContext) {
    try {
      const { readingStatus } = request.qs()

      const users = await User.query().preload('roles').orderBy('id', 'asc')

      // Buscar planos de leitura e progresso para cada usuário
      const usersWithStatus = await Promise.all(
        users.map(async (user) => {
          const readingPlan = await user
            .related('readingPlans')
            .query()
            .where('is_active', true)
            .first()

          let status = 'no_plan' // Não criou plano
          let currentDay = 0
          let totalDays = 0
          let completedDays = 0
          let daysLate = 0

          if (readingPlan) {
            currentDay = readingPlan.currentDay || 0
            totalDays = readingPlan.totalDays || 0
            completedDays = readingPlan.completedChapters || 0

            // Verificar se já iniciou
            const hasProgress = completedDays > 0

            if (!hasProgress) {
              status = 'not_started' // Não iniciou o plano
            } else {
              // Calcular quantos dias se passaram desde o início
              const startDate = readingPlan.startDate.toJSDate()
              startDate.setHours(0, 0, 0, 0)
              const today = new Date()
              today.setHours(0, 0, 0, 0)
              const daysPassed = Math.floor(
                (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
              )
              const expectedDay = Math.min(daysPassed + 1, totalDays)

              if (currentDay < expectedDay) {
                daysLate = expectedDay - currentDay
                status = 'late' // Leitura atrasada
              } else {
                status = 'up_to_date' // Leitura em dia
              }
            }
          }

          return {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            roles: user.roles.map((role) => ({
              id: role.id,
              name: role.name,
              slug: role.slug,
            })),
            createdAt: user.createdAt.toISO(),
            readingStatus: {
              status,
              currentDay,
              totalDays,
              completedDays,
              daysLate,
              planName: readingPlan?.name || null,
            },
          }
        })
      )

      // Filtrar por status se especificado
      const filteredUsers = readingStatus
        ? usersWithStatus.filter((user) => user.readingStatus.status === readingStatus)
        : usersWithStatus

      return response.ok(filteredUsers)
    } catch (error) {
      console.error('Erro ao listar usuários:', error)
      return response.internalServerError({
        error: 'Erro ao listar usuários',
      })
    }
  }

  /**
   * Retorna estatísticas de status de leitura dos usuários
   */
  async usersStats({ response }: HttpContext) {
    try {
      const users = await User.query().preload('roles').orderBy('id', 'asc')

      // Contadores para cada status
      const stats = {
        all: 0,
        up_to_date: 0,
        late: 0,
        not_started: 0,
        no_plan: 0,
      }

      // Analisar status de cada usuário
      await Promise.all(
        users.map(async (user) => {
          const readingPlan = await user
            .related('readingPlans')
            .query()
            .where('is_active', true)
            .first()

          let status = 'no_plan'

          if (readingPlan) {
            const completedDays = readingPlan.completedChapters || 0
            const hasProgress = completedDays > 0

            if (!hasProgress) {
              status = 'not_started'
            } else {
              const startDate = readingPlan.startDate.toJSDate()
              startDate.setHours(0, 0, 0, 0)
              const today = new Date()
              today.setHours(0, 0, 0, 0)
              const daysPassed = Math.floor(
                (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
              )
              const currentDay = readingPlan.currentDay || 0
              const totalDays = readingPlan.totalDays || 0
              const expectedDay = Math.min(daysPassed + 1, totalDays)

              if (currentDay < expectedDay) {
                status = 'late'
              } else {
                status = 'up_to_date'
              }
            }
          }

          stats.all++
          stats[status as keyof typeof stats]++
        })
      )

      return response.ok(stats)
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error)
      return response.internalServerError({
        error: 'Erro ao buscar estatísticas',
      })
    }
  }

  /**
   * Envia e-mail personalizado para usuários selecionados
   * POST /admin/users/send-custom-email
   */
  async sendCustomEmail({ request, response }: HttpContext) {
    try {
      const { userIds, subject, message } = request.only(['userIds', 'subject', 'message'])

      // Validações
      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return response.badRequest({
          error: 'É necessário selecionar pelo menos um usuário',
        })
      }

      if (!subject || !subject.trim()) {
        return response.badRequest({
          error: 'O assunto do e-mail é obrigatório',
        })
      }

      if (!message || !message.trim()) {
        return response.badRequest({
          error: 'A mensagem do e-mail é obrigatória',
        })
      }

      // Buscar usuários
      const users = await User.query().whereIn('id', userIds)

      if (users.length === 0) {
        return response.notFound({
          error: 'Nenhum usuário encontrado',
        })
      }

      // Adicionar e-mails à fila para envio controlado
      const emailJobs = users.map((user) => ({
        userId: user.id,
        email: user.email,
        subject: subject.trim(),
        message: message.trim(),
        userName: user.fullName || 'Usuário',
      }))

      // Adicionar à fila (processamento assíncrono com rate limit)
      emailQueueService.addToQueue(emailJobs)

      // Retornar resposta imediata informando que os e-mails foram enfileirados
      return response.ok({
        success: true,
        message: `${users.length} e-mail(s) adicionado(s) à fila de envio`,
        queued: users.length,
        note: 'Os e-mails serão enviados gradualmente para respeitar o limite de taxa. Verifique os logs para acompanhar o progresso.',
      })
    } catch (error) {
      console.error('Erro ao enviar e-mails personalizados:', error)
      return response.internalServerError({
        error: 'Erro ao enviar e-mails',
      })
    }
  }

  /**
   * Lista todas as permissões do sistema
   */
  async listPermissions({ response }: HttpContext) {
    try {
      const permissions = await Permission.query().orderBy('category', 'asc').orderBy('name', 'asc')

      return response.ok(permissions)
    } catch (error) {
      console.error('Erro ao listar permissões:', error)
      return response.internalServerError({
        error: 'Erro ao listar permissões',
      })
    }
  }

  /**
   * Cria uma nova permissão
   */
  async createPermission({ request, response }: HttpContext) {
    try {
      const { name, slug, description, category, isActive } = request.only([
        'name',
        'slug',
        'description',
        'category',
        'isActive',
      ])

      // Validar campos obrigatórios
      if (!name || !slug) {
        return response.badRequest({
          error: 'Nome e slug são obrigatórios',
        })
      }

      // Verificar se slug já existe
      const existingPermission = await Permission.findBy('slug', slug)
      if (existingPermission) {
        return response.conflict({
          error: 'Já existe uma permissão com este slug',
        })
      }

      // Criar permissão
      const permission = await Permission.create({
        name,
        slug,
        description: description || null,
        category: category || 'general',
        isActive: isActive !== undefined ? isActive : true,
      })

      return response.created(permission)
    } catch (error) {
      console.error('Erro ao criar permissão:', error)
      return response.internalServerError({
        error: 'Erro ao criar permissão',
      })
    }
  }

  /**
   * Lista todas as roles do sistema
   */
  async listRoles({ response }: HttpContext) {
    try {
      const roles = await Role.query().orderBy('name', 'asc')

      return response.ok(roles)
    } catch (error) {
      console.error('Erro ao listar roles:', error)
      return response.internalServerError({
        error: 'Erro ao listar roles',
      })
    }
  }

  /**
   * Adiciona uma permissão a uma role
   */
  async addPermissionToRole({ request, response, params }: HttpContext) {
    try {
      const { roleId } = params
      const { permissionSlug } = request.only(['permissionSlug'])

      if (!permissionSlug) {
        return response.badRequest({
          error: 'Slug da permissão é obrigatório',
        })
      }

      // Buscar role
      const role = await Role.find(roleId)
      if (!role) {
        return response.notFound({
          error: 'Role não encontrada',
        })
      }

      // Verificar se permissão existe
      const permission = await Permission.findBy('slug', permissionSlug)
      if (!permission) {
        return response.notFound({
          error: 'Permissão não encontrada',
        })
      }

      // Verificar se já tem a permissão
      if (role.permissions.includes(permissionSlug)) {
        return response.conflict({
          error: 'Role já possui esta permissão',
        })
      }

      // Adicionar permissão
      role.permissions = [...role.permissions, permissionSlug]
      await role.save()

      return response.ok(role)
    } catch (error) {
      console.error('Erro ao adicionar permissão à role:', error)
      return response.internalServerError({
        error: 'Erro ao adicionar permissão à role',
      })
    }
  }

  /**
   * Remove uma permissão de uma role
   */
  async removePermissionFromRole({ request, response, params }: HttpContext) {
    try {
      const { roleId } = params
      const { permissionSlug } = request.only(['permissionSlug'])

      if (!permissionSlug) {
        return response.badRequest({
          error: 'Slug da permissão é obrigatório',
        })
      }

      // Buscar role
      const role = await Role.find(roleId)
      if (!role) {
        return response.notFound({
          error: 'Role não encontrada',
        })
      }

      // Verificar se tem a permissão
      if (!role.permissions.includes(permissionSlug)) {
        return response.notFound({
          error: 'Role não possui esta permissão',
        })
      }

      // Remover permissão
      role.permissions = role.permissions.filter((p) => p !== permissionSlug)
      await role.save()

      return response.ok(role)
    } catch (error) {
      console.error('Erro ao remover permissão da role:', error)
      return response.internalServerError({
        error: 'Erro ao remover permissão da role',
      })
    }
  }

  /**
   * Converte um plano de leitura de um usuário para 365 dias
   */
  async convertUserPlanTo365Days({ request, response, params }: HttpContext) {
    try {
      const { userId } = params
      const { planId } = request.only(['planId'])

      if (!planId) {
        return response.badRequest({
          error: 'ID do plano é obrigatório',
        })
      }

      console.log(`🔄 [Admin] Convertendo plano ${planId} do usuário ${userId} para 365 dias...`)

      const converterService = new ReadingPlanConverterService()
      const result = await converterService.convertTo365Days(planId)

      if (result.success) {
        console.log(`✅ [Admin] Plano ${planId} convertido com sucesso!`)
        return response.ok(result)
      } else {
        console.log(`❌ [Admin] Falha ao converter plano ${planId}:`, result.message)
        return response.badRequest(result)
      }
    } catch (error) {
      console.error('❌ [Admin] Erro ao converter plano:', error)
      return response.internalServerError({
        error: 'Erro ao converter plano para 365 dias',
        message: error.message,
      })
    }
  }

  /**
   * Lista planos de um usuário que podem ser convertidos (> 365 dias)
   */
  async getUserConvertiblePlans({ response, params }: HttpContext) {
    try {
      const { userId } = params

      const user = await User.find(userId)
      if (!user) {
        return response.notFound({
          error: 'Usuário não encontrado',
        })
      }

      await user.load('readingPlans', (query) => {
        query.whereNull('deleted_at')
        query.where('total_days', '>', 365).orderBy('total_days', 'desc')
      })

      const plans = user.readingPlans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        type: plan.type,
        totalDays: plan.totalDays,
        currentDay: plan.currentDay,
        startDate: plan.startDate,
        endDate: plan.endDate,
        isActive: plan.isActive,
        completedChapters: plan.completedChapters,
      }))

      return response.ok({
        userId: user.id,
        userEmail: user.email,
        convertiblePlans: plans,
      })
    } catch (error) {
      console.error('❌ [Admin] Erro ao listar planos convertíveis:', error)
      return response.internalServerError({
        error: 'Erro ao listar planos convertíveis',
      })
    }
  }

  /**
   * Recalcula os livros de um plano de leitura corrigindo erros
   */
  async recalculateUserPlanBooks({ request, response, params }: HttpContext) {
    try {
      const { userId } = params
      const { planId } = request.only(['planId'])

      let targetPlanId = planId

      // Se não foi fornecido planId, buscar o plano ativo do usuário
      if (!targetPlanId) {
        const { default: ReadingPlan } = await import('#models/reading_plan')
        const activePlan = await ReadingPlan.query()
          .where('user_id', userId)
          .where('is_active', true)
          .whereNull('deleted_at')
          .first()

        if (!activePlan) {
          return response.badRequest({
            error: 'Usuário não possui plano ativo',
          })
        }

        targetPlanId = activePlan.id
      }

      console.log(`🔄 [Admin] Recalculando livros do plano ${targetPlanId} do usuário ${userId}...`)

      const recalculatorService = new ReadingPlanRecalculatorService()
      const result = await recalculatorService.recalculatePlanBooks(targetPlanId)

      if (result.success) {
        console.log(`✅ [Admin] Plano ${targetPlanId} recalculado com sucesso!`)
        return response.ok(result)
      } else {
        console.log(`❌ [Admin] Falha ao recalcular plano ${targetPlanId}:`, result.message)
        return response.badRequest(result)
      }
    } catch (error) {
      console.error('❌ [Admin] Erro ao recalcular plano:', error)
      return response.internalServerError({
        error: 'Erro ao recalcular livros do plano',
        message: error.message,
      })
    }
  }

  /**
   * Verifica se um plano tem problemas de livros duplicados
   */
  async checkUserPlanForDuplicates({ response, params }: HttpContext) {
    try {
      const { planId } = params

      const recalculatorService = new ReadingPlanRecalculatorService()
      const result = await recalculatorService.checkPlanForDuplicateBooks(Number.parseInt(planId))

      return response.ok(result)
    } catch (error) {
      console.error('❌ [Admin] Erro ao verificar duplicatas:', error)
      return response.internalServerError({
        error: 'Erro ao verificar duplicatas no plano',
      })
    }
  }

  /**
   * Lista logs de envio de e-mails com filtros
   * GET /admin/email-logs
   */
  async listEmailLogs({ request, response }: HttpContext) {
    try {
      const { status, page = 1, limit = 50 } = request.qs()

      const query = EmailLog.query().preload('user').orderBy('created_at', 'desc')

      // Filtrar por status se especificado
      if (status && ['success', 'failed'].includes(status)) {
        query.where('status', status)
      }

      // Paginação
      const logs = await query.paginate(page, limit)

      return response.ok({
        data: logs.all().map((log) => ({
          id: log.id,
          userId: log.userId,
          email: log.email,
          subject: log.subject,
          message: log.message,
          status: log.status,
          errorMessage: log.errorMessage,
          sentAt: log.sentAt?.toISO(),
          createdAt: log.createdAt.toISO(),
          user: log.user
            ? {
                id: log.user.id,
                fullName: log.user.fullName,
                email: log.user.email,
              }
            : null,
        })),
        meta: logs.getMeta(),
      })
    } catch (error) {
      console.error('Erro ao listar logs de e-mail:', error)
      return response.internalServerError({
        error: 'Erro ao listar logs de e-mail',
      })
    }
  }

  /**
   * Reenvia e-mails que falharam anteriormente
   * POST /admin/email-logs/retry
   */
  async retryFailedEmails({ request, response }: HttpContext) {
    try {
      const { logIds } = request.only(['logIds'])

      if (!logIds || !Array.isArray(logIds) || logIds.length === 0) {
        return response.badRequest({
          error: 'É necessário selecionar pelo menos um log',
        })
      }

      // Buscar logs de e-mails falhados
      const logs = await EmailLog.query()
        .whereIn('id', logIds)
        .where('status', 'failed')
        .preload('user')

      if (logs.length === 0) {
        return response.notFound({
          error: 'Nenhum log de falha encontrado',
        })
      }

      // Adicionar e-mails à fila para reenvio controlado
      const emailJobs = logs.map((log) => ({
        userId: log.userId,
        email: log.email,
        subject: log.subject,
        message: log.message,
        userName: log.user?.fullName || 'Usuário',
      }))

      // Adicionar à fila (processamento assíncrono com rate limit)
      emailQueueService.addToQueue(emailJobs)

      // Retornar resposta imediata informando que os e-mails foram enfileirados
      return response.ok({
        success: true,
        message: `${logs.length} e-mail(s) adicionado(s) à fila de reenvio`,
        queued: logs.length,
        note: 'Os e-mails serão reenviados gradualmente para respeitar o limite de taxa. Verifique os logs para acompanhar o progresso.',
      })
    } catch (error) {
      console.error('Erro ao reenviar e-mails:', error)
      return response.internalServerError({
        error: 'Erro ao reenviar e-mails',
      })
    }
  }

  /**
   * Obtém estatísticas de envio de e-mails
   * GET /admin/email-logs/stats
   */
  async getEmailStats({ response }: HttpContext) {
    try {
      const [successCount, failedCount, totalCount] = await Promise.all([
        EmailLog.query().where('status', 'success').count('* as total'),
        EmailLog.query().where('status', 'failed').count('* as total'),
        EmailLog.query().count('* as total'),
      ])

      return response.ok({
        success: Number(successCount[0].$extras.total),
        failed: Number(failedCount[0].$extras.total),
        total: Number(totalCount[0].$extras.total),
      })
    } catch (error) {
      console.error('Erro ao buscar estatísticas de e-mail:', error)
      return response.internalServerError({
        error: 'Erro ao buscar estatísticas',
      })
    }
  }
}
