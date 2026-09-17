import { requireUser, readJson } from './_auth'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase, getWimpyPayHeaders } from './_supabase'

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' })
  const auth = await requireUser(request, response)
  if (auth.error) return auth.error
  const body = await readJson(request)
  const tierId = typeof body?.tierId === 'string' ? body.tierId : ''
  const supabase = getServiceSupabase()
  const { data: tier } = await supabase.from('wc_membership_tiers').select('id,creator_id,price_kobo,is_active').eq('id', tierId).maybeSingle()
  if (!tier || !tier.is_active) return response.status(404).json({ error: 'That membership tier is no longer available.' })
  const renewsAt = new Date(); renewsAt.setMonth(renewsAt.getMonth() + 1)
  const upstreamResponse = await fetch(`${process.env.WIMPYPAY_INTERNAL_URL}/internal/charge-wallet`, { method: 'POST', headers: getWimpyPayHeaders(), body: JSON.stringify({ userId: auth.user?.id, amount: tier.price_kobo, sourceProduct: 'wimpycreators', reason: `Membership tier ${tier.id}` }) })
  const result = await upstreamResponse.json().catch(() => ({}))
  if (!upstreamResponse.ok) return response.status(upstreamResponse.status === 402 ? 402 : 502).json({ error: result.error ?? 'Wallet charge failed. Fund your WimpyPay wallet and try again.' })
  const { data: subscription, error } = await supabase.from('wc_subscriptions').insert({ subscriber_id: auth.user?.id, creator_id: tier.creator_id, tier_id: tier.id, status: 'active', renews_at: renewsAt.toISOString() }).select().single()
  if (error) return response.status(500).json({ error: 'Payment succeeded but the membership could not be recorded.' })
  const { error: ledgerError } = await supabase.from('wc_subscription_charges').insert({ subscription_id: subscription.id, creator_id: tier.creator_id, amount_kobo: tier.price_kobo })
  if (ledgerError) return response.status(500).json({ error: 'Payment succeeded but the membership charge could not be recorded.' })
  return response.status(200).json({ subscription })
}
