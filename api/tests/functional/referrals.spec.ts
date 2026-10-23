import { test } from '@japa/runner'
import { mock } from 'node:test'
import User from '#models/user'
import EmailVerification from '#models/email_verification'
import db from '@adonisjs/lucid/services/db'
import emailService from '#services/email_service'

// This suite sends no email. Run only against an isolated test database.
test.group('Invitations', () => {
  test('registration, optional code, verified reward, duplicates and public landing', async ({
    client,
    assert,
  }) => {
    const suffix = Date.now()
    const prefix = `referral-${suffix}`
    const codes = new Map<string, string>()
    const mail = mock.method(
      emailService,
      'sendEmailVerificationCode',
      async (email: string, code: string) => {
        codes.set(email, code)
      }
    )
    const password = 'ReferralTest12345'
    const inviter = await User.create({
      fullName: 'Inviter',
      email: `${prefix}-owner@example.invalid`,
      password,
      emailVerified: true,
    })
    const accessToken = await User.accessTokens.create(inviter)
    const token = accessToken.value!.release()
    const authorization = `Bearer ${token}`
    const email = `${prefix}-new@example.invalid`
    const noCodeEmail = `${prefix}-optional@example.invalid`
    try {
      const unauthorized = await client.get('/referrals/me')
      unauthorized.assertStatus(401)
      const first = await client.get('/referrals/me').header('Authorization', authorization)
      first.assertStatus(200)
      const invitation = first.body().data
      assert.match(invitation.code, /^[A-F0-9]{12}$/)
      assert.equal(invitation.totalHealthPoints, 0)
      const again = await client.get('/referrals/me').header('Authorization', authorization)
      assert.equal(again.body().data.code, invitation.code)
      const [parallelOne, parallelTwo] = await Promise.all([
        client.get('/referrals/me').header('Authorization', authorization),
        client.get('/referrals/me').header('Authorization', authorization),
      ])
      assert.equal(parallelOne.body().data.code, parallelTwo.body().data.code)
      const landing = await client.get(`/invite/${invitation.code}`)
      landing.assertStatus(200)
      assert.include(landing.text(), `readbible://auth?mode=register&amp;invite=${invitation.code}`)
      const invalid = await client
        .post('/auth/register')
        .json({ name: 'Invalid Code', email, password, inviteCode: 'FFFFFFFFFFFF' })
      invalid.assertStatus(400)
      assert.isNull(await User.findBy('email', email))
      const register = await client
        .post('/auth/register')
        .json({ name: 'New Reader', email, password, inviteCode: invitation.code.toLowerCase() })
      register.assertStatus(202)
      const pending = await client.get('/referrals/me').header('Authorization', authorization)
      assert.equal(pending.body().data.pendingInvites, 1)
      assert.equal(pending.body().data.totalHealthPoints, 0)
      const optional = await client
        .post('/auth/register')
        .json({ name: 'No Invitation', email: noCodeEmail, password })
      optional.assertStatus(202)
      const code = codes.get(email)
      assert.isDefined(code)
      const badVerification = await client
        .post('/auth/verify-email')
        .json({ email, code: '00000000' })
      badVerification.assertStatus(200)
      const unrewarded = await client.get('/referrals/me').header('Authorization', authorization)
      assert.equal(unrewarded.body().data.totalHealthPoints, 0)
      // Two simultaneous successful confirmations must award exactly once.
      await Promise.all([
        client.post('/auth/verify-email').json({ email, code }),
        client.post('/auth/verify-email').json({ email, code }),
      ])
      const awarded = await client.get('/referrals/me').header('Authorization', authorization)
      assert.equal(awarded.body().data.confirmedInvites, 1)
      assert.equal(awarded.body().data.pendingInvites, 0)
      assert.equal(awarded.body().data.totalHealthPoints, 5)
      await client.post('/auth/verify-email').json({ email, code })
      await client
        .post('/auth/register')
        .json({ name: 'Existing Reader', email, password, inviteCode: invitation.code })
      // The owner cannot attach their own code to an already existing account.
      await client
        .post('/auth/register')
        .json({ name: 'Inviter', email: inviter.email, password, inviteCode: invitation.code })
      const unchanged = await client.get('/referrals/me').header('Authorization', authorization)
      assert.equal(unchanged.body().data.totalHealthPoints, 5)
      assert.equal(unchanged.body().data.confirmedInvites, 1)
      const optionalUser = await User.findByOrFail('email', noCodeEmail)
      assert.isNull(
        await db.from('user_referrals').where('referred_user_id', optionalUser.id).first()
      )
    } finally {
      mail.mock.restore()
      const users = await User.query().where('email', 'like', `${prefix}%`)
      for (const user of users) {
        await EmailVerification.query().where('user_id', user.id).delete()
        await db.from('audit_logs').where('user_id', user.id).delete()
      }
      await User.query()
        .whereIn(
          'id',
          users.map((user) => user.id)
        )
        .delete()
    }
  }).timeout(30000)
})
