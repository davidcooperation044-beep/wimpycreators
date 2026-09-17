import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async () => {
  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } })
  const now = new Date().toISOString()
  const { data: subscriptions } = await supabase.from('wc_subscriptions').select('id,subscriber_id,creator_id,tier_id,status,renews_at,renewal_attempts').in('status', ['active', 'past_due']).lte('renews_at', now).limit(500)
  const payUrl = `${Deno.env.get('WIMPYPAY_INTERNAL_URL')}/internal/charge-wallet`
  for (let offset = 0; offset < (subscriptions ?? []).length; offset += 50) for (const subscription of (subscriptions ?? []).slice(offset, offset + 50)) {
    const { data: tier } = await supabase.from('wc_membership_tiers').select('price_kobo').eq('id', subscription.tier_id).single()
    if (!tier) continue
    const idempotencyKey = crypto.randomUUID()
    const charge = await fetch(payUrl, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${Deno.env.get('WIMPYPAY_SHARED_SECRET') ?? ''}`, 'idempotency-key': idempotencyKey }, body: JSON.stringify({ userId: subscription.subscriber_id, amount: tier.price_kobo, sourceProduct: 'wimpycreators', reason: `Subscription renewal ${subscription.id}`, idempotencyKey }) })
    const result = await charge.json().catch(() => ({}))
    if (charge.ok) {
      const renewsAt = new Date(); renewsAt.setMonth(renewsAt.getMonth() + 1)
      await supabase.from('wc_subscriptions').update({ status: 'active', renews_at: renewsAt.toISOString(), renewal_attempts: 0 }).eq('id', subscription.id)
      await supabase.from('wc_subscription_charges').insert({ subscription_id: subscription.id, creator_id: subscription.creator_id, amount_kobo: tier.price_kobo, idempotency_key: idempotencyKey, wimpypay_reference: result.reference ?? result.transaction_reference ?? result.transactionReference })
    } else if (subscription.status === 'past_due') await supabase.from('wc_subscriptions').update({ status: 'cancelled', cancelled_at: new Date().toISOString(), renewal_attempts: (subscription.renewal_attempts ?? 0) + 1 }).eq('id', subscription.id)
    else { const retryAt = new Date(); retryAt.setDate(retryAt.getDate() + 3); await supabase.from('wc_subscriptions').update({ status: 'past_due', renews_at: retryAt.toISOString(), renewal_attempts: (subscription.renewal_attempts ?? 0) + 1 }).eq('id', subscription.id) }
  }
  return new Response(JSON.stringify({ processed: subscriptions?.length ?? 0 }), { headers: { 'content-type': 'application/json' } })
})
