import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireUser, readJson } from '../_auth.js'
import { getServiceSupabase, getWimpyPayHeaders } from '../_supabase.js'

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' })
  const auth = await requireUser(request, response)
  if (auth.error) return auth.error
  const body = await readJson(request)
  const amount = Number(body?.amount)
  if (!Number.isInteger(amount) || amount < 10000) return response.status(400).json({ error: 'Enter a funding amount of at least ₦100.' })
  const idempotencyKey = crypto.randomUUID()
  const upstreamResponse = await fetch(`${process.env.WIMPYPAY_INTERNAL_URL}/internal/wallet-funding/initiate`, {
    method: 'POST',
    headers: { ...getWimpyPayHeaders(), 'idempotency-key': idempotencyKey },
    body: JSON.stringify({ userId: auth.user.id, amount, idempotencyKey }),
  })
  const result: any = await upstreamResponse.json().catch(() => ({}))
  if (!upstreamResponse.ok) return response.status(upstreamResponse.status).json({ error: result.error ?? 'WimpyPay could not start wallet funding.' })
  const reference = typeof result.reference === 'string' ? result.reference : ''
  if (!reference) return response.status(502).json({ error: 'WimpyPay returned no funding reference.' })
  const { data: funding, error } = await getServiceSupabase().from('wc_wallet_fundings').insert({ user_id: auth.user.id, amount_kobo: amount, reference, status: 'pending' }).select('id,amount_kobo,reference,status,created_at').single()
  if (error) return response.status(500).json({ error: 'Funding started but could not be recorded. Contact support.' })
  return response.status(200).json({ funding, paystackPublicKey: result.paystackPublicKey })
}
