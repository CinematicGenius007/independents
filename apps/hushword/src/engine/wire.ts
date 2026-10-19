import type { ClockMode, Posture } from './game'
import { hexToRgb, rgbToHex, type Intensity, type Legend, type RoleInk } from './palette'
import type { PatternKind, RedactionConfig, RedactionMode } from './redaction'
import type { Lexicon } from './rules'

/**
 * The wire format.
 *
 * The JSON version was 273 characters for a sealed link, and its keys cost more
 * than the answer did. This is the same information in bits, which takes it to
 * about 120 — and, more usefully, it is the place where the *shape* of a link is
 * stated rather than implied by whichever fields happened to be set.
 *
 * Three fields are never merely optional here, they are absent by design:
 *
 * - the answer, unless the posture is `open`
 * - the nonce, unless the posture is `open`. A commitment whose nonce travels
 *   beside it is not a commitment: with a curated answer list you can hash every
 *   candidate and read the answer off. The nonce is the secret, and it is the
 *   reason `sealed` is worth anything.
 * - the commitment, when the posture is `vault`. A commitment over the plaintext
 *   of an encrypted link is a dictionary attack against the ciphertext, and the
 *   HMAC tag already does that job properly.
 */

export const WIRE_VERSION = 1

/** How a packed string announces its own length. See `writeString`. */
const STRING_BITS = 6
const STRING_LIMIT = (1 << STRING_BITS) - 1

export interface WireConfig {
  readonly seed: string
  readonly length: number
  readonly rows: number
  readonly hard: boolean
  readonly intensity: Intensity
  /** The three colours, when the setter overrode the preset. */
  readonly ink?: RoleInk
  readonly scramble: boolean
  readonly legend: Legend
  readonly redaction: RedactionConfig
  readonly lifts: number
  readonly hints: number
  readonly clock: ClockMode
  readonly minutes: number
  readonly keyHeat: boolean
  readonly lexicon: Lexicon
}

export interface WireContent {
  readonly config: WireConfig
  readonly posture: Posture
  readonly answer?: string
  readonly nonce?: string
  readonly commitment?: string
  /** The solver's guesses, in order. Only a reveal carries them. */
  readonly guesses?: readonly string[]
  readonly vault?: {
    readonly salt: Uint8Array
    readonly nonce: Uint8Array
    readonly ciphertext: Uint8Array
    readonly tag: Uint8Array
  }
}

class BitWriter {
  private readonly out: number[] = []
  private current = 0
  private used = 0

  write(value: number, bits: number): void {
    for (let i = bits - 1; i >= 0; i -= 1) {
      this.current = (this.current << 1) | ((value >> i) & 1)
      this.used += 1
      if (this.used === 8) {
        this.out.push(this.current & 0xff)
        this.current = 0
        this.used = 0
      }
    }
  }

  writeBytes(bytes: Uint8Array): void {
    for (const byte of bytes) this.write(byte, 8)
  }

  writeString(text: string): void {
    const bytes = new TextEncoder().encode(text)
    // Six bits, because a nonce is 32 characters and five bits only reaches 31.
    // The guard is the point: the first version of this wrote the low five bits
    // of 32, which is zero, and every reveal silently decoded to nothing.
    if (bytes.length > STRING_LIMIT) {
      throw new Error(`cannot pack a ${bytes.length}-byte string; the limit is ${STRING_LIMIT}`)
    }
    this.write(bytes.length, STRING_BITS)
    this.writeBytes(bytes)
  }

  /** Five bits a letter: a-z is 26 values, and a word is never 32 letters long. */
  writeWord(word: string): void {
    for (const letter of word) this.write(letter.charCodeAt(0) - 97, 5)
  }

  finish(): Uint8Array {
    if (this.used > 0) {
      this.out.push((this.current << (8 - this.used)) & 0xff)
      this.current = 0
      this.used = 0
    }
    return Uint8Array.from(this.out)
  }
}

class BitReader {
  private bytes: Uint8Array
  private index = 0

  constructor(bytes: Uint8Array) {
    this.bytes = bytes
  }

  read(bits: number): number {
    let value = 0
    for (let i = 0; i < bits; i += 1) {
      const byte = this.bytes[this.index >> 3] ?? 0
      const bit = (byte >> (7 - (this.index & 7))) & 1
      value = (value << 1) | bit
      this.index += 1
    }
    return value
  }

  readBytes(count: number): Uint8Array {
    const out = new Uint8Array(count)
    for (let i = 0; i < count; i += 1) out[i] = this.read(8)
    return out
  }

  readString(): string {
    const length = this.read(STRING_BITS)
    return new TextDecoder().decode(this.readBytes(length))
  }

  readWord(length: number): string {
    let out = ''
    for (let i = 0; i < length; i += 1) out += String.fromCharCode(97 + this.read(5))
    return out
  }
}

const INTENSITIES: readonly Intensity[] = ['clear', 'crisp', 'tricky', 'cruel']
const LEGENDS: readonly Legend[] = ['shown', 'example', 'hidden']
const CLOCKS: readonly ClockMode[] = ['off', 'up', 'down']
const POSTURES: readonly Posture[] = ['open', 'sealed', 'vault', 'reveal']
const MODES: readonly RedactionMode[] = ['off', 'open', 'pattern', 'closed']
const KINDS: readonly PatternKind[] = ['leading', 'alternate']

const indexOf = <T>(list: readonly T[], value: T): number => {
  const index = list.indexOf(value)
  if (index < 0) throw new Error(`cannot pack ${String(value)}`)
  return index
}

export function pack(content: WireContent): Uint8Array {
  const { config: c } = content
  const writer = new BitWriter()

  writer.write(WIRE_VERSION, 3)
  writer.write(c.length - 3, 4)
  writer.write(c.rows - 3, 4)
  writer.write(c.hard ? 1 : 0, 1)
  writer.write(indexOf(POSTURES, content.posture), 2)
  writer.write(indexOf(INTENSITIES, c.intensity), 2)
  writer.write(c.scramble ? 1 : 0, 1)
  writer.write(indexOf(LEGENDS, c.legend), 2)
  writer.write(c.lexicon === 'free' ? 1 : 0, 1)
  writer.write(c.lifts, 4)
  writer.write(c.hints, 4)
  writer.write(indexOf(CLOCKS, c.clock), 2)
  writer.write(c.minutes, 6)
  writer.write(c.keyHeat ? 1 : 0, 1)

  const redaction = c.redaction
  writer.write(indexOf(MODES, redaction.mode), 2)
  const pattern = redaction.pattern
  writer.write(pattern && pattern.kind === 'alternate' ? 1 : 0, 1)
  writer.write(pattern?.count ?? 4, 4)
  writer.write(pattern?.fromRow ?? 3, 4)
  writer.write(redaction.shear ? 1 : 0, 1)
  writer.write(redaction.decoy ? 1 : 0, 1)

  if (redaction.mode === 'open') {
    const rows = redaction.explicit ?? []
    for (let row = 0; row < c.rows; row += 1) {
      for (let cell = 0; cell < c.length; cell += 1) {
        writer.write(rows[row]?.[cell] === true ? 1 : 0, 1)
      }
    }
  }

  // Three colours at eight bits a channel, only when they were chosen by hand.
  writer.write(c.ink ? 1 : 0, 1)
  if (c.ink) {
    for (const role of ['exact', 'shifted', 'absent'] as const) {
      const rgb = hexToRgb(c.ink[role])
      writer.write(rgb.r, 8)
      writer.write(rgb.g, 8)
      writer.write(rgb.b, 8)
    }
  }

  writer.writeString(c.seed)

  if ((content.posture === 'open' || content.posture === 'reveal') && content.answer) {
    writer.writeWord(content.answer)
  }

  if (content.nonce !== undefined) {
    writer.write(1, 1)
    writer.writeString(content.nonce)
  } else {
    writer.write(0, 1)
  }

  if (content.posture === 'reveal') {
    const words = content.guesses ?? []
    writer.write(words.length, 4)
    for (const word of words) writer.writeWord(word)
  }

  if (content.vault) {
    writer.writeBytes(content.vault.salt)
    writer.writeBytes(content.vault.nonce)
    writer.write(content.vault.ciphertext.length, 5)
    writer.writeBytes(content.vault.ciphertext)
    writer.writeBytes(content.vault.tag)
  }

  if (content.commitment) {
    writer.write(1, 1)
    writer.writeBytes(hexToBytes(content.commitment))
  } else {
    writer.write(0, 1)
  }

  return writer.finish()
}

export function unpack(bytes: Uint8Array): WireContent {
  const reader = new BitReader(bytes)
  const version = reader.read(3)
  if (version !== WIRE_VERSION) throw new Error(`link version ${version} is not readable here`)

  const length = reader.read(4) + 3
  const rows = reader.read(4) + 3
  const hard = reader.read(1) === 1
  const posture = POSTURES[reader.read(2)]
  const intensity = INTENSITIES[reader.read(2)]
  const scramble = reader.read(1) === 1
  const legend = LEGENDS[reader.read(2)]
  const lexicon: Lexicon = reader.read(1) === 1 ? 'free' : 'strict'
  const lifts = reader.read(4)
  const hints = reader.read(4)
  const clock = CLOCKS[reader.read(2)]
  const minutes = reader.read(6)
  const keyHeat = reader.read(1) === 1

  const mode = MODES[reader.read(2)]
  const kind = KINDS[reader.read(1)]
  const count = reader.read(4)
  const fromRow = reader.read(4)
  const shear = reader.read(1) === 1
  const decoy = reader.read(1) === 1

  let explicit: boolean[][] | undefined
  if (mode === 'open') {
    explicit = []
    for (let row = 0; row < rows; row += 1) {
      const line: boolean[] = []
      for (let cell = 0; cell < length; cell += 1) line.push(reader.read(1) === 1)
      explicit.push(line)
    }
  }

  const hasInk = reader.read(1) === 1
  let ink: RoleInk | undefined
  if (hasInk) {
    const read = () => rgbToHex({ r: reader.read(8), g: reader.read(8), b: reader.read(8) })
    ink = { exact: read(), shifted: read(), absent: read() }
  }

  const seed = reader.readString()
  const answer = posture === 'open' || posture === 'reveal' ? reader.readWord(length) : undefined
  const hasNonce = reader.read(1) === 1
  const nonce = hasNonce ? reader.readString() : undefined

  let guesses: string[] | undefined
  if (posture === 'reveal') {
    const count = reader.read(4)
    guesses = []
    for (let i = 0; i < count; i += 1) guesses.push(reader.readWord(length))
  }

  let vault: WireContent['vault']
  if (posture === 'vault') {
    const salt = reader.readBytes(16)
    const vaultNonce = reader.readBytes(12)
    const cipherLength = reader.read(5)
    const ciphertext = reader.readBytes(cipherLength)
    const tag = reader.readBytes(32)
    vault = { salt, nonce: vaultNonce, ciphertext, tag }
  }

  const hasCommitment = reader.read(1) === 1
  const commitment = hasCommitment ? bytesToHex(reader.readBytes(32)) : undefined

  const redaction: RedactionConfig =
    mode === 'open'
      ? { mode, explicit }
      : mode === 'off'
        ? { mode }
        : {
            mode,
            pattern: { kind, count, fromRow },
            ...(shear ? { shear: true } : {}),
            ...(decoy ? { decoy: true } : {}),
          }

  return {
    config: { seed, length, rows, hard, intensity, ink, scramble, legend, redaction, lifts, hints, clock, minutes, keyHeat, lexicon },
    posture,
    answer,
    nonce,
    commitment,
    guesses,
    vault,
  }
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i += 1) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0')
  return out
}
