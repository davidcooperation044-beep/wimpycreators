import { requireUser, readJson } from './_auth'
import { getServiceSupabase, getWimpyPayHeaders, json } from './_supabase'

export default async function handler(request: any) {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' })
  const auth = await requireUser(request)
  if (auth.error) return auth.error
  const body = await readJson(request)
  const tierId = typeof body?.tierId === 'string' ? body.tierId : ''
  const supabase = getServiceSupabase()
  const { data: tier } = await supabase.from('wc_membership_tiers').select('id,creator_id,price_kobo,is_active').eq('id', tierId).maybeSingle()
  if (!tier || !tier.is_active) return json(404, { error: 'That membership tier is no longer available.' })
  const renewsAt = new Date(); renewsAt.setMonth(renewsAt.getMonth() + 1)
  const response = await fetch(`${process.env.WIMPYPAY_INTERNAL_URL}/internal/charge-wallet`, { method: 'POST', headers: getWimpyPayHeaders(), body: JSON.stringify({ userId: auth.user?.id, amount: tier.price_kobo, sourceProduct: 'wimpycreators', reason: `Membership tier ${tier.id}` }) })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) return json(response.status === 402 ? 402 : 502, { error: result.error ?? 'Wallet charge failed. Fund your WimpyPay wallet and try again.' })
  const { data: subscription, error } = await supabase.from('wc_subscriptions').insert({ subscriber_id: auth.user?.id, creator_id: tier.creator_id, tier_id: tier.id, status: 'active', renews_at: renewsAt.toISOString() }).select().single()
  if (error) return json(500, { error: 'Payment succeeded but the membership could not be recorded.' })
  return json(200, { subscription })
}
