import { requireUser, readJson } from './_auth'
import { getServiceSupabase, getWimpyPayHeaders, json } from './_supabase'

export default async function handler(request: any) {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' })
  const auth = await requireUser(request)
  if (auth.error) return auth.error
  const body = await readJson(request)
  const amount = Number(body?.amount)
  const supabase = getServiceSupabase()
  const { data: creator } = await supabase.from('wc_creators').select('id,payout_recipient_code').eq('user_id', auth.user?.id).maybeSingle()
  if (!creator) return json(404, { error: 'Creator profile not found.' })
  if (!creator.payout_recipient_code) return json(400, { error: 'Complete payout setup before requesting a payout.' })
  if (!Number.isInteger(amount) || amount < 1000) return json(400, { error: 'The minimum payout is ₦10.' })
  const { data: payout, error } = await supabase.from('wc_payouts').insert({ creator_id: creator.id, amount_kobo: amount, status: 'pending' }).select().single()
  if (error) return json(500, { error: 'Could not create payout request.' })
  const response = await fetch(`${process.env.WIMPYPAY_INTERNAL_URL}/internal/payout`, { method: 'POST', headers: getWimpyPayHeaders(), body: JSON.stringify({ creatorUserId: auth.user?.id, amount }) })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) { await supabase.from('wc_payouts').update({ status: 'failed', processed_at: new Date().toISOString() }).eq('id', payout.id); return json(response.status, { error: result.error ?? 'WimpyPay could not start this payout.' }) }
  const transferCode = result.transfer_code ?? result.transferCode
  await supabase.from('wc_payouts').update({ paystack_transfer_code: transferCode, status: result.status ?? 'processing' }).eq('id', payout.id)
  return json(200, { payout: { ...payout, paystack_transfer_code: transferCode, status: result.status ?? 'processing' } })
}
