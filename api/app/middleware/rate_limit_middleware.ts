import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

interface Attempt {
  count: number
  resetAt: number
}

/**
 * Middleware simples de rate limit em memória (sem dependências externas).
 * Usado em rotas sensíveis (login, registro, reset de senha) para dificultar
 * brute force sem afetar usuários legítimos.
 */
export default class RateLimitMiddleware {
  private static store = new Map<string, Attempt>()

  private static cleanup(): void {
    const now = Date.now()
    for (const [key, attempt] of RateLimitMiddleware.store) {
      if (now > attempt.resetAt) {
        RateLimitMiddleware.store.delete(key)
      }
    }
  }

  async handle(ctx: HttpContext, next: NextFn, options?: { limit?: number; windowMs?: number }) {
    const limit = options?.limit ?? 10
    const windowMs = options?.windowMs ?? 15 * 60 * 1000

    const key = `${ctx.request.ip()}:${ctx.request.url()}`
    const now = Date.now()

    RateLimitMiddleware.cleanup()

    const current = RateLimitMiddleware.store.get(key)
    if (!current || now > current.resetAt) {
      RateLimitMiddleware.store.set(key, { count: 1, resetAt: now + windowMs })
    } else if (current.count >= limit) {
      return ctx.response.tooManyRequests({
        success: false,
        message: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
      })
    } else {
      current.count += 1
    }

    return next()
  }
}
