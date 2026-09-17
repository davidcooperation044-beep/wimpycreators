import { requireUser, readJson } from './_auth'
import { getServiceSupabase, getWimpyPayHeaders, json } from './_supabase'

export default async function handler(request: any) {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' })
  const auth = await requireUser(request)
  if (auth.error) return auth.error
  const body = await readJson(request)
  const creatorId = typeof body?.creatorId === 'string' ? body.creatorId : ''
  const amount = Number(body?.amount)
  const message = typeof body?.message === 'string' ? body.message.slice(0, 500) : null
  if (!creatorId || !Number.isInteger(amount) || amount < 100) return json(400, { error: 'Enter a valid tip amount.' })
  const supabase = getServiceSupabase()
  const { data: creator } = await supabase.from('wc_creators').select('id,user_id').eq('id', creatorId).maybeSingle()
  if (!creator) return json(404, { error: 'Creator not found.' })
  const response = await fetch(`${process.env.WIMPYPAY_INTERNAL_URL}/internal/charge-wallet`, { method: 'POST', headers: getWimpyPayHeaders(), body: JSON.stringify({ userId: auth.user?.id, amount, sourceProduct: 'wimpycreators', reason: `Tip to creator ${creatorId}` }) })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) return json(response.status === 402 ? 402 : 502, { error: result.error ?? 'Wallet charge failed. Fund your WimpyPay wallet and try again.' })
  const { data: tip, error } = await supabase.from('wc_tips').insert({ sender_id: auth.user?.id, creator_id: creatorId, amount_kobo: amount, message, source_product: 'wimpycreators' }).select().single()
  if (error) return json(500, { error: 'Payment succeeded but the tip could not be recorded. Contact support.' })
  return json(200, { tip })
}
