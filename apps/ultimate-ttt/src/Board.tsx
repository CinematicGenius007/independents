/**
 * The nine-by-nine board and its marks, shared by local and online play.
 *
 * It renders a position and reports clicks; whether a click is allowed — your
 * turn, your side, a connected room — is decided by whoever owns the game.
 */

import type { BoardWinner, Cell, GameState, Player } from './game'

export const XMark = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <line x1="6" y1="6" x2="22" y2="22" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    <line x1="22" y1="6" x2="6" y2="22" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
)

export const OMark = ({ size = 26 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <circle cx="14" cy="14" r="8.5" stroke="currentColor" strokeWidth="3" />
  </svg>
)

export const PlayerMark = ({ player, size }: { player: Player; size?: number }) =>
  player === 'X' ? <XMark size={size} /> : <OMark size={size} />

export const SIDE_NAME: Record<Player, string> = { X: 'Blue', O: 'Red' }

export const BOARD_NAMES = [
  'Top left', 'Top center', 'Top right',
  'Center left', 'Center middle', 'Center right',
  'Bottom left', 'Bottom center', 'Bottom right',
]

interface SmallGridProps {
  index: number
  cells: Cell[]
  onCellClick: (cell: number) => void
  isActive: boolean
  winner: BoardWinner
  canPlay: boolean
  currentPlayer: Player
}

const SmallGrid = ({ index, cells, onCellClick, isActive, winner, canPlay, currentPlayer }: SmallGridProps) => {
  const classes = [
    'small-grid',
    isActive && !winner ? 'active' : '',
    winner ? `won won-${winner}` : '',
    !isActive && !winner ? 'inactive' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes} role="group" aria-label={BOARD_NAMES[index]}>
      {winner && (
        <div className={`board-winner board-winner-${winner}`}>
          {winner === 'tie' ? (
            <span className="board-winner-text">—</span>
          ) : (
            <span className="board-winner-mark">
              <PlayerMark player={winner} size={48} />
            </span>
          )}
        </div>
      )}

      <div className="cell-grid">
        {cells.map((cell, idx) => {
          const playable = canPlay && isActive && !cell && !winner
          return (
            <button
              key={idx}
              className={['cell', cell ? `cell-${cell} filled` : '', playable ? 'playable' : '']
                .filter(Boolean)
                .join(' ')}
              onClick={() => onCellClick(idx)}
              disabled={!playable}
              aria-label={`${BOARD_NAMES[index]}, cell ${idx + 1}${cell ? `, ${SIDE_NAME[cell]}` : ''}`}
            >
              <span className="cell-inner">
                {cell && <PlayerMark player={cell} size={18} />}
                {!cell && playable && (
                  <span className="cell-ghost">
                    <PlayerMark player={currentPlayer} size={18} />
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function MegaGrid({
  game,
  canPlay,
  onPlay,
}: {
  game: GameState
  /** False while it is not this browser's turn, so the board is read-only. */
  canPlay: boolean
  onPlay: (board: number, cell: number) => void
}) {
  return (
    <div className="mega-grid">
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
        />
      ))}
    </div>
  )
}
