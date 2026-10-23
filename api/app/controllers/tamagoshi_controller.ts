import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import vine from '@vinejs/vine'
import User from '#models/user'
import pointsService, { scorePeriod } from '#services/tamagoshi_points_service'
import { DateTime } from 'luxon'

const activationValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(24),
    seed: vine.number().min(0).max(2147483647).withoutDecimals(),
    catalogVersion: vine.enum([1, 2]),
  })
)
const nameValidator = vine.compile(
  vine.object({ name: vine.string().trim().minLength(1).maxLength(24) })
)
export default class TamagoshiController {
  async me({ auth, response }: HttpContext) {
    const userId = auth.user!.id
    const profile = await db.from('tamagoshi_profiles').where('user_id', userId).first()
    if (profile) {
      await pointsService.reconcileReadings(userId)
      await pointsService.backfill(userId)
    }
    return response.ok({
      success: true,
      data: {
        profile: profile
          ? {
              name: profile.name,
              seed: profile.seed,
              catalogVersion: profile.catalog_version,
              activatedAt: profile.activated_at,
            }
          : null,
        score: await pointsService.summary(userId),
      },
    })
  }
  async activate(ctx: HttpContext) {
    const data = await ctx.request.validateUsing(activationValidator)
    const userId = ctx.auth.user!.id
    await db.transaction(async (trx) => {
      await User.query({ client: trx }).where('id', userId).forUpdate().firstOrFail()
      if (!(await trx.from('tamagoshi_profiles').where('user_id', userId).first())) {
        await trx.table('tamagoshi_profiles').insert({
          user_id: userId,
          name: data.name,
          seed: data.seed,
          catalog_version: data.catalogVersion,
          activated_at: DateTime.utc().startOf('second').toSQL({ includeOffset: false }),
        })
      }
    })
    return this.me(ctx)
  }
  async rename(ctx: HttpContext) {
    const { name } = await ctx.request.validateUsing(nameValidator)
    const profile = await db.from('tamagoshi_profiles').where('user_id', ctx.auth.user!.id).first()
    if (!profile)
      return ctx.response.notFound({ success: false, message: 'Ative o Tamagoshi primeiro.' })
    await db.from('tamagoshi_profiles').where('user_id', ctx.auth.user!.id).update({ name })
    return this.me(ctx)
  }
  async reading(ctx: HttpContext) {
    if (!(await db.from('tamagoshi_profiles').where('user_id', ctx.auth.user!.id).first()))
      return ctx.response.badRequest({ success: false, message: 'Ative o Tamagoshi primeiro.' })
    if (ctx.request.input('day') !== scorePeriod().day)
      return ctx.response.conflict({
        success: false,
        message: 'A data mudou. Registre a leitura de hoje para pontuar.',
      })
    await pointsService.recordFreeReading(
      ctx.auth.user!.id,
      ctx.request.input('origin') === 'chapter'
    )
    return this.me(ctx)
  }
  async ranking({ auth, request, response }: HttpContext) {
    const period = scorePeriod()
    const page = Math.max(1, Math.min(1000, Number.parseInt(request.input('page', '1')) || 1))
    const base = () =>
      db
        .from('tamagoshi_points')
        .where('score_month', period.month)
        .groupBy('user_id')
        .select('user_id')
        .sum('points as points')
    const ranked = await db
      .from(base().as('totals'))
      .join('tamagoshi_profiles as pet', 'pet.user_id', 'totals.user_id')
      .select(
        'totals.user_id',
        'totals.points',
        'pet.name as pet_name',
        'pet.seed',
        'pet.catalog_version'
      )
      .orderBy('totals.points', 'desc')
      .orderBy('totals.user_id', 'asc')
      .offset((page - 1) * 25)
      .limit(26)
    const entries = ranked.slice(0, 25).map((row, i) => {
      return {
        position: (page - 1) * 25 + i + 1,
        userId: row.user_id,
        name: String(row.pet_name).trim().replace(/\s+/g, ' '),
        seed: row.seed,
        catalogVersion: row.catalog_version,
        points: Number(row.points),
      }
    })
    const own = await pointsService.summary(auth.user!.id)
    let position: number | null = null
    if (own.points > 0) {
      const ahead = await db
        .from(base().as('totals'))
        .where((query) =>
          query
            .where('points', '>', own.points)
            .orWhere((q) => q.where('points', own.points).where('user_id', '<', auth.user!.id))
        )
        .count('* as count')
        .first()
      position = Number(ahead?.count || 0) + 1
    }
    return response.ok({
      success: true,
      data: {
        month: period.month,
        entries,
        hasMore: ranked.length > 25,
        page,
        own: { points: own.points, position },
        resetsAt: DateTime.now()
          .setZone('America/Recife')
          .plus({ months: 1 })
          .startOf('month')
          .toISO(),
      },
    })
  }
}
