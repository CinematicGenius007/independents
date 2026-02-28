import { useState, useRef, useCallback, useEffect } from "react";
import "./SudokuSolver.css";

// ╔══════════════════════════════════════════════════════════════╗
// ║  SECTION 1 — TYPES & CONSTANTS                              ║
// ╚══════════════════════════════════════════════════════════════╝

const EMPTY = 0 as const;
const GRID_SIZE = 9;
const BOX_SIZE = 3;

type Grid = number[][];
type BoolGrid = boolean[][];
type CandidateGrid = (number[] | null)[][];

type CellStatus =
  | "empty"
  | "locked"         // user-input — never mutated
  | "algo"           // brute-force placed
  | "current"        // currently being evaluated
  | "backtrack"      // being cleared during backtrack
  | "solved"         // final state after brute-force
  | "smart-locked"   // smart: 100% certain, permanently placed
  | "smart-guess"    // smart: probabilistic guess, can be undone
  | "smart-solved";  // final state after smart solve

type StatusGrid = CellStatus[][];
type SolveMode = "brute" | "smart";
type AppPhase = "input" | "ready" | "solving" | "solved" | "stopped";
type LogType = "system" | "try" | "back" | "lock" | "guess" | "success" | "error";

interface LogEntry {
  id: number;
  msg: string;
  type: LogType;
}

/** Snapshot pushed onto the history stack before each smart-solver guess */
interface SmartFrame {
  grid: Grid;
  smartLocked: BoolGrid;
  guessRow: number;
  guessCol: number;
  guessVal: number;
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  SECTION 2 — PURE GRID HELPERS                             ║
// ╚══════════════════════════════════════════════════════════════╝

const makeGrid = (fill = EMPTY): Grid =>
  Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(fill));

const makeBoolGrid = (fill = false): BoolGrid =>
  Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(fill));

const cloneGrid = (g: Grid): Grid => g.map((row) => [...row]);
const cloneBoolGrid = (g: BoolGrid): BoolGrid => g.map((row) => [...row]);

/** Returns true when num can legally be placed at (row, col) */
function isValidPlacement(grid: Grid, row: number, col: number, num: number): boolean {
  // Row
  for (let c = 0; c < GRID_SIZE; c++)
    if (grid[row][c] === num) return false;
  // Column
  for (let r = 0; r < GRID_SIZE; r++)
    if (grid[r][col] === num) return false;
  // 3×3 box
  const br = Math.floor(row / BOX_SIZE) * BOX_SIZE;
  const bc = Math.floor(col / BOX_SIZE) * BOX_SIZE;
  for (let r = br; r < br + BOX_SIZE; r++)
    for (let c = bc; c < bc + BOX_SIZE; c++)
      if (grid[r][c] === num) return false;
  return true;
}

/** All legal values for an empty cell */
function getCandidates(grid: Grid, row: number, col: number): number[] {
  const result: number[] = [];
  for (let n = 1; n <= GRID_SIZE; n++)
    if (isValidPlacement(grid, row, col, n)) result.push(n);
  return result;
}

/** Candidate sets for every cell (null if cell is filled) */
function computeAllCandidates(grid: Grid): CandidateGrid {
  return grid.map((row, r) =>
    row.map((val, c) => (val === EMPTY ? getCandidates(grid, r, c) : null))
  );
}

const isSolved = (grid: Grid): boolean =>
  grid.every((row) => row.every((v) => v !== EMPTY));

/** True if any empty cell has zero remaining candidates (dead-end state) */
function hasDeadCell(grid: Grid): boolean {
  for (let r = 0; r < GRID_SIZE; r++)
    for (let c = 0; c < GRID_SIZE; c++)
      if (grid[r][c] === EMPTY && getCandidates(grid, r, c).length === 0)
        return true;
  return false;
}

/**
 * MRV heuristic: empty cell with the fewest candidates.
 * Returns null if the board is fully filled.
 */
function findBestCell(
  grid: Grid
): { row: number; col: number; candidates: number[] } | null {
  let best: { row: number; col: number; candidates: number[] } | null = null;
  for (let r = 0; r < GRID_SIZE; r++)
    for (let c = 0; c < GRID_SIZE; c++)
      if (grid[r][c] === EMPTY) {
        const cands = getCandidates(grid, r, c);
        if (!best || cands.length < best.candidates.length)
          best = { row: r, col: c, candidates: cands };
      }
  return best;
}

/** Ordered list of all user-unlocked cell positions (left→right, top→bottom) */
function getEmptyCellsInOrder(locked: BoolGrid): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  for (let r = 0; r < GRID_SIZE; r++)
    for (let c = 0; c < GRID_SIZE; c++)
      if (!locked[r][c]) cells.push([r, c]);
  return cells;
}

/** Build all 27 Sudoku constraint units (9 rows, 9 cols, 9 boxes) */
function buildUnits(): Array<[number, number][]> {
  const units: Array<[number, number][]> = [];
  for (let i = 0; i < GRID_SIZE; i++) {
    units.push(Array.from({ length: 9 }, (_, j) => [i, j] as [number, number]));
    units.push(Array.from({ length: 9 }, (_, j) => [j, i] as [number, number]));
  }
  for (let br = 0; br < BOX_SIZE; br++)
    for (let bc = 0; bc < BOX_SIZE; bc++) {
      const box: [number, number][] = [];
      for (let dr = 0; dr < BOX_SIZE; dr++)
        for (let dc = 0; dc < BOX_SIZE; dc++)
          box.push([br * BOX_SIZE + dr, bc * BOX_SIZE + dc]);
      units.push(box);
    }
  return units;
}

const ALL_UNITS = buildUnits();

// ╔══════════════════════════════════════════════════════════════╗
// ║  SECTION 3 — STATUS GRID BUILDERS                          ║
// ╚══════════════════════════════════════════════════════════════╝

function buildBruteStatusGrid(
  grid: Grid,
  locked: BoolGrid,
  highlightKey?: string,   // "r,c" for current cell
  backtrackKey?: string    // "r,c" for backtrack cell
): StatusGrid {
  return grid.map((row, r) =>
    row.map((val, c): CellStatus => {
      const key = `${r},${c}`;
      if (key === backtrackKey) return "backtrack";
      if (key === highlightKey) return "current";
      if (locked[r][c]) return "locked";
      if (val !== EMPTY) return "algo";
      return "empty";
    })
  );
}

function buildSmartStatusGrid(
  grid: Grid,
  locked: BoolGrid,
  smartLocked: BoolGrid,
  highlightKey?: string,
  backtrackKey?: string
): StatusGrid {
  return grid.map((row, r) =>
    row.map((val, c): CellStatus => {
      const key = `${r},${c}`;
      if (key === backtrackKey) return "backtrack";
      if (key === highlightKey) return "current";
      if (locked[r][c]) return "locked";
      if (val === EMPTY) return "empty";
      if (smartLocked[r][c]) return "smart-locked";
      return "smart-guess";
    })
  );
}

function buildFinalStatusGrid(
  locked: BoolGrid,
  mode: SolveMode,
  smartLocked?: BoolGrid
): StatusGrid {
  return locked.map((row, r) =>
    row.map((isLocked, c): CellStatus => {
      if (isLocked) return "locked";
      if (mode === "smart" && smartLocked && smartLocked[r][c]) return "smart-solved";
      return "solved";
    })
  );
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  SECTION 4 — SAMPLE PUZZLES                                ║
// ╚══════════════════════════════════════════════════════════════╝

const SAMPLE_PUZZLES: Record<string, Grid> = {
  easy: [
    [5, 3, 0, 0, 7, 0, 0, 0, 0],
    [6, 0, 0, 1, 9, 5, 0, 0, 0],
    [0, 9, 8, 0, 0, 0, 0, 6, 0],
    [8, 0, 0, 0, 6, 0, 0, 0, 3],
    [4, 0, 0, 8, 0, 3, 0, 0, 1],
    [7, 0, 0, 0, 2, 0, 0, 0, 6],
    [0, 6, 0, 0, 0, 0, 2, 8, 0],
    [0, 0, 0, 4, 1, 9, 0, 0, 5],
    [0, 0, 0, 0, 8, 0, 0, 7, 9],
  ],
  medium: [
    [0, 0, 0, 2, 6, 0, 7, 0, 1],
    [6, 8, 0, 0, 7, 0, 0, 9, 0],
    [1, 9, 0, 0, 0, 4, 5, 0, 0],
    [8, 2, 0, 1, 0, 0, 0, 4, 0],
    [0, 0, 4, 6, 0, 2, 9, 0, 0],
    [0, 5, 0, 0, 0, 3, 0, 2, 8],
    [0, 0, 9, 3, 0, 0, 0, 7, 4],
    [0, 4, 0, 0, 5, 0, 0, 3, 6],
    [7, 0, 3, 0, 1, 8, 0, 0, 0],
  ],
  hard: [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 3, 0, 8, 5],
    [0, 0, 1, 0, 2, 0, 0, 0, 0],
    [0, 0, 0, 5, 0, 7, 0, 0, 0],
    [0, 0, 4, 0, 0, 0, 1, 0, 0],
    [0, 9, 0, 0, 0, 0, 0, 0, 0],
    [5, 0, 0, 0, 0, 0, 0, 7, 3],
    [0, 0, 2, 0, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 4, 0, 0, 0, 9],
  ],
};

// ╔══════════════════════════════════════════════════════════════╗
// ║  SECTION 5 — LOG COLOR MAP                                 ║
// ╚══════════════════════════════════════════════════════════════╝

const LOG_COLORS: Record<LogType, string> = {
  system: "#8b7355",
  try: "#4a7c59",
  back: "#8b4a4a",
  lock: "#4a6b8b",
  guess: "#7a5c8b",
  success: "#2d5a27",
  error: "#8b0000",
};

// ╔══════════════════════════════════════════════════════════════╗
// ║  SECTION 6 — GLOBAL CSS (design preserved from original)   ║
// ╚══════════════════════════════════════════════════════════════╝

// Imported from SudokuSolver.css — see that file for details

// ╔══════════════════════════════════════════════════════════════╗
// ║  SECTION 7 — SUB-COMPONENTS                                ║
// ╚══════════════════════════════════════════════════════════════╝

// ── 7a  Individual Cell ───────────────────────────────────────

interface CellProps {
  row: number;
  col: number;
  value: number;
  status: CellStatus;
  candidates: number[] | null;
  isSelected: boolean;
  isInputMode: boolean;
  showCandidates: boolean;
  onSelect: (r: number, c: number) => void;
  onInput: (r: number, c: number, v: string) => void;
  onKeyDown: (r: number, c: number, e: React.KeyboardEvent) => void;
}

function Cell({
  row, col, value, status, candidates,
  isSelected, isInputMode, showCandidates,
  onSelect, onInput, onKeyDown,
}: CellProps) {
  const cellInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isSelected) {
      cellInputRef.current?.focus?.();
    }
  }, [isSelected, row, col]);


  const isDarkBox = (Math.floor(row / BOX_SIZE) + Math.floor(col / BOX_SIZE)) % 2 === 0;
  const borderRight = (col === 2 || col === 5) ? "2px solid var(--ink)" : undefined;
  const borderBottom = (row === 2 || row === 5) ? "2px solid var(--ink)" : undefined;

  const cls = [
    "sudoku-cell",
    isDarkBox ? "dark-box" : "",
    isSelected ? "selected" : "",
    `s-${status}`,
  ].filter(Boolean).join(" ");

  // Decide what to render inside
  const canEdit = isInputMode && status !== "locked";
  const showCands = showCandidates && value === EMPTY && candidates && candidates.length > 0 && candidates.length <= 6;

  return (
    <div
      className={cls}
      style={{ borderRight, borderBottom }}
      onClick={() => onSelect(row, col)}
      onKeyDown={(e) => onKeyDown(row, col, e)}
      tabIndex={0}
    >
      {value !== EMPTY ? (
        canEdit ? (
          <input
            ref={cellInputRef}
            className="cell-input"
            type="text" maxLength={1}
            value={String(value)}
            onChange={(e) => onInput(row, col, e.target.value)}
            onKeyDown={(e) => onKeyDown(row, col, e)}
            onClick={() => onSelect(row, col)}
          />
        ) : (
          <span>{value}</span>
        )
      ) : canEdit ? (
        <input
          ref={cellInputRef}
          className="cell-input"
          type="text" maxLength={1} value=""
          onChange={(e) => onInput(row, col, e.target.value)}
          onKeyDown={(e) => onKeyDown(row, col, e)}
          onClick={() => onSelect(row, col)}
        />
      ) : showCands ? (
        <div className="cand-grid">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <div key={n} className={`cand-num ${candidates!.includes(n) ? "vis" : ""}`}>{n}</div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ── 7b  Board ─────────────────────────────────────────────────

interface BoardProps {
  grid: Grid;
  statusGrid: StatusGrid;
  candidateGrid: CandidateGrid;
  selectedCell: [number, number] | null;
  isInputMode: boolean;
  showCandidates: boolean;
  onSelectCell: (r: number, c: number) => void;
  onCellInput: (r: number, c: number, v: string) => void;
  onCellKeyDown: (r: number, c: number, e: React.KeyboardEvent) => void;
}

function Board({
  grid, statusGrid, candidateGrid, selectedCell,
  isInputMode, showCandidates,
  onSelectCell, onCellInput, onCellKeyDown,
}: BoardProps) {
  return (
    <div className="sudoku-grid">
      {Array.from({ length: GRID_SIZE }, (_, r) =>
        Array.from({ length: GRID_SIZE }, (_, c) => (
          <Cell
            key={`${r}-${c}`}
            row={r} col={c}
            value={grid[r][c]}
            status={statusGrid[r][c]}
            candidates={candidateGrid[r]?.[c] ?? null}
            isSelected={selectedCell !== null && selectedCell[0] === r && selectedCell[1] === c}
            isInputMode={isInputMode}
            showCandidates={showCandidates}
            onSelect={onSelectCell}
            onInput={onCellInput}
            onKeyDown={onCellKeyDown}
          />
        ))
      )}
    </div>
  );
}

// ── 7c  Activity Log ──────────────────────────────────────────

function ActivityLog({ entries }: { entries: LogEntry[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries.length]);

  return (
    <div className="log-area">
      {entries.length === 0 ? (
        <div style={{ fontSize: 10, color: "var(--border-light)", fontFamily: "monospace", textAlign: "center", padding: 8 }}>
          ログなし<br />NO ENTRIES
        </div>
      ) : (
        entries.map((e) => (
          <div
            key={e.id}
            className="log-entry"
            style={{
              borderLeftColor: LOG_COLORS[e.type],
              color: LOG_COLORS[e.type],
              backgroundColor: `${LOG_COLORS[e.type]}10`,
            }}
          >
            {e.msg}
          </div>
        ))
      )}
      <div ref={bottomRef} />
    </div>
  );
}

// ── 7d  Legend ────────────────────────────────────────────────

const BRUTE_LEGEND = [
  { bg: "#2a2015", label: "ユーザー入力" },
  { bg: "#eef3f8", bd: "#2c5f8a", label: "アルゴリズム" },
  { bg: "#c8e6c9", label: "現在のセル" },
  { bg: "#ffcdd2", label: "バックトラック" },
  { bg: "#e8f5e9", label: "解決済み" },
];
const SMART_LEGEND = [
  { bg: "#2a2015", label: "ユーザー入力" },
  { bg: "#e3f0f8", bd: "#2c5f8a", label: "確定 (100%)" },
  { bg: "#f3eef8", bd: "#6b3a8a", label: "推測" },
  { bg: "#e8f5e9", label: "解決済み" },
];

function Legend({ mode }: { mode: SolveMode }) {
  const items = mode === "brute" ? BRUTE_LEGEND : SMART_LEGEND;
  return (
    <div className="legend">
      {items.map((item, i) => (
        <div key={i} className="legend-item">
          <div className="legend-swatch" style={{ background: item.bg, borderColor: item.bd ?? "var(--border-light)" }} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  SECTION 8 — MAIN APP COMPONENT                            ║
// ╚══════════════════════════════════════════════════════════════╝

const EMPTY_STATUS_GRID: StatusGrid = makeGrid().map((row) => row.map(() => "empty" as CellStatus));
const EMPTY_CAND_GRID: CandidateGrid = makeGrid().map((row) => row.map(() => null));

export default function SudokuSolver() {
  // ── 8a  Board State ───────────────────────────────
  const [grid, setGrid] = useState<Grid>(makeGrid);
  const [userLocked, setUserLocked] = useState<BoolGrid>(makeBoolGrid);
  const [statusGrid, setStatusGrid] = useState<StatusGrid>(EMPTY_STATUS_GRID);
  const [candidateGrid, setCandidateGrid] = useState<CandidateGrid>(EMPTY_CAND_GRID);

  // ── 8b  UI State ──────────────────────────────────
  const [mode, setMode] = useState<SolveMode>("brute");
  const [phase, setPhase] = useState<AppPhase>("input");
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null);
  const [speed, setSpeed] = useState<number>(100);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [stepCount, setStepCount] = useState(0);
  const [backtrackCount, setBacktrackCount] = useState(0);
  const [statusMsg, setStatusMsg] = useState("数独を入力してください");

  // ── 8c  Refs (shared between render and async solvers) ──
  const cancelRef = useRef(false);
  const speedRef = useRef(speed);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  // Mutable counters used INSIDE async solvers (avoid stale closures)
  const stepRef = useRef(0);
  const backtrackRef = useRef(0);

  // ── 8d  Derived values ────────────────────────────
  const isInputMode = phase === "input";
  const isSolving = phase === "solving";
  const emptyCells = grid.flat().filter((v) => v === EMPTY).length;
  const filledCells = GRID_SIZE * GRID_SIZE - emptyCells;

  // ╔════════════════════════════════════════════════╗
  // ║  SECTION 9 — LOGGING                          ║
  // ╚════════════════════════════════════════════════╝

  const addLog = useCallback((msg: string, type: LogType = "system") => {
    setLog((prev) => [...prev, { id: Date.now() + Math.random(), msg, type }].slice(-80));
  }, []);

  // ╔════════════════════════════════════════════════╗
  // ║  SECTION 10 — BOARD MANAGEMENT ACTIONS        ║
  // ╚════════════════════════════════════════════════╝

  /** Stop any running solver and wipe transient solve state */
  function clearSolveState() {
    cancelRef.current = true;
    stepRef.current = 0;
    backtrackRef.current = 0;
    setStepCount(0);
    setBacktrackCount(0);
    setLog([]);
    setCandidateGrid(EMPTY_CAND_GRID);
  }

  function handleLoadPuzzle(difficulty: string) {
    if (isSolving) return;
    const puzzle = SAMPLE_PUZZLES[difficulty];
    if (!puzzle) return;
    const newGrid = cloneGrid(puzzle);
    const newLocked = puzzle.map((row) => row.map((v) => v !== EMPTY));
    const newStatus = puzzle.map((row): CellStatus[] =>
      row.map((v) => (v !== EMPTY ? "locked" : "empty"))
    );
    clearSolveState();
    setGrid(newGrid);
    setUserLocked(newLocked);
    setStatusGrid(newStatus);
    setPhase("ready");
    setStatusMsg("パズルを読み込みました — 解を開始できます");
    addLog(`${difficulty} パズルを読み込みました`, "system");
  }

  function handleClearBoard() {
    if (isSolving) return;
    clearSolveState();
    setGrid(makeGrid());
    setUserLocked(makeBoolGrid());
    setStatusGrid(EMPTY_STATUS_GRID);
    setSelectedCell(null);
    setPhase("input");
    setStatusMsg("空のボードです — 数字を入力してください");
  }

  function handleLockBoard() {
    if (isSolving) return;
    const newLocked = grid.map((row) => row.map((v) => v !== EMPTY));
    const newStatus = grid.map((row): CellStatus[] =>
      row.map((v) => (v !== EMPTY ? "locked" : "empty"))
    );
    setUserLocked(newLocked);
    setStatusGrid(newStatus);
    setPhase("ready");
    setStatusMsg("ボードを固定しました — 解を開始できます");
    addLog("ユーザー入力を固定しました", "system");
  }

  function handleEditBoard() {
    if (isSolving) return;
    clearSolveState();
    // Restore grid to user-input only (erase algo cells)
    const cleanGrid = grid.map((row, r) => row.map((val, c) => (userLocked[r][c] ? val : EMPTY)));
    const newStatus = cleanGrid.map((row): CellStatus[] =>
      row.map((v) => (v !== EMPTY ? "locked" : "empty"))
    );
    setGrid(cleanGrid);
    setStatusGrid(newStatus);
    setPhase("input");
    setStatusMsg("数字を入力してください");
  }

  // function handleRetry() {
  //   if (isSolving) return;
  //   clearSolveState();
  //   const cleanGrid = grid.map((row, r) => row.map((val, c) => (userLocked[r][c] ? val : EMPTY)));
  //   const newStatus = cleanGrid.map((row): CellStatus[] =>
  //     row.map((v) => (v !== EMPTY ? "locked" : "empty"))
  //   );
  //   setGrid(cleanGrid);
  //   setStatusGrid(newStatus);
  //   setPhase("ready");
  //   setStatusMsg("もう一度解法できます");
  // }

  // ╔════════════════════════════════════════════════╗
  // ║  SECTION 11 — CELL INPUT HANDLING             ║
  // ╚════════════════════════════════════════════════╝

  function handleCellInput(r: number, c: number, val: string) {
    if (!isInputMode || userLocked[r][c]) return;
    const n = parseInt(val, 10);
    const safe = isNaN(n) || n < 1 || n > 9 ? EMPTY : n;
    const newGrid = cloneGrid(grid);
    newGrid[r][c] = safe;
    setGrid(newGrid);
  }

  function handleCellKeyDown(r: number, c: number, e: React.KeyboardEvent) {
    const { key } = e;
    if (isInputMode) {
      if (key >= "1" && key <= "9") { e.preventDefault(); handleCellInput(r, c, key); }
      else if (key === "Backspace" || key === "Delete" || key === "0") { e.preventDefault(); handleCellInput(r, c, "0"); }
    }
    if (key === "ArrowRight") { e.preventDefault(); setSelectedCell([r, Math.min(c + 1, 8)]); }
    else if (key === "ArrowLeft") { e.preventDefault(); setSelectedCell([r, Math.max(c - 1, 0)]); }
    else if (key === "ArrowDown") { e.preventDefault(); setSelectedCell([Math.min(r + 1, 8), c]); }
    else if (key === "ArrowUp") { e.preventDefault(); setSelectedCell([Math.max(r - 1, 0), c]); }
  }

  // ╔════════════════════════════════════════════════╗
  // ║  SECTION 12 — SOLVER UTILITIES                ║
  // ╚════════════════════════════════════════════════╝

  const sleep = () => new Promise<void>((res) => setTimeout(res, speedRef.current));

  function tickStep() {
    stepRef.current++;
    setStepCount(stepRef.current);
  }
  function tickBacktrack() {
    backtrackRef.current++;
    setBacktrackCount(backtrackRef.current);
  }

  // ╔════════════════════════════════════════════════╗
  // ║  SECTION 13 — BRUTE FORCE SOLVER              ║
  // ╚════════════════════════════════════════════════╝
  /**
   * Algorithm
   * ---------
   * 1. Build an ordered list of all user-unlocked cells.
   * 2. Walk forward: for each cell try values tried[idx]+1 … 9.
   *    - Skip values that fail isValidPlacement.
   *    - On success: place value, advance idx.
   * 3. Walk backward (backtrack): when no value works at idx,
   *    clear the cell, reset tried[idx] = 0, decrement idx,
   *    then clear the previous cell too so the forward loop
   *    will increment past its last tried value.
   * 4. Repeat until idx reaches end (solved) or idx < 0 (no solution).
   *
   * Note: We do NOT need a separate "badValues" set. The tried[] array
   * already encodes which values have been exhausted — the next forward
   * pass starts at tried[idx]+1.
   */
  async function runBruteForce(startGrid: Grid, locked: BoolGrid): Promise<void> {
    const cells = getEmptyCellsInOrder(locked);

    if (cells.length === 0) {
      setPhase("solved");
      setStatusMsg("解決！ — 数独完成");
      addLog("既に解決済みです", "success");
      return;
    }

    const workGrid = cloneGrid(startGrid);
    const tried: number[] = new Array(cells.length).fill(0);
    let idx = 0;

    while (!cancelRef.current && idx >= 0 && idx < cells.length) {
      const [r, c] = cells[idx];
      let placed = false;

      for (let n = tried[idx] + 1; n <= 9; n++) {
        if (!isValidPlacement(workGrid, r, c, n)) continue;

        // ── Forward step ──
        workGrid[r][c] = n;
        tried[idx] = n;
        tickStep();

        setGrid(cloneGrid(workGrid));
        setStatusGrid(buildBruteStatusGrid(workGrid, locked, `${r},${c}`));

        if (stepRef.current % 5 === 0) addLog(`[${r},${c}] = ${n}`, "try");

        await sleep();
        if (cancelRef.current) return;

        idx++;
        placed = true;
        break;
      }

      if (!placed) {
        // ── Backtrack ──
        workGrid[r][c] = EMPTY;
        tried[idx] = 0;
        idx--;
        tickBacktrack();

        if (idx >= 0) {
          const [pr, pc] = cells[idx];
          // Clear the previous cell — forward loop will try tried[idx]+1 next
          workGrid[pr][pc] = EMPTY;

          if (backtrackRef.current % 3 === 0) addLog(`↩ [${r},${c}] → [${pr},${pc}]`, "back");

          setGrid(cloneGrid(workGrid));
          setStatusGrid(buildBruteStatusGrid(workGrid, locked, undefined, `${pr},${pc}`));

          await sleep();
          if (cancelRef.current) return;
        }
      }
    }

    if (cancelRef.current) return;

    if (idx >= cells.length) {
      setGrid(cloneGrid(workGrid));
      setStatusGrid(buildFinalStatusGrid(locked, "brute"));
      setPhase("solved");
      setStatusMsg("解決！ — 数独完成");
      addLog(`完成！ ${stepRef.current} ステップ / ${backtrackRef.current} バックトラック`, "success");
    } else {
      setPhase("stopped");
      setStatusMsg("解なし — このパズルは解けません");
      addLog("解が見つかりませんでした", "error");
    }
  }

  // ╔════════════════════════════════════════════════╗
  // ║  SECTION 14 — SMART SOLVER                    ║
  // ╚════════════════════════════════════════════════╝
  /**
   * Algorithm
   * ---------
   * Constraint propagation + guessing with backtracking:
   *
   * Pass 1 — Naked singles:
   *   Any cell with exactly one candidate → place it, mark 100% locked.
   *
   * Pass 2 — Hidden singles:
   *   For each constraint unit (row/col/box), if a digit appears as
   *   a candidate in exactly one cell of that unit → place it, lock it.
   *
   * Pass 3 — Guess (MRV):
   *   Push snapshot onto history stack, place best.candidates[0].
   *   Cell is NOT smart-locked (it can be undone).
   *
   * On dead-end (any empty cell has 0 candidates):
   *   Pop snapshot, restore grid, exclude the guessed value and try next.
   *
   * Locked cells survive backtracking; guesses are cleared.
   */
  async function runSmart(startGrid: Grid, locked: BoolGrid): Promise<void> {
    const workGrid = cloneGrid(startGrid);
    const smartLocked = cloneBoolGrid(locked); // grows as we certify cells

    const history: SmartFrame[] = [];

    const render = (hl?: string, bt?: string) => {
      setGrid(cloneGrid(workGrid));
      setCandidateGrid(computeAllCandidates(workGrid));
      setStatusGrid(buildSmartStatusGrid(workGrid, locked, smartLocked, hl, bt));
    };

    let iterations = 0;
    const MAX_ITER = 10_000;

    while (!cancelRef.current && iterations++ < MAX_ITER) {
      if (isSolved(workGrid)) break;

      // ── Dead-end check ──────────────────────────────
      if (hasDeadCell(workGrid)) {
        if (history.length === 0) {
          addLog("解なし — デッドセル検出", "error"); break;
        }
        const frame = history.pop()!;
        // Restore to pre-guess state
        for (let r = 0; r < GRID_SIZE; r++)
          for (let c = 0; c < GRID_SIZE; c++) {
            workGrid[r][c] = frame.grid[r][c];
            smartLocked[r][c] = frame.smartLocked[r][c];
          }
        tickBacktrack();
        addLog(`↩ 推測失敗 [${frame.guessRow},${frame.guessCol}]=${frame.guessVal}`, "back");
        render(undefined, `${frame.guessRow},${frame.guessCol}`);
        await sleep();
        if (cancelRef.current) return;

        // Try the next available candidate for the guessed cell
        const remaining = getCandidates(workGrid, frame.guessRow, frame.guessCol)
          .filter((v) => v !== frame.guessVal);

        if (remaining.length === 0) {
          // No more options — this path is unsolvable, will be caught next iter
          workGrid[frame.guessRow][frame.guessCol] = EMPTY;
        } else if (remaining.length === 1) {
          workGrid[frame.guessRow][frame.guessCol] = remaining[0];
          smartLocked[frame.guessRow][frame.guessCol] = true; // now 100% certain
          tickStep();
          addLog(`確定 [${frame.guessRow},${frame.guessCol}] = ${remaining[0]} (消去法)`, "lock");
        } else {
          // Push a new guess frame for the next candidate
          history.push({
            grid: cloneGrid(workGrid),
            smartLocked: cloneBoolGrid(smartLocked),
            guessRow: frame.guessRow,
            guessCol: frame.guessCol,
            guessVal: remaining[0],
          });
          workGrid[frame.guessRow][frame.guessCol] = remaining[0];
          smartLocked[frame.guessRow][frame.guessCol] = false;
          tickStep();
        }
        render(`${frame.guessRow},${frame.guessCol}`);
        await sleep();
        continue;
      }

      // ── Pass 1: Naked singles ────────────────────────
      let found = false;
      for (let r = 0; r < GRID_SIZE && !found; r++) {
        for (let c = 0; c < GRID_SIZE && !found; c++) {
          if (workGrid[r][c] !== EMPTY) continue;
          const cands = getCandidates(workGrid, r, c);
          if (cands.length === 1) {
            workGrid[r][c] = cands[0];
            smartLocked[r][c] = true;
            tickStep();
            addLog(`確定 [${r},${c}] = ${cands[0]} (唯一候補)`, "lock");
            render(`${r},${c}`);
            await sleep();
            if (cancelRef.current) return;
            found = true;
          }
        }
      }
      if (found) continue;

      // ── Pass 2: Hidden singles ───────────────────────
      for (const unit of ALL_UNITS) {
        if (found) break;
        for (let n = 1; n <= 9 && !found; n++) {
          const places = unit.filter(
            ([r, c]) => workGrid[r][c] === EMPTY && getCandidates(workGrid, r, c).includes(n)
          );
          if (places.length === 1) {
            const [r, c] = places[0];
            workGrid[r][c] = n;
            smartLocked[r][c] = true;
            tickStep();
            addLog(`確定 [${r},${c}] = ${n} (隠れ単数)`, "lock");
            render(`${r},${c}`);
            await sleep();
            if (cancelRef.current) return;
            found = true;
          }
        }
      }
      if (found) continue;

      // ── Pass 3: Guess (MRV) ─────────────────────────
      const best = findBestCell(workGrid);
      if (!best) break; // board full (shouldn't happen without isSolved catching it)
      if (best.candidates.length === 0) continue; // dead cell, caught next iter

      const pct = Math.round(100 / best.candidates.length);
      addLog(
        `推測 [${best.row},${best.col}] = ${best.candidates[0]} (${pct}% / ${best.candidates.length}候補)`,
        "guess"
      );

      history.push({
        grid: cloneGrid(workGrid),
        smartLocked: cloneBoolGrid(smartLocked),
        guessRow: best.row,
        guessCol: best.col,
        guessVal: best.candidates[0],
      });

      workGrid[best.row][best.col] = best.candidates[0];
      smartLocked[best.row][best.col] = false;
      tickStep();
      render(`${best.row},${best.col}`);
      await sleep();
    }

    if (cancelRef.current) return;

    if (isSolved(workGrid)) {
      setGrid(cloneGrid(workGrid));
      setStatusGrid(buildFinalStatusGrid(locked, "smart", smartLocked));
      setCandidateGrid(EMPTY_CAND_GRID);
      setPhase("solved");
      setStatusMsg("解決！ — 数独完成");
      addLog(`完成！ ${stepRef.current} ステップ / ${backtrackRef.current} バックトラック`, "success");
    } else {
      setPhase("stopped");
      setStatusMsg("解なし — このパズルは解けません");
      addLog("解が見つかりませんでした", "error");
    }
  }

  // ╔════════════════════════════════════════════════╗
  // ║  SECTION 15 — SOLVE DISPATCH                  ║
  // ╚════════════════════════════════════════════════╝

  function handleStartSolving() {
    if (isSolving || phase === "input") return;

    cancelRef.current = false;
    stepRef.current = 0;
    backtrackRef.current = 0;
    setStepCount(0);
    setBacktrackCount(0);
    setLog([]);
    setCandidateGrid(EMPTY_CAND_GRID);

    // Always start from a clean user-only grid
    const startGrid = grid.map((row, r) =>
      row.map((val, c) => (userLocked[r][c] ? val : EMPTY))
    );
    setGrid(startGrid);
    setPhase("solving");
    setStatusMsg("解法中…");
    addLog(mode === "brute" ? "総当たりアルゴリズム開始" : "スマートアルゴリズム開始", "system");

    const run = mode === "brute"
      ? runBruteForce(startGrid, userLocked)
      : runSmart(startGrid, userLocked);

    run.catch((err) => {
      console.error("Solver error:", err);
      setPhase("stopped");
      setStatusMsg("エラーが発生しました");
    });
  }

  function handleStopSolving() {
    cancelRef.current = true;
    setPhase("stopped");
    setStatusMsg("停止しました");
    addLog("ユーザーが停止", "system");
  }

  // ╔════════════════════════════════════════════════╗
  // ║  SECTION 16 — RENDER                          ║
  // ╚════════════════════════════════════════════════╝

  const statusBarCls = ["status-bar",
    phase === "solved" ? "solved" : "",
    phase === "stopped" ? "stopped" : "",
  ].filter(Boolean).join(" ");

  const showCandidates = mode === "smart" && (isSolving || phase === "stopped");

  return (
    <>
      <div className="app-wrapper">

        {/* ══════════════════ HEADER ══════════════════════ */}
        <header className="header">
          <div className="header-title">
            <span className="title-main">数独解法器</span>
            <span className="title-sub">SUDOKU SOLVER — INTERACTIVE VISUALIZATION</span>
          </div>
          <div className="header-stats">
            <div className="stat-item">
              <span className="stat-value" style={{ color: stepCount > 0 ? "var(--green)" : "var(--ink)" }}>
                {stepCount}
              </span>
              <span className="stat-label">ステップ</span>
            </div>
            <div className="stat-item">
              <span className="stat-value" style={{ color: backtrackCount > 0 ? "var(--red)" : "var(--ink)" }}>
                {backtrackCount}
              </span>
              <span className="stat-label">バックトラック</span>
            </div>
            <div className="stat-item">
              <span className="stat-value" style={{ fontFamily: "'Noto Serif JP'", fontSize: 16, color: phase === "solved" ? "var(--green)" : "var(--ink)" }}>
                {phase === "solved" ? "完成" : isSolving ? "解法中" : "待機"}
              </span>
              <span className="stat-label">状態</span>
            </div>
          </div>
        </header>

        {/* ══ LEFT PANEL ══════════════════════════════════════ */}
        <aside className="left-panel">

          {/* Mode selector */}
          <div className="panel-box">
            <div className="panel-title">解法モード — MODE</div>
            <div className="mode-selector">
              <button
                className={`mode-btn ${mode === "brute" ? "active" : ""}`}
                disabled={isSolving}
                onClick={() => setMode("brute")}
              >
                総当たり<br />
                <span style={{ fontSize: 9, opacity: 0.7 }}>BRUTE FORCE</span>
              </button>
              <button
                className={`mode-btn ${mode === "smart" ? "active" : ""}`}
                disabled={isSolving}
                onClick={() => setMode("smart")}
              >
                スマート<br />
                <span style={{ fontSize: 9, opacity: 0.7 }}>INTELLIGENT</span>
              </button>
            </div>
            <p className="mode-description">
              {mode === "brute"
                ? "左上から順に空白を埋め、行き詰まればバックトラック。"
                : "確実性の高いセルを優先。100%確定→隠れ単数→推測の順。"}
            </p>
          </div>

          {/* Sample puzzles */}
          <div className="panel-box">
            <div className="panel-title">サンプルパズル — SAMPLES</div>
            <div className="btn-group">
              {(["easy", "medium", "hard"] as const).map((d) => (
                <button
                  key={d}
                  className="btn btn-sm"
                  disabled={isSolving}
                  onClick={() => handleLoadPuzzle(d)}
                >
                  {"●".repeat(d === "easy" ? 1 : d === "medium" ? 2 : 3)}
                  &nbsp;
                  {d === "easy" ? "やさしい EASY" : d === "medium" ? "ふつう MEDIUM" : "むずかしい HARD"}
                </button>
              ))}
            </div>
          </div>

          {/* Controls */}
          <div className="panel-box">
            <div className="panel-title">コントロール — CONTROLS</div>
            <div className="btn-group">
              {phase === "input" && (
                <button className="btn btn-success" onClick={handleLockBoard}>
                  ✓ ボードを固定する
                </button>
              )}
              {phase === "ready" && (
                <button className="btn btn-primary" onClick={handleStartSolving}>
                  ▶ 解法開始
                </button>
              )}
              {phase === "solving" && (
                <button className="btn btn-danger" onClick={handleStopSolving}>
                  ■ 停止
                </button>
              )}
              {(phase === "solved" || phase === "stopped") && (
                <button className="btn btn-primary" onClick={() => {
                  clearSolveState();
                  const cleanGrid = grid.map((row, r) =>
                    row.map((val, c) => (userLocked[r][c] ? val : EMPTY))
                  );
                  const newStatus: StatusGrid = cleanGrid.map((row) =>
                    row.map((v) => (v !== EMPTY ? "locked" : "empty"))
                  );
                  setGrid(cleanGrid);
                  setStatusGrid(newStatus);
                  setPhase("ready");
                  setStatusMsg("もう一度解法できます");
                }}>
                  ↺ 再実行
                </button>
              )}
              {phase !== "input" && (
                <button className="btn btn-sm" disabled={isSolving} onClick={handleEditBoard}>
                  ✎ 編集モード
                </button>
              )}
              <button className="btn btn-sm" disabled={isSolving} onClick={handleClearBoard}>
                ✕ ボードをクリア
              </button>
            </div>
          </div>

          {/* Speed */}
          <div className="panel-box">
            <div className="panel-title">速度 — SPEED</div>
            <div className="slider-wrap">
              <span className="slider-label">遅</span>
              <input
                type="range"
                min={10}
                max={600}
                value={610 - speed}
                onChange={(e) => setSpeed(610 - parseInt(e.target.value, 10))}
              />
              <span className="slider-label">速</span>
            </div>
            <div style={{ textAlign: "center", marginTop: 4 }}>
              <span className="deco-kanji">{speed}ms / ステップ</span>
            </div>
          </div>

          {/* Legend */}
          <div className="panel-box">
            <div className="panel-title">凡例 — LEGEND</div>
            <Legend mode={mode} />
          </div>
        </aside>

        {/* ══ CENTER — BOARD ══════════════════════════════════ */}
        <main className="board-area">
          {/* Status bar */}
          <div className={statusBarCls}>
            {isSolving && <span className="solving-ring" />}
            {statusMsg}
          </div>

          {/* Input hint */}
          {isInputMode && (
            <div className="input-hint">
              ↑ クリックして数字を入力 — Click a cell and type 1-9, 0 to clear
            </div>
          )}

          {/* Board */}
          <Board
            grid={grid}
            statusGrid={statusGrid}
            candidateGrid={candidateGrid}
            selectedCell={selectedCell}
            isInputMode={isInputMode}
            showCandidates={showCandidates}
            onSelectCell={(r, c) => setSelectedCell([r, c])}
            onCellInput={handleCellInput}
            onCellKeyDown={handleCellKeyDown}
          />

          {/* Mode badges */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
            {mode === "smart" && !isInputMode && (
              <>
                <span className="badge badge-blue">確定: 100%</span>
                <span className="badge badge-purple">推測: 不確実</span>
              </>
            )}
            {mode === "brute" && !isInputMode && (
              <>
                <span className="badge badge-blue">青: アルゴ生成</span>
                <span className="badge badge-red">赤: バックトラック</span>
              </>
            )}
          </div>
        </main>

        {/* ══ RIGHT PANEL — LOG ═══════════════════════════════ */}
        <aside className="right-panel">

          {/* Log */}
          <div className="panel-box" style={{ flex: 1 }}>
            <div className="panel-title">操作ログ — ACTIVITY LOG</div>
            <ActivityLog entries={log} />
          </div>

          {/* Stats */}
          <div className="panel-box">
            <div className="panel-title">解法情報 — INFO</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div className="info-row">
                <span className="info-label">モード</span>
                <span>{mode === "brute" ? "総当たり" : "スマート"}</span>
              </div>
              <hr className="divider" />
              <div className="info-row">
                <span className="info-label">空白セル</span>
                <span>{emptyCells}</span>
              </div>
              <div className="info-row">
                <span className="info-label">入力セル</span>
                <span>{filledCells}</span>
              </div>
              <hr className="divider" />
              <div className="info-row">
                <span className="info-label">ステップ</span>
                <span style={{ color: "var(--green)" }}>{stepCount}</span>
              </div>
              <div className="info-row">
                <span className="info-label">後退</span>
                <span style={{ color: "var(--red)" }}>{backtrackCount}</span>
              </div>
              <hr className="divider" />
              <div className="info-row">
                <span className="info-label">フェーズ</span>
                <span style={{ fontSize: 10 }}>{phase}</span>
              </div>
            </div>
          </div>

          <div style={{ textAlign: "center" }}>
            <div className="deco-kanji" style={{ fontSize: 8, letterSpacing: "0.4em" }}>
              数独 ・ 解法視覚化
            </div>
          </div>
        </aside>
      </div>

      <div className="watermark">数独解法器 2025</div>
    </>
  );
}