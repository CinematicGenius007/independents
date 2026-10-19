import { createRng, hashSeed } from './rng'
import type { Mark } from './rules'

/**
 * Withheld cells.
 *
 * A redacted cell shows its letter and hides its heat. That is the whole
 * mechanic, and everything here is advisory except the shape of the map: a
 * setter may bar a row end to end if that is the puzzle they want, and a solver
 * can still win, because a win is `guess === answer` and is decided from the
 * truth. The chrome announces it; the grid is under no obligation to explain.
 *
 * The guard that used to live here — never bar a whole row — was removed on
 * request, and rightly: it was a rule the engine had invented, and the setter is
 * the one who knows what they are making. `analyseMap` still counts the rows that
 * say nothing, so the cost is visible without being enforced.
 */

export type RedactionMode = 'off' | 'open' | 'pattern' | 'closed'

export type PatternKind = 'leading' | 'alternate'

export interface Pattern {
  readonly kind: PatternKind
  /** How many cells the window covers. */
  readonly count: number
  /** The 1-indexed row the window starts on. */
  readonly fromRow: number
}

export interface RedactionConfig {
  readonly mode: RedactionMode
  readonly pattern?: Pattern
  /** Used by `open`: the setter's own map, one array per row. */
  readonly explicit?: readonly (readonly boolean[])[]
  /** Walk the window one cell further right on every row. */
  readonly shear?: boolean
  /** Barred cells report a wrong mark instead of withholding one. */
  readonly decoy?: boolean
}

export interface RedactionMap {
  readonly mode: RedactionMode
  readonly length: number
  readonly rows: number
  readonly barred: readonly (readonly boolean[])[]
  /** Whether the solver is shown the map before their first turn. */
  readonly visible: boolean
  readonly decoy: boolean
}

export function everyRowHasAnOpenCell(barred: readonly (readonly boolean[])[]): boolean {
  return barred.every((line) => line.some((cell) => !cell))
}

/** Shape only. A row that says nothing is a choice, not a mistake. */
export function validateMap(barred: readonly (readonly boolean[])[], length: number, rows: number): string[] {
  const problems: string[] = []
  if (barred.length !== rows) problems.push(`expected ${rows} rows, found ${barred.length}`)
  barred.forEach((line, index) => {
    if (line.length !== length) problems.push(`row ${index + 1} has ${line.length} cells, expected ${length}`)
  })
  return problems
}

/** The barred run, as bit patterns. `count` may now be as long as the row. */
export function patternLines(pattern: Pattern, length: number, rows: number, shear: boolean): boolean[][] {
  const count = Math.max(1, Math.min(pattern.count, length))
  const lines: boolean[][] = []
  for (let row = 1; row <= rows; row += 1) {
    const line: boolean[] = new Array(length).fill(false)
    const active = row >= pattern.fromRow && (pattern.kind === 'leading' || (row - pattern.fromRow) % 2 === 0)
    if (active) {
      const shift = shear ? row - pattern.fromRow : 0
      for (let cell = 0; cell < count; cell += 1) {
        const target = cell + shift
        if (target >= 0 && target < length) line[target] = true
      }
    }
    lines.push(line)
  }
  return lines
}

export function buildRedaction(config: RedactionConfig, length: number, rows: number, seed: string): RedactionMap {
  void seed
  const decoy = config.decoy === true

  if (config.mode === 'off') {
    return {
      mode: 'off',
      length,
      rows,
      barred: Array.from({ length: rows }, () => new Array<boolean>(length).fill(false)),
      visible: false,
      decoy: false,
    }
  }

  if (config.mode === 'open') {
    const supplied = config.explicit ?? Array.from({ length: rows }, () => new Array<boolean>(length).fill(false))
    const problems = validateMap(supplied, length, rows)
    if (problems.length > 0) throw new Error(`redaction map rejected: ${problems.join('; ')}`)
    return { mode: 'open', length, rows, barred: supplied.map((line) => [...line]), visible: true, decoy }
  }

  const pattern = config.pattern ?? { kind: 'leading', count: 4, fromRow: 3 }
  const barred = patternLines(pattern, length, rows, config.shear === true)

  return {
    mode: config.mode,
    length,
    rows,
    barred,
    // `pattern` declares the rule up front; `closed` withholds it until the end.
    visible: config.mode === 'pattern',
    decoy,
  }
}

/**
 * A wrong mark, chosen so it is never accidentally right.
 *
 * It lives here rather than in the game because two callers need the same
 * answer: the board, to draw it, and the difficulty model, to work out what a
 * solver who believes it would do.
 */
export function decoyMark(seed: string, row: number, cell: number, truth: Mark): Mark {
  const options: Mark[] = ['exact', 'shifted', 'absent']
  const allowed = options.filter((mark) => mark !== truth)
  return createRng(hashSeed(`decoy:${seed}:${row}:${cell}`)).pick(allowed)
}

export function isBarred(map: RedactionMap, row: number, cell: number): boolean {
  return map.barred[row]?.[cell] === true
}

export function barredCount(map: RedactionMap): number {
  return map.barred.reduce((total, line) => total + line.filter(Boolean).length, 0)
}

export interface LiftResult {
  readonly map: RedactionMap
  readonly changed: boolean
}

/** Spending a lift pulls one bar back, for good. */
export function lift(map: RedactionMap, row: number, cell: number): LiftResult {
  if (!isBarred(map, row, cell)) return { map, changed: false }
  const barred = map.barred.map((line) => [...line])
  barred[row][cell] = false
  return { map: { ...map, barred }, changed: true }
}

export function describeMap(map: RedactionMap): string {
  if (map.mode === 'off') return 'nothing is withheld'
  const count = barredCount(map)
  const where = map.mode === 'open' ? 'by the setter' : map.mode === 'pattern' ? 'by rule' : 'by rule, undeclared'
  return `${count} cell${count === 1 ? '' : 's'} barred ${where}`
}

/**
 * Painting a cell.
 *
 * It used to refuse the last open cell in a row. It does not any more: a setter
 * may bar a whole row, and `analyseMap` will tell them what that costs instead of
 * stopping them. Painting converts a rule into an explicit map, which is what
 * `mode: 'open'` means — the setter's own, rather than generated.
 */
export interface PaintResult {
  readonly map: RedactionMap
  readonly problem?: string
}

export function paint(map: RedactionMap, row: number, cell: number, barred: boolean): PaintResult {
  if (row < 0 || row >= map.rows || cell < 0 || cell >= map.length) {
    return { map, problem: 'that cell is off the board' }
  }
  if (map.barred[row][cell] === barred) return { map }

  const lines = map.barred.map((line) => [...line])
  lines[row][cell] = barred
  return { map: { ...map, mode: 'open', barred: lines } }
}

/**
 * If a painted map happens to be a rule, say which one.
 *
 * The editor offers a brush and a few sentences, and a setter who paints the
 * same shape every time should be told they have painted `leading, four, from
 * row three` — which is shorter to store, easier to describe in a link, and
 * possible to shear.
 */
export function recognisePattern(map: RedactionMap): { pattern: Pattern; shear: boolean } | null {
  for (const shear of [false, true]) {
    for (const kind of ['leading', 'alternate'] as const) {
      for (let count = 1; count < map.length; count += 1) {
        for (let fromRow = 1; fromRow <= map.rows; fromRow += 1) {
          const pattern: Pattern = { kind, count, fromRow }
          const lines = patternLines(pattern, map.length, map.rows, shear)
          const matches = lines.every((line, row) => line.every((cell, index) => cell === map.barred[row][index]))
          if (matches) return { pattern, shear }
        }
      }
    }
  }
  return null
}

export interface MapAnalysis {
  readonly barred: number
  readonly total: number
  /** Open cells in each row, top to bottom. Zero is allowed now. */
  readonly openPerRow: readonly number[]
  /** Where the solver learns least. */
  readonly thinnest: { readonly row: number; readonly open: number }
  /** Rows with nothing legible in them at all. */
  readonly sealedRows: number
  /** Rows down to a single open cell. A lift per such row is a fair grant. */
  readonly suggestedLifts: number
  readonly verdict: 'open' | 'thin' | 'closed' | 'blank'
}

export function analyseMap(map: RedactionMap): MapAnalysis {
  const openPerRow = map.barred.map((line) => line.filter((cell) => !cell).length)
  const barred = map.barred.reduce((total, line) => total + line.filter(Boolean).length, 0)
  const total = map.length * map.rows

  let thinnest = { row: 1, open: openPerRow[0] ?? 0 }
  openPerRow.forEach((open, index) => {
    if (open < thinnest.open) thinnest = { row: index + 1, open }
  })

  const thin = openPerRow.filter((open) => open <= 1).length
  const sealedRows = openPerRow.filter((open) => open === 0).length

  const verdict: MapAnalysis['verdict'] =
    barred === 0 ? 'open' : sealedRows > 0 ? 'closed' : thin === map.rows ? 'blank' : 'thin'

  return {
    barred,
    total,
    openPerRow,
    thinnest,
    sealedRows,
    suggestedLifts: Math.max(0, Math.min(5, thin)),
    verdict,
  }
}

/**
 * The shapes worth having a name.
 *
 * One tap each, because a setter wants a redaction the way they want a colour —
 * by pointing at it, not by building it. `analyseMap` describes whatever comes
 * out, and nothing here is refused.
 */
export interface RedactionPreset {
  readonly id: string
  readonly label: string
  readonly blurb: string
  readonly config: (length: number, rows: number) => RedactionConfig
}

const explicit = (length: number, rows: number, barred: (row: number, cell: number) => boolean): RedactionConfig => ({
  mode: 'open',
  explicit: Array.from({ length: rows }, (_, row) =>
    Array.from({ length }, (_, cell) => barred(row + 1, cell + 1)),
  ),
})

export const REDACTION_PRESETS: readonly RedactionPreset[] = [
  { id: 'none', label: 'Nothing', blurb: 'every cell tells you what it knows', config: () => ({ mode: 'off' }) },
  {
    id: 'house',
    label: 'The house',
    blurb: 'a leading run of four, from row three down',
    config: () => ({ mode: 'pattern', pattern: { kind: 'leading', count: 4, fromRow: 3 } }),
  },
  {
    id: 'alternate',
    label: 'Alternate',
    blurb: 'every other row loses its opening run',
    config: () => ({ mode: 'pattern', pattern: { kind: 'alternate', count: 3, fromRow: 1 } }),
  },
  {
    id: 'shear',
    label: 'Shear',
    blurb: 'the run walks one cell right on every row',
    config: () => ({ mode: 'pattern', pattern: { kind: 'leading', count: 3, fromRow: 1 }, shear: true }),
  },
  {
    id: 'checker',
    label: 'Checker',
    blurb: 'every other cell, like a chequered flag',
    config: (length, rows) => explicit(length, rows, (row, cell) => (row + cell) % 2 === 0),
  },
  {
    id: 'columns',
    label: 'Last two',
    blurb: 'the end of every guess goes dark',
    config: (length, rows) => explicit(length, rows, (_row, cell) => cell > length - 2),
  },
  {
    id: 'blackout',
    label: 'One row',
    blurb: 'a whole row barred — it says nothing, and the chrome still calls a win',
    config: (length, rows) => explicit(length, rows, (row) => row === Math.min(3, rows)),
  },
  {
    id: 'all',
    label: 'Everything',
    blurb: 'nothing is legible anywhere; the board becomes a guess',
    config: (length, rows) => explicit(length, rows, () => true),
  },
]
