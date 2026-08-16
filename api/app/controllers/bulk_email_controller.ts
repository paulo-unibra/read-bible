import ReadingPlan from '#models/reading_plan'
import User from '#models/user'
import emailService from '#services/email_service'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

export default class BulkEmailController {
  /**
   * Busca usuários filtrados por status de leitura
   * GET /admin/bulk-email/users
   */
  async getUsersByStatus({ request, response, auth }: HttpContext) {
    try {
      await auth.authenticate()

      // Verificar permissão
      const user = auth.user!
      const hasPermission = await user.hasPermission('gerenciar_usuarios')

      if (!hasPermission) {
        return response.forbidden({
          success: false,
          message: 'Você não tem permissão para acessar esta funcionalidade',
        })
      }

      const { status } = request.qs()

      if (!status || !['em_dia', 'adiantado', 'atrasado'].includes(status)) {
        return response.badRequest({
          success: false,
          message: 'Status inválido. Use: em_dia, adiantado ou atrasado',
        })
      }

      let usersWithPlans: any[] = []

      if (status === 'em_dia') {
        // Usuários com leitura em dia
        const result = await db.rawQuery(`
          SELECT
            u.id,
            u.email,
            u.full_name as fullName,
            rp.id as planId,
            rp.name as planName,
            rp.total_days as totalDays,
            rp.start_date as startDate,
            rp.end_date as endDate,
            (
              SELECT COUNT(*)
              FROM reading_progress prog
              WHERE prog.reading_plan_id = rp.id
                AND prog.is_completed = true
            ) as daysCompleted,
            GREATEST(1, CEIL(
              rp.total_days *
              (DATEDIFF(CURDATE(), DATE(rp.start_date)) /
               GREATEST(1, DATEDIFF(DATE(rp.end_date), DATE(rp.start_date))))
            )) as expectedDays
          FROM users u
          INNER JOIN reading_plans rp ON rp.user_id = u.id
          WHERE rp.is_active = true
            AND rp.start_date IS NOT NULL
            AND rp.end_date IS NOT NULL
            AND YEAR(rp.start_date) > 1900
            AND YEAR(rp.end_date) > 1900
            AND DATE(rp.start_date) <= CURDATE()
            AND DATE(rp.end_date) >= CURDATE()
          HAVING daysCompleted >= expectedDays
            AND daysCompleted < expectedDays + 3
        `)
        usersWithPlans = result[0]
      } else if (status === 'adiantado') {
        // Usuários com leitura adiantada (3+ dias à frente)
        const result = await db.rawQuery(`
          SELECT
            u.id,
            u.email,
            u.full_name as fullName,
            rp.id as planId,
            rp.name as planName,
            rp.total_days as totalDays,
            rp.start_date as startDate,
            rp.end_date as endDate,
            (
              SELECT COUNT(*)
              FROM reading_progress prog
              WHERE prog.reading_plan_id = rp.id
                AND prog.is_completed = true
            ) as daysCompleted,
            GREATEST(1, CEIL(
              rp.total_days *
              (DATEDIFF(CURDATE(), DATE(rp.start_date)) /
               GREATEST(1, DATEDIFF(DATE(rp.end_date), DATE(rp.start_date))))
            )) as expectedDays
          FROM users u
          INNER JOIN reading_plans rp ON rp.user_id = u.id
          WHERE rp.is_active = true
            AND rp.start_date IS NOT NULL
            AND rp.end_date IS NOT NULL
            AND YEAR(rp.start_date) > 1900
            AND YEAR(rp.end_date) > 1900
            AND DATE(rp.start_date) <= CURDATE()
            AND DATE(rp.end_date) >= CURDATE()
          HAVING daysCompleted >= expectedDays + 3
        `)
        usersWithPlans = result[0]
      } else if (status === 'atrasado') {
        // Usuários com leitura atrasada
        const result = await db.rawQuery(`
          SELECT
            u.id,
            u.email,
            u.full_name as fullName,
            rp.id as planId,
            rp.name as planName,
            rp.total_days as totalDays,
            rp.start_date as startDate,
            rp.end_date as endDate,
            (
              SELECT COUNT(*)
              FROM reading_progress prog
              WHERE prog.reading_plan_id = rp.id
                AND prog.is_completed = true
            ) as daysCompleted,
            GREATEST(1, CEIL(
              rp.total_days *
              (DATEDIFF(CURDATE(), DATE(rp.start_date)) /
               GREATEST(1, DATEDIFF(DATE(rp.end_date), DATE(rp.start_date))))
            )) as expectedDays
          FROM users u
          INNER JOIN reading_plans rp ON rp.user_id = u.id
          WHERE rp.is_active = true
            AND rp.start_date IS NOT NULL
            AND rp.end_date IS NOT NULL
            AND YEAR(rp.start_date) > 1900
            AND YEAR(rp.end_date) > 1900
            AND DATE(rp.start_date) <= CURDATE()
            AND DATE(rp.end_date) >= CURDATE()
          HAVING daysCompleted < expectedDays
        `)
        usersWithPlans = result[0]
      }

      // Filtrar planos com datas nulas no JavaScript como camada extra de segurança
      usersWithPlans = usersWithPlans.filter((row) => {
        if (!row.startDate || !row.endDate) {
          console.warn(`⚠️ [BulkEmail] Plano ${row.planId} tem datas nulas - removendo da lista`)
          return false
        }

        // Verificar se expectedDays é NaN
        const expectedDays = Number(row.expectedDays)
        if (Number.isNaN(expectedDays)) {
          console.warn(
            `⚠️ [BulkEmail] Plano ${row.planId} gerou expectedDays = NaN - removendo da lista`
          )
          return false
        }

        return true
      })

      // Formatar dados para retorno
      const users = usersWithPlans.map((row: any) => ({
        id: row.id,
        email: row.email,
        fullName: row.fullName || 'Usuário',
        plan: {
          id: row.planId,
          name: row.planName,
          totalDays: Number(row.totalDays),
          daysCompleted: Number(row.daysCompleted),
          expectedDays: Number(row.expectedDays),
          percentComplete: (Number(row.daysCompleted) / Number(row.totalDays)) * 100,
        },
      }))

      return response.ok({
        success: true,
        status,
        count: users.length,
        users,
      })
    } catch (error) {
      console.error('[BulkEmailController] Erro ao buscar usuários:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao buscar usuários',
        error: error.message,
      })
    }
  }

  /**
   * Envia e-mails em lote para usuários selecionados
   * POST /admin/bulk-email/send
   */
  async sendBulkEmails({ request, response, auth }: HttpContext) {
    try {
      await auth.authenticate()

      // Verificar permissão
      const user = auth.user!
      const hasPermission = await user.hasPermission('gerenciar_usuarios')

      if (!hasPermission) {
        return response.forbidden({
          success: false,
          message: 'Você não tem permissão para enviar e-mails',
        })
      }

      const { userIds, status } = request.only(['userIds', 'status'])

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return response.badRequest({
          success: false,
          message: 'Lista de usuários é obrigatória',
        })
      }

      if (!status || !['em_dia', 'adiantado', 'atrasado'].includes(status)) {
        return response.badRequest({
          success: false,
          message: 'Status inválido',
        })
      }

      const results = {
        success: 0,
        failed: 0,
        errors: [] as any[],
      }

      // Buscar dados dos usuários
      for (const userId of userIds) {
        try {
          const userRecord = await User.find(userId)
          if (!userRecord) {
            results.failed++
            results.errors.push({
              userId,
              error: 'Usuário não encontrado',
            })
            continue
          }

          // Buscar plano ativo do usuário
          const plan = await ReadingPlan.query()
            .where('user_id', userId)
            .where('is_active', true)
            .whereNull('deleted_at')
            .whereNotNull('start_date')
            .whereNotNull('end_date')
            .where('start_date', '<=', DateTime.now().toSQLDate()!)
            .where('end_date', '>=', DateTime.now().toSQLDate()!)
            .first()

          console.log(`🔍 [BulkEmail] Plano encontrado para usuário ${userId}:`, {
            found: !!plan,
            planId: plan?.id,
            startDate: plan?.startDate,
            endDate: plan?.endDate,
            startDateType: typeof plan?.startDate,
            endDateType: typeof plan?.endDate,
          })

          if (!plan) {
            results.failed++
            results.errors.push({
              userId,
              error: 'Plano ativo não encontrado',
            })
            continue
          }

          // Verificar se as datas do plano são válidas (conversão para Date)
          const startDateObj = plan.startDate ? plan.startDate.toJSDate() : null
          const endDateObj = plan.endDate ? plan.endDate.toJSDate() : null

          if (!startDateObj || !endDateObj) {
            results.failed++
            results.errors.push({
              userId,
              error: 'Plano com datas inválidas (startDate ou endDate nulo/inválido)',
            })
            console.warn(
              `⚠️ [BulkEmail] Plano ${plan.id} do usuário ${userId} tem datas inválidas - pulando`,
              { startDate: plan.startDate, endDate: plan.endDate, startDateObj, endDateObj }
            )
            continue
          }

          // Calcular progresso
          const progress = await db
            .from('reading_progress')
            .where('reading_plan_id', plan.id)
            .where('is_completed', true)
            .count('* as total')

          const daysCompleted = Number(progress[0].total)

          // Calcular dias esperados usando as datas já validadas
          const startDate = DateTime.fromJSDate(startDateObj)
          const endDate = DateTime.fromJSDate(endDateObj)
          const today = DateTime.now()

          const totalPlanDays = Math.max(1, endDate.diff(startDate, 'days').days)
          const elapsedDays = Math.max(0, today.diff(startDate, 'days').days)
          const expectedDays = Math.max(
            1,
            Math.ceil((plan.totalDays * elapsedDays) / totalPlanDays)
          )

          // Debug do cálculo
          console.log(`📊 [BulkEmail] Calculando para usuário ${userId}:`, {
            planId: plan.id,
            planName: plan.name,
            startDate: startDate.toISODate(),
            endDate: endDate.toISODate(),
            today: today.toISODate(),
            totalPlanDays,
            elapsedDays,
            totalDays: plan.totalDays,
            daysCompleted,
            expectedDays,
            calculo: `Math.ceil((${plan.totalDays} * ${elapsedDays}) / ${totalPlanDays}) = ${expectedDays}`,
          })

          // Enviar e-mail
          await emailService.sendReadingStatusEmail(
            userRecord.email,
            userRecord.fullName || 'Usuário',
            status,
            {
              planName: plan.name,
              daysCompleted,
              expectedDays,
              totalDays: plan.totalDays,
              percentComplete: (daysCompleted / plan.totalDays) * 100,
            }
          )

          results.success++

          // Delay para não sobrecarregar o servidor SMTP
          await new Promise((resolve) => setTimeout(resolve, 1000))
        } catch (error) {
          results.failed++
          results.errors.push({
            userId,
            error: error.message,
          })
          console.error(`[BulkEmail] Erro ao enviar para usuário ${userId}:`, error)
        }
      }

      return response.ok({
        success: true,
        message: `E-mails enviados com sucesso`,
        results: {
          total: userIds.length,
          success: results.success,
          failed: results.failed,
          errors: results.errors,
        },
      })
    } catch (error) {
      console.error('[BulkEmailController] Erro ao enviar e-mails em lote:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao enviar e-mails',
        error: error.message,
      })
    }
  }

  /**
   * Visualizar preview do e-mail
   * GET /admin/bulk-email/preview
   */
  async previewEmail({ request, response, auth }: HttpContext) {
    try {
      await auth.authenticate()

      const { status } = request.qs()

      if (!status || !['em_dia', 'adiantado', 'atrasado'].includes(status)) {
        return response.badRequest({
          success: false,
          message: 'Status inválido',
        })
      }

      // Dados de exemplo para preview
      const mockData = {
        userName: 'João Silva',
        email: 'joao@example.com',
        status: status as 'em_dia' | 'adiantado' | 'atrasado',
        statusDetails: {
          planName: 'Leitura Bíblica Anual',
          daysCompleted: 45,
          expectedDays: 40,
          totalDays: 365,
          percentComplete: 12.3,
        },
      }

      return response.ok({
        success: true,
        preview: mockData,
        message: 'Use estes dados para visualizar como ficará o e-mail',
      })
    } catch (error) {
      console.error('[BulkEmailController] Erro ao gerar preview:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao gerar preview',
        error: error.message,
      })
    }
  }
}
