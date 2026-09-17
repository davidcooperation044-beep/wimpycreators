import { createClient } from '@supabase/supabase-js'

let serviceClient: ReturnType<typeof createClient> | undefined

export function getServiceSupabase() {
  if (!serviceClient) {
    serviceClient = createClient(process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '', process.env.SUPABASE_SERVICE_ROLE_KEY ?? '', { auth: { autoRefreshToken: false, persistSession: false } })
  }
  return serviceClient
}

export function getWimpyPayHeaders() {
  return { 'content-type': 'application/json', authorization: `Bearer ${process.env.WIMPYPAY_SHARED_SECRET ?? ''}` }
}

export async function recordPaymentReconciliation(input: { userId: string; amountKobo: number; reason: string; reference?: string }) {
  const { error } = await getServiceSupabase().from('wc_payment_reconciliation').insert({ user_id: input.userId, amount_kobo: input.amountKobo, reason: input.reason, wimpypay_reference: input.reference ?? null })
  if (error) console.error('Payment reconciliation record failed', { error, ...input })
}
