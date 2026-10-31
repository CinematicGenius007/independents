/**
 * The match screen: scoreboard, board, timeline, and the result once it ends.
 *
 * It is a view over a game it does not own. Local, machine, online and replay
 * play all feed it the same few things — the live position, the move list, who
 * sits where — and it decides nothing about what is allowed.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { BOARD_NAMES, MegaGrid, moveLabel } from './Board'
import { applyMove, boardsWon, initialState } from './game'
import type { GameState, Move, Player } from './game'
import type { HistoryEntry } from './history'
import { replayHash } from './record'
import type { MatchInfo } from './useRecordMatch'
import { copyText, renderResultCard, shareResult } from './share'

export interface SeatInfo {
  side: Player
  name: string
  you: boolean
  /** False while that player is disconnected, so their seat shows as away. */
  here: boolean
  /** Replaces the default You / Rival / Away label, e.g. on one shared screen. */
  role?: string
}

export interface ResultActions {
  /** Absent when a replay has nothing to start again. */
  rematch?: { label: string; onClick: () => void; disabled?: boolean }
  /** What to tell a watcher instead of offering a rematch. */
  watcherNote?: string
}

interface MatchViewProps {
  eyebrow: string
  link: { tone: 'live' | 'idle' | 'lost'; label: string }
  seats: [SeatInfo, SeatInfo]
  starter: Player
  moves: Move[]
  game: GameState
  canPlay: boolean
  onPlay: (board: number, cell: number) => void
  /** The line under the board: whose turn it is, or what is being waited for. */
  note: string
  /** Shown in place of the result while a game is still being set up. */
  dock?: React.ReactNode
  result?: ResultActions
  info: MatchInfo | null
  history: HistoryEntry[]
  onLeave: () => void
  /** True when the connection is down and the board is frozen. */
  signalLost?: boolean
  /** Replay mode starts with the whole game laid out and a scrubber, nothing to play. */
  replayBadge?: React.ReactNode
}

const PLAYING_LABEL = (g: GameState) =>
  g.activeBoard === null ? 'Any board' : `Forced → ${BOARD_NAMES[g.activeBoard]} board`

export function MatchView(p: MatchViewProps) {
  const { starter, moves, game } = p
  const [cursor, setCursor] = useState<number | null>(null) // null follows the live game
  const [autoplay, setAutoplay] = useState(false)

  // Every position the game has been in, so scrubbing is a lookup.
  const states = useMemo(() => {
    const list: GameState[] = [initialState(starter)]
    for (const move of moves) list.push(applyMove(list[list.length - 1], move) ?? list[list.length - 1])
    return list
  }, [starter, moves])

  // A new move snaps the view back to the live board.
  const count = moves.length
  useEffect(() => {
    setCursor(null)
    setAutoplay(false)
  }, [count, starter])

  useEffect(() => {
    if (!autoplay) return
    const id = setInterval(() => setCursor(c => ((c ?? 0) + 1 >= count ? null : (c ?? 0) + 1)), 520)
    return () => clearInterval(id)
  }, [autoplay, count])

  // Reaching the end hands the board back to the live game.
  useEffect(() => {
    if (autoplay && cursor === null) setAutoplay(false)
  }, [autoplay, cursor])

  const viewIndex = cursor ?? count
  const view = states[Math.min(viewIndex, states.length - 1)]
  const scrubbing = cursor !== null
  const lastMove = viewIndex > 0 ? moves[viewIndex - 1] : null

  const scrub = (to: number) => {
    setAutoplay(false)
    setCursor(to >= count ? null : Math.max(0, to))
  }

  const scrubRef = useRef(scrub)
  scrubRef.current = scrub
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'ArrowLeft') scrubRef.current(viewIndex - 1)
      else if (e.key === 'ArrowRight') scrubRef.current(viewIndex + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [viewIndex])

  const [x, o] = p.seats
  const turn = game.winner ? null : game.current
  const forced = !view.winner && view.activeBoard !== null

  return (
    <div className={`match ${p.signalLost ? 'match-lost' : ''}`}>
      {p.signalLost && (
        <div className="signal-lost" role="status">
          <span className="eyebrow signal">Signal lost</span>
          <span className="signal-lost-text">Reconnecting — your seat is held.</span>
          <span className="hatch" aria-hidden="true" />
        </div>
      )}

      <div className="rail rail-left">
        <div className="match-head">
          <button className="eyebrow eyebrow-button" onClick={p.onLeave} title="Back to the lobby">
            ← {p.eyebrow}
          </button>
          <span className={`link link-${p.link.tone}`}>
            <i aria-hidden="true" />
            {p.link.label}
          </span>
        </div>

        <h1 className="hero hero-small">
          Ultimate
          <br />
          TTT<span className="signal">.</span>
        </h1>

        <div className="scoreboard">
          {[x, o].map(seat => (
            <div
              key={seat.side}
              className={`seat seat-${seat.side} ${turn === seat.side ? 'seat-turn' : ''} ${seat.here ? '' : 'seat-away'} ${game.winner === seat.side ? 'seat-won' : ''}`}
            >
              <div className="seat-top">
                <span className="eyebrow">
                  {[seat.side, seat.role ?? (seat.you ? 'You' : seat.here ? 'Rival' : 'Away')].filter(Boolean).join(' · ')}
                </span>
                {turn === seat.side && <span className="eyebrow seat-flag">▲ Turn</span>}
                {game.winner === seat.side && <span className="eyebrow seat-flag">Winner</span>}
              </div>
              <div className="seat-bottom">
                <span className="seat-name">{seat.name}</span>
                <span className="seat-score" key={boardsWon(game, seat.side)}>
                  {boardsWon(game, seat.side)}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="label-row">
          <span className={`eyebrow ${forced ? 'signal' : ''}`}>
            <span className={forced ? 'dot dot-signal' : 'dot'} aria-hidden="true" />
            {view.winner ? 'Game over' : PLAYING_LABEL(view)}
          </span>
          <span className="eyebrow">Move {viewIndex}</span>
        </div>
      </div>

      <div className="stage">
        <div className="board-box">
          <MegaGrid game={view} canPlay={p.canPlay && !scrubbing} onPlay={p.onPlay} last={lastMove} />
        </div>
      </div>

      <div className="rail rail-right">
        <div className="timeline">
          <div className="timeline-head">
            <span className="eyebrow">Timeline{scrubbing ? ` · move ${viewIndex}` : ''}</span>
            {scrubbing ? (
              <button className="eyebrow eyebrow-button signal" onClick={() => scrub(count)}>
                Back to live ↵
              </button>
            ) : (
              <span className="eyebrow">{count > 0 ? 'Tap to scrub ←→' : 'No moves yet'}</span>
            )}
          </div>
          <div className="bars" role="group" aria-label="Move timeline">
            {moves.map((move, i) => {
              const mover = i % 2 === 0 ? starter : starter === 'X' ? 'O' : 'X'
              const captured = states[i + 1].boardWinners[move.board] !== states[i].boardWinners[move.board]
              const isHead = i + 1 === viewIndex
              return (
                <button
                  key={i}
                  className={`bar bar-${mover} ${captured ? 'bar-capture' : ''} ${isHead ? 'bar-head' : ''}`}
                  onClick={() => scrub(i + 1)}
                  aria-label={`Move ${i + 1}, ${mover} at ${moveLabel(move)}`}
                  aria-current={isHead ? 'step' : undefined}
                />
              )
            })}
          </div>
        </div>

        <div className="last-line eyebrow">
          {lastMove ? (
            <>
              Last: {viewIndex % 2 === 1 ? (starter === 'X' ? x.name : o.name) : starter === 'X' ? o.name : x.name} → {moveLabel(lastMove)}
            </>
          ) : (
            'No moves yet'
          )}
        </div>

        {game.winner ? (
          <ResultPanel
            winner={game.winner}
            seats={p.seats}
            moves={moves.length}
            state={game}
            info={p.info}
            actions={p.result}
            onReplay={() => {
              setCursor(0)
              setAutoplay(true)
            }}
          />
        ) : (
          <>
            <p className="note" role="status" aria-live="polite">
              {p.note}
            </p>
            {p.dock}
          </>
        )}

        {p.replayBadge}

        {p.history.length > 0 && <History entries={p.history} newTab={!p.replayBadge} />}
        <span className="hatch hatch-foot" aria-hidden="true" />
      </div>
    </div>
  )
}

// ─── Result ────────────────────────────────────────────────────────────────────

function ResultPanel({
  winner,
  seats,
  moves,
  state,
  info,
  actions,
  onReplay,
}: {
  winner: Exclude<GameState['winner'], null>
  seats: [SeatInfo, SeatInfo]
  moves: number
  state: GameState
  info: MatchInfo | null
  actions?: ResultActions
  onReplay: () => void
}) {
  const [feedback, setFeedback] = useState<string | null>(null)
  const winnerSeat = winner === 'tie' ? null : seats.find(s => s.side === winner)!
  const youWon = winnerSeat?.you
  const headline = winner === 'tie' ? 'Nobody blinked.' : youWon ? 'You took it.' : `${winnerSeat!.name} took it.`
  const eyebrow = `${winner === 'tie' ? 'Draw' : `${winner} wins`} · ${moves} moves`

  const timer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(timer.current), [])
  const flash = (text: string) => {
    clearTimeout(timer.current)
    setFeedback(text)
    timer.current = setTimeout(() => setFeedback(null), 1800)
  }

  const share = async () => {
    if (!info) return
    try {
      const card = await renderResultCard({ state, title: headline, eyebrow, number: info.number })
      const outcome = await shareResult(card, `${headline} Ultimate TTT ${info.number}`, info.link, `ultimate-ttt-${info.number}.png`)
      if (outcome === 'downloaded') flash('Card saved')
      else if (outcome === 'shared') flash('Shared')
    } catch {
      flash('Could not draw the card')
    }
  }

  const copy = async () => {
    if (!info) return
    flash((await copyText(info.link)) ? 'Replay link copied' : 'Copy failed')
  }

  return (
    <section className={`result result-${winner}`} aria-label="Result">
      <div className="result-body">
        <span className={`eyebrow ${winner === 'X' ? 'accent-x' : ''}`}>{eyebrow}</span>
        <h2 className="result-title">{headline}</h2>
        <div className="result-number">
          <span className="eyebrow">Match number</span>
          <b>{info ? `#${info.number}` : '…'}</b>
        </div>
      </div>
      <div className="result-actions">
        {actions?.rematch ? (
          <button className="btn btn-light" onClick={actions.rematch.onClick} disabled={actions.rematch.disabled}>
            {actions.rematch.label}
          </button>
        ) : actions?.watcherNote ? (
          <p className="result-note">{actions.watcherNote}</p>
        ) : null}
        <button className="btn" onClick={share} disabled={!info}>
          Share result
        </button>
        <button className="btn" onClick={copy} disabled={!info}>
          Copy link
        </button>
        <button className="btn" onClick={onReplay}>
          Replay
        </button>
      </div>
      <p className="result-feedback eyebrow" role="status" aria-live="polite">
        {feedback ?? ' '}
      </p>
    </section>
  )
}

// ─── History ───────────────────────────────────────────────────────────────────

export function History({
  entries,
  title = 'Last 3 matches · this device',
  newTab = false,
}: {
  entries: HistoryEntry[]
  title?: string
  /** Open replays in a new tab, so a live game is not left behind. */
  newTab?: boolean
}) {
  return (
    <div className="history">
      <span className="eyebrow">{title}</span>
      <ul>
        {entries.map(e => {
          const outcome = e.winner === 'tie' ? 'draw' : e.me === null ? 'played' : e.winner === e.me ? 'won' : 'lost'
          return (
            <li key={`${e.n}-${e.at}`}>
              <a
                className={`history-item history-${outcome}`}
                href={replayHash(e.code, e.n)}
                {...(newTab ? { target: '_blank', rel: 'noopener' } : {})}
              >
                <i aria-hidden="true" />
                <span className="history-main">
                  <b>
                    {outcome === 'won' ? 'Won vs' : outcome === 'lost' ? 'Lost to' : outcome === 'draw' ? 'Draw vs' : `${e.winner} won ·`} {e.vs}
                  </b>
                  <span className="eyebrow">
                    #{e.n} · {e.moves} moves
                  </span>
                </span>
                <span className="eyebrow">Replay ▸</span>
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ─── Waiting for a rival ───────────────────────────────────────────────────────

export function InvitePanel({ code, link, seated }: { code: string; link: string; seated: number }) {
  const [copied, setCopied] = useState(false)
  const canShare = typeof navigator.share === 'function'

  const copy = async () => {
    if (await copyText(link)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }
  }
  const share = async () => {
    try {
      await navigator.share({ title: 'Ultimate TTT', text: 'Play me at Ultimate TTT.', url: link })
    } catch {
      // cancelled; nothing to do
    }
  }

  return (
    <section className="invite" aria-label="Invite a rival">
      <div className="invite-top">
        <span className="eyebrow">01 · Waiting for rival</span>
        <span className="eyebrow signal">
          <span className="dot dot-signal pulse" aria-hidden="true" /> {seated}/2
        </span>
      </div>
      <div className="invite-code">
        <span className="eyebrow">Room code</span>
        <b>{code}</b>
        <span className="invite-hint">Holding your seat. The first person through the link plays; anyone after watches.</span>
      </div>
      <div className="invite-actions">
        {canShare && (
          <button className="btn btn-signal" onClick={share}>
            Share link
          </button>
        )}
        <button className={`btn ${canShare ? '' : 'btn-signal'}`} onClick={copy}>
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>
      <div className="progress" aria-hidden="true">
        <i />
      </div>
    </section>
  )
}
