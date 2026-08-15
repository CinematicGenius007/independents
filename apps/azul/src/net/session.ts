/**
 * A room, from the point of view of one browser.
 *
 * One class covers all three situations, because they differ less than they
 * look: a solo game against bots is a room whose transport has no peers, a
 * hosted game is the same room driving other peers, and a joined game is the
 * same room following one. The `Session` owns the lobby, the replication and
 * the clock that makes bots wait a beat before playing; the interface only
 * reads {@link SessionView} and calls {@link Session.play}.
 *
 * Everything the host does that the others cannot is exactly one thing:
 * drawing tiles. That asymmetry is the reason for the host role, and the only
 * reason.
 */

import { chooseMove } from '../engine/bot'
import type { BotStyle } from '../engine/bot'
import { Game } from '../engine/game'
import { applyMove, createGame, moveError, needsDeal, startRound, tileWall } from '../engine/rules'
import { createRng, randomSeed } from '../engine/rng'
import type { GameState, Move } from '../engine/types'
import type {
  CtrlMessage,
  PeerId,
  RoomConfig,
  Seat,
  Transport,
  Unsubscribe,
} from './protocol'
import { DEFAULT_CONFIG, MAX_SEATS, MIN_SEATS } from './protocol'

export interface SessionView {
  selfId: PeerId
  hostId: PeerId
  isHost: boolean
  seats: Seat[]
  /** This browser's seat, or null when watching. */
  seatIndex: number | null
  state: GameState | null
  started: boolean
  config: RoomConfig
  /** Set when a move was refused, cleared on the next state change. */
  notice: string | null
}

export interface SessionOptions {
  transport: Transport
  name: string
  /** True for the player who created the room. */
  host: boolean
  config?: RoomConfig
  /** Injected so tests can run the clock instantly. */
  schedule?: (fn: () => void, ms: number) => unknown
  cancel?: (handle: unknown) => void
  seed?: number
}

/** How long an absent player's seat is held before the house plays it. */
const ABSENT_GRACE_MS = 1200

/** Pause between the last tile being taken and the walls being tiled. */
const TILING_PAUSE_MS = 900

/** Pause before the next round hits the table. */
const DEAL_PAUSE_MS = 700

export class Session {
  private transport: Transport
  private listeners = new Set<(view: SessionView) => void>()
  private unsubscribes: Unsubscribe[] = []
  private schedule: (fn: () => void, ms: number) => unknown
  private cancel: (handle: unknown) => void
  private timer: unknown = null
  private rng: () => number

  private name: string
  private hostId: PeerId
  private seats: Seat[] = []
  private config: RoomConfig
  private started = false
  private notice: string | null = null

  /** Held only while this peer is the host. */
  private game: Game | null = null
  /** Every peer's copy of the position. The host's mirrors `game.state`. */
  private state: GameState | null = null
  private seq = 0

  constructor(options: SessionOptions) {
    this.transport = options.transport
    this.name = options.name
    this.config = options.config ?? DEFAULT_CONFIG
    this.schedule = options.schedule ?? ((fn, ms) => setTimeout(fn, ms))
    this.cancel = options.cancel ?? (handle => clearTimeout(handle as ReturnType<typeof setTimeout>))
    this.rng = createRng(options.seed ?? randomSeed())
    this.hostId = options.host ? this.transport.selfId : ''

    if (options.host) {
      this.seats = [seatFor(this.transport.selfId, this.name, 'human')]
    }

    this.unsubscribes.push(
      this.transport.onMessage((msg, from) => this.receive(msg, from)),
      this.transport.onPeerJoin(id => this.peerJoined(id)),
      this.transport.onPeerLeave(id => this.peerLeft(id)),
    )
  }

  // ---------------------------------------------------------------- reading

  view(): SessionView {
    const seatIndex = this.seats.findIndex(s => s.id === this.transport.selfId)
    return {
      selfId: this.transport.selfId,
      hostId: this.hostId,
      isHost: this.isHost,
      seats: this.seats,
      seatIndex: seatIndex === -1 ? null : seatIndex,
      state: this.state,
      started: this.started,
      config: this.config,
      notice: this.notice,
    }
  }

  onChange(cb: (view: SessionView) => void): Unsubscribe {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  private get isHost(): boolean {
    return this.hostId === this.transport.selfId
  }

  private emit(): void {
    const view = this.view()
    this.listeners.forEach(cb => cb(view))
  }

  // ------------------------------------------------------------ lobby (host)

  /** Adds a house player. Host only; ignored once the game is under way. */
  addBot(style: BotStyle = 'artisan'): void {
    if (!this.isHost || this.started || this.seats.length >= MAX_SEATS) return
    const n = this.seats.filter(s => s.kind === 'bot').length + 1
    const taken = this.seats.filter(s => s.style === style && s.kind === 'bot').length
    const name = taken === 0 ? HOUSE_NAMES[style] : `${HOUSE_NAMES[style]} ${taken + 1}`
    this.seats = [...this.seats, seatFor(`bot-${n}-${Math.floor(this.rng() * 1e6)}`, name, 'bot', style)]
    this.broadcastRoster()
  }

  /** Removes a bot seat, or frees a seat a player has left. Host only. */
  removeSeat(id: string): void {
    if (!this.isHost || this.started) return
    if (id === this.transport.selfId) return
    this.seats = this.seats.filter(s => s.id !== id)
    this.broadcastRoster()
  }

  setBotStyle(id: string, style: BotStyle): void {
    if (!this.isHost || this.started) return
    this.seats = this.seats.map(s => (s.id === id ? { ...s, style } : s))
    this.broadcastRoster()
  }

  setName(name: string): void {
    this.name = name
    this.seats = this.seats.map(s => (s.id === this.transport.selfId ? { ...s, name } : s))
    if (this.isHost) this.broadcastRoster()
    else this.transport.send({ t: 'hello', name, joinedAt: Date.now() }, this.hostId || undefined)
    this.emit()
  }

  /** Starts the game. Host only, and only with enough seats filled. */
  start(): void {
    if (!this.isHost || this.started || this.seats.length < MIN_SEATS) return
    this.started = true
    this.seq = 1
    this.game = Game.create(this.seats.map(s => ({ id: s.id, name: s.name })))
    this.state = this.game.state
    this.broadcast({ t: 'begin', seq: this.seq, seats: this.seats })
    this.drive()
    this.emit()
  }

  // ------------------------------------------------------------------- play

  /**
   * Offers a move from this browser's own seat.
   *
   * The host plays it directly; everyone else asks the host to. Either way the
   * move is checked against the same rules before it changes anything.
   */
  play(move: Move): void {
    const seatIndex = this.view().seatIndex
    if (!this.state || seatIndex === null) return
    if (this.state.current !== seatIndex || this.state.phase !== 'offer') {
      this.notice = 'It is not your turn.'
      this.emit()
      return
    }
    const error = moveError(this.state, move)
    if (error) {
      this.notice = error
      this.emit()
      return
    }
    this.notice = null
    if (this.isHost) this.hostPlay(move)
    else this.transport.send({ t: 'intent', move }, this.hostId)
  }

  leave(): void {
    if (this.timer !== null) this.cancel(this.timer)
    this.unsubscribes.splice(0).forEach(fn => fn())
    this.listeners.clear()
    this.transport.leave()
  }

  // ------------------------------------------------------------- host driver

  private hostPlay(move: Move): void {
    if (!this.game) return
    const seat = this.game.state.current
    this.game.play(move)
    this.state = this.game.state
    this.broadcast({ t: 'move', seq: ++this.seq, seat, move })
    this.drive()
    this.emit()
  }

  /**
   * Decides what the table does next, and when.
   *
   * Called after every host-side change. It is the only place timers are set,
   * so there is exactly one pending action at a time and no way for two bots
   * to move at once.
   */
  private drive(): void {
    if (!this.isHost || !this.game) return
    if (this.timer !== null) {
      this.cancel(this.timer)
      this.timer = null
    }
    const state = this.game.state
    if (state.phase === 'over') return

    if (needsDeal(state)) {
      this.after(DEAL_PAUSE_MS, () => {
        if (!this.game) return
        const { factories } = this.game.deal()
        this.state = this.game.state
        this.broadcast({ t: 'deal', seq: ++this.seq, factories })
        this.drive()
        this.emit()
      })
      return
    }

    if (state.phase === 'tiling') {
      this.after(TILING_PAUSE_MS, () => {
        if (!this.game) return
        this.game.tile()
        this.state = this.game.state
        this.broadcast({ t: 'tile', seq: ++this.seq })
        this.drive()
        this.emit()
      })
      return
    }

    const seat = this.seats[state.current]
    if (!seat) return
    const houseControlled = seat.kind === 'bot' || !seat.present
    if (!houseControlled) return

    const delay = seat.kind === 'bot' ? this.config.botDelayMs : ABSENT_GRACE_MS
    this.after(delay, () => {
      if (!this.game || this.game.state.phase !== 'offer') return
      const move = chooseMove(this.game.state, this.rng, seat.style)
      if (!move) return
      this.game.play(move)
      this.state = this.game.state
      this.broadcast({ t: 'move', seq: ++this.seq, seat: state.current, move })
      this.drive()
      this.emit()
    })
  }

  private after(ms: number, fn: () => void): void {
    this.timer = this.schedule(() => {
      this.timer = null
      fn()
    }, ms)
  }

  // -------------------------------------------------------------- messaging

  private broadcast(msg: CtrlMessage): void {
    this.transport.send(msg)
  }

  private broadcastRoster(): void {
    this.broadcast({
      t: 'roster',
      hostId: this.hostId,
      seats: this.seats,
      config: this.config,
      started: this.started,
    })
    this.emit()
  }

  private peerJoined(id: PeerId): void {
    this.transport.send({ t: 'hello', name: this.name, joinedAt: Date.now() }, id)
    if (this.isHost) this.broadcastRoster()
  }

  private peerLeft(id: PeerId): void {
    const seat = this.seats.find(s => s.id === id)
    if (seat) {
      this.seats = this.seats.map(s => (s.id === id ? { ...s, present: false } : s))
      if (!this.started) this.seats = this.seats.filter(s => s.id !== id)
    }

    if (id === this.hostId) this.considerClaim()
    else if (this.isHost) {
      this.broadcastRoster()
      this.drive()
    }
    this.emit()
  }

  /**
   * Takes over an abandoned game.
   *
   * The position is public and every peer already has it, so the only thing
   * the departed host really took with them was the bag — and a bag can be
   * derived from what is on the table. The survivors elect deterministically
   * (lowest id present) so two of them cannot both claim the room.
   */
  private considerClaim(): void {
    const candidates = [this.transport.selfId, ...this.transport.peers()]
      .filter(id => this.seats.some(s => s.id === id && s.present) || id === this.transport.selfId)
      .sort()
    if (candidates[0] !== this.transport.selfId) return

    this.hostId = this.transport.selfId
    this.game = this.state ? Game.adopt(this.state) : null
    this.broadcast({ t: 'claim', hostId: this.hostId, at: Date.now() })
    this.broadcastRoster()
    if (this.state) {
      this.broadcast({
        t: 'snapshot',
        seq: this.seq,
        state: this.state,
        seats: this.seats,
        config: this.config,
      })
    }
    this.drive()
    this.emit()
  }

  private receive(msg: CtrlMessage, from: PeerId): void {
    switch (msg.t) {
      case 'hello':
        this.onHello(msg.name, from)
        return
      case 'roster':
        if (from !== this.hostId && this.hostId !== '') return
        this.hostId = msg.hostId
        this.seats = msg.seats
        this.config = msg.config
        this.started = msg.started
        if (this.started && this.state === null) this.transport.send({ t: 'sync' }, this.hostId)
        this.emit()
        return
      case 'claim':
        if (msg.hostId === this.transport.selfId) return
        this.hostId = msg.hostId
        this.game = null
        this.emit()
        return
      case 'sync':
        if (this.isHost && this.state) {
          this.transport.send(
            { t: 'snapshot', seq: this.seq, state: this.state, seats: this.seats, config: this.config },
            from,
          )
        }
        return
      case 'snapshot':
        if (from !== this.hostId) return
        this.seq = msg.seq
        this.state = msg.state
        this.seats = msg.seats
        this.config = msg.config
        this.started = true
        this.emit()
        return
      case 'intent':
        this.onIntent(msg.move, from)
        return
      case 'begin':
      case 'deal':
      case 'move':
      case 'tile':
        this.onEvent(msg, from)
        return
    }
  }

  private onHello(name: string, from: PeerId): void {
    if (!this.isHost) return
    const known = this.seats.find(s => s.id === from)
    if (known) {
      this.seats = this.seats.map(s => (s.id === from ? { ...s, name, present: true } : s))
      this.broadcastRoster()
      return
    }
    if (!this.started && this.seats.length < MAX_SEATS) {
      this.seats = [...this.seats, seatFor(from, name, 'human')]
      this.broadcastRoster()
      return
    }
    // Mid-game arrival: take over a seat its player has dropped out of,
    // preferring one that was theirs by name, or else watch.
    const vacant =
      this.seats.find(s => s.kind === 'human' && !s.present && s.name === name) ??
      this.seats.find(s => s.kind === 'human' && !s.present)
    if (vacant) {
      this.seats = this.seats.map(s => (s.id === vacant.id ? { ...s, id: from, name, present: true } : s))
      if (this.state) {
        this.state = {
          ...this.state,
          players: this.state.players.map(p => (p.id === vacant.id ? { ...p, id: from, name } : p)),
        }
        if (this.game) this.game.state = this.state
      }
      this.broadcastRoster()
      this.drive()
    }
    if (this.state) {
      this.transport.send(
        { t: 'snapshot', seq: this.seq, state: this.state, seats: this.seats, config: this.config },
        from,
      )
    }
  }

  private onIntent(move: Move, from: PeerId): void {
    if (!this.isHost || !this.game) return
    const seat = this.seats.findIndex(s => s.id === from)
    if (seat === -1 || this.game.state.current !== seat) return
    if (moveError(this.game.state, move)) return
    this.game.play(move)
    this.state = this.game.state
    this.broadcast({ t: 'move', seq: ++this.seq, seat, move })
    this.drive()
    this.emit()
  }

  /**
   * Replays a host event on this peer's copy.
   *
   * Out of order means something was lost, and guessing would put two players
   * on different boards — so it asks for the position instead.
   */
  private onEvent(msg: Extract<CtrlMessage, { seq: number }>, from: PeerId): void {
    if (this.isHost || from !== this.hostId) return
    if (msg.t === 'begin') {
      this.seq = msg.seq
      this.seats = msg.seats
      this.started = true
      this.state = createGame(msg.seats.map(s => ({ id: s.id, name: s.name })))
      this.notice = null
      this.emit()
      return
    }
    if (msg.seq !== this.seq + 1 || !this.state) {
      this.transport.send({ t: 'sync' }, this.hostId)
      return
    }
    this.seq = msg.seq
    switch (msg.t) {
      case 'deal':
        this.state = startRound(this.state, msg.factories)
        break
      case 'move':
        this.state = applyMove(this.state, msg.move).state
        break
      case 'tile':
        this.state = tileWall(this.state).state
        break
    }
    this.notice = null
    this.emit()
  }
}

function seatFor(id: string, name: string, kind: Seat['kind'], style: BotStyle = 'artisan'): Seat {
  return { id, name, kind, style, present: true }
}

/** The house plays under the name of its skill, so the seat is honest. */
const HOUSE_NAMES: Record<BotStyle, string> = {
  apprentice: 'The Apprentice',
  artisan: 'The Journeyman',
  master: 'The Master',
}
