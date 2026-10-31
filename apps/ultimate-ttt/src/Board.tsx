/**
 * The nine-by-nine board and its marks, shared by every way of playing.
 *
 * It renders a position and reports clicks; whether a click is allowed — your
 * turn, your side, a connected room — is decided by whoever owns the game.
 */

import type { BoardWinner, Cell, GameState, Move, Player } from './game'

interface MarkProps {
  size?: number
  /** Draw the strokes in, rather than showing them at once. */
  draw?: boolean
  strokeWidth?: number
}

export const XMark = ({ size = 28, draw, strokeWidth = 2.4 }: MarkProps) => (
  <svg className={draw ? 'mark mark-draw' : 'mark'} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M5 5L19 19" pathLength={1} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
    <path d="M19 5L5 19" pathLength={1} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
  </svg>
)

export const OMark = ({ size = 26, draw, strokeWidth = 2.4 }: MarkProps) => (
  <svg className={draw ? 'mark mark-draw' : 'mark'} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="7" pathLength={1} stroke="currentColor" strokeWidth={strokeWidth} />
  </svg>
)

export const PlayerMark = ({ player, ...rest }: { player: Player } & MarkProps) =>
  player === 'X' ? <XMark {...rest} /> : <OMark {...rest} />

export const BOARD_NAMES = [
  'Top left', 'Top', 'Top right',
  'Left', 'Center', 'Right',
  'Bottom left', 'Bottom', 'Bottom right',
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
}

const SmallGrid = ({ index, cells, onCellClick, isActive, winner, canPlay, currentPlayer, last }: SmallGridProps) => {
  const classes = [
    'small-grid',
    isActive && !winner ? 'active' : '',
    winner ? `won won-${winner}` : '',
    // The board that has just been captured plays its stamp-in once.
    winner && last?.board === index ? 'fresh' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes} role="group" aria-label={`${BOARD_NAMES[index]} board${winner ? (winner === 'tie' ? ', drawn' : `, won by ${winner}`) : ''}`}>
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
              disabled={!playable}
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
          {winner === 'tie' ? <span className="board-tie">=</span> : <PlayerMark player={winner} size={96} strokeWidth={1.8} draw />}
        </div>
      )}
    </div>
  )
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
  return (
    <div className="mega-grid" data-forced={game.activeBoard !== null && !game.winner ? game.activeBoard : undefined}>
      {game.boards.map((board, boardIdx) => (
        <SmallGrid
          key={boardIdx}
          index={boardIdx}
          cells={board}
          onCellClick={cell => onPlay(boardIdx, cell)}
          isActive={
            !game.winner &&
            (game.activeBoard === null ? !game.boardWinners[boardIdx] : game.activeBoard === boardIdx)
          }
          winner={game.boardWinners[boardIdx]}
          canPlay={canPlay && !game.winner}
          currentPlayer={game.current}
          last={last}
        />
      ))}
    </div>
  )
}
