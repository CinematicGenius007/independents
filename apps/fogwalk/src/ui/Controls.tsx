import type { Direction } from '../engine/board'

interface Props {
  onMove: (direction: Direction) => void
  onUndo: () => void
  onReset: () => void
  onHint: () => void
  canUndo: boolean
  hintBusy: boolean
}

const ARROWS: { direction: Direction; glyph: string; className: string }[] = [
  { direction: 'up', glyph: '↑', className: 'up' },
  { direction: 'left', glyph: '←', className: 'left' },
  { direction: 'down', glyph: '↓', className: 'down' },
  { direction: 'right', glyph: '→', className: 'right' },
]

export function Controls({ onMove, onUndo, onReset, onHint, canUndo, hintBusy }: Props) {
  return (
    <div className="pad-row">
      <div className="pad">
        {ARROWS.map((arrow) => (
          <button
            key={arrow.direction}
            className={arrow.className}
            onClick={() => onMove(arrow.direction)}
            aria-label={`Slide ${arrow.direction}`}
          >
            {arrow.glyph}
          </button>
        ))}
      </div>
      <div className="side-buttons">
        <button className="ghost-button" onClick={onUndo} disabled={!canUndo}>
          Undo
        </button>
        <button className="ghost-button" onClick={onReset}>
          Restart
        </button>
        <button className="ghost-button" onClick={onHint} disabled={hintBusy}>
          {hintBusy ? 'Thinking' : 'Hint'}
        </button>
      </div>
    </div>
  )
}
