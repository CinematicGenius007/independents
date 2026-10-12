/**
 * The Astral tile motifs: one line-drawn sign per glaze, built on a single
 * construction grid in a 24-unit box centred on (12, 12).
 *
 * Every motif is strokes, not fills: a main weight (1.15) in near-white ink,
 * a hairline weight (0.55) for inner echoes, and a few filled satellite dots.
 * The skeletons are the signs from the Paper glaze key — quatrefoil rings,
 * compass star, rose diamond, chevrons, waves — each given one more detail
 * than the key: a centre dot, an inner echo, a pair of flanking studs.
 *
 * A motif is data ({@link GlazeMotif}), rendered solid on a fired tile and
 * dotted on an empty wall space, so the wall always says what belongs where.
 */

export type GlazeKind = 'cobalt' | 'saffron' | 'crimson' | 'basalt' | 'verdigris'

export interface MotifDot {
  x: number
  y: number
  r: number
}

export interface GlazeMotif {
  /** Main-weight strokes. */
  main: string[]
  /** Hairline inner echoes. */
  hair: string[]
  /** Filled satellite dots. */
  dots: MotifDot[]
}

const C = 12
const RING = 3.3
const OFF = 3.4

function ring(cx: number, cy: number, r: number): string {
  const f = (n: number) => n.toFixed(2)
  return `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`
}

/** A four-pointed compass star: tips at radius `tip`, waist pinched to `waist`. */
function star(tip: number, waist: number): string {
  const f = (n: number) => n.toFixed(2)
  const p: Array<[number, number]> = [
    [C, C - tip],
    [C + waist, C - waist],
    [C + tip, C],
    [C + waist, C + waist],
    [C, C + tip],
    [C - waist, C + waist],
    [C - tip, C],
    [C - waist, C - waist],
  ]
  return `M${p.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z`
}

/** A diamond (square on point) centred on (x, y), `h` from centre to each point. */
function diamond(x: number, y: number, h: number): string {
  const f = (n: number) => n.toFixed(2)
  return `M${f(x)} ${f(y - h)}L${f(x + h)} ${f(y)}L${f(x)} ${f(y + h)}L${f(x - h)} ${f(y)}Z`
}

/** One wave of the verdigris pair, centred on height `y`: crest-to-crest 15.6 wide. */
function wave(y: number): string {
  const f = (n: number) => n.toFixed(2)
  return `M${f(3.8)} ${f(y)}c2.6 0 2.6-3.1 5.2-3.1s2.6 3.1 5.2 3.1s2.6-3.1 5.2-3.1`
}

const CHEVRONS = ['M5 9.4L12 5.2L19 9.4', 'M5 14.3L12 10.1L19 14.3', 'M5 19.2L12 15L19 19.2']

/** The five signs, each on the shared grid. */
export function glazeMotif(kind: GlazeKind): GlazeMotif {
  switch (kind) {
    case 'cobalt':
      // orbit rings: four rings round the cardinals, a stud at the heart,
      // and four micro-studs on the diagonals between the rings
      return {
        main: [
          ring(C, C - OFF, RING),
          ring(C, C + OFF, RING),
          ring(C - OFF, C, RING),
          ring(C + OFF, C, RING),
        ],
        hair: [],
        dots: [
          { x: C, y: C, r: 0.9 },
          { x: C - 4.2, y: C - 4.2, r: 0.55 },
          { x: C + 4.2, y: C - 4.2, r: 0.55 },
          { x: C - 4.2, y: C + 4.2, r: 0.55 },
          { x: C + 4.2, y: C + 4.2, r: 0.55 },
        ],
      }
    case 'saffron':
      // compass star, with a hairline diamond echoing it inside
      return {
        main: [star(8.6, 1.9)],
        hair: [diamond(C, C, 3.2)],
        dots: [{ x: C, y: C, r: 0.9 }],
      }
    case 'crimson':
      // rose diamond: outline, heart-ring, stud, and a hairline echo outside
      return {
        main: [diamond(C, C, 8.2), ring(C, C, 2.5)],
        hair: [diamond(C, C, 9.7)],
        dots: [{ x: C, y: C, r: 0.9 }],
      }
    case 'basalt':
      // three chevrons, studded either side like rivets
      return {
        main: CHEVRONS,
        hair: [],
        dots: [
          { x: 3.2, y: C, r: 0.8 },
          { x: 20.8, y: C, r: 0.8 },
        ],
      }
    case 'verdigris':
      // two waves, with a bubble stud riding the trough between them
      return {
        main: [wave(15.4), wave(10.2)],
        hair: [],
        dots: [{ x: C, y: 11.7, r: 0.85 }],
      }
  }
}

// ------------------------------------------------------ starting-player tile

/** Hairline instrument ring for the marker plate, with ticks at N/E/S/W. */
export function markerDial(): { rings: string[]; ticks: string[] } {
  const f = (n: number) => n.toFixed(2)
  const ticks: string[] = []
  for (const [dx, dy] of [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ]) {
    ticks.push(
      `M${f(C + dx * 8.2)} ${f(C + dy * 8.2)}L${f(C + dx * 9.4)} ${f(C + dy * 9.4)}`,
    )
  }
  return { rings: [ring(C, C, 8.2)], ticks }
}
