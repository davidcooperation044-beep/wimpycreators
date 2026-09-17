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
