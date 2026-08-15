/**
 * Three screens and the rules that move between them: the front door, the
 * room, and the table. Which one is showing is a function of the session, not
 * of a router — there is nothing to route to.
 */

import { useCallback, useEffect, useState } from 'react'
import { Home } from './ui/Home'
import { Lobby } from './ui/Lobby'
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
            {playing ? `Round ${view!.state!.round}` : 'A wall, five glazes, and a bag of tiles'}
          </p>
        </div>
        {session ? (
          <span className="relay" data-status={session.status}>
            {session.code ? `Room ${session.code}` : 'Solo'} · {session.status}
          </span>
        ) : null}
      </header>

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
