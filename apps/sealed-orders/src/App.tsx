import { useCallback, useEffect, useMemo, useState } from 'react'
import { generateBoard } from './engine/board'
import { botOrders } from './engine/bot'
import {
  auditSeals,
  committerOf,
  decodeMatch,
  encodeMatch,
  makeNonce,
  newMatch,
  play,
  replay,
  seal,
  stageOf,
  unseal,
  type Match,
} from './engine/protocol'
import { randomSeedText } from './engine/rng'
import {
  held,
  ordersFromText,
  resolveTurn,
  startPosition,
  STEPS,
  verdict,
  type Orders,
  type Side,
  type Step,
} from './engine/rules'
import { BoardView, routeOf } from './ui/BoardView'

type Mode = 'link' | 'ghost'

interface Kept {
  orders: string
  nonce: string
}

function keep(matchId: string, turn: number, value: Kept) {
  localStorage.setItem(`sealed:${matchId}:${turn}`, JSON.stringify(value))
}

function recall(matchId: string, turn: number): Kept | null {
  const raw = localStorage.getItem(`sealed:${matchId}:${turn}`)
  return raw ? (JSON.parse(raw) as Kept) : null
}

function rememberSide(matchId: string, side: Side) {
  localStorage.setItem(`sealed:side:${matchId}`, String(side))
}

function recallSide(matchId: string): Side | null {
  const raw = localStorage.getItem(`sealed:side:${matchId}`)
  return raw === null ? null : (Number(raw) as Side)
}

/** Re-run one already-resolved turn, used when rebuilding the narration. */
function replayTurn(
  match: Match,
  board: ReturnType<typeof generateBoard>,
  position: ReturnType<typeof startPosition>,
  turn: number,
) {
  const sealedText = match.sealed[turn]?.orders
  const openText = match.open[turn]
  if (!sealedText || !openText) return null
  const sealedOrders = ordersFromText(sealedText)
  const openOrders = ordersFromText(openText)
  if (!sealedOrders || !openOrders) return null
  const committer = committerOf(turn)
  const pair: [Orders, Orders] =
    committer === 0 ? [sealedOrders, openOrders] : [openOrders, sealedOrders]
  return resolveTurn(board, position, pair).position
}

function freshMatch(): Match {
  return newMatch(randomSeedText(), `m${Date.now().toString(36)}`)
}

export default function App() {
  const [mode, setMode] = useState<Mode>('ghost')
  const [match, setMatch] = useState<Match>(() => {
    const fromLink = window.location.hash.startsWith('#m=')
      ? decodeMatch(window.location.hash.slice(3))
      : null
    return fromLink ?? freshMatch()
  })
  const [you, setYou] = useState<Side>(0)
  const [draft, setDraft] = useState<Step[]>([])
  const [copied, setCopied] = useState(false)
  const [broken, setBroken] = useState<number | null>(null)

  const board = useMemo(() => generateBoard(match.seed), [match.seed])
  /**
   * What happened last turn, replayed from the opened seal.
   *
   * Playing it by hand, the resolution was invisible: pieces simply appeared
   * somewhere new. Both sets of orders are public once a seal is broken, so the
   * turn can be narrated exactly rather than guessed at.
   */
  const lastTurn = useMemo(() => {
    const turn = replay(match).turnsPlayed
    if (turn === 0) return null

    let position = startPosition(board)
    for (let at = 1; at < turn; at += 1) {
      position = replayTurn(match, board, position, at) ?? position
    }
    const sealedText = match.sealed[turn]?.orders
    const openText = match.open[turn]
    if (!sealedText || !openText) return null

    const sealedOrders = ordersFromText(sealedText)
    const openOrders = ordersFromText(openText)
    if (!sealedOrders || !openOrders) return null

    const committer = committerOf(turn)
    const pair: [Orders, Orders] =
      committer === 0 ? [sealedOrders, openOrders] : [openOrders, sealedOrders]
    return { turn, mine: pair[you], theirs: pair[1 - you], result: resolveTurn(board, position, pair) }
  }, [match, board, you])

  const state = useMemo(() => replay(match), [match])
  const stage = useMemo(() => stageOf(match), [match])
  const call = verdict(board, state.position)

  // A link that already carries a sealed turn belongs to the second player.
  useEffect(() => {
    const known = recallSide(match.id)
    if (known !== null) {
      setYou(known)
      return
    }
    const started = Object.keys(match.sealed).length > 0 || Object.keys(match.open).length > 0
    const side: Side = started && mode === 'link' ? 1 : 0
    rememberSide(match.id, side)
    setYou(side)
  }, [match.id, match.sealed, match.open, mode])

  useEffect(() => {
    if (mode !== 'link') return
    window.location.hash = `m=${encodeMatch(match)}`
  }, [match, mode])

  useEffect(() => {
    let cancelled = false
    auditSeals(match).then((turn) => {
      if (!cancelled) setBroken(turn)
    })
    return () => {
      cancelled = true
    }
  }, [match])

  const advance = useCallback(
    async (next: Match) => {
      setMatch(next)
      setDraft([])
      setCopied(false)
    },
    [],
  )

  const orders = ordersFromText(draft.join('').padEnd(3, '.'))

  const act = async () => {
    if (!orders || stage.kind === 'over') return

    if (stage.kind === 'commit') {
      const nonce = makeNonce()
      keep(match.id, stage.turn, { orders: orders.join(''), nonce })
      await advance(await seal(match, stage.turn, orders, nonce))
      return
    }

    if (stage.kind === 'open') {
      await advance(play(match, stage.turn, orders))
      return
    }

    const kept = recall(match.id, stage.turn)
    if (!kept) return
    const sealedOrders = ordersFromText(kept.orders)
    if (!sealedOrders) return
    await advance(unseal(match, stage.turn, sealedOrders, kept.nonce))
  }

  // The ghost plays its own side the moment the match waits on it.
  useEffect(() => {
    if (mode !== 'ghost' || stage.kind === 'over' || stage.side === you) return
    let cancelled = false

    const timer = window.setTimeout(async () => {
      const theirs = botOrders(board, state.position, stage.side, 'reader')
      let next = match
      if (stage.kind === 'commit') {
        const nonce = makeNonce()
        keep(match.id, stage.turn, { orders: theirs.join(''), nonce })
        next = await seal(match, stage.turn, theirs, nonce)
      } else if (stage.kind === 'open') {
        next = play(match, stage.turn, theirs)
      } else {
        const kept = recall(match.id, stage.turn)
        const sealedOrders = kept ? ordersFromText(kept.orders) : null
        if (kept && sealedOrders) next = unseal(match, stage.turn, sealedOrders, kept.nonce)
      }
      if (!cancelled) setMatch(next)
    }, 320)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [mode, stage, you, match, board, state.position])

  const startFresh = (nextMode: Mode) => {
    const created = freshMatch()
    rememberSide(created.id, 0)
    setMode(nextMode)
    setMatch(created)
    setYou(0)
    setDraft([])
    if (nextMode === 'ghost') window.location.hash = ''
  }

  const copyLink = async () => {
    await navigator.clipboard?.writeText(window.location.href)
    setCopied(true)
  }

  const yourTurn = stage.kind !== 'over' && stage.side === you
  const waiting = stage.kind !== 'over' && stage.side !== you
  const preview = yourTurn && stage.kind !== 'reveal' ? routeOf(board, state.position.pieces[you], draft) : []

  const stageWord =
    stage.kind === 'commit'
      ? 'Seal your orders'
      : stage.kind === 'open'
        ? 'Play your orders in the open'
        : stage.kind === 'reveal'
          ? 'Break your seal'
          : 'Match over'

  return (
    <main className="app">
      <header className="masthead">
        <div>
          <h1 className="wordmark">Sealed Orders</h1>
          <p className="tagline">
            Two players, one board, no server. Nobody moves second, because nobody can see the other
            move.
          </p>
        </div>
        <div className="modes">
          <button className="chip" aria-pressed={mode === 'ghost'} onClick={() => startFresh('ghost')}>
            Play the ghost
          </button>
          <button className="chip" aria-pressed={mode === 'link'} onClick={() => startFresh('link')}>
            Pass a link
          </button>
        </div>
      </header>

      <section className="table">
        <BoardView board={board} position={state.position} you={you} preview={preview} />

        <div className="side">
          <div className="scores">
            <div className={you === 0 ? 'me' : 'them'}>
              <span className="label">You</span>
              <span className="value">{held(state.position, you)}</span>
              <span className="sub">{state.position.drawn[you]} water</span>
            </div>
            <div className={you === 0 ? 'them' : 'me'}>
              <span className="label">Them</span>
              <span className="value">{held(state.position, (1 - you) as Side)}</span>
              <span className="sub">{state.position.drawn[1 - you]} water</span>
            </div>
            <div>
              <span className="label">Turn</span>
              <span className="value">{state.position.turn}</span>
              <span className="sub">of 12</span>
            </div>
          </div>

          {broken !== null && (
            <p className="alarm">
              Broken seal on turn {broken}. The orders revealed do not match what was committed to —
              this match cannot be trusted.
            </p>
          )}

          {call.over ? (
            <div className="finish">
              <h2>
                {call.winner === 'draw'
                  ? 'Level match.'
                  : call.winner === you
                    ? 'You held the field.'
                    : 'They held the field.'}
              </h2>
              <p>
                {state.position.drawn[you]} water to {state.position.drawn[1 - you]}, over{' '}
                {state.turnsPlayed} turns.
              </p>
              <button className="chip solid" onClick={() => startFresh(mode)}>
                New match
              </button>
            </div>
          ) : (
            <>
              <p className="stage">
                <b>{yourTurn ? stageWord : 'Waiting for them'}</b>
                {stage.kind === 'commit' && yourTurn && ' — they will see only a hash of them.'}
                {stage.kind === 'open' && yourTurn && ' — they are already committed, so this is safe.'}
                {stage.kind === 'reveal' && yourTurn && ' — the orders you sealed are now opened and checked.'}
              </p>

              {yourTurn && stage.kind !== 'reveal' && (
                <>
                  <div className="slots">
                    {[0, 1, 2].map((slot) => (
                      <button
                        key={slot}
                        className={`slot${draft[slot] ? ' filled' : ''}`}
                        onClick={() => setDraft(draft.slice(0, slot))}
                        aria-label={`step ${slot + 1}`}
                      >
                        {draft[slot] ?? '·'}
                      </button>
                    ))}
                  </div>
                  <div className="pad">
                    {STEPS.map((step) => (
                      <button
                        key={step}
                        className="key"
                        disabled={draft.length >= 3}
                        onClick={() => setDraft([...draft, step])}
                      >
                        {step === '.' ? 'wait' : step}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <div className="rack">
                {yourTurn && (
                  <button className="chip solid" onClick={act}>
                    {stage.kind === 'commit' ? 'Seal' : stage.kind === 'open' ? 'Play' : 'Reveal'}
                  </button>
                )}
                {mode === 'link' && (
                  <button className="chip" onClick={copyLink} disabled={!waiting}>
                    {copied ? 'Link copied' : 'Copy link for them'}
                  </button>
                )}
              </div>

              {lastTurn && (
                <p className="recap">
                  <b>Turn {lastTurn.turn}:</b> you gave {lastTurn.mine.join('')}, they gave{' '}
                  {lastTurn.theirs.join('')}.{' '}
                  {lastTurn.result.claimed.length === 0 && lastTurn.result.contested.length === 0
                    ? 'Nothing changed hands.'
                    : [
                        ...lastTurn.result.claimed.map((claim) =>
                          claim.side === you ? 'You took a well.' : 'They took a well.',
                        ),
                        ...lastTurn.result.contested.map(
                          () => 'You both sat down on the same well at once, so neither of you got it.',
                        ),
                      ].join(' ')}
                </p>
              )}

              {mode === 'link' && waiting && (
                <p className="note">
                  Send that link. It carries the whole match — the board, every resolved turn, and a
                  commitment to your orders that nobody can read until you open it.
                </p>
              )}
            </>
          )}

          <details className="rules">
            <summary>How a turn works</summary>
            <p>
              You program three steps. So do they, at the same time, without seeing yours. A well goes
              to whoever <b>sits down on it first</b> and is still there when the turn ends — walking
              across it does nothing. Settle on the same well on the same beat and neither of you gets
              it, and both pieces go back where they started.
            </p>
            <p>
              Wells change hands: sit on one they hold, with nobody there to answer, and it is yours.
              Hold three at once and the match is over. Otherwise the water counted at the end of every
              turn decides it, and the deep well in the middle pays double.
            </p>
            <p>
              Turn {stage.kind === 'over' ? state.position.turn : stage.turn} is sealed by{' '}
              {committerOf(stage.kind === 'over' ? 1 : stage.turn) === you ? 'you' : 'them'}. Sealing
              alternates, so neither player is ever the one who always moves in the open.
            </p>
          </details>
        </div>
      </section>

      {mode === 'link' && (
        <label className="paste">
          <span>Paste the link they sent you</span>
          <input
            placeholder="https://…#m=…"
            onChange={(event) => {
              const value = event.target.value
              const at = value.indexOf('#m=')
              const decoded = decodeMatch(at === -1 ? value : value.slice(at + 3))
              if (decoded) {
                setMatch(decoded)
                setDraft([])
              }
            }}
          />
        </label>
      )}
    </main>
  )
}
