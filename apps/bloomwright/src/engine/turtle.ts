/**
 * The drawing half of the game: an expanded string walked by a turtle.
 *
 * Output is normalised into the unit square, so the player never has to fight
 * scale or position. Only the *shape* a grammar makes is ever compared.
 */

export interface Segment {
  readonly x1: number
  readonly y1: number
  readonly x2: number
  readonly y2: number
  /** Depth in the bracket stack, used to taper branches when drawing. */
  readonly depth: number
}

export interface Drawing {
  readonly segments: readonly Segment[]
  readonly truncated: boolean
}

export const MAX_SEGMENTS = 20_000

export function walk(text: string, angleDegrees: number): Drawing {
  const turn = (angleDegrees * Math.PI) / 180
  const segments: Segment[] = []
  const stack: { x: number; y: number; heading: number; depth: number }[] = []

  let x = 0
  let y = 0
  let heading = -Math.PI / 2 // start pointing up
  let depth = 0
  let truncated = false

  for (const symbol of text) {
    switch (symbol) {
      case 'F':
      case 'G': {
        const nx = x + Math.cos(heading)
        const ny = y + Math.sin(heading)
        if (symbol === 'F') {
          if (segments.length >= MAX_SEGMENTS) {
            truncated = true
          } else {
            segments.push({ x1: x, y1: y, x2: nx, y2: ny, depth })
          }
        }
        x = nx
        y = ny
        break
      }
      case '+':
        heading -= turn
        break
      case '-':
        heading += turn
        break
      case '[':
        stack.push({ x, y, heading, depth })
        depth += 1
        break
      case ']': {
        const saved = stack.pop()
        if (saved) {
          x = saved.x
          y = saved.y
          heading = saved.heading
          depth = saved.depth
        }
        break
      }
      default:
        break
    }
    if (truncated) break
  }

  return { segments: normalize(segments), truncated }
}

/** Fit the drawing into the unit square, preserving aspect ratio. */
function normalize(segments: Segment[]): Segment[] {
  if (segments.length === 0) return segments

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const segment of segments) {
    minX = Math.min(minX, segment.x1, segment.x2)
    maxX = Math.max(maxX, segment.x1, segment.x2)
    minY = Math.min(minY, segment.y1, segment.y2)
    maxY = Math.max(maxY, segment.y1, segment.y2)
  }

  const spanX = maxX - minX
  const spanY = maxY - minY
  const span = Math.max(spanX, spanY, 1e-9)
  const offsetX = (span - spanX) / 2
  const offsetY = (span - spanY) / 2

  return segments.map((segment) => ({
    x1: (segment.x1 - minX + offsetX) / span,
    y1: (segment.y1 - minY + offsetY) / span,
    x2: (segment.x2 - minX + offsetX) / span,
    y2: (segment.y2 - minY + offsetY) / span,
    depth: segment.depth,
  }))
}
