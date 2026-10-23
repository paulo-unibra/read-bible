import pointsService from '#services/tamagoshi_points_service'
import type { Authenticators } from '@adonisjs/auth/types'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Auth middleware is used authenticate HTTP requests and deny
 * access to unauthenticated users.
 */
export default class AuthMiddleware {
  /**
   * The URL to redirect to, when authentication fails
   */
  redirectTo = '/login'

  async handle(
    ctx: HttpContext,
    next: NextFn,
    options: {
      guards?: (keyof Authenticators)[]
    } = {}
  ) {
    try {
      await ctx.auth.authenticateUsing(options.guards, { loginRoute: this.redirectTo })
    } catch (error) {
      throw error
    }

    // Preserve profile migration from older clients using explicit activation.
    if (!(ctx.request.method() === 'POST' && ctx.request.url().endsWith('/tamagoshi/activate'))) {
      await pointsService.ensureProfile(ctx.auth.user!.id)
    }
    return next()
  }
}
