import { IconButton, Slider } from '../design'
import { FOCUS_RING } from '../design/utils'
import { BRUSH_SIZES, INK_PALETTE, type ToolKind, type ToolSettings } from './types'

export interface CanvasToolsProps {
  value: ToolSettings
  onChange(value: ToolSettings): void
  onUndo(): void
  onClear(): void
  disabled?: boolean
}

const TOOLS: Array<{ tool: ToolKind; label: string; glyph: string }> = [
  { tool: 'pencil', label: 'Pencil', glyph: '✎' },
  { tool: 'eraser', label: 'Eraser', glyph: '▱' },
  { tool: 'fill', label: 'Fill bucket', glyph: '◩' },
]

export function CanvasTools({ value, onChange, onUndo, onClear, disabled = false }: CanvasToolsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3" role="toolbar" aria-label="Drawing tools">
      <div className="flex gap-2" role="group" aria-label="Tools and canvas actions">
        {TOOLS.map(({ tool, label, glyph }) => (
          <IconButton
            key={tool}
            icon={<span aria-hidden>{glyph}</span>}
            label={label}
            active={value.tool === tool}
            disabled={disabled}
            onClick={() => onChange({ ...value, tool })}
          />
        ))}
        <IconButton icon={<span aria-hidden>↶</span>} label="Undo" disabled={disabled} onClick={onUndo} />
        <IconButton icon={<span aria-hidden>×</span>} label="Clear canvas" disabled={disabled} onClick={onClear} />
      </div>

      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Ink colors">
        {INK_PALETTE.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`Use color ${color}`}
            aria-pressed={value.color === color}
            disabled={disabled || value.tool === 'eraser'}
            className={`h-7 w-7 rounded-full border-2 border-ink shadow-[1px_1px_0_var(--color-ink)] disabled:opacity-35 aria-pressed:outline aria-pressed:outline-2 aria-pressed:outline-offset-2 aria-pressed:outline-accent-deep ${FOCUS_RING}`}
            style={{ backgroundColor: color }}
            onClick={() => onChange({ ...value, color })}
          />
        ))}
        <input
          type="color"
          aria-label="Custom ink color"
          value={value.color}
          disabled={disabled || value.tool === 'eraser'}
          className={`h-8 w-10 cursor-pointer border-0 bg-transparent disabled:cursor-not-allowed ${FOCUS_RING}`}
          onChange={(event) => onChange({ ...value, color: event.target.value.toUpperCase() })}
        />
      </div>

      <div className="min-w-48 flex-1">
        <Slider
          label="Brush size"
          min={BRUSH_SIZES.min}
          max={BRUSH_SIZES.max}
          value={value.size}
          disabled={disabled || value.tool === 'fill'}
          formatValue={(size) => `${size}px`}
          onChange={(size) => onChange({ ...value, size })}
        />
      </div>
    </div>
  )
}
