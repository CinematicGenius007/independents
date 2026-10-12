/**
 * Browser client for the independents rooms service.
 *
 * CANONICAL COPY. This file lives in services/rooms/client and is copied
 * verbatim into each app by `pnpm sync-client` in services/rooms. Edit it
 * there; `pnpm sync-client --check` fails when an app's copy has drifted.
 *
 * What it adds on top of a WebSocket, and why each piece exists:
 *
 * - **A stable identity** (client id + secret, per browser tab). Reloading the
 *   page or losing the network reconnects as the same member, so a seated
 *   player stays seated.
 * - **Reconnection** with capped, jittered backoff, and a keepalive that
 *   notices a socket the network killed silently.
 * - **An outbox.** Sends made while reconnecting are delivered once the room
 *   is back, in order, instead of vanishing.
 * - **Presence that stays true across a reconnect.** Peers who left while this
 *   client was away are reported as left; everyone present is re-announced, so
 *   a game can redo its hello handshake without special cases.
 *
 * It has no dependencies and knows nothing about any game.
 */

export const ROOMS_PROTOCOL = 1

export interface PeerInfo {
  id: string
  name: string
}

export interface Envelope<T = unknown> {
  t: 'msg'
  seq: number
  from: string
  data: T
  direct?: true
}

export type RoomsStatus = 'connecting' | 'open' | 'reconnecting' | 'failed' | 'closed'

export interface RoomsError {
  code: string
  message: string
}

export interface Welcome {
  self: string
  peers: PeerInfo[]
  seq: number
  log?: Envelope[]
  resumed: boolean
}

export interface SendOptions {
  to?: string
  echo?: boolean
  rebase?: boolean
}

export interface Identity {
  client: string
  secret: string
}

export interface RoomsOptions {
  /** e.g. `https://independents-rooms.example.workers.dev` */
  baseUrl: string
  game: string
  code: string
  name: string
  identity?: Identity
  /** Injected by tests. Defaults to the browser's WebSocket. */
  WebSocketImpl?: typeof WebSocket
  /** Injected by tests. */
  timers?: Timers
  random?: () => number
}

interface Timers {
  set(fn: () => void, ms: number): unknown
  clear(handle: unknown): void
}

interface Events {
  welcome: (welcome: Welcome) => void
  join: (peer: PeerInfo) => void
  leave: (peer: PeerInfo) => void
  message: (envelope: Envelope) => void
  status: (status: RoomsStatus) => void
  error: (error: RoomsError) => void
}

/** Close codes after which reconnecting would only be refused again. */
const FATAL = new Set([4000, 4400, 4403, 4409])
const KEEPALIVE_MS = 25_000
/** A handshake that has not completed by now is not going to. */
const CONNECT_TIMEOUT_MS = 10_000
/** No frame at all for this long means the socket is dead, whatever it says. */
const SILENCE_MS = 60_000
const BACKOFF_MIN_MS = 500
const BACKOFF_MAX_MS = 8_000
const OUTBOX_LIMIT = 256

const defaultTimers: Timers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
}

export class RoomsConnection {
  readonly self: string
  readonly game: string
  readonly code: string
  /** Peers currently in the room, excluding this client. */
  readonly peers = new Map<string, PeerInfo>()

  private identity: Identity
  private name: string
  private baseUrl: string
  private WS: typeof WebSocket
  private timers: Timers
  private random: () => number

  private socket: WebSocket | null = null
  private status: RoomsStatus = 'connecting'
  private listeners: { [K in keyof Events]: Set<Events[K]> } = {
    welcome: new Set(),
    join: new Set(),
    leave: new Set(),
    message: new Set(),
    status: new Set(),
    error: new Set(),
  }
  private outbox: string[] = []
  private attempt = 0
  private welcomed = false
  /** Set once the first welcome arrives; distinguishes connecting from reconnecting. */
  private everWelcomed = false
  private closedByUser = false
  private retryTimer: unknown = null
  private keepaliveTimer: unknown = null
  private silenceTimer: unknown = null
  private connectTimer: unknown = null

  constructor(options: RoomsOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '')
    this.game = options.game
    this.code = options.code.toUpperCase()
    this.name = options.name
    this.identity = options.identity ?? loadIdentity()
    this.self = this.identity.client
    this.WS = options.WebSocketImpl ?? WebSocket
    this.timers = options.timers ?? defaultTimers
    this.random = options.random ?? Math.random
    this.open()
  }

  // ----------------------------------------------------------------- public

  getStatus(): RoomsStatus {
    return this.status
  }

  on<K extends keyof Events>(event: K, cb: Events[K]): () => void {
    this.listeners[event].add(cb)
    return () => this.listeners[event].delete(cb)
  }

  /**
   * Sends to the room (or to one peer). Queued while the connection is down
   * and flushed, in order, once the room has welcomed this client back.
   */
  send(data: unknown, options: SendOptions = {}): void {
    if (this.closedByUser) return
    const frame = JSON.stringify({ t: 'send', data, ...options })
    if (this.welcomed && this.socket?.readyState === this.WS.OPEN) {
      this.socket.send(frame)
      return
    }
    if (this.outbox.length >= OUTBOX_LIMIT) this.outbox.shift()
    this.outbox.push(frame)
  }

  /** Changes the name others see. Takes effect on the next (re)connect. */
  rename(name: string): void {
    this.name = name
  }

  close(): void {
    this.closedByUser = true
    this.clearTimers()
    this.outbox = []
    this.socket?.close(1000, 'Left the room')
    this.socket = null
    this.setStatus('closed')
  }

  // -------------------------------------------------------------- internals

  private url(): string {
    const ws = this.baseUrl.replace(/^http/, 'ws')
    const params = new URLSearchParams({
      client: this.identity.client,
      secret: this.identity.secret,
      name: this.name,
    })
    return `${ws}/v1/rooms/${encodeURIComponent(this.game)}/${encodeURIComponent(this.code)}?${params}`
  }

  private open(): void {
    if (this.closedByUser) return
    this.welcomed = false
    let socket: WebSocket
    try {
      socket = new this.WS(this.url())
    } catch {
      this.scheduleReconnect()
      return
    }
    this.socket = socket
    // A connect that hangs — a captive portal, a stalled proxy — produces no
    // event at all. Without a deadline the client would sit in "connecting"
    // until the browser gave up, which can take minutes.
    this.connectTimer = this.timers.set(() => {
      if (this.socket !== socket || socket.readyState === this.WS.OPEN) return
      this.socket = null
      this.clearTimers()
      try {
        socket.close()
      } catch {
        // never opened
      }
      this.scheduleReconnect()
    }, CONNECT_TIMEOUT_MS)
    socket.addEventListener('open', () => {
      if (this.socket !== socket) return
      if (this.connectTimer !== null) this.timers.clear(this.connectTimer)
      this.connectTimer = null
      this.armSilence()
      this.keepaliveTimer = this.timers.set(() => this.keepalive(socket), KEEPALIVE_MS)
    })
    socket.addEventListener('message', event => {
      if (this.socket !== socket) return
      this.armSilence()
      if (typeof event.data !== 'string' || event.data === 'pong') return
      this.receive(event.data)
    })
    socket.addEventListener('close', event => {
      if (this.socket !== socket) return
      this.socket = null
      this.clearTimers()
      if (this.closedByUser) return
      if (FATAL.has(event.code)) {
        this.setStatus('failed')
        return
      }
      this.scheduleReconnect()
    })
    // Errors are always followed by close; that is where recovery happens.
    socket.addEventListener('error', () => {})
  }

  private receive(raw: string): void {
    let msg: { t: string } & Record<string, unknown>
    try {
      msg = JSON.parse(raw)
    } catch {
      return
    }
    switch (msg.t) {
      case 'welcome':
        this.onWelcome(msg as unknown as Welcome)
        return
      case 'join': {
        const peer = msg.peer as PeerInfo
        this.peers.set(peer.id, peer)
        this.emit('join', peer)
        return
      }
      case 'leave': {
        const peer = msg.peer as PeerInfo
        this.peers.delete(peer.id)
        this.emit('leave', peer)
        return
      }
      case 'msg':
        this.emit('message', msg as unknown as Envelope)
        return
      case 'error':
        this.emit('error', { code: String(msg.code), message: String(msg.message) })
        return
    }
  }

  private onWelcome(welcome: Welcome): void {
    this.attempt = 0
    this.welcomed = true
    this.everWelcomed = true

    // Anyone who left while this client was away missed being announced.
    const present = new Map(welcome.peers.map(p => [p.id, p]))
    for (const [id, peer] of [...this.peers]) {
      if (!present.has(id)) {
        this.peers.delete(id)
        this.emit('leave', peer)
      }
    }
    this.emit('welcome', welcome)
    // Everyone present is (re)announced. A game's join handler then redoes
    // its handshake, which is what a client that may have been forgotten
    // needs — and harmless for one that was not.
    for (const peer of welcome.peers) {
      this.peers.set(peer.id, peer)
      this.emit('join', peer)
    }

    const queued = this.outbox.splice(0)
    for (const frame of queued) this.socket?.send(frame)
    this.setStatus('open')
  }

  private scheduleReconnect(): void {
    this.setStatus(this.everWelcomed ? 'reconnecting' : 'connecting')
    const base = Math.min(BACKOFF_MAX_MS, BACKOFF_MIN_MS * 2 ** this.attempt)
    const delay = base / 2 + this.random() * (base / 2)
    this.attempt++
    this.retryTimer = this.timers.set(() => this.open(), delay)
  }

  private keepalive(socket: WebSocket): void {
    if (this.socket !== socket || socket.readyState !== this.WS.OPEN) return
    socket.send('ping')
    this.keepaliveTimer = this.timers.set(() => this.keepalive(socket), KEEPALIVE_MS)
  }

  /** A socket the network killed without a close frame is noticed here. */
  private armSilence(): void {
    if (this.silenceTimer !== null) this.timers.clear(this.silenceTimer)
    this.silenceTimer = this.timers.set(() => {
      const dead = this.socket
      if (!dead) return
      this.socket = null
      this.clearTimers()
      try {
        dead.close(4001, 'No traffic')
      } catch {
        // already gone
      }
      this.scheduleReconnect()
    }, SILENCE_MS)
  }

  private clearTimers(): void {
    for (const t of [this.retryTimer, this.keepaliveTimer, this.silenceTimer, this.connectTimer]) {
      if (t !== null) this.timers.clear(t)
    }
    this.retryTimer = this.keepaliveTimer = this.silenceTimer = this.connectTimer = null
  }

  private setStatus(next: RoomsStatus): void {
    if (this.status === next) return
    this.status = next
    this.emit('status', next)
  }

  private emit<K extends keyof Events>(event: K, ...args: Parameters<Events[K]>): void {
    for (const cb of this.listeners[event]) (cb as (...a: Parameters<Events[K]>) => void)(...args)
  }
}

/**
 * This tab's identity, created once and kept for the tab's lifetime.
 *
 * Session storage, not local storage, on purpose: two tabs are two players
 * (which is how most people test a multiplayer game), while a reload of one
 * tab is still that same player coming back.
 */
export function loadIdentity(key = 'independents:rooms:identity'): Identity {
  try {
    const saved = sessionStorage.getItem(key)
    if (saved) {
      const parsed = JSON.parse(saved) as Identity
      if (/^[A-Za-z0-9_-]{8,64}$/.test(parsed.client) && /^[A-Za-z0-9_-]{16,128}$/.test(parsed.secret)) {
        return parsed
      }
    }
  } catch {
    // Private windows can refuse storage; a fresh identity still works.
  }
  const identity = { client: randomToken(16), secret: randomToken(32) }
  try {
    sessionStorage.setItem(key, JSON.stringify(identity))
  } catch {
    // As above.
  }
  return identity
}

function randomToken(bytes: number): string {
  const raw = new Uint8Array(bytes)
  crypto.getRandomValues(raw)
  let text = ''
  for (const b of raw) text += String.fromCharCode(b)
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
