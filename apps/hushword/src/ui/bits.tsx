import type { CSSProperties, ReactNode } from 'react'
import type { ShownMark } from '../engine/game'
import { readableLetter, ROLES, type Role, type RoleInk } from '../engine/palette'

const GLOW: Record<Role, string> = {
  exact: 'rgba(43,196,107,0.4)',
  shifted: 'rgba(255,195,61,0.4)',
  absent: 'transparent',
}

export const ROLE_CLASS: Record<Role, string> = {
  exact: 'ink-hit',
  shifted: 'ink-near',
  absent: 'ink-miss',
}

/**
 * What each mark means, in words.
 *
 * A board of six colours is nothing to a screen reader, and this game's whole
 * subject is the meaning of those colours — so the meaning travels alongside
 * them, cell by cell, in the row's accessible name.
 */
export const MARK_WORDS: Record<ShownMark, string> = {
  exact: 'right letter, right spot',
  shifted: 'right letter, wrong spot',
  absent: 'not in the word',
  barred: 'withheld',
}

export function describeRow(index: number, row: { word: string; shown: readonly ShownMark[] }): string {
  const cells = row.word
    .split('')
    .map((letter, cell) => `${letter}, ${MARK_WORDS[row.shown[cell] ?? 'absent']}`)
  return `Row ${index + 1}: ${cells.join('; ')}`
}

export function Eyebrow({ children, pink }: { children: ReactNode; pink?: boolean }): ReactNode {
  return <div className={pink ? 'eyebrow eyebrow--pink' : 'eyebrow'}>{children}</div>
}

export function Rule({ wide }: { wide?: boolean }): ReactNode {
  return <div className={wide ? 'rule rule--wide' : 'rule'} />
}

export function Section({
  title,
  note,
  children,
}: {
  title: string
  note?: ReactNode
  children?: ReactNode
}): ReactNode {
  return (
    <div className="section">
      <div className="row row--between">
        <Eyebrow>{title}</Eyebrow>
        {note}
      </div>
      <Rule />
      {children}
    </div>
  )
}

/**
 * One cell.
 *
 * The letter colour is chosen against its own ink, which is why it is inline
 * rather than a class: the palette changes per link, so "white letters" is not a
 * property the board can have.
 */
export function Tile({
  letter,
  shown,
  ink,
  index = 0,
  onLift,
  pending,
  active,
  delay,
}: {
  letter: string
  shown?: ShownMark
  ink: RoleInk
  index?: number
  onLift?: () => void
  /** A letter typed but not yet submitted. */
  pending?: boolean
  /** The cell the next keystroke lands in. */
  active?: boolean
  /** Milliseconds to hold the flip back, for a staged reveal. */
  delay?: number
}): ReactNode {
  const base = {
    '--i': index,
    ...(delay === undefined ? {} : { '--delay': `${delay}ms` }),
  } as CSSProperties

  if (!shown) {
    const className = `tile${pending ? ' tile--pending' : ''}${active ? ' tile--active' : ''}`
    return (
      // The row's accessible name says what this cell means; the cell itself
      // would only repeat the letter.
      <div className={className} style={base} aria-hidden="true">
        {letter ? (
          // Keyed on the letter so typing it plays the pop, and retyping it over
          // a cleared cell plays it again.
          <span className="tile__letter" key={letter}>
            {letter}
          </span>
        ) : null}
      </div>
    )
  }

  /**
   * A told cell, as a card with two faces.
   *
   * The letter is on both, so the only thing that changes as the tile turns is
   * the ink — and it changes while the tile is edge-on and invisible.
   */
  if (shown === 'barred') {
    return (
      <button
        type="button"
        className={`tile tile--flip tile--barred${onLift ? ' tile--liftable' : ''}`}
        style={base}
        onClick={onLift}
        disabled={!onLift}
        aria-hidden={onLift ? undefined : true}
        aria-label={onLift ? `${letter}, withheld — spend a lift to pull the bar back` : undefined}
        title={onLift ? 'spend a lift on this cell' : 'withheld'}
      >
        <span className="tile__letter" aria-hidden="true">
          {letter}
        </span>
        <span className="tile__face" aria-hidden="true">
          {letter}
        </span>
      </button>
    )
  }

  const role: Role = shown === 'exact' ? 'exact' : shown === 'shifted' ? 'shifted' : 'absent'
  const colour = ink[role]
  const style = { ...base, '--fill': colour, '--glow': GLOW[role] } as CSSProperties

  return (
    <div className={`tile tile--flip ${ROLE_CLASS[role]}`} style={style} aria-hidden="true">
      <span className="tile__letter">{letter}</span>
      <span className="tile__face" style={{ color: readableLetter(colour) }}>
        {letter}
      </span>
    </div>
  )
}

export interface PlayedRow {
  readonly word: string
  readonly shown: readonly ShownMark[]
}

/**
 * The board, which is also the input.
 *
 * There is no separate field: the row you are filling in sits in the grid like
 * every other row, the way it does in the game this one is a version of. A
 * `shakeToken` that changes remounts that row, which is how a rejected guess
 * replays the shake rather than sitting there already shaken.
 */
export function Board({
  rows,
  total,
  length,
  ink,
  tileSize,
  onLift,
  typed = '',
  shakeToken = 0,
  stagedRows = [],
  won = false,
}: {
  rows: readonly PlayedRow[]
  total: number
  length: number
  ink: RoleInk
  tileSize?: string
  onLift?: (row: number, cell: number) => void
  typed?: string
  shakeToken?: number
  /**
   * Rows that were told rather than shown — held back, then stepped. Once a row
   * is in here it stays, because removing its delay would change a finished
   * animation and could start it again.
   */
  stagedRows?: readonly number[]
  /** A solved board lifts its rows one after another. */
  won?: boolean
}): ReactNode {
  const style = tileSize ? ({ '--tile': tileSize } as CSSProperties) : undefined
  const typingRow = rows.length

  /** What a screen reader is told about one row, since the colours say nothing. */
  const rowLabel = (row: number, played: PlayedRow | undefined): string | undefined => {
    if (played) return describeRow(row, played)
    if (row === typingRow) {
      return typed.length === 0
        ? `Row ${row + 1}, empty`
        : `Row ${row + 1}, ${typed.length} of ${length}: ${typed.split('').join(' ')}`
    }
    return undefined
  }

  return (
    <div
      className={won ? 'board board--won' : 'board'}
      style={style}
      role="group"
      aria-label={`the board, ${total} rows of ${length} letters`}
    >
      {Array.from({ length: total }, (_, row) => {
        const played = rows[row]
        const isTyping = !played && row === typingRow
        const staged = stagedRows.includes(row)
        const label = rowLabel(row, played)
        return (
          <div
            className={`board__row${isTyping && shakeToken > 0 ? ' board__row--shake' : ''}`}
            key={isTyping ? `typing-${shakeToken}` : `row-${row}`}
            style={{ '--row': row } as CSSProperties}
            role={label ? 'group' : undefined}
            aria-label={label}
            aria-hidden={label ? undefined : true}
          >
            {Array.from({ length }, (_, cell) => (
              <Tile
                key={cell}
                letter={played?.word[cell] ?? (isTyping ? typed[cell] ?? '' : '')}
                shown={played?.shown[cell]}
                ink={ink}
                index={cell}
                delay={staged ? REVEAL_HOLD + cell * REVEAL_STEP : undefined}
                pending={isTyping}
                active={isTyping && cell === typed.length}
                onLift={played && onLift && played.shown[cell] === 'barred' ? () => onLift(row, cell) : undefined}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}

/**
 * The pause before a row is told, and the gap between its cells.
 *
 * Long enough to see the word you committed to before the board answers, and
 * stepped so the answer arrives left to right rather than all at once. These are
 * exported because the input lock has to last exactly as long as they do, and
 * two numbers that have to agree should be one number.
 */
export const REVEAL_HOLD = 300
export const REVEAL_STEP = 190
export const REVEAL_MS = (length: number): number => REVEAL_HOLD + length * REVEAL_STEP + 260

/** The redaction diagram and the editor's brush target are the same shape. */
export function Cell({
  barred,
  onToggle,
  size,
}: {
  barred: boolean
  onToggle?: () => void
  size?: string
}): ReactNode {
  const style = size ? ({ '--cell': size } as CSSProperties) : undefined
  return (
    <button
      type="button"
      className={`cell${barred ? ' cell--barred' : ''}${onToggle ? '' : ' cell--static'}`}
      style={style}
      onClick={onToggle}
      disabled={!onToggle}
      aria-pressed={barred}
      aria-label={barred ? 'barred, click to open' : 'open, click to bar'}
    />
  )
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (next: boolean) => void; label: string }): ReactNode {
  return (
    <button type="button" className="row" onClick={() => onChange(!on)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
      <span className={on ? 'toggle toggle--on' : 'toggle'}>
        <span />
      </span>
      <span className="eyebrow" style={{ color: on ? 'var(--pink)' : undefined }}>
        {label}
      </span>
    </button>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { readonly value: T; readonly label: string }[]
  value: T
  onChange: (next: T) => void
}): ReactNode {
  return (
    <div className="chips">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={option.value === value ? 'chip chip--on' : 'chip'}
          onClick={() => onChange(option.value)}
          aria-pressed={option.value === value}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Stepper({
  value,
  min = 0,
  max = 5,
  suffix,
  onChange,
}: {
  value: number
  min?: number
  max?: number
  suffix?: string
  onChange: (next: number) => void
}): ReactNode {
  return (
    <span className="stepper">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="less">
        −
      </button>
      <span className="stepper__value">{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="more">
        +
      </button>
      {suffix ? <span className="eyebrow">{suffix}</span> : null}
    </span>
  )
}

export function RoleLegend({ ink, compact }: { ink: RoleInk; compact?: boolean }): ReactNode {
  return (
    <div className="chips">
      {ROLES.map((role) => (
        <span key={role} className="row" style={{ gap: '0.375rem' }}>
          <span
            style={{
              width: '0.6875rem',
              height: '0.6875rem',
              borderRadius: '0.125rem',
              background: ink[role],
              border: `1px solid ${ink[role]}`,
            }}
          />
          {compact ? null : <span className="eyebrow">{role}</span>}
        </span>
      ))}
    </div>
  )
}

export function Panel({ children, accent }: { children: ReactNode; accent?: boolean }): ReactNode {
  return <div className={accent ? 'panel panel--cyan' : 'panel'}>{children}</div>
}

/** Clipboard access is refused on some origins; the caller decides what to say. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
