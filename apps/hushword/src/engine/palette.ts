import { createRng, hashSeed } from './rng'

/**
 * The ink: three colours, what they mean, and how far apart they sit.
 *
 * This is where Hushword stops being Wordle with a longer word. The three
 * feedback colours are data, so the brand owns none of them — and the setter
 * owns all three, including the right to shuffle which one means what.
 *
 * Two hard rules live here, and both were found by writing this file rather
 * than by drawing the screens:
 *
 * 1. A letter colour is chosen against its own ink, never once for the board.
 *    White on the house amber is 2.3:1 and fails; near-black on the same amber
 *    is 7.9:1 and passes. Because the palette is per link, this is load-bearing
 *    rather than cosmetic.
 * 2. A scrambled code with no key and no worked example is a coin flip, not a
 *    puzzle. Below a separation floor the generator refuses an untaught code.
 */

export type Role = 'exact' | 'shifted' | 'absent'

export const ROLES: readonly Role[] = ['exact', 'shifted', 'absent']

/** role -> hex, before any shuffling. */
export type RoleInk = Readonly<Record<Role, string>>

export const LIGHT_LETTER = '#FFFFFF'
export const DARK_LETTER = '#14161A'

/** The house ink is the arcade default: a mid green, a warm amber, a slate. */
export const HOUSE_INK: RoleInk = { exact: '#1F8A55', shifted: '#D9A21A', absent: '#333A4D' }

/** Below this, `hidden` is refused outright. */
export const SEPARATION_FLOOR = 0.1
/** Above this, two inks are unmistakably different. */
export const LEGIBLE_SEPARATION = 0.15
/**
 * The letter floor is the *large text* threshold, not the small one.
 *
 * A tile letter is 30px and bold by construction, so 3:1 is what WCAG asks of
 * it. Holding it to 4.5:1 would have rejected the house green at 4.35:1 — and
 * across every possible colour, the best of a light and a dark letter tops out
 * at about 4.27:1, so a 4.5 floor would have condemned a narrow band for no
 * operational reason. The 4.5 target is still measured and reported as advice,
 * because the on-screen keyboard reuses the same ink at a smaller size.
 */
export const LETTER_CONTRAST_FLOOR = 3
export const LETTER_CONTRAST_TARGET = 4.5

export interface Rgb {
  r: number
  g: number
  b: number
}

export function hexToRgb(hex: string): Rgb {
  const clean = hex.replace('#', '').trim()
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`not a colour: ${hex}`)
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  }
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const part = (value: number) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')
  return `#${part(r)}${part(g)}${part(b)}`.toUpperCase()
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex)
  const channel = (value: number) => {
    const scaled = value / 255
    return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const light = Math.max(la, lb)
  const dark = Math.min(la, lb)
  return (light + 0.05) / (dark + 0.05)
}

/** Rule 1: the letter is chosen against its own ink, whichever side wins. */
export function readableLetter(colour: string): string {
  return contrastRatio(colour, LIGHT_LETTER) >= contrastRatio(colour, DARK_LETTER) ? LIGHT_LETTER : DARK_LETTER
}

export function letterContrast(colour: string): number {
  return contrastRatio(colour, readableLetter(colour))
}

/**
 * Deuteranopia, Machado et al.'s matrix applied straight to the 0-255 values.
 *
 * Applying it in linear light would be more correct and would also make the
 * numbers here disagree with every design tool a person is likely to check
 * against. Consistency with what a designer sees on screen wins, and the
 * approximation is documented rather than hidden.
 */
const CVD = [
  [0.367322, 0.860646, -0.227968],
  [0.280085, 0.672501, 0.047413],
  [-0.01182, 0.04294, 0.968881],
] as const

export function simulateDeuteranopia(hex: string): string {
  const { r, g, b } = hexToRgb(hex)
  const mix = (row: readonly number[]) => row[0] * r + row[1] * g + row[2] * b
  return rgbToHex({ r: mix(CVD[0]), g: mix(CVD[1]), b: mix(CVD[2]) })
}

const MAX_DISTANCE = Math.sqrt(3) * 255

/**
 * How far apart two inks are, to someone reading the board.
 *
 * Half lightness, half colour-vision-deficiency distance. Lightness matters
 * because that is the channel deuteranopes keep; the simulated distance matters
 * because it is the channel everyone else reads first. Neither alone predicted
 * whether a board was playable.
 */
export function separation(a: string, b: string): number {
  const lightness = Math.abs(relativeLuminance(a) - relativeLuminance(b))
  const ca = hexToRgb(simulateDeuteranopia(a))
  const cb = hexToRgb(simulateDeuteranopia(b))
  const distance =
    Math.sqrt((ca.r - cb.r) ** 2 + (ca.g - cb.g) ** 2 + (ca.b - cb.b) ** 2) / MAX_DISTANCE
  return 0.5 * lightness + 0.5 * distance
}

export interface PairReport {
  readonly a: Role
  readonly b: Role
  readonly separation: number
  readonly ok: boolean
}

export type Verdict = 'clear' | 'tight' | 'collapsed'

export interface PaletteReport {
  readonly pairs: readonly PairReport[]
  readonly min: number
  readonly verdict: Verdict
}

export function inspectPalette(ink: RoleInk): PaletteReport {
  const pairs: PairReport[] = []
  for (let i = 0; i < ROLES.length; i += 1) {
    for (let j = i + 1; j < ROLES.length; j += 1) {
      const value = separation(ink[ROLES[i]], ink[ROLES[j]])
      pairs.push({ a: ROLES[i], b: ROLES[j], separation: value, ok: value >= SEPARATION_FLOOR })
    }
  }
  const min = Math.min(...pairs.map((pair) => pair.separation))
  const verdict: Verdict = min >= LEGIBLE_SEPARATION ? 'clear' : min >= SEPARATION_FLOOR ? 'tight' : 'collapsed'
  return { pairs, min, verdict }
}

/**
 * Shuffle which colour means what.
 *
 * Seeded, so the same link shows the same code to everyone, and never the
 * identity permutation — a shuffle that leaves the code as it was would be a
 * setting that does nothing.
 */
export function resolveInk(ink: RoleInk, scramble: boolean, seed: string): RoleInk {
  if (!scramble) return { ...ink }
  const colours = ROLES.map((role) => ink[role])
  const order = createRng(hashSeed(`ink:${seed}`)).shuffle([0, 1, 2])
  if (order.every((value, index) => value === index)) order.push(order.shift() as number)
  const out = {} as Record<Role, string>
  ROLES.forEach((role, index) => {
    out[role] = colours[order[index]]
  })
  return out
}

export type Intensity = 'clear' | 'crisp' | 'tricky' | 'cruel'

export interface Preset {
  readonly intensity: Intensity
  readonly label: string
  readonly ink: RoleInk
  readonly scramble: boolean
  readonly blurb: string
}

export const PRESETS: readonly Preset[] = [
  {
    intensity: 'clear',
    label: 'Clear',
    ink: HOUSE_INK,
    scramble: false,
    blurb: 'House ink, meanings where you expect them.',
  },
  {
    intensity: 'crisp',
    label: 'Crisp',
    ink: { exact: '#D9A21A', shifted: '#1F8A55', absent: '#333A4D' },
    scramble: true,
    blurb: 'House hues, meanings shuffled.',
  },
  {
    intensity: 'tricky',
    label: 'Tricky',
    ink: { exact: '#1F8A55', shifted: '#3E9A66', absent: '#333A4D' },
    scramble: false,
    blurb: 'Two of the three pulled into the same family.',
  },
  {
    intensity: 'cruel',
    label: 'Cruel',
    ink: { exact: '#1F8A55', shifted: '#2A7070', absent: '#2A5B6B' },
    scramble: false,
    blurb: 'Three inks that read as one. The map is your only friend.',
  },
]

export function presetFor(intensity: Intensity): Preset {
  const found = PRESETS.find((preset) => preset.intensity === intensity)
  if (!found) throw new Error(`unknown intensity: ${intensity}`)
  return found
}

export type Legend = 'shown' | 'example' | 'hidden'

export interface InkProblem {
  readonly kind: 'duplicate' | 'illegible' | 'needsLegend'
  readonly message: string
}

export interface InkCheck {
  readonly report: PaletteReport
  readonly problems: readonly InkProblem[]
  /** Worth telling the setter, not worth blocking them. */
  readonly advice: readonly InkProblem[]
  /** True when nothing stands in the way of building the link. */
  readonly ok: boolean
}

export function checkInk(src: RoleInk, options: { scramble: boolean; legend: Legend; seed: string }): InkCheck {
  const ink = resolveInk(src, options.scramble, options.seed)
  const report = inspectPalette(ink)
  const problems: InkProblem[] = []
  const advice: InkProblem[] = []

  for (const role of ROLES) {
    const value = letterContrast(ink[role])
    if (value < LETTER_CONTRAST_FLOOR) {
      problems.push({
        kind: 'illegible',
        message: `the letter on ${role} reads at ${value.toFixed(2)}:1 — move that colour lighter or darker`,
      })
    } else if (value < LETTER_CONTRAST_TARGET) {
      advice.push({
        kind: 'illegible',
        message: `${role} reads at ${value.toFixed(2)}:1 against its own letter — fine on a tile, thin on the keyboard`,
      })
    }
  }

  if (new Set(ROLES.map((role) => ink[role].toUpperCase())).size < ROLES.length) {
    problems.push({ kind: 'duplicate', message: 'two roles share a colour, so the board cannot tell them apart' })
  }

  if (options.legend === 'hidden' && report.min < SEPARATION_FLOOR) {
    problems.push({
      kind: 'needsLegend',
      message: `separation is ${report.min.toFixed(2)} — an untaught code that tight is a coin flip, not a puzzle`,
    })
  }

  return { report, problems, advice, ok: problems.length === 0 }
}

/**
 * What an untaught code costs, in guesses.
 *
 * This is a model, not a measurement, and it is labelled as one. Measured
 * guess counts are identical whether or not the code is taught — the
 * information content does not change, only whether the solver can read it.
 * So the cost is a read cost that appears only when nobody teaches the code,
 * and it grows as the inks crowd each other.
 */
export function readCost(minSeparation: number, legend: Legend): number {
  if (legend !== 'hidden') return 0
  // Nobody teaches the code, so working out the mapping costs something before
  // the first guess is even informative.
  const learn = 0.5
  const crowded = Math.max(0, LEGIBLE_SEPARATION - minSeparation)
  return learn + Math.min(1.2, crowded * 6)
}
