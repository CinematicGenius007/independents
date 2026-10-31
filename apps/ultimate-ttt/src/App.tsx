import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import { LEVELS } from './ai'
import type { Level } from './ai'
import { applyMove, initialState } from './game'
import type { GameState, Move, Player } from './game'
import { codename } from './history'
import { Lobby } from './Lobby'
import { InvitePanel, MatchView } from './Match'
import type { SeatInfo } from './Match'
import { ROOMS_URL, useTable } from './net/useTable'
import { parseReplayHash } from './record'
import type { MatchRecord } from './record'
import { useAi } from './useAi'
import { useRecordMatch } from './useRecordMatch'

// ─── Rooms and links ─────────────────────────────────────────────────────────

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const NAME_KEY = 'ultra-ttt:name'
/** The room this tab is sitting in, so a reload goes straight back to it. */
const ROOM_KEY = 'ultra-ttt:room'

function storedRoom(): string | null {
  try {
    return sessionStorage.getItem(ROOM_KEY)
  } catch {
    return null
  }
}

function storeRoom(code: string | null): void {
  try {
    if (code) sessionStorage.setItem(ROOM_KEY, code)
    else sessionStorage.removeItem(ROOM_KEY)
  } catch {
    // a private window may refuse storage; a reload then asks again
  }
}

function newCode(): string {
  const bytes = new Uint8Array(5)
  crypto.getRandomValues(bytes)
  return [...bytes].map(b => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
}

function codeFromHash(): string | null {
  const match = /^#?room=([A-Za-z0-9]{4,12})$/.exec(location.hash)
  return match ? match[1].toUpperCase() : null
}

function roomLink(code: string): string {
  return `${location.origin}${location.pathname}#room=${code}`
}

function savedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) || ''
  } catch {
    return ''
  }
}

type Mode =
  | { kind: 'lobby' }
  | { kind: 'local' }
  | { kind: 'ai'; level: Level }
  | { kind: 'online'; code: string }
  | { kind: 'replay'; record: MatchRecord; claimed: string | null; hash: string }

function replayFromHash(): Mode | null {
  const parsed = parseReplayHash(location.hash)
  return parsed ? { kind: 'replay', ...parsed, hash: location.hash } : null
}

/** The game so far: the moves are the truth, the position is a fold over them. */
function fold(starter: Player, moves: Move[]): GameState {
  return moves.reduce((state, move) => applyMove(state, move) ?? state, initialState(starter))
}

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  // A room link is an invitation, not a seat: it opens the lobby with the code
  // filled in, so the visitor can say who they are before sitting down.
  // A tab that was already in this room goes straight back; anyone else is asked.
  const linked = ROOMS_URL ? codeFromHash() : null
  const [mode, setMode] = useState<Mode>(() => {
    const replay = replayFromHash()
    if (replay) return replay
    return linked && storedRoom() === linked ? { kind: 'online', code: linked } : { kind: 'lobby' }
  })
  const [invite, setInvite] = useState<string | null>(() => (linked && storedRoom() !== linked ? linked : null))
  const [name, setName] = useState(savedName)
  const fallbackName = useMemo(codename, [])

  useEffect(() => {
    try {
      localStorage.setItem(NAME_KEY, name)
    } catch {
      // storage refused; the name lasts for this visit
    }
  }, [name])

  // A replay link followed from inside the app (the history list) only changes the hash.
  useEffect(() => {
    const onHash = () => {
      const replay = replayFromHash()
      // Only the lobby and another replay give way to a replay link; a live game must not be dropped by one.
      if (replay) setMode(m => (m.kind === 'lobby' || m.kind === 'replay' ? replay : m))
      // Back out of a replay: the hash is gone, so is the screen.
      else if (!location.hash) setMode(m => (m.kind === 'replay' ? { kind: 'lobby' } : m))
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const goOnline = useCallback((code: string) => {
    history.replaceState(null, '', `#room=${code}`)
    storeRoom(code)
    setInvite(null)
    setMode({ kind: 'online', code })
  }, [])

  const toLobby = useCallback(() => {
    history.replaceState(null, '', location.pathname + location.search)
    storeRoom(null)
    setInvite(null)
    setMode({ kind: 'lobby' })
  }, [])

  const me = name.trim() || fallbackName

  return (
    <div className="app">
      {mode.kind === 'lobby' && (
        <Lobby
          name={name}
          placeholder={fallbackName}
          onName={setName}
          invite={invite}
          onDeclineInvite={toLobby}
          onLocal={() => setMode({ kind: 'local' })}
          onAi={level => setMode({ kind: 'ai', level })}
          onCreate={() => goOnline(newCode())}
          onJoin={goOnline}
        />
      )}
      {mode.kind === 'local' && <LocalGame onLeave={toLobby} />}
      {mode.kind === 'ai' && <AiGame level={mode.level} name={me} onLeave={toLobby} />}
      {mode.kind === 'online' && <OnlineGame code={mode.code} name={me} onLeave={toLobby} />}
      {mode.kind === 'replay' && (
        <ReplayGame key={mode.hash} record={mode.record} claimed={mode.claimed} onLeave={toLobby} />
      )}
    </div>
  )
}

const seat = (side: Player, name: string, you: boolean, here = true, role?: string): SeatInfo => ({
  side,
  name,
  you,
  here,
  role,
})

// ─── Same screen ──────────────────────────────────────────────────────────────

function LocalGame({ onLeave }: { onLeave: () => void }) {
  const [moves, setMoves] = useState<Move[]>([])
  const [round, setRound] = useState(1)
  const game = useMemo(() => fold('X', moves), [moves])
  const { info, history } = useRecordMatch({
    key: `local:${round}`,
    winner: game.winner,
    starter: 'X',
    moves,
    me: null,
    file: true,
    vs: 'Same screen',
  })

  const reset = () => {
    setMoves([])
    setRound(r => r + 1)
  }

  return (
    <MatchView
      eyebrow="Same screen"
      link={{ tone: 'idle', label: 'Local' }}
      seats={[seat('X', 'Player 1', false, true, ''), seat('O', 'Player 2', false, true, '')]}
      starter="X"
      moves={moves}
      game={game}
      canPlay
      onPlay={(board, cell) => setMoves(m => (applyMove(fold('X', m), { board, cell }) ? [...m, { board, cell }] : m))}
      note={`${game.current} to play.`}
      result={{ rematch: { label: 'Play again', onClick: reset } }}
      info={info}
      history={history}
      onLeave={onLeave}
    />
  )
}

// ─── Versus the machine ───────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function AiGame({ level, name, onLeave }: { level: Level; name: string; onLeave: () => void }) {
  const [moves, setMoves] = useState<Move[]>([])
  const [round, setRound] = useState(1)
  const ask = useAi()
  const levelName = LEVELS.find(l => l.id === level)!.name
  // Sides swap every game, as online: X always opens.
  const mine: Player = round % 2 === 1 ? 'X' : 'O'
  const game = useMemo(() => fold('X', moves), [moves])
  const machineTurn = !game.winner && game.current !== mine
  const count = moves.length

  useEffect(() => {
    if (!machineTurn) return
    let live = true
    const started = Date.now()
    ;(async () => {
      const move = await ask(fold('X', moves), level)
      // Even an instant answer waits a beat, so the reply reads as a decision.
      await sleep(Math.max(0, 450 - (Date.now() - started)))
      if (live) setMoves(m => (m.length === count ? [...m, move] : m))
    })()
    return () => {
      live = false
    }
    // `moves` is read once per machine turn; `count` identifies the turn
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machineTurn, count, round, level, ask])

  const { info, history } = useRecordMatch({
    key: `ai:${level}:${round}`,
    winner: game.winner,
    starter: 'X',
    moves,
    me: mine,
    file: true,
    vs: levelName,
  })

  const theirs: Player = mine === 'X' ? 'O' : 'X'
  const seats: [SeatInfo, SeatInfo] =
    mine === 'X'
      ? [seat('X', name, true), seat('O', levelName, false)]
      : [seat('X', levelName, false), seat('O', name, true)]

  return (
    <MatchView
      eyebrow={`Versus ${levelName}`}
      link={{ tone: 'idle', label: 'Solo' }}
      seats={seats}
      starter="X"
      moves={moves}
      game={game}
      canPlay={!machineTurn && !game.winner}
      onPlay={(board, cell) => setMoves(m => (applyMove(fold('X', m), { board, cell }) ? [...m, { board, cell }] : m))}
      note={
        game.winner
          ? ''
          : machineTurn
            ? `${levelName} is thinking…`
            : `Your move — you are ${mine}, ${theirs} is ${levelName}.`
      }
      result={{
        rematch: {
          label: 'Rematch — sides swap',
          onClick: () => {
            setMoves([])
            setRound(r => r + 1)
          },
        },
      }}
      info={info}
      history={history}
      onLeave={onLeave}
    />
  )
}

// ─── Online ───────────────────────────────────────────────────────────────────

function OnlineGame({ code, name, onLeave }: { code: string; name: string; onLeave: () => void }) {
  const online = useTable(code, name)
  const { table, side, status, peers, error } = online
  const game = table.game

  const opponentSide: Player | null = side === 'X' ? 'O' : side === 'O' ? 'X' : null
  const opponentId = opponentSide ? table.seats[opponentSide] : null
  const opponentHere = opponentId !== null && peers.has(opponentId)
  const seated = table.seats.X !== null && table.seats.O !== null
  const myTurn = status === 'open' && seated && side === game.current && !game.winner

  const nameOf = (id: string | null, fallback = 'Open seat') =>
    id === null ? fallback : id === online.self ? name : (peers.get(id)?.name ?? 'Away')
  const hereOf = (id: string | null) => (id ? id === online.self || peers.has(id) : false)

  const { info, history } = useRecordMatch({
    key: `${code}:${table.round}`,
    winner: game.winner,
    starter: 'X',
    moves: table.moves,
    me: side,
    file: side !== null,
    vs: opponentSide ? nameOf(opponentId, 'Rival') : 'Players',
  })

  let note: string
  if (error) note = error
  else if (status === 'connecting') note = 'Connecting to the room…'
  else if (status === 'reconnecting') note = 'Connection lost. Your seat is held.'
  else if (!seated) note = side ? 'Holding the other seat. Send them the link.' : 'Taking a seat…'
  else if (side === null) note = 'Watching. Both seats are taken.'
  else if (!opponentHere && !game.winner) note = `${nameOf(opponentId)} has stepped away. Their seat is held.`
  else if (myTurn) note = 'Your move.'
  else if (!game.winner) note = `${nameOf(opponentId)} is thinking…`
  else note = ''

  const seatCount = (table.seats.X ? 1 : 0) + (table.seats.O ? 1 : 0)
  const waiting = side !== null && !seated && !error

  return (
    <MatchView
      eyebrow={`Room · ${code}`}
      link={
        status === 'open'
          ? { tone: 'live', label: 'Live' }
          : status === 'reconnecting'
            ? { tone: 'lost', label: 'Offline' }
            : { tone: 'idle', label: 'Connecting' }
      }
      seats={[
        seat('X', nameOf(table.seats.X), side === 'X', hereOf(table.seats.X) || table.seats.X === null),
        seat('O', nameOf(table.seats.O), side === 'O', hereOf(table.seats.O) || table.seats.O === null),
      ]}
      starter="X"
      moves={table.moves}
      game={game}
      canPlay={myTurn}
      onPlay={(board, cell) => online.play({ board, cell })}
      note={note}
      signalLost={status === 'reconnecting'}
      dock={waiting ? <InvitePanel code={code} link={roomLink(code)} seated={seatCount} /> : undefined}
      result={
        side
          ? { rematch: { label: 'Rematch — sides swap', onClick: online.rematch, disabled: status !== 'open' } }
          : { watcherNote: 'Waiting for the players to start a rematch.' }
      }
      info={info}
      history={history}
      onLeave={onLeave}
    />
  )
}

// ─── Replay ───────────────────────────────────────────────────────────────────

function ReplayGame({
  record,
  claimed,
  onLeave,
}: {
  record: MatchRecord
  claimed: string | null
  onLeave: () => void
}) {
  const game = useMemo(() => fold(record.starter, record.moves), [record])
  const { info, history } = useRecordMatch({
    key: 'replay',
    winner: game.winner,
    starter: record.starter,
    moves: record.moves,
    me: null,
    file: false,
    vs: '',
  })
  // The page shows the stored matches too, so a replay opened from the list can hop to another.
  const verdict = !info ? null : claimed === null ? 'computed' : claimed === info.number ? 'verified' : 'mismatch'

  return (
    <MatchView
      eyebrow="Replay"
      link={{ tone: 'idle', label: 'Replay' }}
      seats={[
        seat('X', record.starter === 'X' ? 'Opens' : 'Replies', false, true, ''),
        seat('O', record.starter === 'O' ? 'Opens' : 'Replies', false, true, ''),
      ]}
      starter={record.starter}
      moves={record.moves}
      game={game}
      canPlay={false}
      onPlay={() => {}}
      note={game.winner ? '' : 'This game was shared unfinished.'}
      info={info}
      history={history}
      onLeave={onLeave}
      replayBadge={
        verdict && (
          <p className={`verify verify-${verdict}`}>
            {verdict === 'verified' && `✓ Verified by replay — #${info!.number}`}
            {verdict === 'computed' && `Number computed from the moves — #${info!.number}`}
            {verdict === 'mismatch' &&
              `✕ The link says #${claimed}, the moves say #${info!.number}. They may have been changed.`}
          </p>
        )
      }
    />
  )
}

export default App
