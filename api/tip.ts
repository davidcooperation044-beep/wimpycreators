import { requireUser, readJson } from './_auth.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase, getWimpyPayHeaders, recordPaymentReconciliation } from './_supabase.js'

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' })
  const auth = await requireUser(request, response)
  if (auth.error) return auth.error
  const body = await readJson(request)
  const creatorId = typeof body?.creatorId === 'string' ? body.creatorId : ''
  const amount = Number(body?.amount)
  const message = typeof body?.message === 'string' ? body.message.slice(0, 500) : null
  if (!creatorId || !Number.isInteger(amount) || amount < 100) return response.status(400).json({ error: 'Enter a valid tip amount.' })
  const supabase = getServiceSupabase()
  const { data: creator } = await supabase.from('wc_creators').select('id,user_id').eq('id', creatorId).maybeSingle()
  if (!creator) return response.status(404).json({ error: 'Creator not found.' })
  if (creator.user_id === auth.user?.id) return response.status(400).json({ error: 'You cannot tip your own creator profile.' })
  const idempotencyKey = crypto.randomUUID()
  const upstreamResponse = await fetch(`${process.env.WIMPYPAY_INTERNAL_URL}/internal/charge-wallet`, { method: 'POST', headers: { ...getWimpyPayHeaders(), 'idempotency-key': idempotencyKey }, body: JSON.stringify({ userId: auth.user?.id, amount, sourceProduct: 'wimpycreators', reason: `Tip to creator ${creatorId}`, idempotencyKey }) })
  const result: any = await upstreamResponse.json().catch(() => ({}))
  if (!upstreamResponse.ok) return response.status(upstreamResponse.status === 402 ? 402 : 502).json({ error: result.error ?? 'Wallet charge failed. Fund your WimpyPay wallet and try again.' })
  const reference = result.reference ?? result.transaction_reference ?? result.transactionReference
  const { data: tip, error } = await supabase.from('wc_tips').insert({ sender_id: auth.user?.id, creator_id: creatorId, amount_kobo: amount, message, source_product: 'wimpycreators', idempotency_key: idempotencyKey, wimpypay_reference: reference }).select().single()
  if (error) { await recordPaymentReconciliation({ userId: auth.user!.id, amountKobo: amount, reason: `Tip recording failed for creator ${creatorId}`, reference }); console.error('Tip charged but recording failed', { error, creatorId, userId: auth.user?.id, idempotencyKey, reference }); return response.status(500).json({ error: 'Payment succeeded but the tip could not be recorded. Support has been notified.' }) }
  return response.status(200).json({ tip })
}
