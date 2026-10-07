import { useCallback, useEffect, useState } from 'react'
import './App.css'
import { applyMove, boardsWon, initialState } from './game'
import type { BoardWinner, GameState, Player } from './game'
import { BOARD_NAMES, MegaGrid, OMark, PlayerMark, SIDE_NAME, XMark } from './Board'
import { ROOMS_URL, useTable } from './net/useTable'

// ─── Rooms and links ─────────────────────────────────────────────────────────

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const NAME_KEY = 'ultra-ttt:name'

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

type Mode = { kind: 'lobby' } | { kind: 'local' } | { kind: 'online'; code: string }

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  // A room link is an invitation, not a seat: it opens the lobby with the code
  // filled in, so the visitor can say who they are before sitting down.
  const [mode, setMode] = useState<Mode>({ kind: 'lobby' })
  const [invite, setInvite] = useState<string | null>(() => (ROOMS_URL ? codeFromHash() : null))
  const [name, setName] = useState(savedName)

  useEffect(() => {
    try {
      localStorage.setItem(NAME_KEY, name)
    } catch {
      // storage refused; the name lasts for this visit
    }
  }, [name])

  const goOnline = useCallback((code: string) => {
    history.replaceState(null, '', `#room=${code}`)
    setInvite(null)
    setMode({ kind: 'online', code })
  }, [])

  const toLobby = useCallback(() => {
    history.replaceState(null, '', location.pathname + location.search)
    setInvite(null)
    setMode({ kind: 'lobby' })
  }, [])

  return (
    <div className="app">
      <div className="bg-noise" aria-hidden="true" />
      {mode.kind === 'lobby' && (
        <Lobby
          name={name}
          onName={setName}
          invite={invite}
          onDeclineInvite={toLobby}
          onLocal={() => setMode({ kind: 'local' })}
          onCreate={() => goOnline(newCode())}
          onJoin={goOnline}
        />
      )}
      {mode.kind === 'local' && <LocalGame onLeave={toLobby} />}
      {mode.kind === 'online' && (
        <OnlineGame code={mode.code} name={name.trim() || 'Player'} onLeave={toLobby} />
      )}
    </div>
  )
}

// ─── Lobby ────────────────────────────────────────────────────────────────────

function Lobby({
  name,
  onName,
  invite,
  onDeclineInvite,
  onLocal,
  onCreate,
  onJoin,
}: {
  name: string
  onName: (name: string) => void
  invite: string | null
  onDeclineInvite: () => void
  onLocal: () => void
  onCreate: () => void
  onJoin: (code: string) => void
}) {
  const [code, setCode] = useState('')
  const valid = /^[A-Z0-9]{4,12}$/.test(code)

  return (
    <>
      <header className="app-header">
        <Wordmark />
      </header>
      <main className="lobby">
        {invite ? (
          <section className="lobby-card lobby-card--invite" aria-label="Invitation">
            <h2 className="lobby-title">You&rsquo;re invited</h2>
            <p className="lobby-body">
              A game is waiting in room <b className="lobby-invite-code">{invite}</b>. Tell your
              opponent who you are, then take a seat.
            </p>
            <label className="lobby-label" htmlFor="invite-name">
              Your name
            </label>
            <input
              id="invite-name"
              className="lobby-input"
              value={name}
              maxLength={24}
              placeholder="Name"
              autoFocus
              onChange={e => onName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') onJoin(invite)
              }}
            />
            <button className="btn-play-again" onClick={() => onJoin(invite)}>
              Join room {invite}
            </button>
            <button className="btn-new" onClick={onDeclineInvite}>
              Not this room
            </button>
          </section>
        ) : null}

        <section className="lobby-card">
          <h2 className="lobby-title">Same screen</h2>
          <p className="lobby-body">Two players, one device, taking turns.</p>
          <button className="btn-play-again" onClick={onLocal}>
            Play here
          </button>
        </section>

        <section className="lobby-card">
          <h2 className="lobby-title">Online</h2>
          {ROOMS_URL ? (
            <>
              <label className="lobby-label" htmlFor="name">
                Your name
              </label>
              <input
                id="name"
                className="lobby-input"
                value={name}
                maxLength={24}
                placeholder="Name"
                onChange={e => onName(e.target.value)}
              />
              <button className="btn-play-again" onClick={onCreate}>
                Create a room
              </button>
              <div className="lobby-join">
                <input
                  className="lobby-input lobby-code"
                  value={code}
                  maxLength={12}
                  placeholder="Room code"
                  aria-label="Room code"
                  onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && valid) onJoin(code)
                  }}
                />
                <button className="btn-new" disabled={!valid} onClick={() => onJoin(code)}>
                  Join
                </button>
              </div>
              <p className="lobby-body lobby-fine">
                The first two people in a room play; anyone after them watches.
              </p>
            </>
          ) : (
            <p className="lobby-body">Online play isn&rsquo;t configured for this deployment.</p>
          )}
        </section>
      </main>
      <Footer />
    </>
  )
}

// ─── Local game ───────────────────────────────────────────────────────────────

function LocalGame({ onLeave }: { onLeave: () => void }) {
  const [game, setGame] = useState<GameState>(initialState)

  const play = useCallback((board: number, cell: number) => {
    setGame(current => applyMove(current, { board, cell }) ?? current)
  }, [])
  const reset = useCallback(() => setGame(initialState()), [])

  return (
    <>
      <Header game={game} onLeave={onLeave}>
        <button className="btn-new" onClick={reset}>
          New game
        </button>
      </Header>
      <main className="arena">
        <MegaGrid game={game} canPlay onPlay={play} />
        {game.winner && (
          <GameOver winner={game.winner}>
            <button className="btn-play-again" onClick={reset}>
              Play again
            </button>
          </GameOver>
        )}
      </main>
      <Footer />
    </>
  )
}

// ─── Online game ──────────────────────────────────────────────────────────────

function OnlineGame({ code, name, onLeave }: { code: string; name: string; onLeave: () => void }) {
  const online = useTable(code, name)
  const { table, side, status, peers, error } = online
  const game = table.game
  const [copied, setCopied] = useState(false)

  const opponentSide: Player | null = side === 'X' ? 'O' : side === 'O' ? 'X' : null
  const opponentId = opponentSide ? table.seats[opponentSide] : null
  const opponentHere = opponentId !== null && peers.has(opponentId)
  const seated = table.seats.X !== null && table.seats.O !== null
  const myTurn = status === 'open' && seated && side === game.current && !game.winner

  const nameOf = (id: string | null) =>
    id === null ? null : id === online.self ? name : (peers.get(id)?.name ?? 'Away')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(roomLink(code))
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  let note: string
  if (error) note = error
  else if (status === 'connecting') note = 'Connecting to the room…'
  else if (status === 'reconnecting') note = 'Connection lost — reconnecting. Your seat is held.'
  else if (!seated) note = side ? 'Waiting for an opponent. Send them the link.' : 'Taking a seat…'
  else if (side === null) note = 'Watching. Both seats are taken.'
  else if (!opponentHere && !game.winner) note = `${nameOf(opponentId)} has stepped away. Their seat is held.`
  else if (myTurn) note = 'Your move.'
  else if (!game.winner) note = `${nameOf(opponentId)} is thinking…`
  else note = ''

  return (
    <>
      <Header game={game} onLeave={onLeave} mine={side} myTurn={myTurn}>
        <button className="btn-new" onClick={copy} title={roomLink(code)}>
          {copied ? 'Link copied' : `Room ${code}`}
        </button>
      </Header>

      <div className="room-bar" role="status" aria-live="polite">
        <span className={`room-dot room-dot-${status}`} aria-hidden="true" />
        <SeatChip side="X" name={nameOf(table.seats.X)} you={side === 'X'} here={table.seats.X ? table.seats.X === online.self || peers.has(table.seats.X) : false} />
        <span className="room-vs">vs</span>
        <SeatChip side="O" name={nameOf(table.seats.O)} you={side === 'O'} here={table.seats.O ? table.seats.O === online.self || peers.has(table.seats.O) : false} />
        {note && <span className="room-note">{note}</span>}
      </div>

      <main className="arena">
        <MegaGrid game={game} canPlay={myTurn} onPlay={(board, cell) => online.play({ board, cell })} />
        {game.winner && (
          <GameOver winner={game.winner} perspective={side}>
            {side ? (
              <button className="btn-play-again" onClick={online.rematch} disabled={status !== 'open'}>
                Rematch — sides swap
              </button>
            ) : (
              <p className="overlay-body">Waiting for the players to start a rematch.</p>
            )}
          </GameOver>
        )}
      </main>
      <Footer />
    </>
  )
}

function SeatChip({ side, name, you, here }: { side: Player; name: string | null; you: boolean; here: boolean }) {
  return (
    <span className={`seat-chip seat-chip-${side} ${here ? '' : 'seat-chip-away'}`}>
      <PlayerMark player={side} size={12} />
      <span>{name ?? 'Open seat'}</span>
      {you && <span className="seat-you">you</span>}
    </span>
  )
}

// ─── Shared chrome ────────────────────────────────────────────────────────────

function Wordmark() {
  return (
    <div className="wordmark">
      <span className="wm-ultra">ULTRA</span>
      <span className="wm-ttt">TTT</span>
    </div>
  )
}

function Header({
  game,
  onLeave,
  mine,
  myTurn,
  children,
}: {
  game: GameState
  onLeave: () => void
  /** The side this browser plays online; undefined for local play. */
  mine?: Player | null
  myTurn?: boolean
  children?: React.ReactNode
}) {
  const current = game.current
  const xCount = boardsWon(game, 'X')
  const oCount = boardsWon(game, 'O')
  const who = mine === undefined ? SIDE_NAME[current] : myTurn ? 'You' : SIDE_NAME[current]

  return (
    <header className="app-header">
      <button className="wordmark wordmark-button" onClick={onLeave} title="Back to the lobby">
        <span className="wm-ultra">ULTRA</span>
        <span className="wm-ttt">TTT</span>
      </button>

      <div className="header-center">
        {game.winner ? (
          <div className={`status-winner status-winner-${game.winner}`}>
            {game.winner === 'tie' ? (
              'Draw — well played'
            ) : (
              <>
                <span className="status-mark">
                  <PlayerMark player={game.winner} size={16} />
                </span>
                {SIDE_NAME[game.winner]} wins
              </>
            )}
          </div>
        ) : (
          <div className={`status-turn status-turn-${current}`}>
            <span className="status-mark">
              <PlayerMark player={current} size={14} />
            </span>
            <span>
              {who}
              <span className="status-sub">
                {game.activeBoard === null ? ' · Any board' : ` · ${BOARD_NAMES[game.activeBoard]}`}
              </span>
            </span>
          </div>
        )}
      </div>

      <div className="header-right">
        <div className="score-pill">
          <span className={`score-x ${current === 'X' && !game.winner ? 'score-current' : ''} ${game.winner === 'X' ? 'score-won' : ''}`}>
            <XMark size={12} />
            <span className="scores">{xCount}</span>
          </span>
          <span className="score-sep" />
          <span className={`score-o ${current === 'O' && !game.winner ? 'score-current' : ''} ${game.winner === 'O' ? 'score-won' : ''}`}>
            <span className="scores">{oCount}</span>
            <OMark size={12} />
          </span>
        </div>
        {children}
      </div>
    </header>
  )
}

function GameOver({
  winner,
  perspective,
  children,
}: {
  winner: BoardWinner
  /** Online, the result is told from this side's point of view. */
  perspective?: Player | null
  children: React.ReactNode
}) {
  if (!winner) return null
  const body =
    winner === 'tie'
      ? 'Neither side blinked.'
      : perspective
        ? perspective === winner
          ? 'Dominant performance.'
          : 'Next one is yours.'
        : 'Dominant performance.'
  return (
    <div className={`overlay overlay-${winner}`}>
      <div className="overlay-card">
        <p className="overlay-eyebrow">Game over</p>
        {winner === 'tie' ? (
          <h2 className="overlay-title">Draw</h2>
        ) : (
          <h2 className={`overlay-title overlay-title-${winner}`}>
            <span className="overlay-mark">
              <PlayerMark player={winner} size={48} />
            </span>
            {perspective ? (perspective === winner ? 'You win' : `${SIDE_NAME[winner]} wins`) : `${SIDE_NAME[winner]} wins`}
          </h2>
        )}
        <p className="overlay-body">{body}</p>
        {children}
      </div>
    </div>
  )
}

function Footer() {
  return (
    <footer className="app-footer">
      <span>Your cell choice picks the next board</span>
      <span className="footer-dot">·</span>
      <span>Win 3 boards in a row to claim victory</span>
      <span className="footer-dot">·</span>
      <span>Sent to a won board? Play anywhere</span>
    </footer>
  )
}

export default App
