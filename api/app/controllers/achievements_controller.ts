import type { HttpContext } from '@adonisjs/core/http'
import ReadingPlan from '#models/reading_plan'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import { getPlanCompletion } from '#utils/plan_completion'

export default class AchievementsController {
  async sync({ auth, response }: HttpContext) {
    const user = auth.user!
    // Also recognize previous completions and preserve earned awards after plan deletion.
    const plans = await ReadingPlan.query().where('user_id', user.id).preload('progress')
    const issued = await db
      .from('reading_certificates')
      .where('user_id', user.id)
      .select('reading_plan_id')
    const issuedIds = new Set(issued.map((row) => Number(row.reading_plan_id)))
    for (const plan of plans) {
      if (issuedIds.has(plan.id)) continue
      const completion = getPlanCompletion(plan.totalChapters, plan.progress)
      if (!completion) continue
      try {
        await db.table('reading_certificates').insert({
          user_id: user.id,
          reading_plan_id: plan.id,
          code: `BF-${DateTime.fromISO(completion.completedAt).year}-${plan.id}`,
          reader_name: user.fullName?.trim() || 'Leitor da Bíblia em Foco',
          plan_name: plan.name,
          plan_type: plan.type,
          total_chapters: completion.chapters,
          completed_at: DateTime.fromISO(completion.completedAt)
            .toUTC()
            .toSQL({ includeOffset: false }),
          created_at: DateTime.utc().toSQL({ includeOffset: false }),
        })
      } catch (error) {
        // Parallel sync requests must issue only one certificate per plan.
        if ((error as { code?: string }).code !== 'ER_DUP_ENTRY') throw error
      }
    }
    const certificates = await db
      .from('reading_certificates')
      .where('user_id', user.id)
      .orderBy('completed_at', 'desc')
      .orderBy('id', 'desc')
    return response.ok({
      success: true,
      data: certificates.map((item) => ({
        id: Number(item.id),
        code: item.code,
        readerName: item.reader_name,
        planName: item.plan_name,
        planType: item.plan_type,
        totalChapters: Number(item.total_chapters),
        completedAt:
          item.completed_at instanceof Date
            ? item.completed_at.toISOString()
            : DateTime.fromSQL(String(item.completed_at), { zone: 'utc' }).toISO(),
      })),
    })
  }
}
