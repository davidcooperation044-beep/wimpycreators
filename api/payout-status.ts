import { requireUser } from './_auth.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase, getWimpyPayHeaders } from './_supabase.js'

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' })
  const auth = await requireUser(request, response)
  if (auth.error) return auth.error
  const payoutId = request.query?.id
  if (typeof payoutId !== 'string' || !payoutId) return response.status(400).json({ error: 'A single payout id is required.' })
  const supabase = getServiceSupabase()
  const { data: payout } = await supabase.from('wc_payouts').select('*,wc_creators!inner(user_id)').eq('id', payoutId).eq('wc_creators.user_id', auth.user?.id).maybeSingle()
  if (!payout) return response.status(404).json({ error: 'Payout not found.' })
  if (payout.paystack_transfer_code) {
    const upstreamResponse = await fetch(`${process.env.WIMPYPAY_INTERNAL_URL}/internal/payout/${payout.paystack_transfer_code}`, { headers: getWimpyPayHeaders() })
    if (upstreamResponse.ok) {
      const result: any = await upstreamResponse.json()
      const status = result.status ?? payout.status
      if (status !== payout.status) await supabase.from('wc_payouts').update({ status, processed_at: ['paid', 'failed'].includes(status) ? new Date().toISOString() : null }).eq('id', payout.id)
      return response.status(200).json({ ...payout, status })
    }
  }
  return response.status(200).json(payout)
}
