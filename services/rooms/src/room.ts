/**
 * One room: a Durable Object per `game:code`.
 *
 * The object is the single point every message in a room passes through, so it
 * is the obvious place to give them an order. Everything else here follows
 * from two decisions:
 *
 * - **Identity outlives the socket.** A client picks its own id and a secret,
 *   and keeps both across reconnects. Phones sleep, Wi-Fi flaps, tabs reload;
 *   none of that should turn a seated player into a stranger. Sockets come and
 *   go; members persist.
 * - **Leaving is not instant.** A dropped socket starts a short grace period.
 *   Reconnect inside it and nobody else is ever told you left. Only when the
 *   grace runs out is `leave` broadcast. Without this, a host blinking off for
 *   two seconds would trigger a host election in every game built on top.
 *
 * Presence lives in SQLite, not in memory, because the object hibernates
 * between messages and its constructor runs again on wake. The only in-memory
 * state is the rate limiter, which is allowed to forget.
 */

import { DurableObject } from 'cloudflare:workers'
import type { Env } from './env'
import { gameConfig } from './games'
import type { GameConfig } from './games'
import type { Envelope, ErrorCode, PeerInfo, ServerMessage } from './protocol'
import {
  CLOSE,
  KEEPALIVE_PING,
  KEEPALIVE_PONG,
  MAX_MESSAGE_BYTES,
  parseClientMessage,
} from './protocol'

/** How long a dropped client keeps its place before `leave` is announced. */
export const GRACE_MS = 8_000

/** How long an empty room keeps its members and log before it is wiped. */
export const EMPTY_ROOM_TTL_MS = 6 * 60 * 60 * 1000

/** Token bucket per client: a burst of 40, refilling at 8 a second. */
const RATE_CAPACITY = 40
const RATE_REFILL_PER_SECOND = 8

const OPEN = 1

interface Attachment {
  client: string
  name: string
}

interface MemberRow extends Record<string, SqlStorageValue> {
  client: string
  secret: string
  name: string
  left_at: number | null
  announced: number
}

export interface RoomInfo {
  game: string | null
  peers: number
  seq: number
}

/** What the Worker tells the room about a connecting client. */
export interface JoinRequest {
  game: string
  code: string
  client: string
  secret: string
  name: string
}

export const JOIN_HEADER = 'X-Rooms-Join'

export class Room extends DurableObject<Env> {
  private sql: SqlStorage
  private buckets = new Map<string, { tokens: number; at: number }>()

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.sql = ctx.storage.sql
    ctx.blockConcurrencyWhile(async () => this.ensureSchema())
    // Answered by the runtime without waking the object, so a room full of
    // idle players keeping their sockets alive still hibernates.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(KEEPALIVE_PING, KEEPALIVE_PONG))
  }

  /**
   * Creates the tables if they are missing. Runs on construction, and again
   * after an empty room is wiped: `deleteAll()` drops the tables but leaves
   * this instance alive, and the same code may be reused before it is evicted.
   */
  private ensureSchema(): void {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS members (
        client    TEXT PRIMARY KEY,
        secret    TEXT NOT NULL,
        name      TEXT NOT NULL,
        left_at   INTEGER,
        announced INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE IF NOT EXISTS log (
        seq    INTEGER PRIMARY KEY,
        sender TEXT NOT NULL,
        data   TEXT NOT NULL
      );
      INSERT OR IGNORE INTO meta (key, value) VALUES ('seq', '0');
    `)
  }

  // ------------------------------------------------------------------ public

  /** Lightweight room status, for a join screen to check before connecting. */
  async info(): Promise<RoomInfo> {
    await this.reconcile()
    return { game: this.meta('game'), peers: this.present().length, seq: this.seq() }
  }

  /** WebSocket upgrades must arrive through fetch; RPC cannot carry them. */
  async fetch(request: Request): Promise<Response> {
    const header = request.headers.get(JOIN_HEADER)
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket' || !header) {
      return new Response('Expected a WebSocket upgrade from the rooms Worker', { status: 426 })
    }
    const join = JSON.parse(header) as JoinRequest
    const config = gameConfig(join.game)
    if (!config) return new Response('Unknown game', { status: 404 })

    if (this.meta('game') === null) {
      this.setMeta('game', join.game)
      this.setMeta('code', join.code)
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    this.ctx.acceptWebSocket(server, [join.client])

    const refusal = await this.admit(join, config, server)
    if (refusal) {
      // Refused sockets never get an attachment, so every handler and every
      // broadcast ignores them while they close.
      this.send(server, { t: 'error', code: refusal.code, message: refusal.message })
      server.close(refusal.close, refusal.message)
    }
    return new Response(null, { status: 101, webSocket: client })
  }

  // ---------------------------------------------------------------- sockets

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const sender = ws.deserializeAttachment() as Attachment | null
    if (!sender) return // a socket refused at the door; it is already closing

    if (typeof message !== 'string') {
      return this.fail(ws, 'bad_request', 'Frames must be JSON text')
    }
    if (byteLength(message) > MAX_MESSAGE_BYTES) {
      return this.fail(ws, 'too_large', `Messages are limited to ${MAX_MESSAGE_BYTES} bytes`)
    }
    if (!this.take(sender.client)) {
      return this.fail(ws, 'rate_limited', 'Too many messages; slow down')
    }
    const msg = parseClientMessage(message)
    if (!msg) return this.fail(ws, 'bad_request', 'Expected {t:"send", data, to?, echo?, rebase?}')

    const config = gameConfig(this.meta('game') ?? '')
    const targets = msg.to ? this.live(msg.to) : []
    if (msg.to && targets.length === 0) {
      return this.fail(ws, 'unknown_peer', `No peer ${msg.to} is connected`)
    }

    // Persist first, then deliver: the sequence number and the log entry must
    // never be ahead of what the room has told anyone.
    const seq = this.nextSeq()
    const envelope: Envelope = { t: 'msg', seq, from: sender.client, data: msg.data }
    if (msg.to) envelope.direct = true
    if (config?.log && !msg.to) this.record(envelope, msg.rebase === true, config)

    const frame = JSON.stringify(envelope)
    const recipients = msg.to
      ? targets
      : this.live().filter(s => this.clientOf(s) !== sender.client)
    for (const socket of recipients) safeSend(socket, frame)
    if (msg.echo) safeSend(ws, frame)
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.departed(ws)
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.departed(ws)
  }

  /** Announces clients whose grace ran out, and wipes rooms long empty. */
  async alarm(): Promise<void> {
    await this.reconcile()
    const now = Date.now()
    const due = this.sql
      .exec<MemberRow>(
        'SELECT * FROM members WHERE announced = 0 AND left_at IS NOT NULL AND left_at <= ?',
        now - GRACE_MS,
      )
      .toArray()

    for (const member of due) {
      if (this.live(member.client).length > 0) continue // came back in time
      this.sql.exec('UPDATE members SET announced = 1 WHERE client = ?', member.client)
      this.broadcast({ t: 'leave', peer: { id: member.client, name: member.name } })
    }

    const emptySince = Number(this.meta('empty_since') ?? NaN)
    if (
      this.live().length === 0 &&
      this.pendingSince() === null &&
      Number.isFinite(emptySince) &&
      now >= emptySince + EMPTY_ROOM_TTL_MS
    ) {
      await this.ctx.storage.deleteAll()
      this.ensureSchema()
      return
    }
    await this.reschedule()
  }

  // ---------------------------------------------------------------- helpers

  /**
   * Decides whether a client may enter, and if so seats it.
   *
   * Returns the refusal to send, or null once the client is in and has been
   * welcomed. Every outcome is decided against SQLite, so a room that just
   * woke from hibernation decides exactly as it would have awake.
   */
  private async admit(
    join: JoinRequest,
    config: GameConfig,
    socket: WebSocket,
  ): Promise<{ code: ErrorCode; message: string; close: number } | null> {
    await this.reconcile()
    const secret = await sha256(join.secret)
    const existing = this.member(join.client)

    if (existing && existing.secret !== secret) {
      return {
        code: 'identity_taken',
        message: 'That client id is already in this room under a different secret',
        close: CLOSE.IDENTITY_TAKEN,
      }
    }

    // Connected, or dropped but still inside the grace period: either way the
    // others still count this client as here, so it is not a newcomer.
    const alreadyHere = existing !== null && (existing.left_at === null || existing.announced === 0)
    const others = this.present().filter(p => p.id !== join.client)
    if (!alreadyHere && others.length >= config.maxPeers) {
      return { code: 'room_full', message: 'This room is full', close: CLOSE.ROOM_FULL }
    }

    // A second connection for the same client wins and the old one is told
    // why. The new socket gets its attachment first, so when the old one's
    // close handler runs it sees a live connection and starts no grace period.
    const previous = this.live(join.client)
    socket.serializeAttachment({ client: join.client, name: join.name } satisfies Attachment)
    for (const old of previous) old.close(CLOSE.REPLACED, 'Replaced by a newer connection')

    if (existing) {
      this.sql.exec(
        'UPDATE members SET name = ?, left_at = NULL, announced = 1 WHERE client = ?',
        join.name,
        join.client,
      )
    } else {
      this.sql.exec(
        'INSERT INTO members (client, secret, name, left_at, announced) VALUES (?, ?, ?, NULL, 1)',
        join.client,
        secret,
        join.name,
      )
    }

    this.send(socket, {
      t: 'welcome',
      self: join.client,
      peers: this.present().filter(p => p.id !== join.client),
      seq: this.seq(),
      log: config.log ? this.history() : undefined,
      resumed: existing !== null,
    })
    if (!alreadyHere) {
      this.broadcast({ t: 'join', peer: { id: join.client, name: join.name } }, join.client)
    }
    await this.reschedule()
    return null
  }

  /**
   * Starts the grace period for members SQLite thinks are connected but who
   * have no socket. That happens when the runtime restarts the object — on a
   * deploy, say — and the close handlers never ran. Without this they would
   * hold their seats, and never be announced as gone, forever.
   */
  private async reconcile(): Promise<void> {
    const connected = this.sql
      .exec<{ client: string }>('SELECT client FROM members WHERE left_at IS NULL')
      .toArray()
    const now = Date.now()
    let changed = false
    for (const { client } of connected) {
      if (this.live(client).length === 0) {
        this.sql.exec('UPDATE members SET left_at = ?, announced = 0 WHERE client = ?', now, client)
        changed = true
      }
    }
    if (changed) await this.reschedule()
  }

  /** A socket closed. The member only starts its grace if it has none left. */
  private async departed(ws: WebSocket): Promise<void> {
    const who = ws.deserializeAttachment() as Attachment | null
    if (!who) return
    const remaining = this.live(who.client).filter(s => s !== ws)
    if (remaining.length > 0) return
    this.sql.exec(
      'UPDATE members SET left_at = ?, announced = 0 WHERE client = ? AND left_at IS NULL',
      Date.now(),
      who.client,
    )
    this.buckets.delete(who.client)
    await this.reschedule()
  }

  /**
   * One alarm per object, so it is always set to whichever comes first: the
   * next grace period running out, or an empty room's time being up.
   */
  private async reschedule(): Promise<void> {
    const anyoneHere = this.live().length > 0
    if (anyoneHere) this.deleteMeta('empty_since')
    const pending = this.pendingSince()
    if (!anyoneHere && pending === null && this.meta('empty_since') === null) {
      this.setMeta('empty_since', String(Date.now()))
    }

    const deadlines: number[] = []
    if (pending !== null) deadlines.push(pending + GRACE_MS)
    const emptySince = this.meta('empty_since')
    if (!anyoneHere && emptySince !== null) deadlines.push(Number(emptySince) + EMPTY_ROOM_TTL_MS)

    if (deadlines.length === 0) await this.ctx.storage.deleteAlarm()
    else await this.ctx.storage.setAlarm(Math.min(...deadlines))
  }

  /** Earliest drop still inside its grace period, or null. */
  private pendingSince(): number | null {
    const row = this.sql
      .exec<{ at: number | null }>(
        'SELECT MIN(left_at) AS at FROM members WHERE announced = 0 AND left_at IS NOT NULL',
      )
      .one()
    return row.at ?? null
  }

  /** Members other players should see: connected, or dropped but in grace. */
  private present(): PeerInfo[] {
    return this.sql
      .exec<{ client: string; name: string }>(
        'SELECT client, name FROM members WHERE left_at IS NULL OR announced = 0 ORDER BY rowid',
      )
      .toArray()
      .map(row => ({ id: row.client, name: row.name }))
  }

  private member(client: string): MemberRow | null {
    return this.sql.exec<MemberRow>('SELECT * FROM members WHERE client = ?', client).toArray()[0] ?? null
  }

  private record(envelope: Envelope, rebase: boolean, config: GameConfig): void {
    if (rebase) this.sql.exec('DELETE FROM log')
    this.sql.exec(
      'INSERT INTO log (seq, sender, data) VALUES (?, ?, ?)',
      envelope.seq,
      envelope.from,
      JSON.stringify(envelope.data),
    )
    this.sql.exec(
      'DELETE FROM log WHERE seq NOT IN (SELECT seq FROM log ORDER BY seq DESC LIMIT ?)',
      config.logLimit,
    )
  }

  private history(): Envelope[] {
    return this.sql
      .exec<{ seq: number; sender: string; data: string }>('SELECT * FROM log ORDER BY seq')
      .toArray()
      .map(row => ({ t: 'msg', seq: row.seq, from: row.sender, data: JSON.parse(row.data) }))
  }

  private nextSeq(): number {
    return Number(
      this.sql
        .exec<{ value: string }>(
          "UPDATE meta SET value = CAST(value AS INTEGER) + 1 WHERE key = 'seq' RETURNING value",
        )
        .one().value,
    )
  }

  private seq(): number {
    return Number(this.meta('seq') ?? 0)
  }

  private meta(key: string): string | null {
    const rows = this.sql.exec<{ value: string }>('SELECT value FROM meta WHERE key = ?', key).toArray()
    return rows[0]?.value ?? null
  }

  private setMeta(key: string, value: string): void {
    this.sql.exec('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', key, value)
  }

  private deleteMeta(key: string): void {
    this.sql.exec('DELETE FROM meta WHERE key = ?', key)
  }

  /** Open sockets, optionally for one client. Closing sockets are excluded. */
  private live(client?: string): WebSocket[] {
    return this.ctx.getWebSockets(client).filter(s => s.readyState === OPEN && s.deserializeAttachment())
  }

  private clientOf(ws: WebSocket): string | null {
    return (ws.deserializeAttachment() as Attachment | null)?.client ?? null
  }

  private broadcast(msg: ServerMessage, except?: string): void {
    const frame = JSON.stringify(msg)
    for (const socket of this.live()) {
      if (except && this.clientOf(socket) === except) continue
      safeSend(socket, frame)
    }
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    safeSend(ws, JSON.stringify(msg))
  }

  private fail(ws: WebSocket, code: ErrorCode, message: string): void {
    this.send(ws, { t: 'error', code, message })
  }

  private take(client: string): boolean {
    const now = Date.now()
    const bucket = this.buckets.get(client) ?? { tokens: RATE_CAPACITY, at: now }
    bucket.tokens = Math.min(RATE_CAPACITY, bucket.tokens + ((now - bucket.at) / 1000) * RATE_REFILL_PER_SECOND)
    bucket.at = now
    if (bucket.tokens < 1) {
      this.buckets.set(client, bucket)
      return false
    }
    bucket.tokens -= 1
    this.buckets.set(client, bucket)
    return true
  }
}

/** A peer vanishing between the check and the send is not the sender's problem. */
function safeSend(ws: WebSocket, frame: string): void {
  try {
    ws.send(frame)
  } catch {
    // The close handler will account for it.
  }
}

function byteLength(text: string): number {
  // Cheap bound first: UTF-8 never takes fewer bytes than UTF-16 code units.
  if (text.length * 3 <= MAX_MESSAGE_BYTES) return text.length
  return new TextEncoder().encode(text).byteLength
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
}
