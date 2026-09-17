import { requireUser } from './_auth'
import { getServiceSupabase, getWimpyPayHeaders, json } from './_supabase'

export default async function handler(request: any) {
  if (request.method !== 'GET') return json(405, { error: 'Method not allowed' })
  const auth = await requireUser(request)
  if (auth.error) return auth.error
  const payoutId = request.query?.id
  const supabase = getServiceSupabase()
  const { data: payout } = await supabase.from('wc_payouts').select('*,wc_creators!inner(user_id)').eq('id', payoutId).eq('wc_creators.user_id', auth.user?.id).maybeSingle()
  if (!payout) return json(404, { error: 'Payout not found.' })
  if (payout.paystack_transfer_code) {
    const response = await fetch(`${process.env.WIMPYPAY_INTERNAL_URL}/internal/payout/${payout.paystack_transfer_code}`, { headers: getWimpyPayHeaders() })
    if (response.ok) {
      const result = await response.json()
      const status = result.status ?? payout.status
      if (status !== payout.status) await supabase.from('wc_payouts').update({ status, processed_at: ['paid', 'failed'].includes(status) ? new Date().toISOString() : null }).eq('id', payout.id)
      return json(200, { ...payout, status })
    }
  }
  return json(200, payout)
}
