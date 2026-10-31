/**
 * The nine-by-nine board and its marks, shared by every way of playing.
 *
 * It renders a position and reports clicks; whether a click is allowed — your
 * turn, your side, a connected room — is decided by whoever owns the game.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { WIN_LINES } from './game'
import type { BoardWinner, Cell, GameState, Move, Player } from './game'

interface MarkProps {
  size?: number
  /** Draw the strokes in, rather than showing them at once. */
  draw?: boolean
  strokeWidth?: number
}

/** X is the sharp one: square-cut strokes that slash in and snap into place. */
export const XMark = ({ size = 28, draw, strokeWidth = 2.4 }: MarkProps) => (
  <svg
    className={draw ? 'mark mark-x mark-draw' : 'mark mark-x'}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <path d="M5 5L19 19" pathLength={1} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="square" />
    <path d="M19 5L5 19" pathLength={1} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="square" />
  </svg>
)

/** O is the soft one: a ring that sweeps round from the top and settles, with a quiet nucleus when large. */
export const OMark = ({ size = 26, draw, strokeWidth = 2.4 }: MarkProps) => (
  <svg
    className={draw ? 'mark mark-o mark-draw' : 'mark mark-o'}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <circle
      cx="12"
      cy="12"
      r="7"
      pathLength={1}
      transform="rotate(-90 12 12)"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
    {size >= 48 && (
      <>
        <circle className="o-orbit" cx="12" cy="12" r="10.2" stroke="currentColor" strokeWidth={0.35} />
        <circle className="o-nucleus" cx="12" cy="12" r="1.2" fill="currentColor" />
      </>
    )}
  </svg>
)

export const PlayerMark = ({ player, ...rest }: { player: Player } & MarkProps) =>
  player === 'X' ? <XMark {...rest} /> : <OMark {...rest} />

export const BOARD_NAMES = [
  'Top left',
  'Top',
  'Top right',
  'Left',
  'Center',
  'Right',
  'Bottom left',
  'Bottom',
  'Bottom right',
]

/** `B5·C2`: board and cell, counted from one, as the timeline and last-move line show them. */
export const moveLabel = (m: Move) => `B${m.board + 1}·C${m.cell + 1}`

interface SmallGridProps {
  index: number
  cells: Cell[]
  onCellClick: (cell: number) => void
  isActive: boolean
  winner: BoardWinner
  canPlay: boolean
  currentPlayer: Player
  last: Move | null
  /** On a phone the big grid is a map: tapping a board focuses it instead of playing in it. */
  onSelect?: () => void
  selected?: boolean
  inLine?: boolean
}

const SmallGrid = ({
  index,
  cells,
  onCellClick,
  isActive,
  winner,
  canPlay,
  currentPlayer,
  last,
  onSelect,
  selected,
  inLine,
}: SmallGridProps) => {
  const classes = [
    'small-grid',
    onSelect ? 'small-map' : '',
    selected ? 'selected' : '',
    inLine ? 'in-line' : '',
    isActive && !winner ? 'active' : '',
    winner ? `won won-${winner}` : '',
    // The board that has just been captured plays its stamp-in once.
    winner && last?.board === index ? 'fresh' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={classes}
      role={onSelect ? 'button' : 'group'}
      tabIndex={onSelect ? 0 : undefined}
      onClick={onSelect}
      onKeyDown={onSelect ? e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect()) : undefined}
      aria-label={`${BOARD_NAMES[index]} board${winner ? (winner === 'tie' ? ', drawn' : `, won by ${winner}`) : ''}`}
    >
      <div className="cell-grid">
        {cells.map((cell, idx) => {
          const playable = canPlay && isActive && !cell && !winner
          const isLast = last?.board === index && last.cell === idx
          return (
            <button
              key={idx}
              className={['cell', cell ? `cell-${cell}` : '', playable ? 'playable' : '', isLast ? 'last' : '']
                .filter(Boolean)
                .join(' ')}
              onClick={() => onCellClick(idx)}
              disabled={!playable || !!onSelect}
              aria-label={`${BOARD_NAMES[index]}, cell ${idx + 1}${cell ? `, ${cell}` : ''}`}
            >
              {cell && <PlayerMark player={cell} size={22} draw={isLast} />}
              {!cell && playable && (
                <span className="cell-ghost">
                  <PlayerMark player={currentPlayer} size={22} />
                </span>
              )}
            </button>
          )
        })}
      </div>

      {winner && (
        <div className={`board-winner board-winner-${winner}`} aria-hidden="true">
          {winner === 'tie' ? (
            <span className="board-tie">=</span>
          ) : (
            <PlayerMark player={winner} size={96} strokeWidth={1.8} draw />
          )}
        </div>
      )}
    </div>
  )
}

interface Segment {
  w: number
  h: number
  x1: number
  y1: number
  x2: number
  y2: number
}

/**
 * Where the winning line runs, measured from the boards as laid out rather than
 * computed from percentages, so it meets the marks on any screen.
 */
function useLineSegment(ref: React.RefObject<HTMLDivElement>, line: [number, number, number] | null) {
  const [seg, setSeg] = useState<Segment | null>(null)
  const key = line ? line.join() : ''
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !line) return setSeg(null)
    const measure = () => {
      const a = el.children[line[0]] as HTMLElement | undefined
      const c = el.children[line[2]] as HTMLElement | undefined
      if (!a || !c) return
      setSeg({
        w: el.clientWidth,
        h: el.clientHeight,
        x1: a.offsetLeft + a.offsetWidth / 2,
        y1: a.offsetTop + a.offsetHeight / 2,
        x2: c.offsetLeft + c.offsetWidth / 2,
        y2: c.offsetTop + c.offsetHeight / 2,
      })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ref])
  return seg
}

/** The winning line of boards, or null for a drawn game. */
const winningLine = (game: GameState) => {
  if (!game.winner || game.winner === 'tie') return null
  return WIN_LINES.find(line => line.every(b => game.boardWinners[b] === game.winner)) ?? null
}

const useNarrow = () => {
  const query = '(max-width: 720px)'
  const [narrow, setNarrow] = useState(() => typeof matchMedia === 'function' && matchMedia(query).matches)
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const mq = matchMedia(query)
    const on = () => setNarrow(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return narrow
}

export function MegaGrid({
  game,
  canPlay,
  onPlay,
  last = null,
}: {
  game: GameState
  /** False while it is not this browser's turn, so the board is read-only. */
  canPlay: boolean
  onPlay: (board: number, cell: number) => void
  /** The move just played, so the board can answer it. */
  last?: Move | null
}) {
  const narrow = useNarrow()
  const [picked, setPicked] = useState<number | null>(null)
  const line = winningLine(game)
  const gridRef = useRef<HTMLDivElement>(null)
  const seg = useLineSegment(gridRef, line)
  const over = !!game.winner

  const open = (b: number) => !game.boardWinners[b]
  // The forced board, else the one the player tapped, else the first open one.
  const focus = over
    ? null
    : game.activeBoard !== null
      ? game.activeBoard
      : picked !== null && open(picked)
        ? picked
        : game.boards.findIndex((_, b) => open(b))
  const zoom = narrow && focus !== null && focus >= 0

  const activeFor = (b: number) =>
    !game.winner && (game.activeBoard === null ? !game.boardWinners[b] : game.activeBoard === b)

  return (
    <div className="board-stack">
      <div className="board-box">
        <div
          ref={gridRef}
          className={['mega-grid', over ? 'over' : '', zoom ? 'mega-map' : ''].filter(Boolean).join(' ')}
          data-forced={game.activeBoard !== null && !game.winner ? game.activeBoard : undefined}
          data-over={over ? (game.winner === 'tie' ? 'tie' : game.winner) : undefined}
        >
          {game.boards.map((board, boardIdx) => (
            <SmallGrid
              key={boardIdx}
              index={boardIdx}
              cells={board}
              onCellClick={cell => onPlay(boardIdx, cell)}
              isActive={activeFor(boardIdx)}
              winner={game.boardWinners[boardIdx]}
              canPlay={canPlay && !game.winner}
              currentPlayer={game.current}
              last={last}
              inLine={!!line?.includes(boardIdx)}
              selected={zoom && focus === boardIdx}
              onSelect={zoom && open(boardIdx) ? () => setPicked(boardIdx) : undefined}
            />
          ))}

          {over && (
            <div className={`finale finale-${game.winner}`} aria-hidden="true">
              {seg && (
                <svg className="finale-line" viewBox={`0 0 ${seg.w} ${seg.h}`}>
                  <line x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2} pathLength={1} />
                </svg>
              )}
              <span className="finale-ring" />
              <span className="finale-ring finale-ring-2" />
              {Array.from({ length: 14 }, (_, n) => (
                <i
                  key={n}
                  className="spark"
                  style={{
                    ['--a' as string]: `${(n * 360) / 14}deg`,
                    ['--d' as string]: `${n % 3}`,
                  }}
                />
              ))}
              <span className="finale-title">
                {game.winner === 'tie' ? 'Dead heat' : `${game.winner} takes the grid`}
              </span>
            </div>
          )}
        </div>
      </div>

      {zoom && focus !== null && (
        <div className="focus-box" key={focus}>
          <div className="focus-label eyebrow">
            <span className={game.activeBoard !== null ? 'signal' : ''}>
              {game.activeBoard !== null ? 'Forced → ' : 'Playing in → '}
              {BOARD_NAMES[focus]}
            </span>
            <span>{canPlay ? 'Tap a cell' : 'Read only'}</span>
          </div>
          <SmallGrid
            index={focus}
            cells={game.boards[focus]}
            onCellClick={cell => onPlay(focus, cell)}
            isActive={activeFor(focus)}
            winner={game.boardWinners[focus]}
            canPlay={canPlay && !game.winner}
            currentPlayer={game.current}
            last={last}
          />
        </div>
      )}
    </div>
  )
}
