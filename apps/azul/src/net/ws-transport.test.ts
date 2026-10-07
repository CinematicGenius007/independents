import { describe, expect, it } from 'vitest'
import { createRoomsHandle } from './ws-transport'
import { Session } from './session'
import { chooseMove } from '../engine/bot'
import { createRng } from '../engine/rng'
import { settle } from './memory-transport'

/**
 * Just enough of the rooms service to talk to the real client: welcome,
 * presence, sequenced relay, direct messages. The real service has its own
 * suite against the Workers runtime; this one proves the *adapter* — that an
 * Azul session over the rooms protocol behaves as it does over any transport.
 */
class FakeRoomsServer {
  private sockets = new Map<string, FakeSocket>()
  private names = new Map<string, string>()
  private seq = 0

  readonly Socket = (() => {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const server = this
    return class extends FakeSocket {
      constructor(url: string) {
        super(url, server)
      }
    }
  })()

  connect(socket: FakeSocket) {
    const old = this.sockets.get(socket.client)
    const resumed = this.names.has(socket.client)
    this.sockets.set(socket.client, socket)
    this.names.set(socket.client, socket.name)
    if (old && old !== socket) old.kill(4000)
    socket.deliver({
      t: 'welcome',
      self: socket.client,
      peers: [...this.sockets.keys()].filter(id => id !== socket.client).map(id => ({ id, name: this.names.get(id) })),
      seq: this.seq,
      resumed,
    })
    if (!resumed) this.broadcast({ t: 'join', peer: { id: socket.client, name: socket.name } }, socket.client)
  }

  relay(from: FakeSocket, frame: string) {
    if (frame === 'ping') return from.deliver('pong')
    const msg = JSON.parse(frame)
    const envelope = { t: 'msg', seq: ++this.seq, from: from.client, data: msg.data } as Record<string, unknown>
    if (msg.to) {
      envelope.direct = true
      this.sockets.get(msg.to)?.deliver(envelope)
    } else {
      this.broadcast(envelope, from.client)
    }
    if (msg.echo) from.deliver(envelope)
  }

  /** The network drops a socket; the server treats it as a blip, not a leave. */
  drop(client: string) {
    const socket = this.sockets.get(client)
    this.sockets.delete(client)
    socket?.kill(1006)
  }

  private broadcast(msg: unknown, except?: string) {
    for (const [id, socket] of this.sockets) if (id !== except) socket.deliver(msg)
  }
}

class FakeSocket {
  static OPEN = 1
  readyState = 0
  readonly client: string
  readonly name: string
  private handlers: Record<string, ((e: unknown) => void)[]> = {}
  private server: FakeRoomsServer

  constructor(url: string, server: FakeRoomsServer) {
    this.server = server
    const params = new URL(url).searchParams
    this.client = params.get('client')!
    this.name = params.get('name')!
    queueMicrotask(() => {
      this.readyState = 1
      this.fire('open', {})
      this.server.connect(this)
    })
  }
  addEventListener(type: string, fn: (e: unknown) => void) {
    ;(this.handlers[type] ??= []).push(fn)
  }
  send(frame: string) {
    queueMicrotask(() => this.server.relay(this, frame))
  }
  close() {
    this.readyState = 3
  }
  deliver(msg: unknown) {
    if (this.readyState !== 1) return
    queueMicrotask(() => this.fire('message', { data: typeof msg === 'string' ? msg : JSON.stringify(msg) }))
  }
  kill(code: number) {
    this.readyState = 3
    queueMicrotask(() => this.fire('close', { code, reason: '' }))
  }
  private fire(type: string, e: unknown) {
    for (const fn of this.handlers[type] ?? []) fn(e)
  }
}

function fakeClock() {
  const queue: { id: number; fn: () => void }[] = []
  let nextId = 1
  return {
    schedule: (fn: () => void) => {
      const id = nextId++
      queue.push({ id, fn })
      return id
    },
    cancel: (handle: unknown) => {
      const i = queue.findIndex(item => item.id === handle)
      if (i !== -1) queue.splice(i, 1)
    },
    async run(steps: number) {
      for (let i = 0; i < steps && queue.length > 0; i++) {
        queue.shift()!.fn()
        await settle(8)
      }
    },
  }
}

function player(server: FakeRoomsServer, id: string, name: string, host: boolean, clock = fakeClock()) {
  const handle = createRoomsHandle({
    baseUrl: 'https://rooms.test',
    roomId: 'KP4TQ',
    name,
    url: 'https://azul.test/#room=KP4TQ',
    WebSocketImpl: server.Socket as unknown as typeof WebSocket,
    identity: { client: `${id}-client-0001`, secret: `${id}-secret-abcdefghijklmnop` },
  })
  const session = new Session({
    transport: handle.transport,
    name,
    host,
    seed: 7,
    schedule: clock.schedule,
    cancel: clock.cancel,
  })
  return { session, handle, clock }
}

describe('Azul over the rooms service', () => {
  it('seats a guest and reports a connected relay', async () => {
    const server = new FakeRoomsServer()
    const host = player(server, 'host', 'Ana', true)
    const guest = player(server, 'guest', 'Bo', false)
    await settle(40)
    expect(host.handle.status()).toBe('connected')
    expect(host.session.view().seats.map(s => s.name)).toEqual(['Ana', 'Bo'])
    expect(guest.session.view().seatIndex).toBe(1)
  })

  it('replicates a whole game, and survives the guest dropping mid-round', async () => {
    const server = new FakeRoomsServer()
    const clock = fakeClock()
    const host = player(server, 'host', 'Ana', true, clock)
    const guest = player(server, 'guest', 'Bo', false, clock)
    await settle(40)
    host.session.start()
    await clock.run(3)
    await settle(20)

    const rng = createRng(11)
    let dropped = false
    for (let guard = 0; guard < 800 && host.session.view().state?.phase !== 'over'; guard++) {
      const state = host.session.view().state!
      if (!dropped && state.round === 2) {
        // The guest's network blips. The client reconnects on its own with
        // the same identity, and the game must carry on as if nothing happened.
        server.drop(guest.handle.transport.selfId)
        dropped = true
        await new Promise(r => setTimeout(r, 700))
        await settle(40)
      }
      if (state.phase === 'offer') {
        const actor = state.current === 0 ? host : guest
        const view = actor.session.view()
        if (view.state && view.state.current === view.seatIndex) {
          // A real strategy, so the walls actually fill and the game ends.
          const move = chooseMove(view.state, rng, 'master')
          if (move) actor.session.play(move)
        }
        await settle(20)
      }
      await clock.run(2)
      await settle(20)
    }

    expect(dropped).toBe(true)
    expect(host.session.view().state?.phase).toBe('over')
    expect(guest.session.view().state).toEqual(host.session.view().state)
    // The guest never lost its seat.
    expect(host.session.view().seats[1]).toMatchObject({ name: 'Bo', present: true })
  })
})
