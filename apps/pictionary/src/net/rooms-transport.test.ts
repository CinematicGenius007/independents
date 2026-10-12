/**
 * The rooms adapter for Pictionary, against a fake rooms service.
 *
 * Proves the adapter — ctrl/ink/directed/batch/chunk/presence behave over the
 * rooms protocol exactly as the mesh expects — not the service itself, which
 * has its own suite against the Workers runtime.
 */

import { describe, expect, it } from 'vitest'
import type { CtrlMessage } from './protocol'
import { base64ToBytes, bytesToBase64, createRoomsTransport } from './rooms-transport'
import type { RoomsTransport } from './rooms-transport'

interface SentFrame {
  from: string
  data: unknown
  to?: string
}

class FakeSocket {
  static OPEN = 1
  static CONNECTING = 0
  static CLOSING = 2
  static CLOSED = 3
  readonly OPEN = 1

  readyState = FakeSocket.CONNECTING
  readonly client: string
  readonly name: string
  private server: FakeRoomsServer
  private handlers = new Map<string, ((event: { data?: string; code?: number }) => void)[]>()
  private closed = false

  constructor(url: string, server: FakeRoomsServer) {
    this.server = server
    const query = new URL(url).searchParams
    this.client = query.get('client') ?? `anon-${Math.floor(Math.random() * 1e9)}`
    this.name = query.get('name') ?? 'player'
    queueMicrotask(() => {
      if (this.closed) return
      this.readyState = FakeSocket.OPEN
      this.emit('open', {})
      this.server.connect(this)
    })
  }

  addEventListener(type: string, cb: (event: { data?: string; code?: number }) => void): void {
    const list = this.handlers.get(type) ?? []
    list.push(cb)
    this.handlers.set(type, list)
  }

  send(frame: string): void {
    this.server.relay(this, frame)
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    this.readyState = FakeSocket.CLOSED
    this.server.disconnect(this)
    this.emit('close', { code: 1000 })
  }

  /** Server → client delivery. */
  deliver(payload: unknown): void {
    if (this.closed) return
    const data = typeof payload === 'string' ? payload : JSON.stringify(payload)
    this.emit('message', { data })
  }

  /** Server-initiated drop (no leave broadcast — a blip, not a departure). */
  kill(code: number): void {
    if (this.closed) return
    this.closed = true
    this.readyState = FakeSocket.CLOSED
    this.emit('close', { code })
  }

  private emit(type: string, event: { data?: string; code?: number }): void {
    for (const cb of this.handlers.get(type) ?? []) cb(event)
  }
}

class FakeRoomsServer {
  frames: SentFrame[] = []
  private sockets = new Map<string, FakeSocket>()
  private seq = 0

  readonly Socket = (() => {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const server = this
    return class extends FakeSocket {
      constructor(url: string) {
        super(url, server)
      }
    }
  })() as unknown as typeof WebSocket

  connect(socket: FakeSocket): void {
    const resumed = this.sockets.has(socket.client)
    this.sockets.set(socket.client, socket)
    socket.deliver({
      t: 'welcome',
      self: socket.client,
      peers: [...this.sockets.keys()]
        .filter(id => id !== socket.client)
        .map(id => ({ id, name: id })),
      seq: this.seq,
      resumed,
    })
    if (!resumed) {
      this.broadcast({ t: 'join', peer: { id: socket.client, name: socket.name } }, socket.client)
    }
  }

  relay(from: FakeSocket, frame: string): void {
    if (frame === 'ping') return from.deliver('pong')
    const msg = JSON.parse(frame) as { t: string; data: unknown; to?: string; echo?: boolean }
    if (msg.t !== 'send') return
    this.frames.push({ from: from.client, data: msg.data, to: msg.to })
    const envelope = { t: 'msg', seq: ++this.seq, from: from.client, data: msg.data } as Record<string, unknown>
    if (msg.to) {
      envelope.direct = true
      this.sockets.get(msg.to)?.deliver(envelope)
    } else {
      this.broadcast(envelope, from.client)
    }
    if (msg.echo) from.deliver(envelope)
  }

  disconnect(socket: FakeSocket): void {
    if (this.sockets.get(socket.client) !== socket) return
    this.sockets.delete(socket.client)
    this.broadcast({ t: 'leave', peer: { id: socket.client, name: socket.name } })
  }

  private broadcast(payload: Record<string, unknown>, except?: string): void {
    for (const [id, socket] of this.sockets) {
      if (id !== except) socket.deliver(payload)
    }
  }
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

async function pair(server: FakeRoomsServer): Promise<[RoomsTransport, RoomsTransport]> {
  const a = createRoomsTransport({
    baseUrl: 'https://rooms.test',
    roomId: 'ABCDEF',
    name: 'ann',
    identity: { client: 'client-a', secret: 'secret-a-0000000000' },
    WebSocketImpl: server.Socket,
    flushMs: 5,
  })
  const b = createRoomsTransport({
    baseUrl: 'https://rooms.test',
    roomId: 'ABCDEF',
    name: 'bob',
    identity: { client: 'client-b', secret: 'secret-b-0000000000' },
    WebSocketImpl: server.Socket,
    flushMs: 5,
  })
  // Welcome + join handshake.
  await sleep(20)
  return [a, b]
}

describe('rooms-transport (pictionary)', () => {
  it('round-trips ctrl broadcasts and reports peers', async () => {
    const server = new FakeRoomsServer()
    const [a, b] = await pair(server)
    const seen: CtrlMessage[] = []
    b.transport.onCtrl(msg => seen.push(msg))

    expect(a.transport.selfId).toBe('client-a')
    expect(new Set(a.transport.peers())).toEqual(new Set(['client-b']))

    a.transport.sendCtrl({ t: 'action', revision: 1, action: { type: 'CHAT', entry: { id: 'm1' } } as never })
    await sleep(10)
    expect(seen).toHaveLength(1)
    expect(seen[0]).toMatchObject({ t: 'action', revision: 1 })
    a.transport.leave()
    b.transport.leave()
  })

  it('delivers directed words only to their target', async () => {
    const server = new FakeRoomsServer()
    const [a, b] = await pair(server)
    const wordsA: unknown[] = []
    const wordsB: unknown[] = []
    a.transport.onCtrl(msg => {
      if (msg.t === 'word') wordsA.push(msg)
    })
    b.transport.onCtrl(msg => {
      if (msg.t === 'word') wordsB.push(msg)
    })

    a.transport.sendCtrl({ t: 'word', word: 'apple', category: null, turnIndex: 0 }, 'client-b')
    await sleep(10)
    expect(wordsB).toHaveLength(1)
    expect(wordsA).toHaveLength(0)
    a.transport.leave()
    b.transport.leave()
  })

  it('drops ping/pong instead of spending the rate budget', async () => {
    const server = new FakeRoomsServer()
    const [a, b] = await pair(server)
    const seen: CtrlMessage[] = []
    b.transport.onCtrl(msg => seen.push(msg))

    a.transport.sendCtrl({ t: 'ping', nonce: 1, at: 0 })
    a.transport.sendCtrl({ t: 'pong', nonce: 1, at: 0 })
    await sleep(10)
    expect(seen).toHaveLength(0)
    expect(server.frames).toHaveLength(0)
    a.transport.leave()
    b.transport.leave()
  })

  it('batches rapid ink frames into one envelope and redelivers each', async () => {
    const server = new FakeRoomsServer()
    const [a, b] = await pair(server)
    const received: Uint8Array[] = []
    b.transport.onInk(bytes => received.push(bytes))

    a.transport.sendInk(new Uint8Array([1, 2, 3]))
    a.transport.sendInk(new Uint8Array([4, 5]))
    a.transport.sendInk(new Uint8Array([6]))
    await sleep(30)

    expect(server.frames).toHaveLength(1)
    expect(server.frames[0].data).toMatchObject({ ch: 'ink-batch' })
    expect(received.map(bytes => Array.from(bytes))).toEqual([[1, 2, 3], [4, 5], [6]])
    a.transport.leave()
    b.transport.leave()
  })

  it('chunks oversize ink and preserves order around it', async () => {
    const server = new FakeRoomsServer()
    const [a, b] = await pair(server)
    const received: Uint8Array[] = []
    b.transport.onInk(bytes => received.push(bytes))

    const big = new Uint8Array(100_000)
    for (let i = 0; i < big.length; i++) big[i] = i % 251
    a.transport.sendInk(new Uint8Array([9]))
    a.transport.sendInk(big)
    a.transport.sendInk(new Uint8Array([8]))
    await sleep(50)

    expect(received).toHaveLength(3)
    expect(Array.from(received[0])).toEqual([9])
    expect(received[1]).toEqual(big)
    expect(Array.from(received[2])).toEqual([8])
    // Every wire frame fits the rooms limit.
    for (const frame of server.frames) {
      expect(JSON.stringify(frame.data).length).toBeLessThan(64 * 1024)
    }
    a.transport.leave()
    b.transport.leave()
  })

  it('reports joins and leaves', async () => {
    const server = new FakeRoomsServer()
    const [a, b] = await pair(server)
    const joins: string[] = []
    const leaves: string[] = []
    a.transport.onPeerJoin(id => joins.push(id))
    a.transport.onPeerLeave(id => leaves.push(id))

    const c = createRoomsTransport({
      baseUrl: 'https://rooms.test',
      roomId: 'ABCDEF',
      name: 'cyd',
      identity: { client: 'client-c', secret: 'secret-c-0000000000' },
      WebSocketImpl: server.Socket,
      flushMs: 5,
    })
    await sleep(20)
    expect(joins).toEqual(['client-c'])

    c.transport.leave()
    await sleep(20)
    expect(leaves).toEqual(['client-c'])
    a.transport.leave()
    b.transport.leave()
  })

  it('base64 helpers round-trip binary incl. snapshot magic bytes', () => {
    const bytes = new Uint8Array([0x50, 0x49, 0x43, 0x53, 0x4e, 0x41, 0x50, 0x01, 0, 255, 13])
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes)
  })
})
