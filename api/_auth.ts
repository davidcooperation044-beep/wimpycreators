import { getServiceSupabase, json } from './_supabase'

export async function requireUser(request: { headers: Record<string, string | string[] | undefined> }) {
  const header = request.headers.authorization
  const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return { error: json(401, { error: 'Sign in with WimpyID to continue.' }) }
  const { data, error } = await getServiceSupabase().auth.getUser(token)
  if (error || !data.user) return { error: json(401, { error: 'Your session has expired. Please sign in again.' }) }
  return { user: data.user }
}

export async function readJson(request: { body?: unknown }) {
  if (typeof request.body === 'object' && request.body !== null) return request.body as Record<string, unknown>
  if (typeof request.body === 'string') {
    try { return JSON.parse(request.body) as Record<string, unknown> } catch { return null }
  }
  return null
}
