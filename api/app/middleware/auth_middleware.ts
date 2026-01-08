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
    console.log('=== AUTH MIDDLEWARE ===')
    console.log('Request URL:', ctx.request.url())
    console.log('Request method:', ctx.request.method())
    console.log('Has Authorization header:', !!ctx.request.header('authorization'))

    try {
      await ctx.auth.authenticateUsing(options.guards, { loginRoute: this.redirectTo })
      console.log('Auth successful, user ID:', ctx.auth.user?.id)
    } catch (error) {
      console.error('Auth failed:', error.message)
      throw error
    }

    return next()
  }
}
