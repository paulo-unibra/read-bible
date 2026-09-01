import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class AdminMiddleware {
  async handle(ctx: HttpContext, next: NextFn, options?: { permission?: string }) {
    const user = ctx.auth.user
    const permission = options?.permission ?? 'acessar_painel_administrativo'

    if (!user) {
      return ctx.response.unauthorized({ error: 'Não autenticado' })
    }

    const hasAccess = await user.hasPermission(permission)
    if (!hasAccess) {
      return ctx.response.forbidden({ error: 'Acesso administrativo negado' })
    }

    return next()
  }
}
