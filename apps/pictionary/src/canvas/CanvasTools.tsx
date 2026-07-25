import type { ReactNode } from 'react'
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

/**
 * Toolbar icons are drawn rather than typed.
 *
 * They used to be text glyphs (`✎ ▱ ◩ ↶ ×`), which meant their weight and
 * shape came from whatever font the OS substituted — hairline on macOS, and
 * missing outright on some systems. These are stroked at the same 2px as the
 * kit's ink lines, so the toolbar matches the rest of the drawing.
 */
function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  )
}

const PencilIcon = (
  <Glyph>
    <path d="M4 20h4L20 8l-4-4L4 16v4Z" />
    <path d="M14 6l4 4" />
  </Glyph>
)

const EraserIcon = (
  <Glyph>
    <path d="M9 20 4 15a2 2 0 0 1 0-3l8-8a2 2 0 0 1 3 0l5 5a2 2 0 0 1 0 3l-8 8H9Z" />
    <path d="M9 20 20 9" />
  </Glyph>
)

const FillIcon = (
  <Glyph>
    <path d="M5 11 12 4l7 7-7 7-7-7Z" />
    <path d="M19 15c1.5 2 2 3 2 4a2 2 0 0 1-4 0c0-1 .5-2 2-4Z" />
  </Glyph>
)

const UndoIcon = (
  <Glyph>
    <path d="M4 9h10a5 5 0 0 1 0 10H9" />
    <path d="m4 9 4-4M4 9l4 4" />
  </Glyph>
)

const ClearIcon = (
  <Glyph>
    <path d="M6 6l12 12M18 6 6 18" />
  </Glyph>
)

const TOOLS: Array<{ tool: ToolKind; label: string; icon: ReactNode }> = [
  { tool: 'pencil', label: 'Pencil', icon: PencilIcon },
  { tool: 'eraser', label: 'Eraser', icon: EraserIcon },
  { tool: 'fill', label: 'Fill bucket', icon: FillIcon },
]

export function CanvasTools({ value, onChange, onUndo, onClear, disabled = false }: CanvasToolsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3" role="toolbar" aria-label="Drawing tools">
      <div className="flex gap-2" role="group" aria-label="Tools and canvas actions">
        {TOOLS.map(({ tool, label, icon }) => (
          <IconButton
            key={tool}
            icon={icon}
            label={label}
            active={value.tool === tool}
            disabled={disabled}
            onClick={() => onChange({ ...value, tool })}
          />
        ))}
        <IconButton icon={UndoIcon} label="Undo" disabled={disabled} onClick={onUndo} />
        <IconButton icon={ClearIcon} label="Clear canvas" disabled={disabled} onClick={onClear} />
      </div>

      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Ink colors">
        {INK_PALETTE.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`Use color ${color}`}
            aria-pressed={value.color === color}
            disabled={disabled || value.tool === 'eraser'}
            className={`h-7 w-7 rounded-doodle border-2 border-ink shadow-[1px_1px_0_var(--color-ink)] disabled:opacity-35 aria-pressed:outline aria-pressed:outline-2 aria-pressed:outline-offset-2 aria-pressed:outline-accent-deep ${FOCUS_RING}`}
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
