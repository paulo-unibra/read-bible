import { test } from '@japa/runner'
import User from '#models/user'
import Quiz from '#models/quiz'
import QuizResult from '#models/quiz_result'
import ReadingPlan from '#models/reading_plan'
import ReadingProgress from '#models/reading_progress'
import db from '@adonisjs/lucid/services/db'
import pointsService, { scorePeriod } from '#services/tamagoshi_points_service'
import { DateTime } from 'luxon'

test.group('Tamagoshi monthly points', () => {
  test('current-month activity is recovered retroactively without duplicate awards', async ({
    client,
    assert,
  }) => {
    const user = await User.create({
      fullName: 'New Pet',
      email: `zero-pet-${Date.now()}@example.invalid`,
      password: 'TemporaryTest12345',
      emailVerified: true,
    })
    const quiz = await Quiz.create({
      bookName: 'Salmos',
      chapter: 1,
      bibleVersion: 'ARC',
      testament: 'old',
      category: 'test',
      cloudStorageUrl: null,
    })
    try {
      const before = DateTime.now().setZone('America/Recife').startOf('month').toUTC()
      const result = await QuizResult.create({
        userId: user.id,
        quizId: quiz.id,
        correctAnswers: 1,
        totalQuestions: 1,
        score: 100,
        createdAt: before,
        updatedAt: before,
      })
      const plan = await ReadingPlan.create({
        createdAt: before,
        userId: user.id,
        name: 'Existing readings',
        type: 'custom',
        startDate: before,
        endDate: before.plus({ days: 2 }),
        isActive: true,
        currentDay: 1,
        totalDays: 2,
        chaptersPerDay: 1,
        totalChapters: 2,
        completedChapters: 1,
      })
      await ReadingProgress.create({
        readingPlanId: plan.id,
        day: 1,
        bookName: 'Gênesis',
        startChapter: 1,
        endChapter: 1,
        isCompleted: true,
        completedAt: before,
      })
      const token = await User.accessTokens.create(user)
      const auth = `Bearer ${token.value!.release()}`
      const activation = await client
        .post('/tamagoshi/activate')
        .header('Authorization', auth)
        .json({ name: 'Lumi', seed: 42, catalogVersion: 2 })
      activation.assertStatus(200)
      assert.equal(activation.body().data.score.points, 18)
      for (let i = 0; i < 2; i++) {
        const summary = await client.get('/tamagoshi').header('Authorization', auth)
        assert.equal(summary.body().data.score.points, 18)
        assert.deepEqual(summary.body().data.score.readingHistory, [scorePeriod(before).day])
      }
      // Repeating an old quiz after activation is new activity, worth two points.
      await db
        .from('quiz_results')
        .where('id', result.id)
        .update({ updated_at: DateTime.utc().startOf('second').toSQL({ includeOffset: false }) })
      const after = await client.get('/tamagoshi').header('Authorization', auth)
      assert.equal(
        after.body().data.score.points,
        18 + (scorePeriod(before).day === scorePeriod().day ? 0 : 2)
      )
      const again = await client.get('/tamagoshi').header('Authorization', auth)
      assert.equal(
        again.body().data.score.points,
        18 + (scorePeriod(before).day === scorePeriod().day ? 0 : 2)
      )
    } finally {
      await user.delete()
      await quiz.delete()
    }
  })

  test('deleted plans cannot preserve or recreate reading points; other valid readings still count', async ({
    client,
    assert,
  }) => {
    const user = await User.create({
      fullName: 'Deleted Plan Reader',
      email: `deleted-plan-${Date.now()}@example.invalid`,
      password: 'TemporaryTest12345',
      emailVerified: true,
    })
    try {
      const token = await User.accessTokens.create(user)
      const auth = `Bearer ${token.value!.release()}`
      await client
        .post('/tamagoshi/activate')
        .header('Authorization', auth)
        .json({ name: 'Pingo', seed: 42, catalogVersion: 2 })
      const plans: ReadingPlan[] = []
      for (let i = 0; i < 2; i++) {
        const plan = await ReadingPlan.create({
          createdAt: DateTime.utc().minus({ months: 1 }),
          userId: user.id,
          name: 'Reading plan',
          type: 'custom',
          startDate: DateTime.utc(),
          endDate: DateTime.utc().plus({ days: 1 }),
          isActive: i === 0,
          currentDay: 1,
          totalDays: 1,
          chaptersPerDay: 1,
          totalChapters: 1,
          completedChapters: 1,
        })
        plans.push(plan)
        await ReadingProgress.create({
          readingPlanId: plan.id,
          day: 1,
          bookName: 'Gênesis',
          startChapter: 1,
          endChapter: 1,
          isCompleted: true,
          completedAt: DateTime.utc().startOf('second'),
        })
      }
      await pointsService.backfill(user.id)
      await pointsService.award(user.id, 'quiz')
      let score = await pointsService.summary(user.id)
      assert.equal(score.points, 8)
      const firstDelete = await client.delete('/reading-plans').header('Authorization', auth)
      firstDelete.assertStatus(200)
      score = await pointsService.summary(user.id)
      assert.equal(score.points, 8)
      // Historical records remain for audit, but only the other non-deleted plan supports points.
      const historicalReading = await ReadingProgress.query()
        .where('reading_plan_id', plans[0].id)
        .firstOrFail()
      assert.isTrue(Boolean(historicalReading.isCompleted))
      await db.from('reading_plans').where('id', plans[1].id).update({ is_active: true })
      const secondDelete = await client.delete('/reading-plans').header('Authorization', auth)
      secondDelete.assertStatus(200)
      score = await pointsService.summary(user.id)
      assert.equal(score.points, 2)
      assert.deepEqual(score.readingHistory, [])
      await pointsService.backfill(user.id)
      await pointsService.backfill(user.id)
      const synced = await client.get('/tamagoshi').header('Authorization', auth)
      assert.equal(synced.body().data.score.points, 2)
      // Stale plan awards from older releases are removed on synchronization too.
      await pointsService.award(user.id, 'reading')
      const repaired = await client.get('/tamagoshi').header('Authorization', auth)
      assert.equal(repaired.body().data.score.points, 2)
      const ranking = await client.get('/tamagoshi/ranking').header('Authorization', auth)
      assert.equal(ranking.body().data.own.points, 2)
      const free = await client
        .post('/tamagoshi/reading')
        .header('Authorization', auth)
        .json({ day: scorePeriod().day, origin: 'chapter' })
      assert.equal(free.body().data.score.points, 8)
    } finally {
      await db.from('audit_logs').where('user_id', user.id).delete()
      await user.delete()
    }
  })

  test('all plan creation routes award ten points once per plan and remove the bonus on deletion', async ({
    client,
    assert,
  }) => {
    const user = await User.create({
      fullName: 'Plan Creator',
      email: `plan-bonus-${Date.now()}@example.invalid`,
      password: 'TemporaryTest12345',
      emailVerified: true,
    })
    try {
      const token = await User.accessTokens.create(user)
      const auth = `Bearer ${token.value!.release()}`
      await client
        .post('/tamagoshi/activate')
        .header('Authorization', auth)
        .json({ name: 'Lumi', seed: 42, catalogVersion: 2 })
      const routes = ['/reading-plans', '/reading-plans/custom', '/reading-plans/beginner']
      for (let i = 0; i < routes.length; i++) {
        const payload = {
          name: 'Test bonus',
          type: 'sequential',
          startDate: DateTime.utc().toISODate(),
          endDate: DateTime.utc().plus({ days: 99 }).toISODate(),
          totalDays: 100,
        }
        const created = await client.post(routes[i]).header('Authorization', auth).json(payload)
        created.assertStatus(201)
        const immediate = await pointsService.summary(user.id)
        assert.equal(immediate.points, (i + 1) * 10)
        for (let repeat = 0; repeat < 2; repeat++) {
          const synced = await client.get('/tamagoshi').header('Authorization', auth)
          assert.equal(synced.body().data.score.points, (i + 1) * 10)
          assert.deepEqual(synced.body().data.score.readingDays, [])
        }
        const conflict = await client.post(routes[i]).header('Authorization', auth).json(payload)
        conflict.assertStatus(409)
        if (i < routes.length - 1)
          await db
            .from('reading_plans')
            .where('id', created.body().data.plan.id)
            .update({ is_active: false })
      }
      const deleted = await client.delete('/reading-plans').header('Authorization', auth)
      deleted.assertStatus(200)
      const remaining = await pointsService.summary(user.id)
      assert.equal(remaining.points, 20)
      await db
        .from('reading_plans')
        .where('user_id', user.id)
        .update({ deleted_at: DateTime.utc().toSQL({ includeOffset: false }), is_active: false })
      const repaired = await client.get('/tamagoshi').header('Authorization', auth)
      assert.equal(repaired.body().data.score.points, 0)
      const ranking = await client.get('/tamagoshi/ranking').header('Authorization', auth)
      assert.equal(ranking.body().data.own.points, 0)
    } finally {
      await db.from('audit_logs').where('user_id', user.id).delete()
      await user.delete()
    }
  })

  test('first authenticated access creates one default pet, and a first plan receives its bonus', async ({
    client,
    assert,
  }) => {
    const user = await User.create({
      fullName: 'Automatic Pet',
      email: `auto-pet-${Date.now()}@example.invalid`,
      password: 'TemporaryTest12345',
      emailVerified: true,
    })
    try {
      const token = await User.accessTokens.create(user)
      const auth = `Bearer ${token.value!.release()}`
      // No explicit activation, including when the user's first action is creating a plan.
      const created = await client
        .post('/reading-plans/custom')
        .header('Authorization', auth)
        .json({
          name: 'First plan',
          type: 'sequential',
          startDate: DateTime.utc().toISODate(),
          endDate: DateTime.utc().plus({ days: 99 }).toISODate(),
          totalDays: 100,
        })
      created.assertStatus(201)
      const [one, two] = await Promise.all(
        [0, 1].map(() => client.get('/tamagoshi').header('Authorization', auth))
      )
      one.assertStatus(200)
      two.assertStatus(200)
      assert.equal(one.body().data.score.points, 10)
      assert.deepEqual(one.body().data.profile, two.body().data.profile)
      assert.equal(one.body().data.profile.catalogVersion, 2)
      const count = await db
        .from('tamagoshi_profiles')
        .where('user_id', user.id)
        .count('* as count')
        .first()
      assert.equal(Number(count!.count), 1)
      // A previous-month plan is not credited again when a pet is recreated.
      await db.from('tamagoshi_profiles').where('user_id', user.id).delete()
      await db
        .from('reading_plans')
        .where('user_id', user.id)
        .update({
          created_at: DateTime.utc().minus({ months: 1 }).toSQL({ includeOffset: false }),
        })
      const [reset, concurrentReset] = await Promise.all(
        [0, 1].map(() => client.get('/tamagoshi').header('Authorization', auth))
      )
      assert.deepEqual(reset.body().data.profile, concurrentReset.body().data.profile)
      assert.isNotNull(reset.body().data.profile)
      assert.equal(reset.body().data.score.points, 0)
    } finally {
      await db.from('audit_logs').where('user_id', user.id).delete()
      await user.delete()
    }
  })

  test('authenticated daily points, concurrency, ranking, monthly reset and no score cap', async ({
    client,
    assert,
  }) => {
    const users: User[] = []
    try {
      for (let index = 0; index < 2; index++)
        users.push(
          await User.create({
            fullName: index ? 'Ana Silva' : 'Paulo Silva',
            email: `monthly-${Date.now()}-${index}@example.invalid`,
            password: 'TemporaryTest12345',
            emailVerified: true,
          })
        )
      const tokens = await Promise.all(users.map((user) => User.accessTokens.create(user)))
      const auth = tokens.map((token) => `Bearer ${token.value!.release()}`)
      const unauthorized = await client.get('/tamagoshi/ranking')
      unauthorized.assertStatus(401)
      const automatic = await client.get('/tamagoshi').header('Authorization', auth[0])
      automatic.assertStatus(200)
      assert.isNotNull(automatic.body().data.profile)
      assert.equal(automatic.body().data.score.points, 0)
      for (let i = 0; i < 2; i++) {
        const activation = await client
          .post('/tamagoshi/activate')
          .header('Authorization', auth[i])
          .json({ name: i ? 'Nino' : 'Lumi', seed: i + 1, catalogVersion: 2, points: 999999 })
        activation.assertStatus(200)
        assert.equal(activation.body().data.score.points, 0)
      }
      const [one, two] = await Promise.all(
        [0, 1].map(() =>
          client
            .post('/tamagoshi/reading')
            .header('Authorization', auth[0])
            .json({ day: scorePeriod().day, points: 999, source: 'invite' })
        )
      )
      one.assertStatus(200)
      two.assertStatus(200)
      const summary = await client.get('/tamagoshi').header('Authorization', auth[0])
      assert.equal(summary.body().data.score.points, 6)
      const oldDay = await client
        .post('/tamagoshi/reading')
        .header('Authorization', auth[0])
        .json({ day: '2020-01-01' })
      oldDay.assertStatus(409)
      await pointsService.award(users[1].id, 'reading')
      await pointsService.award(users[1].id, 'quiz')
      const ranking = await client.get('/tamagoshi/ranking').header('Authorization', auth[0])
      ranking.assertStatus(200)
      assert.equal(ranking.body().data.entries[0].name, 'Nino')
      assert.equal(ranking.body().data.entries[0].points, 8)
      assert.equal(ranking.body().data.own.position, 2)
      // The reset boundary is midnight Recife, not midnight UTC.
      const before = DateTime.fromISO('2026-11-01T02:59:59Z')
      const after = DateTime.fromISO('2026-11-01T03:00:00Z')
      assert.equal(scorePeriod(before).month, '2026-10')
      assert.equal(scorePeriod(after).month, '2026-11')
      const pointSummary1 = await pointsService.summary(users[0].id, after)
      assert.equal(pointSummary1.points, 0)
      await pointsService.award(users[0].id, 'reading', after)
      await pointsService.award(users[0].id, 'reading', after)
      const pointSummary2 = await pointsService.summary(users[0].id, after)
      assert.equal(pointSummary2.points, 6)
      for (let day = 1; day <= 20; day++)
        await pointsService.award(
          users[0].id,
          'reading',
          DateTime.fromObject({ year: 2026, month: 12, day, hour: 12 }, { zone: 'America/Recife' })
        )
      const december = await pointsService.summary(
        users[0].id,
        DateTime.fromISO('2026-12-25T15:00:00Z')
      )
      assert.equal(december.points, 120)
      const january = await pointsService.summary(
        users[0].id,
        DateTime.fromISO('2027-01-01T03:00:00Z')
      )
      assert.equal(january.points, 0)
    } finally {
      await User.query()
        .whereIn(
          'id',
          users.map((user) => user.id)
        )
        .delete()
    }
  })

  test('plan completion and historical confirmed activity give one daily reading award', async ({
    client,
    assert,
  }) => {
    const user = await User.create({
      fullName: 'Reader',
      email: `monthly-plan-${Date.now()}@example.invalid`,
      password: 'TemporaryTest12345',
      emailVerified: true,
    })
    try {
      const token = await User.accessTokens.create(user)
      const auth = `Bearer ${token.value!.release()}`
      const plan = await ReadingPlan.create({
        createdAt: DateTime.utc().minus({ months: 1 }),
        userId: user.id,
        name: 'Test',
        type: 'custom',
        startDate: DateTime.utc(),
        endDate: DateTime.utc().plus({ days: 2 }),
        isActive: true,
        currentDay: 1,
        totalDays: 2,
        chaptersPerDay: 1,
        totalChapters: 2,
        completedChapters: 0,
      })
      await ReadingProgress.create({
        readingPlanId: plan.id,
        day: 1,
        bookName: 'Gênesis',
        startChapter: 1,
        endChapter: 1,
        isCompleted: false,
      })
      await client
        .post('/tamagoshi/activate')
        .header('Authorization', auth)
        .json({ name: 'Pipo', seed: 42, catalogVersion: 2 })
      const completed = await client
        .post('/reading-plans/complete')
        .header('Authorization', auth)
        .json({ day: 1 })
      completed.assertStatus(200)
      await pointsService.backfill(user.id)
      await pointsService.backfill(user.id)
      const pointSummary3 = await pointsService.summary(user.id)
      assert.equal(pointSummary3.points, 6)
      await ReadingProgress.create({
        readingPlanId: plan.id,
        day: 2,
        bookName: 'Gênesis',
        startChapter: 2,
        endChapter: 2,
        isCompleted: true,
        completedAt: DateTime.utc(),
      })
      // Legacy app versions also notified this endpoint after plan completion.
      await client
        .post('/tamagoshi/reading')
        .header('Authorization', auth)
        .json({ day: scorePeriod().day })
      const unmark = (day: number) =>
        client.post('/reading-plans/unmark').header('Authorization', auth).json({ day })
      const firstUnmark = await unmark(1)
      firstUnmark.assertStatus(200)
      let summary = await client.get('/tamagoshi').header('Authorization', auth)
      assert.equal(summary.body().data.score.points, 6)
      await pointsService.award(user.id, 'quiz')
      const lastUnmark = await unmark(2)
      lastUnmark.assertStatus(200)
      summary = await client.get('/tamagoshi').header('Authorization', auth)
      assert.equal(summary.body().data.score.points, 2)
      assert.deepEqual(summary.body().data.score.readingHistory, [])
      assert.isFalse(summary.body().data.score.readToday)
      const rank = await client.get('/tamagoshi/ranking').header('Authorization', auth)
      assert.equal(rank.body().data.own.points, 2)
      // Repair stale awards left behind by the previous version.
      await pointsService.award(user.id, 'reading')
      summary = await client.get('/tamagoshi').header('Authorization', auth)
      assert.equal(summary.body().data.score.points, 2)
      const free = await client
        .post('/tamagoshi/reading')
        .header('Authorization', auth)
        .json({ day: scorePeriod().day, origin: 'chapter' })
      free.assertStatus(200)
      await unmark(2)
      summary = await client.get('/tamagoshi').header('Authorization', auth)
      assert.equal(summary.body().data.score.points, 8)
      assert.deepEqual(summary.body().data.score.readingHistory, [scorePeriod().day])
    } finally {
      await db.from('audit_logs').where('user_id', user.id).delete()
      await user.delete()
    }
  })
})
