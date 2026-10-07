/**
 * React's view of an online table.
 *
 * The table is never sent; it is computed. On every welcome — first connect or
 * reconnect — the room's log arrives and is folded from scratch, which makes
 * reconnecting trivially correct: there is no local state to patch up, only a
 * log to read again. After that, each sequenced message is folded on top as it
 * arrives, the sender's own included (they ask for an echo), so a click only
 * changes the board once the room has put it in order.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Move, Player } from '../game'
import { RoomsConnection } from './rooms-client'
import type { Envelope, PeerInfo, RoomsStatus } from './rooms-client'
import { emptyTable, reduceTable, rematchMessage, replay, sideOf } from './table'
import type { Table, TableMessage } from './table'

export const GAME_ID = 'ultimate-ttt'

/** Set at build time. Without it, online play is switched off. */
export const ROOMS_URL: string | null = (import.meta.env.VITE_ROOMS_URL ?? '').trim() || null

export interface OnlineTable {
  table: Table
  self: string
  side: Player | null
  status: RoomsStatus
  /** Everyone else in the room right now, by client id. */
  peers: Map<string, PeerInfo>
  error: string | null
  play: (move: Move) => void
  rematch: () => void
}

export function useTable(code: string, name: string): OnlineTable {
  const [table, setTable] = useState<Table>(emptyTable)
  const [status, setStatus] = useState<RoomsStatus>('connecting')
  const [peers, setPeers] = useState<Map<string, PeerInfo>>(new Map())
  const [error, setError] = useState<string | null>(null)
  const [self, setSelf] = useState('')

  const connection = useRef<RoomsConnection | null>(null)
  const tableRef = useRef(table)
  const lastSeq = useRef(0)
  /** A claim of ours that the room has not sequenced yet. */
  const claiming = useRef(false)

  const send = useCallback((message: TableMessage) => {
    connection.current?.send(message, { echo: true })
  }, [])

  /**
   * Sits down if there is a free side and this client has none. Runs after
   * every change, so losing a race for X simply leads to claiming O next.
   */
  const maybeClaim = useCallback(
    (next: Table, me: string) => {
      if (claiming.current || sideOf(next, me) !== null) return
      const free: Player | null = next.seats.X === null ? 'X' : next.seats.O === null ? 'O' : null
      if (!free) return
      claiming.current = true
      send({ k: 'claim', side: free })
    },
    [send],
  )

  useEffect(() => {
    if (!ROOMS_URL) {
      setStatus('failed')
      setError('Online play is not configured for this deployment.')
      return
    }
    const conn = new RoomsConnection({ baseUrl: ROOMS_URL, game: GAME_ID, code, name })
    connection.current = conn
    setSelf(conn.self)

    const commit = (next: Table) => {
      tableRef.current = next
      setTable(next)
      maybeClaim(next, conn.self)
    }

    const offs = [
      conn.on('status', setStatus),
      conn.on('welcome', welcome => {
        lastSeq.current = welcome.seq
        claiming.current = false
        const log = welcome.log ?? []
        // A room's first message is seq 1. If the oldest entry kept is later
        // than that, the log has been trimmed and the board cannot be rebuilt
        // faithfully — say so rather than show a board that differs from
        // everyone else's.
        if (log.length > 0 && log[0].seq > 1) {
          setError('This room has run too long to rebuild. Start a new room to keep playing.')
          commit(emptyTable())
          return
        }
        setError(null)
        commit(replay(log))
      }),
      conn.on('message', (envelope: Envelope) => {
        if (envelope.seq <= lastSeq.current) return // already folded via the log
        lastSeq.current = envelope.seq
        if (envelope.from === conn.self) claiming.current = false
        commit(reduceTable(tableRef.current, envelope.from, envelope.data))
      }),
      conn.on('join', () => setPeers(new Map(conn.peers))),
      conn.on('leave', () => setPeers(new Map(conn.peers))),
      conn.on('error', e => {
        // A refused message may have been our claim. Forget it and try again
        // shortly, or a free seat could stay empty until the next reconnect.
        if (claiming.current) {
          claiming.current = false
          setTimeout(() => maybeClaim(tableRef.current, conn.self), 1500)
        }
        setError(
          e.code === 'room_full'
            ? 'That room is full.'
            : e.code === 'identity_taken'
              ? 'This tab is already seated in that room somewhere else.'
              : e.message,
        )
      }),
    ]

    return () => {
      offs.forEach(off => off())
      conn.close()
      connection.current = null
    }
  }, [code, name, maybeClaim])

  const side = self ? sideOf(table, self) : null

  const play = useCallback((move: Move) => send({ k: 'move', ...move }), [send])
  const rematch = useCallback(() => send(rematchMessage()), [send])

  return { table, self, side, status, peers, error, play, rematch }
}
