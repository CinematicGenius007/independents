/**
 * The result card: drawn in the browser, shared from the browser.
 *
 * Nothing here talks to a server. The card is painted on a canvas from the
 * final position, turned into a PNG, and handed to the system share sheet
 * where files can be shared, or downloaded where they cannot.
 */

import type { GameState, Player } from './game'

const C = {
  bg: '#0B0D10',
  panel: '#14181D',
  line: '#2A3038',
  text: '#E8E6DF',
  dim: '#8A919B',
  signal: '#FF5A36',
  x: '#7FD6E8',
}

const HEADING = '"Space Grotesk Variable", "Space Grotesk", system-ui, sans-serif'
const MONO = '"JetBrains Mono", ui-monospace, monospace'

export interface CardDetails {
  state: GameState
  /** Headline, e.g. "Ayush took the diagonal." */
  title: string
  /** Small label above it, e.g. "X WINS · 41 MOVES". */
  eyebrow: string
  number: string
}

function mark(ctx: CanvasRenderingContext2D, p: Player, cx: number, cy: number, r: number, width: number, alpha = 1) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.strokeStyle = p === 'X' ? C.x : C.text
  ctx.beginPath()
  if (p === 'X') {
    ctx.moveTo(cx - r, cy - r)
    ctx.lineTo(cx + r, cy + r)
    ctx.moveTo(cx + r, cy - r)
    ctx.lineTo(cx - r, cy + r)
  } else {
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
  }
  ctx.stroke()
  ctx.restore()
}

function drawBoard(ctx: CanvasRenderingContext2D, state: GameState, x0: number, y0: number, size: number) {
  const gap = size * 0.04
  const small = (size - gap * 2) / 3
  const cell = small / 3
  for (let b = 0; b < 9; b++) {
    const bx = x0 + (b % 3) * (small + gap)
    const by = y0 + Math.floor(b / 3) * (small + gap)
    const won = state.boardWinners[b]

    ctx.save()
    ctx.globalAlpha = won ? 0.22 : 1
    ctx.strokeStyle = C.line
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let i = 1; i < 3; i++) {
      ctx.moveTo(bx + i * cell, by + cell * 0.1)
      ctx.lineTo(bx + i * cell, by + small - cell * 0.1)
      ctx.moveTo(bx + cell * 0.1, by + i * cell)
      ctx.lineTo(bx + small - cell * 0.1, by + i * cell)
    }
    ctx.stroke()
    for (let c = 0; c < 9; c++) {
      const v = state.boards[b][c]
      if (v) mark(ctx, v, bx + (c % 3) * cell + cell / 2, by + Math.floor(c / 3) * cell + cell / 2, cell * 0.22, 3)
    }
    ctx.restore()

    if (won && won !== 'tie') mark(ctx, won, bx + small / 2, by + small / 2, small * 0.3, 9)
  }
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word
    if (line && ctx.measureText(test).width > maxWidth) {
      lines.push(line)
      line = word
    } else line = test
  }
  if (line) lines.push(line)
  return lines
}

export async function renderResultCard(details: CardDetails): Promise<Blob> {
  try {
    await Promise.all([document.fonts.load(`700 60px ${HEADING}`), document.fonts.load(`500 22px ${MONO}`)])
  } catch {
    // fall back to system fonts rather than fail to share
  }
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 630
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, 1200, 630)
  ctx.fillStyle = C.panel
  ctx.fillRect(40, 40, 1120, 550)
  ctx.strokeStyle = C.line
  ctx.lineWidth = 2
  ctx.strokeRect(40, 40, 1120, 550)

  drawBoard(ctx, details.state, 80, 75, 480)

  const left = 640
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = C.x
  ctx.font = `500 22px ${MONO}`
  ctx.fillText(details.eyebrow.toUpperCase(), left, 130)

  ctx.fillStyle = C.text
  ctx.font = `700 60px ${HEADING}`
  wrap(ctx, details.title, 480).slice(0, 4).forEach((line, i) => ctx.fillText(line, left, 215 + i * 68))

  ctx.fillStyle = C.signal
  ctx.fillRect(left, 480, 44, 4)
  ctx.fillStyle = C.dim
  ctx.font = `500 22px ${MONO}`
  ctx.fillText('MATCH NUMBER', left, 525)
  ctx.fillStyle = C.text
  ctx.font = `500 34px ${MONO}`
  ctx.fillText(`#${details.number}`, left + 210, 527)
  ctx.fillStyle = C.dim
  ctx.font = `500 20px ${MONO}`
  ctx.fillText('ULTIMATE TTT', left, 564)

  return new Promise((resolve, reject) =>
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Could not draw the card.'))), 'image/png'),
  )
}

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled'

/** Shares the card and link, or downloads the card when the browser cannot share files. */
export async function shareResult(card: Blob, text: string, url: string, filename: string): Promise<ShareOutcome> {
  const file = new File([card], filename, { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text, url })
      return 'shared'
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled'
    }
  }
  const href = URL.createObjectURL(card)
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(href), 1000)
  return 'downloaded'
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
