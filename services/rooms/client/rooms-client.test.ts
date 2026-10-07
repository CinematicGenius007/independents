import { describe, expect, it } from 'vitest'
import { RoomsConnection } from './rooms-client'
import type { PeerInfo, RoomsStatus } from './rooms-client'

/** A socket whose server side the test drives by hand. */
class FakeSocket {
  static OPEN = 1
  static instances: FakeSocket[] = []
  readyState = 0
  sent: string[] = []
  closedWith: { code?: number; reason?: string } | null = null
  private handlers: Record<string, ((e: unknown) => void)[]> = {}

  constructor(readonly url: string) {
    FakeSocket.instances.push(this)
  }
  addEventListener(type: string, fn: (e: unknown) => void) {
    ;(this.handlers[type] ??= []).push(fn)
  }
  send(data: string) {
    this.sent.push(data)
  }
  close(code?: number, reason?: string) {
    this.closedWith = { code, reason }
    this.readyState = 3
  }
  // --- driven by tests
  serverOpen() {
    this.readyState = 1
    this.fire('open', {})
  }
  serverSend(msg: unknown) {
    this.fire('message', { data: typeof msg === 'string' ? msg : JSON.stringify(msg) })
  }
  serverClose(code = 1006) {
    this.readyState = 3
    this.fire('close', { code, reason: '' })
  }
  private fire(type: string, e: unknown) {
    for (const fn of this.handlers[type] ?? []) fn(e)
  }
}

/** A clock that only moves when told to. */
function manualTimers() {
  let now = 0
  let nextId = 1
  const pending = new Map<number, { at: number; fn: () => void }>()
  return {
    set(fn: () => void, ms: number) {
      const id = nextId++
      pending.set(id, { at: now + ms, fn })
      return id
    },
    clear(id: unknown) {
      pending.delete(id as number)
    },
    advance(ms: number) {
      const target = now + ms
      for (;;) {
        const due = [...pending.entries()].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at)[0]
        if (!due) break
        pending.delete(due[0])
        now = due[1].at
        due[1].fn()
      }
      now = target
    },
  }
}

const identity = { client: 'client-abc-123', secret: 'secret-abcdefghijklmnop' }

function setup() {
  FakeSocket.instances = []
  const timers = manualTimers()
  const conn = new RoomsConnection({
    baseUrl: 'https://rooms.example.dev/',
    game: 'azul',
    code: 'kp4tq',
    name: 'Ana',
    identity,
    WebSocketImpl: FakeSocket as unknown as typeof WebSocket,
    timers,
    random: () => 0.5,
  })
  const statuses: RoomsStatus[] = []
  const joins: PeerInfo[] = []
  const leaves: PeerInfo[] = []
  conn.on('status', s => statuses.push(s))
  conn.on('join', p => joins.push(p))
  conn.on('leave', p => leaves.push(p))
  const socket = () => FakeSocket.instances[FakeSocket.instances.length - 1]
  return { conn, timers, statuses, joins, leaves, socket }
}

const welcome = (peers: PeerInfo[] = [], extra = {}) => ({
  t: 'welcome',
  self: identity.client,
  peers,
  seq: 0,
  resumed: false,
  ...extra,
})

describe('the rooms client', () => {
  it('connects to the room URL with its identity and name', () => {
    const { socket } = setup()
    const url = new URL(socket().url)
    expect(url.protocol).toBe('wss:')
    expect(url.pathname).toBe('/v1/rooms/azul/KP4TQ')
    expect(url.searchParams.get('client')).toBe(identity.client)
    expect(url.searchParams.get('secret')).toBe(identity.secret)
    expect(url.searchParams.get('name')).toBe('Ana')
  })

  it('announces the peers already in the room as joins, after the welcome', () => {
    const { socket, joins, statuses } = setup()
    socket().serverOpen()
    socket().serverSend(welcome([{ id: 'b', name: 'Bo' }]))
    expect(joins).toEqual([{ id: 'b', name: 'Bo' }])
    expect(statuses).toEqual(['open'])
  })

  it('queues sends until welcomed, then flushes them in order', () => {
    const { conn, socket } = setup()
    conn.send(1)
    conn.send(2, { echo: true })
    socket().serverOpen()
    expect(socket().sent).toEqual([])
    socket().serverSend(welcome())
    expect(socket().sent.map(f => JSON.parse(f))).toEqual([
      { t: 'send', data: 1 },
      { t: 'send', data: 2, echo: true },
    ])
    conn.send(3, { to: 'b' })
    expect(JSON.parse(socket().sent[2])).toEqual({ t: 'send', data: 3, to: 'b' })
  })

  it('reconnects with backoff and reconciles presence when it comes back', () => {
    const { conn, socket, timers, statuses, joins, leaves } = setup()
    const first = socket()
    first.serverOpen()
    first.serverSend(welcome([{ id: 'b', name: 'Bo' }, { id: 'c', name: 'Cy' }]))

    first.serverClose(1006)
    expect(statuses.at(-1)).toBe('reconnecting')
    conn.send('while away')

    timers.advance(300)
    expect(FakeSocket.instances).toHaveLength(1) // 0.5 jitter of a 500ms base = 375ms
    timers.advance(100)
    const second = socket()
    expect(second).not.toBe(first)

    second.serverOpen()
    // Cy left while we were away; Dee arrived.
    second.serverSend(welcome([{ id: 'b', name: 'Bo' }, { id: 'd', name: 'Dee' }], { resumed: true }))
    expect(leaves).toEqual([{ id: 'c', name: 'Cy' }])
    expect(joins.slice(2)).toEqual([
      { id: 'b', name: 'Bo' },
      { id: 'd', name: 'Dee' },
    ])
    expect([...conn.peers.keys()]).toEqual(['b', 'd'])
    expect(JSON.parse(second.sent[0])).toEqual({ t: 'send', data: 'while away' })
    expect(statuses.at(-1)).toBe('open')
  })

  it('backs off exponentially, capped', () => {
    const { socket, timers } = setup()
    const delays: number[] = []
    for (let i = 0; i < 7; i++) {
      const before = FakeSocket.instances.length
      socket().serverClose(1006)
      let waited = 0
      while (FakeSocket.instances.length === before) {
        timers.advance(25)
        waited += 25
      }
      delays.push(waited)
    }
    expect(delays[1]).toBeGreaterThan(delays[0])
    expect(delays[2]).toBeGreaterThan(delays[1])
    expect(Math.max(...delays)).toBeLessThanOrEqual(8000)
  })

  it('gives up on fatal close codes and says why', () => {
    const { conn, socket, timers, statuses } = setup()
    const errors: string[] = []
    conn.on('error', e => errors.push(e.code))
    socket().serverOpen()
    socket().serverSend({ t: 'error', code: 'room_full', message: 'This room is full' })
    socket().serverClose(4409)
    timers.advance(60_000)
    expect(FakeSocket.instances).toHaveLength(1)
    expect(statuses.at(-1)).toBe('failed')
    expect(errors).toEqual(['room_full'])
  })

  it('pings to keep the socket alive, and treats a silent socket as dead', () => {
    const { socket, timers, statuses } = setup()
    const s = socket()
    s.serverOpen()
    s.serverSend(welcome())
    timers.advance(25_000)
    expect(s.sent).toContain('ping')
    s.serverSend('pong')
    timers.advance(59_000)
    expect(s.closedWith).toBeNull()
    timers.advance(2_000)
    expect(s.closedWith?.code).toBe(4001)
    expect(statuses.at(-1)).toBe('reconnecting')
  })

  it('relays messages and ignores frames it does not understand', () => {
    const { conn, socket } = setup()
    const got: unknown[] = []
    conn.on('message', e => got.push(e))
    socket().serverOpen()
    socket().serverSend(welcome())
    socket().serverSend('not json')
    socket().serverSend({ t: 'msg', seq: 4, from: 'b', data: { x: 1 } })
    expect(got).toEqual([{ t: 'msg', seq: 4, from: 'b', data: { x: 1 } }])
  })

  it('stays closed after close(), even if the server drops it', () => {
    const { conn, socket, timers, statuses } = setup()
    socket().serverOpen()
    socket().serverSend(welcome())
    conn.close()
    socket().serverClose(1006)
    timers.advance(60_000)
    expect(FakeSocket.instances).toHaveLength(1)
    expect(statuses.at(-1)).toBe('closed')
    conn.send('ignored')
    expect(socket().sent).toEqual([])
  })
})
