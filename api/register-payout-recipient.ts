import { requireUser, readJson } from './_auth'
import { getServiceSupabase, getWimpyPayHeaders, json } from './_supabase'

export default async function handler(request: any) {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' })
  const auth = await requireUser(request)
  if (auth.error) return auth.error
  const body = await readJson(request)
  const bankCode = typeof body?.bankCode === 'string' ? body.bankCode : ''
  const accountNumber = typeof body?.accountNumber === 'string' ? body.accountNumber : ''
  const accountName = typeof body?.accountName === 'string' ? body.accountName : ''
  if (!bankCode || !/^\d{10}$/.test(accountNumber) || !accountName) return json(400, { error: 'Enter valid bank details.' })
  const response = await fetch(`${process.env.WIMPYPAY_INTERNAL_URL}/internal/payout-recipients`, { method: 'POST', headers: getWimpyPayHeaders(), body: JSON.stringify({ creatorUserId: auth.user?.id, bankCode, accountNumber, accountName }) })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) return json(response.status, { error: result.error ?? 'Paystack could not validate these bank details.' })
  const recipientCode = result.recipient_code ?? result.recipientCode
  if (!recipientCode) return json(502, { error: 'WimpyPay returned no recipient code.' })
  const { error } = await getServiceSupabase().from('wc_creators').update({ payout_recipient_code: recipientCode }).eq('user_id', auth.user?.id)
  if (error) return json(500, { error: 'Recipient registered but creator profile could not be updated.' })
  return json(200, { recipientCode })
}
