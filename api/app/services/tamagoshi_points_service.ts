import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import { defaultTamagoshi } from '#utils/default_tamagoshi'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'

export const SCORE_ZONE = 'America/Recife'
export const POINTS = { reading: 6, quiz: 2, invite: 5, plan: 10 } as const
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
  async ensureProfile(userId: number) {
    const existing = await db.from('tamagoshi_profiles').where('user_id', userId).first()
    if (existing) return existing
    return db.transaction(async (trx) => {
      await User.query({ client: trx }).where('id', userId).forUpdate().firstOrFail()
      const profile = await trx.from('tamagoshi_profiles').where('user_id', userId).first()
      if (profile) return profile
      await trx.table('tamagoshi_profiles').insert({
        user_id: userId,
        ...defaultTamagoshi(),
        activated_at: DateTime.utc().startOf('second').toSQL({ includeOffset: false }),
      })
      return trx.from('tamagoshi_profiles').where('user_id', userId).first()
    })
  }
  async award(
    userId: number,
    source: PointSource,
    at: DateTime = DateTime.utc(),
    eventId?: number,
    trx?: TransactionClientContract
  ) {
    const client = trx || db
    const profile = await client.from('tamagoshi_profiles').where('user_id', userId).first()
    if (!profile || at < dateOf(profile.activated_at)) return
    const period = scorePeriod(at)
    try {
      await client.table('tamagoshi_points').insert({
        user_id: userId,
        source,
        event_key: source === 'invite' || source === 'plan' ? String(eventId) : period.day,
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
        .whereNull('reading_plans.deleted_at')
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
      .whereNull('reading_plans.deleted_at')
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
    const validPlans = await client
      .from('reading_plans')
      .where('user_id', userId)
      .whereNull('deleted_at')
      .select('id')
    const validPlanIds = new Set(validPlans.map((plan) => String(plan.id)))
    const planAwards = await client
      .from('tamagoshi_points')
      .where('user_id', userId)
      .where('source', 'plan')
      .select('id', 'event_key')
    const removedPlanAwards = planAwards
      .filter((row) => !validPlanIds.has(row.event_key))
      .map((row) => row.id)
    if (removedPlanAwards.length)
      await client.from('tamagoshi_points').whereIn('id', removedPlanAwards).delete()
  }
  // Only server-confirmed activity is eligible for the leaderboard.
  async backfill(userId: number, now: DateTime = DateTime.utc()) {
    const profile = await db.from('tamagoshi_profiles').where('user_id', userId).first()
    if (!profile) return
    const activatedAt = dateOf(profile.activated_at)
    const period = scorePeriod(now)
    const since = DateTime.max(activatedAt, dateOf(period.start))
      .toUTC()
      .toSQL({ includeOffset: false })!
    const quizzes = await db
      .from('quiz_results')
      .where('user_id', userId)
      .where((query) => {
        query
          .whereBetween('created_at', [since, period.end])
          .orWhereBetween('updated_at', [since, period.end])
      })
      .select('created_at', 'updated_at')
    const readings = await db
      .from('reading_progress')
      .join('reading_plans', 'reading_plans.id', 'reading_progress.reading_plan_id')
      .where('reading_plans.user_id', userId)
      .whereNull('reading_plans.deleted_at')
      .where('reading_progress.is_completed', true)
      .where('reading_progress.completed_at', '>=', since)
      .where('reading_progress.completed_at', '<', period.end)
      .select('reading_progress.completed_at')
    const invitations = await db
      .from('user_referrals')
      .where('referrer_id', userId)
      .where('rewarded_at', '>=', since)
      .where('rewarded_at', '<', period.end)
      .select('id', 'rewarded_at')
    const plans = await db
      .from('reading_plans')
      .where('user_id', userId)
      .whereNull('deleted_at')
      .where('created_at', '>=', since)
      .where('created_at', '<', period.end)
      .select('id', 'created_at')
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
      if (
        !at.isValid ||
        at < activatedAt ||
        at > now ||
        scorePeriod(at).month !== period.month ||
        seen.has(key)
      )
        continue
      seen.add(key)
      await this.award(userId, item.source, at)
    }
    for (const plan of plans) {
      const at = dateOf(plan.created_at)
      if (at <= now && !seen.has(`plan:${plan.id}`)) await this.award(userId, 'plan', at, plan.id)
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
