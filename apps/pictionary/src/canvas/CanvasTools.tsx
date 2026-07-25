import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Slider } from '../design'
import { bevelClass, FOCUS_RING } from '../design/utils'
import { BRUSH_SIZES, INK_PALETTE, type ToolKind, type ToolSettings } from './types'

export interface CanvasToolsProps {
  value: ToolSettings
  onChange(value: ToolSettings): void
  onUndo(): void
  onClear(): void
  disabled?: boolean
}

function PencilGlyph() {
  return (
    <svg viewBox="0 0 16 16" width={20} height={20} shapeRendering="crispEdges" aria-hidden>
      <path d="M3 13 L3 11 L10 4 L12 6 L5 13 Z" fill="currentColor" />
      <path d="M9 5 L11 7" stroke="var(--color-chrome-panel)" strokeWidth={1} />
    </svg>
  )
}

function EraserGlyph() {
  return (
    <svg viewBox="0 0 16 16" width={20} height={20} shapeRendering="crispEdges" aria-hidden>
      <rect x={3} y={6.5} width={10} height={5} fill="none" stroke="currentColor" strokeWidth={1.5} />
      <rect x={3} y={11.5} width={10} height={1.5} fill="currentColor" />
    </svg>
  )
}

function FillGlyph() {
  return (
    <svg viewBox="0 0 16 16" width={20} height={20} shapeRendering="crispEdges" aria-hidden>
      <path d="M3 8 L8 3 L13 8 L8 13 Z" fill="none" stroke="currentColor" strokeWidth={1.5} />
      <rect x={7} y={13} width={2} height={2} fill="currentColor" />
    </svg>
  )
}

function UndoGlyph() {
  return (
    <svg viewBox="0 0 16 16" width={20} height={20} shapeRendering="crispEdges" aria-hidden>
      <path d="M9 3 L4 3 L4 1 L1 5 L4 9 L4 7 L9 7 Z" fill="currentColor" />
      <rect x={9} y={5} width={4} height={4} fill="none" stroke="currentColor" strokeWidth={1.5} />
    </svg>
  )
}

function ClearGlyph() {
  return (
    <svg viewBox="0 0 16 16" width={20} height={20} shapeRendering="crispEdges" aria-hidden>
      <path d="M4 4 L12 12 M12 4 L4 12" stroke="currentColor" strokeWidth={2.2} strokeLinecap="square" />
    </svg>
  )
}

const TOOLS: Array<{ tool: ToolKind; label: string; caption: string; glyph: ReactNode }> = [
  { tool: 'pencil', label: 'Pencil', caption: 'PENCIL', glyph: <PencilGlyph /> },
  { tool: 'eraser', label: 'Eraser', caption: 'ERASE', glyph: <EraserGlyph /> },
  { tool: 'fill', label: 'Fill bucket', caption: 'FILL', glyph: <FillGlyph /> },
]

interface TileProps extends Pick<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'disabled'> {
  label: string
  caption: string
  active?: boolean
  children: ReactNode
}

/**
 * A single reference-A icon tile: bevelled chrome square, a pixel glyph
 * above a small uppercase caption. The active tool gets a pressed-in bevel
 * plus a gold outline ring.
 */
function ToolTile({ label, caption, active = false, disabled, onClick, children }: TileProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={[
        'flex h-16 w-16 shrink-0 flex-col items-center justify-center gap-1 bg-chrome-panel text-text',
        bevelClass({ tone: 'chrome', pressed: active }),
        disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer',
        active ? 'outline outline-[2px] outline-offset-2 outline-[color:var(--color-gold)]' : '',
        FOCUS_RING,
      ].join(' ')}
    >
      {children}
      <span className="pixel-heading text-[8px] leading-[8px]">{caption}</span>
    </button>
  )
}

export function CanvasTools({ value, onChange, onUndo, onClear, disabled = false }: CanvasToolsProps) {
  return (
    <div className="flex flex-wrap items-center gap-4" role="toolbar" aria-label="Drawing tools">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Tools and canvas actions">
        {TOOLS.map(({ tool, label, caption, glyph }) => (
          <ToolTile
            key={tool}
            label={label}
            caption={caption}
            active={value.tool === tool}
            disabled={disabled}
            onClick={() => onChange({ ...value, tool })}
          >
            {glyph}
          </ToolTile>
        ))}
        <ToolTile label="Undo" caption="UNDO" disabled={disabled} onClick={onUndo}>
          <UndoGlyph />
        </ToolTile>
        <ToolTile label="Clear canvas" caption="CLEAR" disabled={disabled} onClick={onClear}>
          <ClearGlyph />
        </ToolTile>
      </div>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Ink colors">
        {INK_PALETTE.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`Use color ${color}`}
            aria-pressed={value.color === color}
            disabled={disabled || value.tool === 'eraser'}
            className={`h-7 w-7 border-2 border-[color:var(--color-chrome-lo)] disabled:opacity-35 aria-pressed:outline aria-pressed:outline-[2px] aria-pressed:outline-offset-2 aria-pressed:outline-[color:var(--color-gold)] ${FOCUS_RING}`}
            style={{ backgroundColor: color }}
            onClick={() => onChange({ ...value, color })}
          />
        ))}
        <span className={`inline-flex h-8 w-10 items-center justify-center bg-chrome-panel ${bevelClass({ tone: 'chrome', size: 'sm' })}`}>
          <input
            type="color"
            aria-label="Custom ink color"
            value={value.color}
            disabled={disabled || value.tool === 'eraser'}
            className={`h-full w-full cursor-pointer border-0 bg-transparent p-0 disabled:cursor-not-allowed ${FOCUS_RING}`}
            onChange={(event) => onChange({ ...value, color: event.target.value.toUpperCase() })}
          />
        </span>
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
