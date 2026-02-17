import { useState, useCallback } from 'react'
import './App.css'

// ─── Types ────────────────────────────────────────────────────────────────────

type Player = 'X' | 'O'
type Cell = Player | null
type BoardWinner = Player | 'tie' | null

interface SmallGridProps {
  cells: Cell[]
  onCellClick: (cellIdx: number) => void
  isActive: boolean
  winner: BoardWinner
  isDisabled: boolean
  currentPlayer: Player
}

// ─── Text Helpers ─────────────────────────────────────────────────────────────

const BOARD_TO_NAME_MAP: string[] = [
  "Top left",
  "Top center",
  "Top right",
  "Center left",
  "Center middle",
  "Center right",
  "Bottom left",
  "Bottom center",
  "Bottom right"
];

// ─── Game Logic ───────────────────────────────────────────────────────────────

const WIN_LINES: [number, number, number][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
]

const checkWinner = (board: (Cell | BoardWinner)[]): BoardWinner => {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a] as Player
    }
  }
  if (board.every((cell) => cell !== null)) return 'tie'
  return null
}

const createEmptyBoards = (): Cell[][] =>
  Array(9).fill(null).map(() => Array(9).fill(null))

// ─── SVG Marks ────────────────────────────────────────────────────────────────

const XMark = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <line x1="6" y1="6" x2="22" y2="22" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    <line x1="22" y1="6" x2="6" y2="22" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
)

const OMark = ({ size = 26 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <circle cx="14" cy="14" r="8.5" stroke="currentColor" strokeWidth="3" />
  </svg>
)

const PlayerMark = ({ player, size }: { player: Player; size?: number }) =>
  player === 'X' ? <XMark size={size} /> : <OMark size={size} />

// ─── Small Grid ───────────────────────────────────────────────────────────────

const SmallGrid = ({
  cells,
  onCellClick,
  isActive,
  winner,
  isDisabled,
  currentPlayer,
}: SmallGridProps) => {
  const classes = [
    'small-grid',
    isActive && !winner ? 'active' : '',
    winner ? `won won-${winner}` : '',
    !isActive && !winner ? 'inactive' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={classes}>
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
          const canPlay = isActive && !cell && !winner && !isDisabled
          return (
            <button
              key={idx}
              className={[
                'cell',
                cell ? `cell-${cell} filled` : '',
                canPlay ? 'playable' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => onCellClick(idx)}
              disabled={!canPlay}
            >
              <span className="cell-inner">
                {cell && <PlayerMark player={cell} size={18} />}
                {!cell && canPlay && (
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

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  const [boards, setBoards] = useState<Cell[][]>(createEmptyBoards)
  const [currentPlayer, setCurrentPlayer] = useState<Player>('X')
  const [activeBoard, setActiveBoard] = useState<number | null>(null)
  const [boardWinners, setBoardWinners] = useState<BoardWinner[]>(Array(9).fill(null))
  const [gameWinner, setGameWinner] = useState<BoardWinner>(null)

  const handleCellClick = useCallback(
    (boardIdx: number, cellIdx: number): void => {
      if (gameWinner) return
      if (boardWinners[boardIdx]) return
      if (boards[boardIdx][cellIdx]) return
      if (activeBoard !== null && activeBoard !== boardIdx) return

      const newBoards = boards.map((board, idx) =>
        idx === boardIdx
          ? board.map((cell, cIdx) => (cIdx === cellIdx ? currentPlayer : cell))
          : board,
      )
      setBoards(newBoards)

      const newBoardWinners = [...boardWinners]
      const smallBoardWinner = checkWinner(newBoards[boardIdx])
      if (smallBoardWinner) {
        newBoardWinners[boardIdx] = smallBoardWinner
        setBoardWinners(newBoardWinners)

        const bigBoardWinner = checkWinner(
          newBoardWinners.map((w) => (w === 'tie' ? null : w)),
        )
        if (bigBoardWinner) {
          setGameWinner(bigBoardWinner)
        }
      }

      const nextBoard = cellIdx
      setActiveBoard(newBoardWinners[nextBoard] ? null : nextBoard)
      setCurrentPlayer(currentPlayer === 'X' ? 'O' : 'X')
    },
    [boards, boardWinners, currentPlayer, activeBoard, gameWinner],
  )

  const resetGame = useCallback((): void => {
    setBoards(createEmptyBoards())
    setCurrentPlayer('X')
    setActiveBoard(null)
    setBoardWinners(Array(9).fill(null))
    setGameWinner(null)
  }, [])

  const xCount = boardWinners.filter((w) => w === 'X').length
  const oCount = boardWinners.filter((w) => w === 'O').length

  return (
    <div className="app">
      <div className="bg-noise" aria-hidden="true" />

      {/* ── Header ── */}
      <header className="app-header">
        <div className="wordmark">
          <span className="wm-ultra">ULTRA</span>
          <span className="wm-ttt">TTT</span>
        </div>

        <div className="header-center">
          {gameWinner ? (
            <div className={`status-winner status-winner-${gameWinner}`}>
              {gameWinner === 'tie' ? (
                'Draw — well played'
              ) : (
                <>
                  <span className="status-mark">
                    <PlayerMark player={gameWinner} size={16} />
                  </span>
                  {gameWinner === 'X' ? 'Blue' : 'Red'} wins
                </>
              )}
            </div>
          ) : (
            <div className={`status-turn status-turn-${currentPlayer}`}>
              <span className="status-mark">
                <PlayerMark player={currentPlayer} size={14} />
              </span>
              <span>
                {currentPlayer === 'X' ? 'Blue' : 'Red'}
                <span className="status-sub">
                  {activeBoard === null ? ' · Any board' : ` · ${BOARD_TO_NAME_MAP[activeBoard]}`}
                </span>
              </span>
            </div>
          )}
        </div>

        <div className="header-right">
          <div className="score-pill">
            <span className={`score-x ${currentPlayer === 'X' && !gameWinner ? 'score-current' : ''} ${gameWinner === 'X' ? 'score-won' : ''}`}>
              <XMark size={12} />
              <span className='scores'>{xCount}</span>
            </span>
            <span className="score-sep" />
            <span className={`score-o ${currentPlayer === 'O' && !gameWinner ? 'score-current' : ''} ${gameWinner === 'O' ? 'score-won' : ''}`}>
              <span className='scores'>{oCount}</span>
              <OMark size={12} />
            </span>
          </div>
          <button className="btn-new" onClick={resetGame}>
            New game
          </button>
        </div>
      </header>

      {/* ── Board arena ── */}
      <main className="arena">
        <div className="mega-grid">
          {boards.map((board, boardIdx) => (
            <SmallGrid
              key={boardIdx}
              cells={board}
              onCellClick={(cellIdx) => handleCellClick(boardIdx, cellIdx)}
              isActive={
                !gameWinner &&
                (activeBoard === null
                  ? !boardWinners[boardIdx]
                  : activeBoard === boardIdx)
              }
              winner={boardWinners[boardIdx]}
              isDisabled={gameWinner !== null}
              currentPlayer={currentPlayer}
            />
          ))}
        </div>

        {/* ── Game-over overlay ── */}
        {gameWinner && (
          <div className={`overlay overlay-${gameWinner}`}>
            <div className="overlay-card">
              {gameWinner === 'tie' ? (
                <>
                  <p className="overlay-eyebrow">Game over</p>
                  <h2 className="overlay-title">Draw</h2>
                  <p className="overlay-body">Neither side blinked.</p>
                </>
              ) : (
                <>
                  <p className="overlay-eyebrow">Game over</p>
                  <h2 className={`overlay-title overlay-title-${gameWinner}`}>
                    <span className="overlay-mark">
                      <PlayerMark player={gameWinner} size={48} />
                    </span>
                    {gameWinner === 'X' ? 'Blue' : 'Red'} wins
                  </h2>
                  <p className="overlay-body">Dominant performance.</p>
                </>
              )}
              <button className="btn-play-again" onClick={resetGame}>
                Play again
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ── Footer rules ── */}
      <footer className="app-footer">
        <span>Your cell choice picks the next board</span>
        <span className="footer-dot">·</span>
        <span>Win 3 boards in a row to claim victory</span>
        <span className="footer-dot">·</span>
        <span>Sent to a won board? Play anywhere</span>
      </footer>
    </div>
  )
}

export default App