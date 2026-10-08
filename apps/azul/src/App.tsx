/**
 * Three screens and the rules that move between them: the front door, the
 * room, and the table. Which one is showing is a function of the session, not
 * of a router — there is nothing to route to.
 */

import { useCallback, useEffect, useState } from 'react'
import { Home } from './ui/Home'
import { Lobby } from './ui/Lobby'
import { Rules } from './ui/Rules'
import { setSoundEnabled, soundEnabled } from './ui/audio'
import { Table } from './ui/Table'
import { COLORS } from './engine/types'
import type { GameState } from './engine/types'
import { unseenTiles } from './engine/preview'
import { GLAZE_TEXT } from './ui/Tile'
import { useSession } from './useSession'
import type { RoomKind } from './useSession'
import { parseRoomIdFromLocation } from './net/room'

const NAME_KEY = 'azulejo:name'
/** The room this tab is sitting in, so a reload goes straight back to it. */
const ROOM_KEY = 'azulejo:room'

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

const NAMES = ['Amoreira', 'Bicesse', 'Cascais', 'Douro', 'Estremoz', 'Faro', 'Guimarães', 'Lagos']

function initialName(): string {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(NAME_KEY)
    if (saved) return saved
  }
  return NAMES[Math.floor(Math.random() * NAMES.length)]
}

export default function App() {
  const [name, setName] = useState(initialName)
  // A tab that was already at this table goes straight back to it; anyone else
  // arriving by the link is asked who they are first (below).
  const linked = parseRoomIdFromLocation()
  const [room, setRoom] = useState<RoomKind | null>(() =>
    linked && storedRoom() === linked ? { kind: 'join', code: linked } : null,
  )
  const [rulesOpen, setRulesOpen] = useState(false)
  const [sound, setSound] = useState(soundEnabled)
  const session = useSession(room, name.trim() || 'Anonymous')

  useEffect(() => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(NAME_KEY, name)
  }, [name])

  // A link with a code in it is an invitation, not a seat: it brings the
  // visitor to the front door with the code filled in, so they can say who
  // they are before sitting down.
  const [invite, setInvite] = useState<string | null>(() =>
    linked && storedRoom() !== linked ? linked : null,
  )

  useEffect(() => {
    const onHash = () => setInvite(parseRoomIdFromLocation())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const declineInvite = useCallback(() => {
    setInvite(null)
    if (location.hash) history.replaceState(null, '', location.pathname + location.search)
  }, [])

  // Remember the room, and keep it in the address bar, so a reload — by the
  // host too — comes back to the same table without a prompt.
  const roomCode = session?.code ?? null
  useEffect(() => {
    if (!roomCode) return
    storeRoom(roomCode)
    if (parseRoomIdFromLocation() !== roomCode) history.replaceState(null, '', `#room=${roomCode}`)
  }, [roomCode])

  // A link to a table nobody is hosting — its host left for good, or the only
  // player reloaded — would wait for ever. Offer to open it instead.
  const [stranded, setStranded] = useState(false)
  const hostless = Boolean(session && room?.kind === 'join' && !session.view.hostId)
  const linkStatus = session?.status
  useEffect(() => {
    if (!hostless || linkStatus !== 'connected') {
      setStranded(false)
      return
    }
    const timer = setTimeout(() => setStranded(true), 3000)
    return () => clearTimeout(timer)
  }, [hostless, linkStatus])

  const leave = useCallback(() => {
    storeRoom(null)
    setRoom(null)
    setInvite(null)
    if (typeof location !== 'undefined' && location.hash) {
      history.replaceState(null, '', location.pathname + location.search)
    }
  }, [])

  const view = session?.view ?? null
  const playing = Boolean(view?.started && view.state)

  return (
    <div className={`app ${playing ? 'app--table' : ''}`}>
      <header className="masthead">
        <div className="masthead__brand">
          <h1 className="wordmark">Azulejo</h1>
          <p className="readout">
            {!playing ? (
              <span>A wall, five glazes, and a bag of tiles</span>
            ) : (
              <>
                <span>
                  {view!.state!.phase === 'over'
                    ? 'Finished'
                    : `Round ${String(view!.state!.round).padStart(2, '0')}`}
                </span>
                <span>Seats {String(view!.state!.players.length).padStart(2, '0')}</span>
                <span>Bag {Object.values(unseenTiles(view!.state!)).reduce((a, b) => a + b, 0)}</span>
              </>
            )}
          </p>
        </div>
        <div className="masthead__aside">
          {playing ? <Unseen state={view!.state!} /> : null}
          {session ? (
            <span className="relay" data-status={session.status}>
              {session.code ? session.code : 'Solo'} ·{' '}
              {session.status === 'connected' ? 'linked' : session.status}
            </span>
          ) : null}
          <button
            type="button"
            className="button button--small button--ghost"
            aria-pressed={sound}
            onClick={() => {
              setSoundEnabled(!sound)
              setSound(!sound)
            }}
            title={sound ? 'Sound is on' : 'Sound is off'}
          >
            {sound ? 'Sound on' : 'Sound off'}
          </button>
          <button
            type="button"
            className="button button--small button--ghost"
            onClick={() => setRulesOpen(true)}
          >
            How to play
          </button>
          {session && playing && view!.state!.phase !== 'over' ? (
            <button
              type="button"
              className="button button--small button--ghost"
              onClick={() => {
                // Leaving a solo game throws it away; leaving a room only takes
                // you out of it — the house holds your seat until you return.
                const solo = !session.code
                const ask = solo
                  ? 'Leave this game? A solo game cannot be resumed.'
                  : 'Leave the table? The house will play your seat until you rejoin with the link.'
                if (confirm(ask)) leave()
              }}
            >
              Leave
            </button>
          ) : null}
        </div>
      </header>

      {rulesOpen ? <Rules onClose={() => setRulesOpen(false)} /> : null}

      {room && !session ? (
        <p className="prompt prompt--quiet">Opening the room…</p>
      ) : !session ? (
        <Home
          name={name}
          onName={setName}
          invite={invite}
          onDeclineInvite={declineInvite}
          onSolo={() => setRoom({ kind: 'solo' })}
          onHost={() => setRoom({ kind: 'host' })}
          onJoin={code => setRoom({ kind: 'join', code })}
        />
      ) : !playing ? (
        <>
        {stranded ? (
          <p className="prompt prompt--quiet">
            Nobody is hosting this table right now.{' '}
            <button type="button" className="button button--small" onClick={() => session!.session.becomeHost()}>
              Open it here
            </button>
          </p>
        ) : null}
        <Lobby
          code={session.code}
          url={session.url}
          status={session.status}
          seats={view!.seats}
          isHost={view!.isHost}
          onAddBot={style => session.session.addBot(style)}
          onRemove={id => session.session.removeSeat(id)}
          onStart={() => session.session.start()}
          onLeave={leave}
        />
        </>
      ) : (
        <>
          <Table
            state={view!.state!}
            seats={view!.seats}
            seatIndex={view!.seatIndex}
            onPlay={session.play}
            notice={view!.notice}
            lastMove={view!.lastMove}
            onSeen={round => session.session.seen(round)}
          />
          {view!.state!.phase === 'over' ? (
            <div className="row">
              <button type="button" className="button button--gold" onClick={leave}>
                Back to the front
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

/** Tiles of each glaze nobody has seen yet — the bag, read off the table. */
function Unseen({ state }: { state: GameState }) {
  const unseen = unseenTiles(state)
  return (
    <div className="unseen" aria-label="Tiles not yet seen, by glaze">
      <span className="eyebrow eyebrow--faint">Unseen by glaze</span>
      <span className="unseen__counts">
        {COLORS.map(color => (
          <span key={color} style={{ color: GLAZE_TEXT[color] }} title={color}>
            {String(unseen[color]).padStart(2, '0')}
          </span>
        ))}
      </span>
    </div>
  )
}
