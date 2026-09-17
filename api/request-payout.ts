import { requireUser, readJson } from './_auth'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase, getWimpyPayHeaders } from './_supabase'

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' })
  const auth = await requireUser(request, response)
  if (auth.error) return auth.error
  const body = await readJson(request)
  const amount = Number(body?.amount)
  const supabase = getServiceSupabase()
  const { data: creator } = await supabase.from('wc_creators').select('id,payout_recipient_code').eq('user_id', auth.user?.id).maybeSingle()
  if (!creator) return response.status(404).json({ error: 'Creator profile not found.' })
  if (!creator.payout_recipient_code) return response.status(400).json({ error: 'Complete payout setup before requesting a payout.' })
  if (!Number.isInteger(amount) || amount < 1000) return response.status(400).json({ error: 'The minimum payout is ₦10.' })
  const [{ data: tips }, { data: subscriptionCharges }, { data: paidPayouts }, { data: activePayouts }] = await Promise.all([
    supabase.from('wc_tips').select('amount_kobo').eq('creator_id', creator.id),
    supabase.from('wc_subscription_charges').select('amount_kobo').eq('creator_id', creator.id),
    supabase.from('wc_payouts').select('amount_kobo').eq('creator_id', creator.id).in('status', ['processing', 'paid']),
    supabase.from('wc_payouts').select('id').eq('creator_id', creator.id).in('status', ['pending', 'processing']).limit(1),
  ])
  if (activePayouts?.length) return response.status(409).json({ error: 'A payout is already in progress. Wait for it to finish before requesting another.' })
  const totalTips = (tips ?? []).reduce((sum, item) => sum + item.amount_kobo, 0)
  const totalSubscriptions = (subscriptionCharges ?? []).reduce((sum, item) => sum + item.amount_kobo, 0)
  const totalPaidOut = (paidPayouts ?? []).reduce((sum, item) => sum + item.amount_kobo, 0)
  const availableBalance = totalTips + totalSubscriptions - totalPaidOut
  if (amount > availableBalance) return response.status(400).json({ error: `Your available balance is ₦${Math.max(availableBalance, 0) / 100}. Request a smaller amount.` })
  const idempotencyKey = crypto.randomUUID()
  const { data: payout, error } = await supabase.from('wc_payouts').insert({ creator_id: creator.id, amount_kobo: amount, status: 'pending', idempotency_key: idempotencyKey }).select().single()
  if (error) { if (error.code === '23505') return response.status(409).json({ error: 'A payout is already in progress. Wait for it to finish before requesting another.' }); return response.status(500).json({ error: 'Could not create payout request.' }) }
  const upstreamResponse = await fetch(`${process.env.WIMPYPAY_INTERNAL_URL}/internal/payout`, { method: 'POST', headers: { ...getWimpyPayHeaders(), 'idempotency-key': idempotencyKey }, body: JSON.stringify({ creatorUserId: auth.user?.id, amount, idempotencyKey }) })
  const result = await upstreamResponse.json().catch(() => ({}))
  if (!upstreamResponse.ok) { await supabase.from('wc_payouts').update({ status: 'failed', processed_at: new Date().toISOString() }).eq('id', payout.id); return response.status(upstreamResponse.status).json({ error: result.error ?? 'WimpyPay could not start this payout.' }) }
  const transferCode = result.transfer_code ?? result.transferCode
  await supabase.from('wc_payouts').update({ paystack_transfer_code: transferCode, wimpypay_reference: result.reference ?? result.transaction_reference ?? result.transactionReference, status: result.status ?? 'processing' }).eq('id', payout.id)
  return response.status(200).json({ payout: { ...payout, paystack_transfer_code: transferCode, status: result.status ?? 'processing' } })
}
