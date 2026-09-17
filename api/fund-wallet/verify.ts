import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireUser, readJson } from '../_auth.js'
import { getServiceSupabase, getWimpyPayHeaders } from '../_supabase.js'

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' })
  const auth = await requireUser(request, response)
  if (auth.error) return auth.error
  const body = await readJson(request)
  const reference = typeof body?.reference === 'string' ? body.reference.trim() : ''
  if (!reference) return response.status(400).json({ error: 'A funding reference is required.' })
  const supabase = getServiceSupabase()
  const { data: funding } = await supabase.from('wc_wallet_fundings').select('id,user_id,amount_kobo,reference,status,confirmed_at').eq('reference', reference).eq('user_id', auth.user.id).maybeSingle()
  if (!funding) return response.status(404).json({ error: 'Funding record not found.' })
  if (funding.status === 'confirmed') return response.status(200).json({ status: 'confirmed', funding })
  if (funding.status === 'failed') return response.status(400).json({ error: 'This wallet funding attempt has already failed.', status: 'failed', funding })
  const upstreamResponse = await fetch(`${process.env.WIMPYPAY_INTERNAL_URL}/internal/wallet-funding/verify`, { method: 'POST', headers: getWimpyPayHeaders(), body: JSON.stringify({ reference }) })
  const result: any = await upstreamResponse.json().catch(() => ({}))
  if (!upstreamResponse.ok || result.status === 'failed') {
    const message = result.error ?? 'WimpyPay could not confirm this wallet funding.'
    await supabase.from('wc_wallet_fundings').update({ status: 'failed' }).eq('id', funding.id).eq('status', 'pending')
    return response.status(upstreamResponse.ok ? 400 : upstreamResponse.status).json({ error: message, status: 'failed' })
  }
  const { data: confirmed, error } = await supabase.from('wc_wallet_fundings').update({ status: 'confirmed', confirmed_at: new Date().toISOString() }).eq('id', funding.id).eq('status', 'pending').select('id,user_id,amount_kobo,reference,status,confirmed_at').maybeSingle()
  if (error) return response.status(500).json({ error: 'Wallet funding was verified but could not be recorded.' })
  return response.status(200).json({ status: 'confirmed', funding: confirmed ?? { ...funding, status: 'confirmed' }, balance: result.balance })
}
