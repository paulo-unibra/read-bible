import { test } from '@japa/runner'
import User from '#models/user'
import Quiz from '#models/quiz'
import QuizQuestion from '#models/quiz_question'
import QuizResult from '#models/quiz_result'
import EmailVerification from '#models/email_verification'
import { hashPublicToken } from '#utils/public_token'
import { DateTime } from 'luxon'

test.group('Public quiz security', () => {
  test('public quiz details omit the answer key and results are graded from stored answers', async ({
    client,
    assert,
  }) => {
    const user = await User.create({
      fullName: 'Security Test User',
      email: `quiz-security-${Date.now()}@example.invalid`,
      password: 'TemporaryTestPassword123',
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
      await QuizQuestion.createMany([
        {
          quizId: quiz.id,
          questionId: 'security-q1',
          pergunta: 'Pergunta de teste 1',
          alternativas: ['A', 'B'],
          respostaCorreta: 'A',
          order: 1,
        },
        {
          quizId: quiz.id,
          questionId: 'security-q2',
          pergunta: 'Pergunta de teste 2',
          alternativas: ['C', 'D'],
          respostaCorreta: 'C',
          order: 2,
        },
      ])

      const publicResponse = await client.get(`/quizzes/${quiz.id}`)
      publicResponse.assertStatus(200)
      assert.notProperty(publicResponse.body().quiz.questions[0], 'respostaCorreta')

      const token = await User.accessTokens.create(user)
      const tokenValue = token.value!.release()
      await client
        .post('/tamagoshi/activate')
        .header('Authorization', `Bearer ${tokenValue}`)
        .json({ name: 'Pipo', seed: 42, catalogVersion: 2 })
      const generatedQuizResponse = await client
        .post('/generate-quiz')
        .header('Authorization', `Bearer ${tokenValue}`)
        .json({ bookName: 'Salmos', chapter: 1, bibleVersion: 'ARC' })
      generatedQuizResponse.assertStatus(200)
      assert.notProperty(generatedQuizResponse.body().quiz.questions[0], 'respostaCorreta')

      const forgedResult = await client
        .post('/quiz-results')
        .header('Authorization', `Bearer ${tokenValue}`)
        .json({ quizId: quiz.id, correctAnswers: 99, totalQuestions: 2, timeSeconds: 1 })
      forgedResult.assertStatus(400)

      const verifiedResult = await client
        .post('/quiz-results')
        .header('Authorization', `Bearer ${tokenValue}`)
        .json({
          quizId: quiz.id,
          timeSeconds: 30,
          answers: [
            { questionId: 'security-q1', answer: 'A' },
            { questionId: 'security-q2', answer: 'D' },
          ],
        })

      verifiedResult.assertStatus(201)
      verifiedResult.assertBodyContains({
        result: {
          correctAnswers: 1,
          totalQuestions: 2,
          score: 50,
        },
      })

      const storedResult = await QuizResult.query().where('user_id', user.id).firstOrFail()
      storedResult.updatedAt = DateTime.now().minus({ days: 30 })
      await storedResult.save()
      const repeatedSubmission = await client
        .post('/quiz-results')
        .header('Authorization', `Bearer ${tokenValue}`)
        .json({
          quizId: quiz.id,
          timeSeconds: 1,
          answers: [
            { questionId: 'security-q1', answer: 'A' },
            { questionId: 'security-q2', answer: 'C' },
          ],
        })
      repeatedSubmission.assertStatus(200)
      repeatedSubmission.assertBodyContains({
        alreadyRecorded: true,
        result: { correctAnswers: 1, score: 50 },
      })
      const monthly = await client.get('/tamagoshi').header('Authorization', `Bearer ${tokenValue}`)
      assert.equal(monthly.body().data.score.points, 2)
      await storedResult.refresh()
      assert.isTrue(
        storedResult.updatedAt.toMillis() > DateTime.now().minus({ minutes: 1 }).toMillis()
      )
      const history = await client
        .get('/quiz-results/me')
        .header('Authorization', `Bearer ${tokenValue}`)
      history.assertStatus(200)
      assert.equal(history.body().results[0].lastCompletedAt, storedResult.updatedAt.toISO())
    } finally {
      await QuizResult.query().where('user_id', user.id).delete()
      await QuizQuestion.query().where('quiz_id', quiz.id).delete()
      await quiz.delete()
      await user.delete()
    }
  })

  test('email verification enables login only after a valid code', async ({ client, assert }) => {
    const email = `email-verification-${Date.now()}@example.invalid`
    const user = await User.create({
      fullName: 'Unverified Test User',
      email,
      password: 'TemporaryTestPassword123',
      emailVerified: false,
    })
    const code = '12345678'

    try {
      await EmailVerification.create({
        userId: user.id,
        tokenHash: hashPublicToken(code),
        attempts: 0,
        used: false,
        expiresAt: DateTime.now().plus({ minutes: 15 }),
      })

      const unverifiedLogin = await client.post('/auth/login').json({
        email,
        password: 'TemporaryTestPassword123',
      })
      unverifiedLogin.assertStatus(401)

      const verifyResponse = await client.post('/auth/verify-email').json({ email, code })
      verifyResponse.assertStatus(200)
      const verifiedUser = await User.findOrFail(user.id)
      assert.isTrue(verifiedUser.emailVerified)

      const verifiedLogin = await client.post('/auth/login').json({
        email,
        password: 'TemporaryTestPassword123',
      })
      verifiedLogin.assertStatus(200)
    } finally {
      await EmailVerification.query().where('user_id', user.id).delete()
      await user.delete()
    }
  })

  test('admin login throttles repeated failures per route and IP', async ({ client, assert }) => {
    const statuses: number[] = []
    const email = `admin-throttle-${Date.now()}@example.invalid`

    for (let attempt = 0; attempt < 6; attempt++) {
      const response = await client.post('/admin/login').json({
        email,
        password: 'SyntheticInvalidPassword',
      })
      statuses.push(response.status())
    }

    assert.deepEqual(statuses, [401, 401, 401, 401, 401, 429])
  })
})
