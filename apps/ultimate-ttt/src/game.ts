/**
 * Ultimate tic-tac-toe, as a pure function of the moves made.
 *
 * The rules used to live inside the click handler. They live here now because
 * online play needs every browser in a room to reach the same board from the
 * same list of moves, and the only way to be sure of that is for the rules to
 * be one deterministic function that nothing else can reach into.
 */

export type Player = 'X' | 'O'
export type Cell = Player | null
export type BoardWinner = Player | 'tie' | null

export interface GameState {
  /** Nine small boards of nine cells each. */
  boards: Cell[][]
  /** Who has taken each small board, if anyone. */
  boardWinners: BoardWinner[]
  current: Player
  /** The small board the next move must be played in; null means any. */
  activeBoard: number | null
  winner: BoardWinner
  moveCount: number
}

export interface Move {
  board: number
  cell: number
}

export const WIN_LINES: [number, number, number][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
]

export function checkWinner(board: (Cell | BoardWinner)[]): BoardWinner {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] !== 'tie' && board[a] === board[b] && board[a] === board[c]) {
      return board[a] as Player
    }
  }
  if (board.every(cell => cell !== null)) return 'tie'
  return null
}

export function initialState(starter: Player = 'X'): GameState {
  return {
    boards: Array.from({ length: 9 }, () => Array<Cell>(9).fill(null)),
    boardWinners: Array<BoardWinner>(9).fill(null),
    current: starter,
    activeBoard: null,
    winner: null,
    moveCount: 0,
  }
}

/** Why a move cannot be played, or null if it can. */
export function moveError(state: GameState, move: Move): string | null {
  if (state.winner) return 'The game is over.'
  if (!Number.isInteger(move.board) || move.board < 0 || move.board > 8) return 'No such board.'
  if (!Number.isInteger(move.cell) || move.cell < 0 || move.cell > 8) return 'No such cell.'
  if (state.boardWinners[move.board]) return 'That board is already decided.'
  if (state.activeBoard !== null && state.activeBoard !== move.board) return 'You must play in the highlighted board.'
  if (state.boards[move.board][move.cell]) return 'That cell is taken.'
  return null
}

/**
 * Plays a move for whoever is to play. Returns the new state, or null if the
 * move is illegal — so a replayed log with a bad entry in it is skipped by
 * everyone identically, rather than throwing on some machines and not others.
 */
export function applyMove(state: GameState, move: Move): GameState | null {
  if (moveError(state, move)) return null

  const boards = state.boards.map((board, b) =>
    b === move.board ? board.map((cell, c) => (c === move.cell ? state.current : cell)) : board,
  )
  const boardWinners = [...state.boardWinners]
  const local = checkWinner(boards[move.board])
  if (local) boardWinners[move.board] = local

  // A drawn small board counts for nobody on the big one.
  const big = checkWinner(boardWinners.map(w => (w === 'tie' ? null : w)))
  // ...but if every small board is decided and nobody has three, it is a draw.
  const winner: BoardWinner =
    big && big !== 'tie' ? big : boardWinners.every(w => w !== null) ? 'tie' : null

  // The cell you played picks the board your opponent must play in, unless
  // that board is already decided, in which case they may play anywhere.
  const next = move.cell
  return {
    boards,
    boardWinners,
    current: state.current === 'X' ? 'O' : 'X',
    activeBoard: boardWinners[next] ? null : next,
    winner,
    moveCount: state.moveCount + 1,
  }
}

/** Every legal move in a position. */
export function legalMoves(state: GameState): Move[] {
  const moves: Move[] = []
  for (let board = 0; board < 9; board++) {
    for (let cell = 0; cell < 9; cell++) {
      if (!moveError(state, { board, cell })) moves.push({ board, cell })
    }
  }
  return moves
}

export function boardsWon(state: GameState, player: Player): number {
  return state.boardWinners.filter(w => w === player).length
}
