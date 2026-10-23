import { test } from '@japa/runner'
import User from '#models/user'
import ReadingPlan from '#models/reading_plan'
import ReadingProgress from '#models/reading_progress'
import db from '@adonisjs/lucid/services/db'
import pointsService, { scorePeriod } from '#services/tamagoshi_points_service'
import { DateTime } from 'luxon'

test.group('Tamagoshi monthly points', () => {
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
      const inactive = await client
        .post('/tamagoshi/reading')
        .header('Authorization', auth[0])
        .json({ day: scorePeriod().day })
      inactive.assertStatus(400)
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
      assert.equal(ranking.body().data.entries[0].name, 'Nino Ana')
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
    } finally {
      await db.from('audit_logs').where('user_id', user.id).delete()
      await user.delete()
    }
  })
})
