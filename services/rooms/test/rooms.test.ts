import { env, exports } from 'cloudflare:workers'
import { evictDurableObject, runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import type { Room } from '../src/room'
import { EMPTY_ROOM_TTL_MS, GRACE_MS } from '../src/room'
import type { ServerMessage } from '../src/protocol'
import { CLOSE } from '../src/protocol'

const BASE = 'https://rooms.test'

let counter = 0
/** Unique, valid ids so tests never share a room or a member by accident. */
function ident(label = 'c') {
  counter++
  return {
    client: `${label}-${counter.toString().padStart(6, '0')}-id`,
    secret: `secret-${counter}-abcdefghijklmnop`,
  }
}
function code() {
  return `R${(++counter).toString(36).toUpperCase().padStart(6, '0')}`
}

/**
 * A test client: an open socket plus everything it has been sent, with a way
 * to wait for the next message matching a predicate.
 */
class Peer {
  readonly inbox: ServerMessage[] = []
  closed: { code: number; reason: string } | null = null
  private waiters: { match: (m: ServerMessage) => boolean; resolve: (m: ServerMessage) => void }[] = []
  private seen = 0

  constructor(readonly ws: WebSocket, readonly id: string, readonly secret: string) {
    ws.addEventListener('message', event => {
      const msg = JSON.parse(event.data as string) as ServerMessage
      this.inbox.push(msg)
      for (const w of [...this.waiters]) {
        if (w.match(msg)) {
          this.waiters.splice(this.waiters.indexOf(w), 1)
          w.resolve(msg)
        }
      }
    })
    ws.addEventListener('close', event => {
      this.closed = { code: event.code, reason: event.reason }
    })
  }

  /** The next message (not yet consumed) matching `match`. */
  next<T extends ServerMessage['t']>(t: T, ms = 2000): Promise<Extract<ServerMessage, { t: T }>> {
    const match = (m: ServerMessage) => m.t === t
    const pending = this.inbox.slice(this.seen).find(match)
    if (pending) {
      this.seen = this.inbox.indexOf(pending) + 1
      return Promise.resolve(pending as Extract<ServerMessage, { t: T }>)
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${this.id}: no ${t} within ${ms}ms`)), ms)
      this.waiters.push({
        match,
        resolve: m => {
          clearTimeout(timer)
          this.seen = this.inbox.indexOf(m) + 1
          resolve(m as Extract<ServerMessage, { t: T }>)
        },
      })
    })
  }

  send(data: unknown, options: { to?: string; echo?: boolean; rebase?: boolean } = {}) {
    this.ws.send(JSON.stringify({ t: 'send', data, ...options }))
  }

  raw(frame: string) {
    this.ws.send(frame)
  }

  close() {
    this.ws.close(1000, 'bye')
  }
}

async function connect(
  game: string,
  room: string,
  who = ident(),
  name = 'Player',
): Promise<Peer> {
  const url = `${BASE}/v1/rooms/${game}/${room}?client=${who.client}&secret=${who.secret}&name=${encodeURIComponent(name)}`
  const res = await exports.default.fetch(url, { headers: { Upgrade: 'websocket' } })
  expect(res.status).toBe(101)
  const ws = res.webSocket!
  ws.accept()
  return new Peer(ws, who.client, who.secret)
}

const settle = (ms = 30) => new Promise(r => setTimeout(r, ms))

function stub(game: string, room: string): DurableObjectStub<Room> {
  return env.ROOMS.getByName(`${game}:${room}`)
}

/** Pretends the grace period has elapsed for everyone who dropped. */
async function expireGrace(game: string, room: string) {
  await runInDurableObject(stub(game, room), async (_instance, state) => {
    state.storage.sql.exec(
      'UPDATE members SET left_at = left_at - ? WHERE announced = 0',
      GRACE_MS + 1000,
    )
  })
  return runDurableObjectAlarm(stub(game, room))
}

describe('the HTTP surface', () => {
  it('reports health and the hosted games', async () => {
    const health = await exports.default.fetch(`${BASE}/health`)
    expect(await health.json()).toEqual({ ok: true, protocol: 1 })

    const games = (await (await exports.default.fetch(`${BASE}/v1/games`)).json()) as {
      games: Record<string, { maxPeers: number; log: boolean }>
    }
    expect(games.games.azul).toEqual({ maxPeers: 12, log: false })
    expect(games.games['ultimate-ttt'].log).toBe(true)
  })

  it('refuses unknown games, bad codes and bad identities before touching a room', async () => {
    expect((await exports.default.fetch(`${BASE}/v1/rooms/chess/ABCDE`)).status).toBe(404)
    expect((await exports.default.fetch(`${BASE}/v1/rooms/azul/AB`)).status).toBe(400)
    const badIdentity = await exports.default.fetch(`${BASE}/v1/rooms/azul/ABCDE?client=x&secret=y`, {
      headers: { Upgrade: 'websocket' },
    })
    expect(badIdentity.status).toBe(400)
    expect(await badIdentity.json()).toMatchObject({ error: 'bad_identity' })
  })

  it('answers CORS preflight and reports room status without joining', async () => {
    const pre = await exports.default.fetch(`${BASE}/v1/rooms/azul/ABCDE`, { method: 'OPTIONS' })
    expect(pre.status).toBe(204)
    expect(pre.headers.get('Access-Control-Allow-Origin')).toBe('*')

    const room = code()
    await connect('azul', room)
    const info = await (await exports.default.fetch(`${BASE}/v1/rooms/azul/${room.toLowerCase()}`)).json()
    expect(info).toEqual({ game: 'azul', peers: 1, seq: 0 })
  })
})

describe('probing', () => {
  it('asking about a room that was never joined writes nothing', async () => {
    const room = code()
    const info = await (await exports.default.fetch(`${BASE}/v1/rooms/azul/${room}`)).json()
    expect(info).toEqual({ game: null, peers: 0, seq: 0 })
    await runInDurableObject(stub('azul', room), async (_i, state) => {
      const tables = state.storage.sql
        .exec<{ n: number }>("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table'")
        .one().n
      expect(tables).toBe(0)
    })
  })
})

describe('joining', () => {
  it('welcomes the first peer to an empty room', async () => {
    const a = await connect('azul', code(), ident('a'), 'Ana')
    const welcome = await a.next('welcome')
    expect(welcome).toMatchObject({ self: a.id, peers: [], seq: 0, resumed: false })
    expect(welcome.log).toBeUndefined()
  })

  it('introduces newcomers both ways', async () => {
    const room = code()
    const a = await connect('azul', room, ident('a'), 'Ana')
    await a.next('welcome')
    const b = await connect('azul', room, ident('b'), 'Bo')
    const welcome = await b.next('welcome')
    expect(welcome.peers).toEqual([{ id: a.id, name: 'Ana' }])
    expect((await a.next('join')).peer).toEqual({ id: b.id, name: 'Bo' })
  })

  it('strips control and bidi characters from names', async () => {
    const room = code()
    const a = await connect('azul', room)
    await a.next('welcome')
    await connect('azul', room, ident('b'), 'E‮vil\u0000Bo')
    expect((await a.next('join')).peer.name).toBe('EvilBo')
  })
})

describe('relaying', () => {
  it('broadcasts to everyone else with a room-wide sequence number', async () => {
    const room = code()
    const a = await connect('azul', room)
    const b = await connect('azul', room)
    const c = await connect('azul', room)
    await Promise.all([a.next('welcome'), b.next('welcome'), c.next('welcome')])

    a.send({ move: 1 })
    const [atB, atC] = await Promise.all([b.next('msg'), c.next('msg')])
    expect(atB).toEqual({ t: 'msg', seq: 1, from: a.id, data: { move: 1 } })
    expect(atC).toEqual(atB)
    await settle()
    expect(a.inbox.some(m => m.t === 'msg')).toBe(false)
  })

  it('echoes to the sender when asked, in the same sequence', async () => {
    const room = code()
    const a = await connect('ultimate-ttt', room)
    const b = await connect('ultimate-ttt', room)
    await Promise.all([a.next('welcome'), b.next('welcome')])
    a.send('x', { echo: true })
    const [mine, theirs] = await Promise.all([a.next('msg'), b.next('msg')])
    expect(mine).toEqual(theirs)
  })

  it('gives every client the same total order under concurrent senders', async () => {
    const room = code()
    const a = await connect('ultimate-ttt', room)
    const b = await connect('ultimate-ttt', room)
    const watcher = await connect('ultimate-ttt', room)
    await Promise.all([a.next('welcome'), b.next('welcome'), watcher.next('welcome')])

    for (let i = 0; i < 10; i++) {
      a.send(`a${i}`, { echo: true })
      b.send(`b${i}`, { echo: true })
    }
    await settle(200)
    const order = (p: Peer) => p.inbox.filter(m => m.t === 'msg').map(m => (m as { data: string }).data)
    expect(order(watcher)).toHaveLength(20)
    expect(order(a)).toEqual(order(watcher))
    expect(order(b)).toEqual(order(watcher))
    const seqs = watcher.inbox.filter(m => m.t === 'msg').map(m => (m as { seq: number }).seq)
    expect(seqs).toEqual([...seqs].sort((x, y) => x - y))
  })

  it('delivers direct messages to one peer only', async () => {
    const room = code()
    const a = await connect('azul', room)
    const b = await connect('azul', room)
    const c = await connect('azul', room)
    await Promise.all([a.next('welcome'), b.next('welcome'), c.next('welcome')])

    a.send({ secret: true }, { to: b.id })
    expect(await b.next('msg')).toMatchObject({ from: a.id, direct: true, data: { secret: true } })
    await settle()
    expect(c.inbox.some(m => m.t === 'msg')).toBe(false)

    a.send('nobody', { to: 'not-a-peer-123' })
    expect(await a.next('error')).toMatchObject({ code: 'unknown_peer' })
  })

  it('reports malformed, binary and oversized frames without relaying them', async () => {
    const room = code()
    const a = await connect('azul', room)
    const b = await connect('azul', room)
    await Promise.all([a.next('welcome'), b.next('welcome')])

    a.raw('not json')
    expect(await a.next('error')).toMatchObject({ code: 'bad_request' })
    a.raw(JSON.stringify({ t: 'send' }))
    expect(await a.next('error')).toMatchObject({ code: 'bad_request' })
    a.raw(JSON.stringify({ t: 'send', data: 'x'.repeat(70 * 1024) }))
    expect(await a.next('error')).toMatchObject({ code: 'too_large' })
    await settle()
    expect(b.inbox.some(m => m.t === 'msg')).toBe(false)
  })

  it('rate limits a client that floods the room', async () => {
    const room = code()
    const a = await connect('azul', room)
    const b = await connect('azul', room)
    await Promise.all([a.next('welcome'), b.next('welcome')])
    for (let i = 0; i < 80; i++) a.send(i)
    expect(await a.next('error')).toMatchObject({ code: 'rate_limited' })
    await settle(200)
    const relayed = b.inbox.filter(m => m.t === 'msg').length
    expect(relayed).toBeGreaterThanOrEqual(40)
    expect(relayed).toBeLessThan(80)
  })
})

describe('identity across reconnects', () => {
  it('lets a client back in silently inside the grace period', async () => {
    const room = code()
    const who = ident('a')
    const a = await connect('azul', room, who, 'Ana')
    const b = await connect('azul', room)
    await Promise.all([a.next('welcome'), b.next('welcome')])

    a.close()
    await settle()
    const again = await connect('azul', room, who, 'Ana')
    const welcome = await again.next('welcome')
    expect(welcome.resumed).toBe(true)
    expect(welcome.peers.map(p => p.id)).toEqual([b.id])
    await settle()
    expect(b.inbox.filter(m => m.t === 'leave' || m.t === 'join')).toHaveLength(0)
  })

  it('refuses a reconnect that does not know the secret', async () => {
    const room = code()
    const who = ident('a')
    const a = await connect('azul', room, who)
    await a.next('welcome')

    const impostor = await connect('azul', room, { client: who.client, secret: 'guessed-wrong-secret-0000' })
    expect(await impostor.next('error')).toMatchObject({ code: 'identity_taken' })
    await settle()
    expect(impostor.closed?.code).toBe(CLOSE.IDENTITY_TAKEN)
    expect(a.closed).toBeNull()
  })

  it('replaces an older connection for the same client without anyone noticing', async () => {
    const room = code()
    const who = ident('a')
    const first = await connect('azul', room, who)
    const b = await connect('azul', room)
    await Promise.all([first.next('welcome'), b.next('welcome')])

    const second = await connect('azul', room, who)
    await second.next('welcome')
    await settle()
    expect(first.closed?.code).toBe(CLOSE.REPLACED)

    b.send('still you?')
    expect(await second.next('msg')).toMatchObject({ data: 'still you?' })
    expect(b.inbox.filter(m => m.t === 'leave' || m.t === 'join')).toHaveLength(0)
  })

  it('announces a departure only once the grace period runs out', async () => {
    const room = code()
    const a = await connect('azul', room, ident('a'), 'Ana')
    const b = await connect('azul', room)
    await Promise.all([a.next('welcome'), b.next('welcome')])

    a.close()
    await settle()
    expect(b.inbox.some(m => m.t === 'leave')).toBe(false)
    expect(await expireGrace('azul', room)).toBe(true)
    expect((await b.next('leave')).peer).toEqual({ id: a.id, name: 'Ana' })
  })

  it('welcomes a departed member back as a fresh arrival, still known', async () => {
    const room = code()
    const who = ident('a')
    const a = await connect('azul', room, who, 'Ana')
    const b = await connect('azul', room)
    await Promise.all([a.next('welcome'), b.next('welcome')])
    a.close()
    await settle()
    await expireGrace('azul', room)
    await b.next('leave')

    const back = await connect('azul', room, who, 'Ana')
    expect((await back.next('welcome')).resumed).toBe(true)
    expect((await b.next('join')).peer.id).toBe(who.client)
  })
})

describe('capacity', () => {
  it('turns away the client after the room is full, but not a returning member', async () => {
    const room = code()
    const seated = []
    for (let i = 0; i < 10; i++) seated.push(await connect('ultimate-ttt', room))
    await Promise.all(seated.map(p => p.next('welcome')))

    const late = await connect('ultimate-ttt', room)
    expect(await late.next('error')).toMatchObject({ code: 'room_full' })
    await settle()
    expect(late.closed?.code).toBe(CLOSE.ROOM_FULL)

    // A member in its grace period still holds its place.
    seated[0].close()
    await settle()
    const stranger = await connect('ultimate-ttt', room)
    expect(await stranger.next('error')).toMatchObject({ code: 'room_full' })
    const back = await connect('ultimate-ttt', room, { client: seated[0].id, secret: seated[0].secret })
    expect((await back.next('welcome')).resumed).toBe(true)
  })
})

describe('the room log', () => {
  it('replays history to late joiners in logged games', async () => {
    const room = code()
    const a = await connect('ultimate-ttt', room)
    await a.next('welcome')
    a.send({ n: 1 }, { echo: true })
    a.send({ n: 2 }, { echo: true })
    a.send({ n: 3 }, { echo: true })
    await settle(100)

    const late = await connect('ultimate-ttt', room)
    const welcome = await late.next('welcome')
    expect(welcome.seq).toBe(3)
    expect(welcome.log?.map(e => e.data)).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }])
    expect(welcome.log?.every(e => e.from === a.id)).toBe(true)
  })

  it('starts the log over on a rebase', async () => {
    const room = code()
    const a = await connect('ultimate-ttt', room)
    await a.next('welcome')
    a.send('old', { echo: true })
    a.send('rematch', { echo: true, rebase: true })
    a.send('new', { echo: true })
    await settle(100)
    const late = await connect('ultimate-ttt', room)
    expect((await late.next('welcome')).log?.map(e => e.data)).toEqual(['rematch', 'new'])
  })

  it('keeps no log for games with hidden information', async () => {
    const room = code()
    const a = await connect('azul', room)
    await a.next('welcome')
    a.send('deal')
    await settle()
    const late = await connect('azul', room)
    const welcome = await late.next('welcome')
    expect(welcome.log).toBeUndefined()
    expect(welcome.seq).toBe(1)
  })

  it('never logs direct messages', async () => {
    const room = code()
    const a = await connect('ultimate-ttt', room)
    const b = await connect('ultimate-ttt', room)
    await Promise.all([a.next('welcome'), b.next('welcome')])
    a.send('psst', { to: b.id })
    await b.next('msg')
    const late = await connect('ultimate-ttt', room)
    expect((await late.next('welcome')).log).toEqual([])
  })
})

describe('hibernation', () => {
  it('keeps relaying, sequencing and logging after the object hibernates', async () => {
    const room = code()
    const a = await connect('ultimate-ttt', room, ident('a'), 'Ana')
    const b = await connect('ultimate-ttt', room, ident('b'), 'Bo')
    await Promise.all([a.next('welcome'), b.next('welcome')])
    a.send('before', { echo: true })
    await b.next('msg')

    await evictDurableObject(stub('ultimate-ttt', room), { webSockets: 'hibernate' })

    a.send('after', { echo: true })
    expect(await b.next('msg')).toMatchObject({ seq: 2, from: a.id, data: 'after' })
    const late = await connect('ultimate-ttt', room)
    const welcome = await late.next('welcome')
    expect(welcome.peers.map(p => p.name)).toEqual(['Ana', 'Bo'])
    expect(welcome.log?.map(e => e.data)).toEqual(['before', 'after'])
  })
})

describe('cleanup', () => {
  it('forgets an empty room once its time is up', async () => {
    const room = code()
    const a = await connect('ultimate-ttt', room)
    await a.next('welcome')
    a.send('history', { echo: true })
    await a.next('msg')
    a.close()
    await settle()

    await expireGrace('ultimate-ttt', room) // announces the departure
    await runInDurableObject(stub('ultimate-ttt', room), async (_i, state) => {
      state.storage.sql.exec(
        "UPDATE meta SET value = CAST(value AS INTEGER) - ? WHERE key = 'empty_since'",
        EMPTY_ROOM_TTL_MS + 1000,
      )
    })
    await runDurableObjectAlarm(stub('ultimate-ttt', room))

    const info = await (await exports.default.fetch(`${BASE}/v1/rooms/ultimate-ttt/${room}`)).json()
    expect(info).toEqual({ game: null, peers: 0, seq: 0 })
  })
})
