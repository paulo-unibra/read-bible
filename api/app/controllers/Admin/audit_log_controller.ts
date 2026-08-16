import AuditLog from '#models/audit_log'
import type { HttpContext } from '@adonisjs/core/http'

export default class AuditLogController {
  /**
   * Lista logs de auditoria com filtros
   * GET /api/admin/audit-logs?action=&search=&from=&to=&page=&limit=
   */
  async index({ request, response }: HttpContext) {
    try {
      const { action, search, from, to, page = 1, limit = 50 } = request.qs()

      const query = AuditLog.query()
        .preload('user')
        .orderBy('created_at', 'desc')

      if (action && action !== 'all') {
        query.where('action', action)
      }

      if (from) {
        query.where('created_at', '>=', new Date(from).toISOString())
      }

      if (to) {
        query.where('created_at', '<=', new Date(to).toISOString())
      }

      if (search && search.trim()) {
        const term = `%${search.trim()}%`
        query.whereHas('user', (userQuery) => {
          userQuery
            .where('email', 'like', term)
            .orWhere('full_name', 'like', term)
        })
      }

      const logs = await query.paginate(page, limit)

      return response.ok({
        data: logs.all().map((log) => ({
          id: log.id,
          userId: log.userId,
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId,
          details: log.details,
          ipAddress: log.ipAddress,
          userAgent: log.userAgent,
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
      console.error('Erro ao listar logs de auditoria:', error)
      return response.internalServerError({
        error: 'Erro ao listar logs de auditoria',
      })
    }
  }

  /**
   * Lista as ações distintas disponíveis para o filtro
   * GET /api/admin/audit-logs/actions
   */
  async actions({ response }: HttpContext) {
    try {
      const rows = await AuditLog.query()
        .distinct('action')
        .orderBy('action', 'asc')

      return response.ok({
        data: rows.map((row) => row.action),
      })
    } catch (error) {
      console.error('Erro ao listar ações de auditoria:', error)
      return response.internalServerError({
        error: 'Erro ao listar ações de auditoria',
      })
    }
  }
}