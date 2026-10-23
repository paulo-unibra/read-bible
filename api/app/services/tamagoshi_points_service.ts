import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'

export const SCORE_ZONE = 'America/Recife'
export const POINTS = { reading: 6, quiz: 2, invite: 5 } as const
export type PointSource = keyof typeof POINTS
export function scorePeriod(now: DateTime = DateTime.utc()) {
  const local = now.setZone(SCORE_ZONE)
  const start = local.startOf('month')
  return {
    month: local.toFormat('yyyy-MM'),
    day: local.toISODate()!,
    start: start.toUTC().toSQL({ includeOffset: false })!,
    end: start.plus({ months: 1 }).toUTC().toSQL({ includeOffset: false })!,
  }
}
function dateOf(value: Date | string) {
  return value instanceof Date
    ? DateTime.fromJSDate(value, { zone: 'utc' })
    : DateTime.fromSQL(value, { zone: 'utc' })
}
class TamagoshiPointsService {
  async award(
    userId: number,
    source: PointSource,
    at: DateTime = DateTime.utc(),
    invitationId?: number,
    trx?: TransactionClientContract
  ) {
    const client = trx || db
    if (!(await client.from('tamagoshi_profiles').where('user_id', userId).first())) return
    const period = scorePeriod(at)
    try {
      await client.table('tamagoshi_points').insert({
        user_id: userId,
        source,
        event_key: source === 'invite' ? String(invitationId) : period.day,
        points: POINTS[source],
        score_month: period.month,
        score_day: period.day,
        earned_at: at.toUTC().toSQL({ includeOffset: false }),
      })
    } catch (error) {
      if ((error as { code?: string }).code !== 'ER_DUP_ENTRY') throw error
    }
  }
  async recordFreeReading(userId: number, explicitChapter = false) {
    // Older app versions also call this endpoint after completing a plan day.
    // Those calls must not turn a reversible plan award into a free-reading award.
    if (!explicitChapter) {
      const completed = await db
        .from('reading_progress')
        .join('reading_plans', 'reading_plans.id', 'reading_progress.reading_plan_id')
        .where('reading_plans.user_id', userId)
        .where('reading_progress.is_completed', true)
        .whereNotNull('reading_progress.completed_at')
        .select('reading_progress.completed_at')
      if (completed.some((row) => scorePeriod(dateOf(row.completed_at)).day === scorePeriod().day))
        return
    }
    await db.transaction(async (trx) => {
      await this.award(userId, 'reading', DateTime.utc(), undefined, trx)
      await trx
        .from('tamagoshi_points')
        .where('user_id', userId)
        .where('source', 'reading')
        .where('score_day', scorePeriod().day)
        .update({ free_reading: true })
    })
  }
  async reconcileReadings(userId: number, trx?: TransactionClientContract) {
    const client = trx || db
    const completed = await client
      .from('reading_progress')
      .join('reading_plans', 'reading_plans.id', 'reading_progress.reading_plan_id')
      .where('reading_plans.user_id', userId)
      .where('reading_progress.is_completed', true)
      .whereNotNull('reading_progress.completed_at')
      .select('reading_progress.completed_at')
    const validDays = new Set(completed.map((row) => scorePeriod(dateOf(row.completed_at)).day))
    const awards = await client
      .from('tamagoshi_points')
      .where('user_id', userId)
      .where('source', 'reading')
      .where('free_reading', false)
      .select('id', 'score_day')
    const invalidIds = awards.filter((row) => !validDays.has(row.score_day)).map((row) => row.id)
    if (invalidIds.length) await client.from('tamagoshi_points').whereIn('id', invalidIds).delete()
  }
  // Only server-confirmed activity is eligible for the leaderboard.
  async backfill(userId: number, now: DateTime = DateTime.utc()) {
    const period = scorePeriod(now)
    const quizzes = await db
      .from('quiz_results')
      .where('user_id', userId)
      .where((query) => {
        query
          .whereBetween('created_at', [period.start, period.end])
          .orWhereBetween('updated_at', [period.start, period.end])
      })
      .select('created_at', 'updated_at')
    const readings = await db
      .from('reading_progress')
      .join('reading_plans', 'reading_plans.id', 'reading_progress.reading_plan_id')
      .where('reading_plans.user_id', userId)
      .where('reading_progress.is_completed', true)
      .where('reading_progress.completed_at', '>=', period.start)
      .where('reading_progress.completed_at', '<', period.end)
      .select('reading_progress.completed_at')
    const invitations = await db
      .from('user_referrals')
      .where('referrer_id', userId)
      .where('rewarded_at', '>=', period.start)
      .where('rewarded_at', '<', period.end)
      .select('id', 'rewarded_at')
    const existing = await db
      .from('tamagoshi_points')
      .where('user_id', userId)
      .where('score_month', period.month)
      .select('source', 'event_key')
    const seen = new Set<string>(existing.map((row) => `${row.source}:${row.event_key}`))
    for (const item of [
      ...quizzes.flatMap((row) => [
        { source: 'quiz' as const, at: row.created_at },
        { source: 'quiz' as const, at: row.updated_at },
      ]),
      ...readings.map((row) => ({ source: 'reading' as const, at: row.completed_at })),
    ]) {
      if (!item.at) continue
      const at = dateOf(item.at)
      const key = `${item.source}:${scorePeriod(at).day}`
      if (!at.isValid || at > now || scorePeriod(at).month !== period.month || seen.has(key))
        continue
      seen.add(key)
      await this.award(userId, item.source, at)
    }
    for (const invitation of invitations) {
      const at = dateOf(invitation.rewarded_at)
      if (at <= now && !seen.has(`invite:${invitation.id}`))
        await this.award(userId, 'invite', at, invitation.id)
    }
  }
  async summary(userId: number, now: DateTime = DateTime.utc()) {
    const period = scorePeriod(now)
    const readingHistory = await db
      .from('tamagoshi_points')
      .where('user_id', userId)
      .where('source', 'reading')
      .select('score_day')
    const rows = await db
      .from('tamagoshi_points')
      .where('user_id', userId)
      .where('score_month', period.month)
      .select('source', 'score_day', 'points')
    return {
      month: period.month,
      readingHistory: readingHistory.map((row) => row.score_day as string),
      points: rows.reduce((sum, row) => sum + Number(row.points), 0),
      readingDays: rows
        .filter((row) => row.source === 'reading')
        .map((row) => row.score_day as string),
      quizDays: rows.filter((row) => row.source === 'quiz').map((row) => row.score_day as string),
      readToday: rows.some((row) => row.source === 'reading' && row.score_day === period.day),
      quizToday: rows.some((row) => row.source === 'quiz' && row.score_day === period.day),
    }
  }
}
export default new TamagoshiPointsService()
