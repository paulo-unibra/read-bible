import env from '#start/env'
import { createHmac, timingSafeEqual } from 'node:crypto'

export function hashPublicToken(token: string): string {
  return createHmac('sha256', env.get('APP_KEY')).update(token).digest('hex')
}

export function matchesPublicToken(storedHash: string, token: string): boolean {
  const expected = Buffer.from(storedHash, 'hex')
  const actual = Buffer.from(hashPublicToken(token), 'hex')
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}
