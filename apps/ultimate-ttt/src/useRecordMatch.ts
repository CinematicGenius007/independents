import { useEffect, useRef, useState } from 'react'
import type { BoardWinner, Move, Player } from './game'
import { addMatch, loadHistory } from './history'
import type { HistoryEntry } from './history'
import { encodeRecord, matchNumber, replayHash } from './record'

export interface MatchInfo {
  number: string
  code: string
  /** A link anyone can open to watch this game back. */
  link: string
}

/**
 * Once a game ends, works out its match number and replay link and files it
 * under this device's last three matches. `key` identifies the game, so a
 * re-render or a reconnect does not file the same match twice.
 */
export function useRecordMatch(opts: {
  key: string
  winner: BoardWinner
  starter: Player
  moves: Move[]
  /** The side this device played; null when it played both (same screen) or only watched. */
  me: Player | null
  /** Whether this match belongs in the device's history; watching and replaying do not. */
  file: boolean
  vs: string
}): { info: MatchInfo | null; history: HistoryEntry[] } {
  const { key, winner, starter, moves, me, file, vs } = opts
  const [info, setInfo] = useState<MatchInfo | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory)
  const filed = useRef<string | null>(null)

  useEffect(() => {
    if (!winner) {
      setInfo(null)
      return
    }
    let cancelled = false
    ;(async () => {
      const record = { starter, moves }
      const number = await matchNumber(record)
      const code = encodeRecord(record)
      if (cancelled) return
      setInfo({ number, code, link: `${location.origin}${location.pathname}${replayHash(code, number)}` })
      if (file && filed.current !== key) {
        filed.current = key
        setHistory(addMatch({ n: number, code, winner, me, vs, moves: moves.length, at: Date.now() }))
      }
    })()
    return () => {
      cancelled = true
    }
    // moves/vs are stable for a finished game; `key` is what identifies it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winner, key])

  return { info, history }
}
