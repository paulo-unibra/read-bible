import { POINTS, scorePeriod } from '#services/tamagoshi_points_service'
import User from '#models/user'
import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import { randomBytes } from 'node:crypto'
import { DateTime } from 'luxon'

export const INVITE_HEALTH_REWARD = POINTS.invite

export default class ReferralsController {
  async me({ auth, response }: HttpContext) {
    const user = auth.user!
    const code = await db.transaction(async (trx) => {
      await User.query({ client: trx }).where('id', user.id).forUpdate().firstOrFail()
      const existing = await trx.from('invite_codes').where('user_id', user.id).first()
      if (existing) return existing.code as string
      const generated = randomBytes(6).toString('hex').toUpperCase()
      await trx.table('invite_codes').insert({
        user_id: user.id,
        code: generated,
        created_at: DateTime.now().toSQL({ includeOffset: false }),
      })
      return generated
    })
    const period = scorePeriod()
    const monthly = await db
      .from('user_referrals')
      .where('referrer_id', user.id)
      .where('rewarded_at', '>=', period.start)
      .where('rewarded_at', '<', period.end)
      .count('* as count')
      .sum('reward_points as points')
      .first()
    const confirmed = await db
      .from('user_referrals')
      .where('referrer_id', user.id)
      .whereNotNull('rewarded_at')
      .count('* as count')
      .sum('reward_points as points')
      .first()
    const pending = await db
      .from('user_referrals')
      .where('referrer_id', user.id)
      .whereNotNull('referred_user_id')
      .whereNull('rewarded_at')
      .count('* as count')
      .first()
    const base = env.get('PUBLIC_API_URL', 'https://bibliafoco.com.br/api').replace(/\/+$/, '')
    return response.ok({
      success: true,
      data: {
        code,
        inviteUrl: `${base}/invite/${code}`,
        confirmedInvites: Number(confirmed?.count || 0),
        pendingInvites: Number(pending?.count || 0),
        month: period.month,
        monthlyConfirmedInvites: Number(monthly?.count || 0),
        monthlyPoints: Number(monthly?.points || 0),
        totalHealthPoints: Number(confirmed?.points || 0),
        rewardPerInvite: INVITE_HEALTH_REWARD,
      },
    })
  }

  async landing({ params, response }: HttpContext) {
    const code = String(params.code || '').toUpperCase()
    if (!/^[A-F0-9]{12}$/.test(code))
      return response.notFound({ message: 'Convite não encontrado' })
    const invitation = await db
      .from('invite_codes')
      .join('users', 'users.id', 'invite_codes.user_id')
      .where('invite_codes.code', code)
      .where('users.email_verified', true)
      .first()
    if (!invitation) return response.notFound({ message: 'Convite não encontrado' })
    response.header('Cache-Control', 'no-store')
    return response.header('Content-Type', 'text/html; charset=utf-8').send(`<!doctype html>
<html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Seu convite para Bíblia em Foco</title><style>
body{margin:0;background:#f4f9fc;color:#203947;font:17px/1.6 system-ui,sans-serif}main{max-width:460px;margin:10vh auto;padding:28px}h1{font-size:32px;line-height:1.2}code{display:block;font-size:27px;letter-spacing:2px;font-weight:700;margin:24px 0;padding:16px;background:white;border-radius:12px;text-align:center}a{color:#0879b6}a.open{display:block;padding:14px;text-align:center;background:#0879b6;color:white;border-radius:12px;text-decoration:none;font-weight:600}nav{display:flex;gap:24px;margin-top:20px;flex-wrap:wrap}small{display:block;margin-top:24px}</style>
<main><h1>Uma leitura por dia. Uma jornada juntos.</h1><p>Você recebeu um convite para conhecer a Bíblia em Foco. No cadastro, informe este código opcional:</p>
<code>${code}</code><a class="open" href="readbible://auth?mode=register&amp;invite=${code}">Abrir no aplicativo</a>
<p>Ainda não tem o app? Instale, crie sua conta e digite o código acima.</p><nav><a href="https://play.google.com/store/apps/details?id=com.readbible.app">Baixar para Android</a><a href="https://apps.apple.com/app/id6758371735">Baixar para iPhone</a></nav>
<small>Após a confirmação do seu e-mail, quem convidou recebe ${INVITE_HEALTH_REWARD} pontos no Tamagoshi no mês da confirmação.</small></main></html>`)
  }
}
