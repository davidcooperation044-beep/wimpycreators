import type { Connect } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import tip from './api/tip.js'
import subscribe from './api/subscribe.js'
import initiateFunding from './api/fund-wallet/initiate.js'
import verifyFunding from './api/fund-wallet/verify.js'
import requestPayout from './api/request-payout.js'
import payoutStatus from './api/payout-status.js'
import registerRecipient from './api/register-payout-recipient.js'

type Handler = (request: any, response: any) => Promise<unknown> | unknown

const routes: Record<string, Handler> = {
  '/api/tip': tip,
  '/api/subscribe': subscribe,
  '/api/fund-wallet/initiate': initiateFunding,
  '/api/fund-wallet/verify': verifyFunding,
  '/api/request-payout': requestPayout,
  '/api/register-payout-recipient': registerRecipient,
}

function responseAdapter(response: ServerResponse) {
  const adapted = response as ServerResponse & { status: (code: number) => typeof adapted; json: (body: unknown) => typeof adapted }
  adapted.status = (code) => { response.statusCode = code; return adapted }
  adapted.json = (body) => { if (!response.writableEnded) { response.setHeader('content-type', 'application/json'); response.end(JSON.stringify(body)) } return adapted }
  return adapted
}

async function requestBody(request: IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(Buffer.from(chunk))
  if (!chunks.length) return undefined
  const raw = Buffer.concat(chunks).toString('utf8')
  try { return JSON.parse(raw) } catch { return raw }
}

export function apiMiddleware(): Connect.NextHandleFunction {
  return async (request, response, next) => {
    const url = request.url?.split('?')[0] ?? ''
    const dynamicPayout = url.match(/^\/api\/payout-status\/([^/]+)$/)
    const handler = dynamicPayout ? payoutStatus : routes[url]
    if (!handler) return next()
    const body = await requestBody(request)
    const query = dynamicPayout ? { id: dynamicPayout[1] } : Object.fromEntries(new URL(request.url ?? '/', 'http://localhost').searchParams)
    try { await handler({ ...request, headers: request.headers, method: request.method, url: request.url, body, query } as any, responseAdapter(response) as any) } catch (error) { console.error(`API route failed: ${url}`, error); if (!response.writableEnded) responseAdapter(response).status(500).json({ error: 'Internal server error.' }) }
  }
}
