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
import { useSession } from './useSession'
import type { RoomKind } from './useSession'
import { parseRoomIdFromLocation } from './net/room'

const NAME_KEY = 'azulejo:name'

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
  const [room, setRoom] = useState<RoomKind | null>(null)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [sound, setSound] = useState(soundEnabled)
  const session = useSession(room, name.trim() || 'Anonymous')

  useEffect(() => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(NAME_KEY, name)
  }, [name])

  // A link with a code in it sits somebody straight down at that table.
  useEffect(() => {
    const code = parseRoomIdFromLocation()
    if (code) setRoom({ kind: 'join', code })
  }, [])

  const leave = useCallback(() => {
    setRoom(null)
    if (typeof location !== 'undefined' && location.hash) {
      history.replaceState(null, '', location.pathname + location.search)
    }
  }, [])

  const view = session?.view ?? null
  const playing = Boolean(view?.started && view.state)

  return (
    <div className="app">
      <header className="masthead">
        <div>
          <h1 className="wordmark">
            Azule<span>jo</span>
          </h1>
          <p className="tagline">
            {!playing
              ? 'A wall, five glazes, and a bag of tiles'
              : view!.state!.phase === 'over'
                ? 'The wall is finished'
                : `Round ${view!.state!.round}`}
          </p>
        </div>
        <div className="masthead__aside">
          {session ? (
            <span className="relay" data-status={session.status}>
              {session.code ? `Room ${session.code}` : 'Solo'} · {session.status}
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
          onSolo={() => setRoom({ kind: 'solo' })}
          onHost={() => setRoom({ kind: 'host' })}
          onJoin={code => setRoom({ kind: 'join', code })}
        />
      ) : !playing ? (
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
      ) : (
        <>
          <Table
            state={view!.state!}
            seats={view!.seats}
            seatIndex={view!.seatIndex}
            onPlay={session.play}
            notice={view!.notice}
            lastMove={view!.lastMove}
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
