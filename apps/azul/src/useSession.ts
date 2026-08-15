/**
 * React's view of a {@link Session}.
 *
 * The session is a plain object with a subscribe method, so this hook is only
 * a bridge: it holds one session for the life of a room, mirrors its view into
 * state, and tears the room down on unmount. Nothing about the game lives here.
 *
 * Opening a room is asynchronous because the signalling code is fetched on
 * demand — see {@link createRoom}. A solo game skips that entirely and is ready
 * on the first render after the choice.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { MemoryHub } from './net/memory-transport'
import { createRoom, joinRoom } from './net/room'
import type { RelayStatus, RoomHandle } from './net/protocol'
import { Session } from './net/session'
import type { SessionView } from './net/session'
import type { Move } from './engine/types'

export type RoomKind = { kind: 'solo' } | { kind: 'host' } | { kind: 'join'; code: string }

export interface RoomSession {
  view: SessionView
  status: RelayStatus
  /** The code to read out, or null for a solo game. */
  code: string | null
  url: string | null
  play: (move: Move) => void
  session: Session
}

/** A solo game is a room with no relay: same code path, no peers, no traffic. */
function soloHandle(): RoomHandle {
  const hub = new MemoryHub('SOLO')
  return {
    transport: hub.join(`solo-${Math.random().toString(36).slice(2, 8)}`),
    url: '',
    status: () => 'connected',
    onStatus: () => () => {},
  }
}

interface Built {
  handle: RoomHandle
  session: Session
  code: string | null
}

export function useSession(room: RoomKind | null, name: string): RoomSession | null {
  const [built, setBuilt] = useState<Built | null>(null)
  const [status, setStatus] = useState<RelayStatus>('connecting')
  const [, forceUpdate] = useState(0)
  const revision = useRef(0)
  const bump = useCallback(() => forceUpdate(++revision.current), [])

  // The name is pushed in after the fact rather than being a dependency here,
  // so renaming yourself never drops the connection.
  const nameRef = useRef(name)
  nameRef.current = name

  useEffect(() => {
    if (!room) {
      setBuilt(null)
      return
    }

    let live = true
    let session: Session | null = null
    const unsubscribes: (() => void)[] = []

    const open = async () => {
      const handle =
        room.kind === 'solo'
          ? soloHandle()
          : room.kind === 'host'
            ? await createRoom()
            : await joinRoom(room.code)

      if (!live) {
        handle.transport.leave()
        return
      }

      session = new Session({
        transport: handle.transport,
        name: nameRef.current,
        host: room.kind !== 'join',
      })
      // A solo table is never waiting for anyone, so it starts with an
      // opponent already sitting down. The player can add or remove seats.
      if (room.kind === 'solo') session.addBot('artisan')

      setStatus(handle.status())
      unsubscribes.push(handle.onStatus(setStatus), session.onChange(bump))
      setBuilt({ handle, session, code: room.kind === 'solo' ? null : handle.transport.roomId })
    }

    void open()

    return () => {
      live = false
      unsubscribes.splice(0).forEach(fn => fn())
      session?.leave()
      setBuilt(null)
    }
  }, [room, bump])

  useEffect(() => {
    built?.session.setName(name)
  }, [built, name])

  if (!built) return null

  return {
    view: built.session.view(),
    status,
    code: built.code,
    url: built.handle.url || null,
    play: move => built.session.play(move),
    session: built.session,
  }
}
