# 数独解法器 — Sudoku Solver

An interactive, visually-driven Sudoku solver built with **Next.js** and **TypeScript**, styled with a Japanese washi-paper aesthetic. Watch two distinct algorithms race through the board in real time — every step, guess, and backtrack animated before your eyes.

---

## Features

- **Two solving modes** — Brute Force and Smart/Intelligent, switchable before each solve
- **Animated step-by-step visualization** — every cell fill, guess, and backtrack is visible with a configurable delay
- **Manual board input** — type your own puzzle or load one of three built-in samples
- **Candidate display** — in Smart mode, empty cells show remaining possible numbers
- **Live activity log** — color-coded log of every algorithm decision
- **Step and backtrack counters** — track solver efficiency at a glance
- **Adjustable speed** — from 10ms (blazing) to 500ms (meditative) per step
- **Mobile friendly** — responsive layout, desktop-first

---

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## How to Use

### Inputting a Puzzle

1. **Load a sample** — click Easy, Medium, or Hard in the left panel
2. **Type your own** — click any cell and press `1`–`9` to enter a digit, `0` or `Backspace` to clear
   - Use arrow keys to navigate between cells
3. Click **ボードを固定する (Lock Board)** to confirm your input before solving

### Solving

- Select a mode (Brute Force or Smart) from the mode panel
- Click **▶ 解法開始 (Start Solving)**
- Click **■ 停止 (Stop)** at any time to pause
- Adjust the speed slider — drag left for slower, right for faster

---

## Solving Modes

### 総当たり — Brute Force

Walks the board from the **top-left cell**, moving left-to-right, row-by-row.

- Fills each empty cell with the lowest valid number
- If a cell has no valid options, **backtracks** to the previous filled cell and tries the next value
- Each cell maintains a **bad-value memory** — numbers that previously caused dead ends are skipped on retry
- User-entered cells are **never modified**

**Color coding:**

| Color | Meaning |
|---|---|
| Dark / black | User input (locked) |
| Blue tint | Algorithm-placed number |
| Green | Cell currently being filled |
| Red | Cell being cleared during backtrack |
| Light green | Final solved state |

### スマート — Intelligent

Mimics human solving strategy, prioritizing **certainty** over speed.

**Step priority:**

1. **Naked Singles (100%)** — a cell with only one possible candidate is filled and locked immediately
2. **Hidden Singles** — a number that can only go in one cell within a row, column, or 3×3 box is locked in
3. **Guessing** — when no certain moves remain, the cell with the *fewest* candidates is chosen and the first option is guessed

Guesses are **never locked** — if a guess leads to a contradiction, backtracking clears only the guessed values while all locked certainties remain intact.

**Color coding:**

| Color | Meaning |
|---|---|
| Dark / black | User input (locked) |
| Blue tint | Locked certainty (100% confirmed) |
| Purple italic | Active guess (unconfirmed) |
| Mini number grid | Remaining candidates for that cell |
| Light green | Final solved state |

---

## Project Structure

```
/
├── pages/
│   └── index.tsx          # Entry point — renders the solver
├── components/
│   └── SudokuSolver.tsx   # Main component (grid, state, UI)
├── lib/
│   └── sudoku.ts          # Pure solver logic (validation, candidates, best-cell)
├── public/
└── README.md
```

---

## Tech Stack

- [Next.js](https://nextjs.org/) — React framework
- TypeScript — type-safe throughout
- CSS-in-JS (style tag) — no external CSS framework, fully self-contained styling
- Google Fonts — *Noto Serif JP*, *Share Tech Mono*

---

## Algorithm Notes

### Why iterative backtracking instead of recursive?

JavaScript's call stack has a hard limit. For difficult puzzles, a naive recursive backtracker can overflow. The brute force solver uses an **explicit stack** (`emptyCells[]` + `tried[]` index array) to avoid this, and it keeps the UI thread responsive for `async/await`-based animation between steps.

### Why does Smart mode still backtrack?

Human-style strategies (naked singles, hidden singles) can solve most easy and medium puzzles without any guessing. But for hard/minimal-clue puzzles, logical deduction eventually runs out of moves. When that happens the solver makes a **minimum-uncertainty guess** (the cell with fewest candidates). If that guess turns out to be wrong — detected when any cell reaches zero candidates — the solver backtracks to the last guess point, discards it, and tries the next candidate.

---

## Sample Puzzles

| Difficulty | Source |
|---|---|
| Easy | Classic givens puzzle, ~35 clues |
| Medium | Requires moderate deduction, ~27 clues |
| Hard | Near-minimal clues, requires guessing |

---

## License

MIT