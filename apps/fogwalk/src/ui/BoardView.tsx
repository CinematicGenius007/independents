import { useEffect, useRef, useState } from 'react'
import type { Belief } from '../engine/belief'
import { coordsOf, ratchetDirection, type Board } from '../engine/board'

interface Props {
  board: Board
  belief: Belief
  doomed: boolean
  objective: 'mark' | 'reset'
}

const UNIT = 100
const INSET = 6

/**
 * The field, painted rather than drawn.
 *
 * Every cell owns a permanent ghost that fades in and out, because a possibility
 * is not an object that travels — it is a place that stops being possible. Fading
 * is the honest animation for that, and it also means the fog thins visibly even
 * when nothing appears to move.
 */
export function BoardView({ board, belief, doomed, objective }: Props) {
  const present = new Set(belief)
  const settled = belief.length === 1
  const [trail, setTrail] = useState<Set<number>>(new Set())
  const previous = useRef<Belief>(belief)

  useEffect(() => {
    const left = previous.current.filter((cell) => !present.has(cell))
    previous.current = belief
    if (left.length === 0) return
    setTrail(new Set(left))
    const timer = window.setTimeout(() => setTrail(new Set()), 420)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [belief])

  const width = board.width * UNIT
  const height = board.height * UNIT
  const gateArcs = Object.entries(board.gates)
    .map(([from, to]) => [Number(from), to] as const)
    .filter(([from, to]) => from < to)

  return (
    <svg
      className="field"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${belief.length} possible positions remain`}
    >
      <defs>
        <radialGradient id="ghost" cx="36%" cy="30%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="26%" stopColor="#d8f7ff" stopOpacity="0.98" />
          <stop offset="62%" stopColor="#57d2f5" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#1c5f92" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ghost-doomed" cx="38%" cy="32%">
          <stop offset="0%" stopColor="#ffe4e8" stopOpacity="0.95" />
          <stop offset="45%" stopColor="#ff8fa3" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#8c2f45" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="slab" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#5d6a7d" />
          <stop offset="55%" stopColor="#2f3947" />
          <stop offset="100%" stopColor="#4a5768" />
        </linearGradient>
        <filter id="bloom" x="-70%" y="-70%" width="240%" height="240%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g className="ring">
        <circle cx={width / 2} cy={height / 2} r={Math.min(width, height) * 0.62} />
        <circle cx={width / 2} cy={height / 2} r={Math.min(width, height) * 0.47} />
      </g>

      {board.cells.map((cell, index) => {
        const { x, y } = coordsOf(board, index)
        const left = x * UNIT
        const top = y * UNIT
        const ratchet = ratchetDirection(cell)

        return (
          <g key={index} transform={`translate(${left} ${top})`}>
            {cell === 'wall' ? (
              <rect x={2} y={2} width={UNIT - 4} height={UNIT - 4} rx={6} fill="url(#slab)" />
            ) : (
              <rect
                x={INSET}
                y={INSET}
                width={UNIT - INSET * 2}
                height={UNIT - INSET * 2}
                rx={10}
                className={`plate plate-${cell}`}
              />
            )}

            {cell === 'mud' && <circle cx={UNIT / 2} cy={UNIT / 2} r={26} className="mud-pool" />}

            {cell === 'hazard' && (
              <>
                <circle cx={UNIT / 2} cy={UNIT / 2} r={30} className="pit-mouth" />
                <circle cx={UNIT / 2} cy={UNIT / 2} r={16} className="pit-throat" />
              </>
            )}

            {ratchet && (
              <path
                className="ratchet"
                transform={`rotate(${{ up: 0, right: 90, down: 180, left: 270 }[ratchet]} ${UNIT / 2} ${UNIT / 2})`}
                d={`M ${UNIT / 2 - 22} ${UNIT / 2 + 12} L ${UNIT / 2} ${UNIT / 2 - 14} L ${UNIT / 2 + 22} ${UNIT / 2 + 12}`}
              />
            )}

            {cell === 'gate' && (
              <>
                <circle cx={UNIT / 2} cy={UNIT / 2} r={30} className="gate-rim" />
                <circle cx={UNIT / 2} cy={UNIT / 2} r={13} className="gate-core" />
              </>
            )}

            {index === board.goal && objective === 'mark' && (
              <>
                <circle cx={UNIT / 2} cy={UNIT / 2} r={36} className="mark-rim" />
                <circle cx={UNIT / 2} cy={UNIT / 2} r={24} className="mark-inner" />
              </>
            )}
          </g>
        )
      })}

      {gateArcs.map(([from, to]) => {
        const a = coordsOf(board, from)
        const b = coordsOf(board, to)
        return (
          <path
            key={`${from}-${to}`}
            className="gate-thread"
            d={`M ${a.x * UNIT + UNIT / 2} ${a.y * UNIT + UNIT / 2} Q ${((a.x + b.x) / 2) * UNIT + UNIT / 2} ${
              ((a.y + b.y) / 2) * UNIT - UNIT * 0.4
            } ${b.x * UNIT + UNIT / 2} ${b.y * UNIT + UNIT / 2}`}
          />
        )
      })}

      <g filter="url(#bloom)">
        {board.cells.map((_, index) => {
          const { x, y } = coordsOf(board, index)
          const here = present.has(index)
          const fading = trail.has(index)
          if (!here && !fading) return null

          return (
            <circle
              key={index}
              cx={x * UNIT + UNIT / 2}
              cy={y * UNIT + UNIT / 2}
              r={settled && here ? 32 : 24}
              fill={doomed ? 'url(#ghost-doomed)' : 'url(#ghost)'}
              className={`ghost${here ? ' here' : ' gone'}${settled && here ? ' settled' : ''}`}
              style={{ opacity: here ? Math.max(0.62, 1.7 / Math.sqrt(belief.length)) : 0 }}
            />
          )
        })}
      </g>
    </svg>
  )
}
