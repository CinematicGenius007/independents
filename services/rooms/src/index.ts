/**
 * The rooms Worker: routing, validation, and nothing else.
 *
 *   GET /health                       liveness, for uptime checks
 *   GET /v1/games                     which games are hosted, and their limits
 *   GET /v1/rooms/:game/:code         room status (peer count), as JSON
 *   GET /v1/rooms/:game/:code  + Upgrade: websocket
 *       ?client=<id>&secret=<secret>&name=<display name>
 *                                     join the room
 *
 * Every check that does not need the room's state happens here, so a malformed
 * request never wakes a Durable Object. The room itself is reached by name —
 * `game:code` — so the same code in two games is two different rooms.
 */

import type { Env } from './env'
import { GAMES, gameConfig } from './games'
import { CLIENT_ID, CLIENT_SECRET, PROTOCOL_VERSION, ROOM_CODE, cleanName } from './protocol'
import type { ErrorCode } from './protocol'
import { JOIN_HEADER } from './room'
import type { JoinRequest } from './room'

export { Room } from './room'

const ROOM_PATH = /^\/v1\/rooms\/([a-z0-9-]{1,40})\/([A-Za-z0-9]{1,40})\/?$/

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const origin = request.headers.get('Origin')
    const cors = corsHeaders(origin, env)

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    if (request.method !== 'GET') return problem(405, 'bad_request', 'Only GET is supported', cors)

    if (url.pathname === '/health') {
      return Response.json({ ok: true, protocol: PROTOCOL_VERSION }, { headers: cors })
    }

    if (url.pathname === '/v1/games') {
      const games = Object.fromEntries(
        Object.entries(GAMES).map(([id, g]) => [id, { maxPeers: g.maxPeers, log: g.log }]),
      )
      return Response.json({ protocol: PROTOCOL_VERSION, games }, { headers: cors })
    }

    const match = ROOM_PATH.exec(url.pathname)
    if (!match) return problem(404, 'bad_request', 'No such route', cors)

    const [, game, rawCode] = match
    if (!gameConfig(game)) return problem(404, 'unknown_game', `No game called ${game}`, cors)
    const code = rawCode.toUpperCase()
    if (!ROOM_CODE.test(code)) {
      return problem(400, 'bad_code', 'Room codes are 4 to 12 letters and digits', cors)
    }
    if (!originAllowed(origin, env)) {
      return problem(403, 'origin_not_allowed', 'This origin may not use the rooms API', cors)
    }

    const stub = env.ROOMS.getByName(`${game}:${code}`)

    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return Response.json(await stub.info(), { headers: cors })
    }

    const client = url.searchParams.get('client') ?? ''
    const secret = url.searchParams.get('secret') ?? ''
    if (!CLIENT_ID.test(client) || !CLIENT_SECRET.test(secret)) {
      return problem(400, 'bad_identity', 'client must be 8-64 and secret 16-128 URL-safe characters', cors)
    }

    const join: JoinRequest = { game, code, client, secret, name: cleanName(url.searchParams.get('name')) }
    const forwarded = new Request(request)
    forwarded.headers.set(JOIN_HEADER, JSON.stringify(join))
    return stub.fetch(forwarded)
  },
} satisfies ExportedHandler<Env>

function allowList(env: Env): string[] {
  return (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean)
}

/** With no allow-list configured, anyone may connect — the API is public. */
function originAllowed(origin: string | null, env: Env): boolean {
  const list = allowList(env)
  if (list.length === 0) return true
  return origin !== null && list.includes(origin)
}

function corsHeaders(origin: string | null, env: Env): HeadersInit {
  const list = allowList(env)
  const allow = list.length === 0 ? '*' : origin && list.includes(origin) ? origin : ''
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
  }
  if (allow) headers['Access-Control-Allow-Origin'] = allow
  if (allow && allow !== '*') headers.Vary = 'Origin'
  return headers
}

function problem(status: number, code: ErrorCode, message: string, headers: HeadersInit): Response {
  return Response.json({ error: code, message }, { status, headers })
}
