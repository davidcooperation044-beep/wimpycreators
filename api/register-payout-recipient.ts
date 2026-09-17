import { requireUser, readJson } from './_auth'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase, getWimpyPayHeaders } from './_supabase'

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' })
  const auth = await requireUser(request, response)
  if (auth.error) return auth.error
  const body = await readJson(request)
  const bankCode = typeof body?.bankCode === 'string' ? body.bankCode : ''
  const accountNumber = typeof body?.accountNumber === 'string' ? body.accountNumber : ''
  const accountName = typeof body?.accountName === 'string' ? body.accountName : ''
  if (!bankCode || !/^\d{10}$/.test(accountNumber) || !accountName) return response.status(400).json({ error: 'Enter valid bank details.' })
  const upstreamResponse = await fetch(`${process.env.WIMPYPAY_INTERNAL_URL}/internal/payout-recipients`, { method: 'POST', headers: getWimpyPayHeaders(), body: JSON.stringify({ creatorUserId: auth.user?.id, bankCode, accountNumber, accountName }) })
  const result = await upstreamResponse.json().catch(() => ({}))
  if (!upstreamResponse.ok) return response.status(upstreamResponse.status).json({ error: result.error ?? 'Paystack could not validate these bank details.' })
  const recipientCode = result.recipient_code ?? result.recipientCode
  if (!recipientCode) return response.status(502).json({ error: 'WimpyPay returned no recipient code.' })
  const { error } = await getServiceSupabase().from('wc_creators').update({ payout_recipient_code: recipientCode }).eq('user_id', auth.user?.id)
  if (error) return response.status(500).json({ error: 'Recipient registered but creator profile could not be updated.' })
  return response.status(200).json({ recipientCode })
}
