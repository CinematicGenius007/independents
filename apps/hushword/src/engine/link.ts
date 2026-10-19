import { fromBase64Url, toBase64Url } from './bytes'
import { openVault, sealVault, vaultKey, VAULT_ITERATIONS, type Vault } from './chacha'
import type { GameConfig, Posture } from './game'
import { bytesToHex, sha256, utf8 } from './sha256'
import { pack, unpack, type WireContent } from './wire'

/**
 * The link, and what it is allowed to contain.
 *
 * The honest constraint, stated once and relied on everywhere below: if a
 * browser can grade a guess instantly, it is holding the answer, and a key in
 * the link would be sitting next to the ciphertext. Encryption cannot fix that.
 * So Hushword ships three postures instead of pretending, and only one of them
 * encrypts anything:
 *
 *   open    the answer rides in the URL fragment. Fragments are never sent to a
 *           server, so no host, log or CDN sees the word — but it is not a
 *           secret from the solver, and the app says so.
 *   sealed  the fragment carries a commitment and nothing else. The word and the
 *           nonce stay with the setter; the solver plays and sends their guesses
 *           back, and the setter grades them and publishes the reveal.
 *   vault   the answer is sealed under a passphrase with ChaCha20 and an
 *           HMAC-SHA-256 tag. The link on its own is inert.
 *
 * Two things the first version got wrong, both found by writing the packed
 * format and having to say out loud what each field was for:
 *
 * 1. **A sealed link with the nonce beside the commitment is not sealed.** The
 *    commitment is `SHA-256(config ‖ answer ‖ nonce)`. With a curated answer pool
 *    of a few hundred words, anybody holding the link and the nonce can hash
 *    every candidate and read the answer off in milliseconds. The nonce is the
 *    secret; it is generated at 128 bits, it never travels in a sealed link, and
 *    there is a test that brute-forces the link to prove it.
 * 2. **A vaulted link with a commitment over the plaintext is not encrypted.**
 *    Same attack, and the HMAC tag already authenticates the ciphertext properly.
 *    A vault carries no commitment at all.
 *
 * The nonce is not a detail of the commitment scheme, it *is* the scheme.
 */

export const LINK_VERSION = 1

export interface VaultWire {
  readonly salt: string
  readonly nonce: string
  readonly ciphertext: string
  readonly tag: string
}

export interface SharePayload {
  readonly config: GameConfig
  readonly posture: Posture
  /** Present for `open` and `sealed`; absent for `vault`, where the tag covers it. */
  readonly commitment?: string
  /** Present only alongside an answer, where it hides nothing. */
  readonly nonce?: string
  /** Present in `open` only. */
  readonly answer?: string
  /** Present in a reveal only: what the solver guessed, in order. */
  readonly guesses?: readonly string[]
  /** Present in `vault` only. */
  readonly vault?: VaultWire
}

/** What the setter keeps and publishes later. Never in a sealed or vaulted link. */
export interface Reveal {
  readonly answer: string
  readonly nonce: string
}

export interface BuiltLink {
  readonly payload: SharePayload
  readonly fragment: string
  /** True when the fragment would let anyone read the answer without playing. */
  readonly revealsAnswer: boolean
  readonly secret: Reveal
}

/**
 * The commitment covers everything that decides the puzzle, not just the word.
 * A setter who changes the row count after the fact breaks the seal exactly as
 * loudly as one who changes the answer.
 */
export function commitmentFor(answer: string, config: GameConfig, nonce: string): string {
  const canonical = [
    LINK_VERSION,
    config.seed,
    config.length,
    config.rows,
    config.hard ? 1 : 0,
    config.intensity,
    config.scramble ? 1 : 0,
    config.legend,
    // The three colours decide how readable the board is, so they are part of
    // what the seal covers: a setter who swaps them after the fact breaks it.
    config.ink ? `${config.ink.exact}:${config.ink.shifted}:${config.ink.absent}` : '-',
    config.redaction.mode,
    config.redaction.pattern
      ? `${config.redaction.pattern.kind}:${config.redaction.pattern.count}:${config.redaction.pattern.fromRow}`
      : '-',
    config.redaction.shear ? 1 : 0,
    config.redaction.decoy ? 1 : 0,
    config.lifts,
    config.clock,
    config.minutes,
    config.keyHeat ? 1 : 0,
    config.lexicon,
    answer.trim().toLowerCase(),
    nonce,
  ].join('|')
  return bytesToHex(sha256(utf8(canonical)))
}

/**
 * 128 bits, because for a sealed link this is the only thing standing between a
 * curated answer list and an afternoon of hashing. A pronounceable seed would
 * have been seven thousand possibilities.
 */
export function randomNonce(): string {
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  return bytesToHex(bytes)
}

/**
 * The nonce is derived from `entropy` when one is supplied, never used directly.
 * Taking a caller's string as the secret would have made every test link's secret
 * two characters long, which is the sort of thing that ships. Truncated to the
 * same 128 bits `randomNonce` produces, so the claim holds either way.
 */
function nonceFrom(entropy?: string): string {
  return entropy === undefined ? randomNonce() : bytesToHex(sha256(utf8(`nonce:${entropy}`)).slice(0, 16))
}

export interface BuildOptions {
  readonly passphrase?: string
  /** Supply to make a link byte-for-byte reproducible, as the tests do. */
  readonly entropy?: string
  readonly iterations?: number
}

export function buildLink(config: GameConfig, answer: string, options: BuildOptions = {}): BuiltLink {
  const word = answer.trim().toLowerCase()
  const nonce = nonceFrom(options.entropy)

  if (config.posture === 'vault' && !options.passphrase) {
    throw new Error('the vault posture needs a passphrase')
  }

  const content: WireContent = {
    config: {
      seed: config.seed,
      length: config.length,
      rows: config.rows,
      hard: config.hard,
      intensity: config.intensity,
      ink: config.ink,
      scramble: config.scramble,
      legend: config.legend,
      redaction: config.redaction,
      lifts: config.lifts,
      hints: config.hints,
      clock: config.clock,
      minutes: config.minutes,
      keyHeat: config.keyHeat,
      lexicon: config.lexicon,
    },
    posture: config.posture,
  }

  let payload: SharePayload = { config, posture: config.posture }

  if (config.posture === 'open') {
    payload = { ...payload, answer: word, nonce, commitment: commitmentFor(word, config, nonce) }
  }

  if (config.posture === 'sealed') {
    // The nonce is deliberately absent. See the note at the top of this file.
    payload = { ...payload, commitment: commitmentFor(word, config, nonce) }
  }

  if (config.posture === 'vault' && options.passphrase) {
    const salt = new Uint8Array(16)
    const vaultNonce = new Uint8Array(12)
    fillRandom(salt, options.entropy === undefined ? undefined : `${options.entropy}:salt`)
    fillRandom(vaultNonce, options.entropy === undefined ? undefined : `${options.entropy}:nonce`)
    const key = vaultKey(options.passphrase, salt, options.iterations ?? VAULT_ITERATIONS)
    const sealed: Vault = sealVault(key, salt, utf8(word), vaultNonce)
    payload = {
      ...payload,
      vault: {
        salt: toBase64Url(sealed.salt),
        nonce: toBase64Url(sealed.nonce),
        ciphertext: toBase64Url(sealed.ciphertext),
        tag: toBase64Url(sealed.tag),
      },
    }
  }

  const wire: WireContent = {
    ...content,
    answer: payload.answer,
    nonce: payload.nonce,
    commitment: payload.commitment,
    guesses: payload.guesses,
    vault: payload.vault
      ? {
          salt: fromBase64Url(payload.vault.salt),
          nonce: fromBase64Url(payload.vault.nonce),
          ciphertext: fromBase64Url(payload.vault.ciphertext),
          tag: fromBase64Url(payload.vault.tag),
        }
      : undefined,
  }

  return {
    payload,
    fragment: `#${toBase64Url(pack(wire))}`,
    revealsAnswer: payload.answer !== undefined,
    secret: { answer: word, nonce },
  }
}

/**
 * The setter's side of a sealed case.
 *
 * A reveal carries the word, the nonce that was kept hidden, the commitment it
 * has to match, and the guesses that were handed back. It is the only artefact
 * that lets the solver check the setter did not simply pick a word afterwards —
 * which is the entire promise of the posture, so the reveal is the thing that
 * has to exist.
 */
export interface BuiltReveal {
  readonly fragment: string
  readonly payload: SharePayload
}

export function buildReveal(
  config: GameConfig,
  answer: string,
  nonce: string,
  guesses: readonly string[],
  commitment: string,
): BuiltReveal {
  const content: WireContent = {
    config: {
      seed: config.seed,
      length: config.length,
      rows: config.rows,
      hard: config.hard,
      intensity: config.intensity,
      ink: config.ink,
      scramble: config.scramble,
      legend: config.legend,
      redaction: config.redaction,
      lifts: config.lifts,
      hints: config.hints,
      clock: config.clock,
      minutes: config.minutes,
      keyHeat: config.keyHeat,
      lexicon: config.lexicon,
    },
    posture: 'reveal',
    answer: answer.trim().toLowerCase(),
    nonce,
    commitment,
    guesses: guesses.map((guess) => guess.trim().toLowerCase()),
  }

  return {
    fragment: `#${toBase64Url(pack(content))}`,
    payload: {
      config,
      posture: 'reveal',
      answer: content.answer,
      nonce,
      commitment,
      guesses: content.guesses,
    },
  }
}

/**
 * Sealed cases live in the browser that made them, and nowhere else.
 *
 * There is no server to hold the word, so the setter's own machine is the only
 * place it exists between sending the link and grading the receipt. That is a
 * real constraint rather than a limitation of the implementation, and the app
 * says so out loud on the screen that builds one.
 */
export interface SealedRecord {
  readonly commitment: string
  readonly config: GameConfig
  readonly answer: string
  readonly nonce: string
  readonly createdAt: number
}

const SEALED_KEY = 'hushword.sealed'

export function rememberSealed(record: SealedRecord): void {
  try {
    const existing = sealedCases().filter((entry) => entry.commitment !== record.commitment)
    window.localStorage.setItem(SEALED_KEY, JSON.stringify([record, ...existing].slice(0, 20)))
  } catch {
    // A private window can refuse storage; the reveal is still copied by hand.
  }
}

export function sealedCases(): SealedRecord[] {
  try {
    const raw = window.localStorage.getItem(SEALED_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as SealedRecord[]) : []
  } catch {
    return []
  }
}

export function forgetSealed(commitment: string): void {
  try {
    window.localStorage.setItem(SEALED_KEY, JSON.stringify(sealedCases().filter((entry) => entry.commitment !== commitment)))
  } catch {
    // Nothing to do.
  }
}

/**
 * Fill a buffer with randomness, or with a reproducible stream when `entropy` is
 * supplied so a test link can be compared byte for byte.
 */
function fillRandom(target: Uint8Array, entropy?: string): void {
  if (entropy === undefined) {
    globalThis.crypto.getRandomValues(target)
    return
  }
  let hash = sha256(utf8(`vault:${entropy}`))
  let offset = 0
  while (offset < target.length) {
    target.set(hash.subarray(0, Math.min(hash.length, target.length - offset)), offset)
    offset += hash.length
    hash = sha256(hash)
  }
}

export function decodeLink(fragment: string): SharePayload {
  const body = fragment.startsWith('#') ? fragment.slice(1) : fragment
  const content = unpack(fromBase64Url(body))

  const config: GameConfig = {
    seed: content.config.seed,
    length: content.config.length,
    rows: content.config.rows,
    hard: content.config.hard,
    intensity: content.config.intensity,
    ink: content.config.ink,
    scramble: content.config.scramble,
    legend: content.config.legend,
    redaction: content.config.redaction,
    lifts: content.config.lifts,
    hints: content.config.hints,
    clock: content.config.clock,
    minutes: content.config.minutes,
    keyHeat: content.config.keyHeat,
    lexicon: content.config.lexicon,
    posture: content.posture,
  }

  return {
    config,
    posture: content.posture,
    commitment: content.commitment,
    nonce: content.nonce,
    answer: content.answer,
    guesses: content.guesses,
    vault: content.vault
      ? {
          salt: toBase64Url(content.vault.salt),
          nonce: toBase64Url(content.vault.nonce),
          ciphertext: toBase64Url(content.vault.ciphertext),
          tag: toBase64Url(content.vault.tag),
        }
      : undefined,
  }
}

export type OpenResult =
  | { readonly kind: 'ready'; readonly config: GameConfig; readonly answer: string; readonly payload: SharePayload }
  | { readonly kind: 'sealed'; readonly config: GameConfig; readonly payload: SharePayload }
  | { readonly kind: 'locked'; readonly config: GameConfig; readonly payload: SharePayload }
  | {
      readonly kind: 'revealed'
      readonly config: GameConfig
      readonly answer: string
      readonly nonce: string
      readonly commitment?: string
      readonly guesses: readonly string[]
      readonly payload: SharePayload
    }

/**
 * Open a link. A sealed one has no answer to give — the solver plays and sends
 * their guesses back, which is the whole point of that posture. A reveal has
 * everything, and is meant to be checked rather than believed.
 */
export function openLink(fragment: string, passphrase?: string, iterations?: number): OpenResult {
  const payload = decodeLink(fragment)

  if (payload.posture === 'reveal' && payload.answer !== undefined) {
    return {
      kind: 'revealed',
      config: payload.config,
      answer: payload.answer,
      nonce: payload.nonce ?? '',
      commitment: payload.commitment,
      guesses: payload.guesses ?? [],
      payload,
    }
  }

  if (payload.answer !== undefined) {
    return { kind: 'ready', config: payload.config, answer: payload.answer, payload }
  }

  if (payload.vault && passphrase) {
    const salt = fromBase64Url(payload.vault.salt)
    const key = vaultKey(passphrase, salt, iterations ?? VAULT_ITERATIONS)
    const plain = openVault(key, {
      salt,
      nonce: fromBase64Url(payload.vault.nonce),
      ciphertext: fromBase64Url(payload.vault.ciphertext),
      tag: fromBase64Url(payload.vault.tag),
    })
    if (!plain) return { kind: 'locked', config: payload.config, payload }
    return { kind: 'ready', config: payload.config, answer: new TextDecoder().decode(plain), payload }
  }

  return { kind: 'sealed', config: payload.config, payload }
}

/**
 * Rebuild the commitment from a revealed answer and the reveal's nonce, and
 * check it against the one in the link. The verifier supplies both, because the
 * link deliberately carries neither.
 */
export function verifyCommitment(payload: SharePayload, answer: string, nonce: string): boolean {
  if (!payload.commitment) return false
  const expected = commitmentFor(answer, payload.config, nonce)
  if (expected.length !== payload.commitment.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ payload.commitment.charCodeAt(i)
  return diff === 0
}

/**
 * Would this link hand the answer to somebody who never played?
 *
 * For an `open` link the answer is packed five bits a letter, so grepping the
 * fragment for the word finds nothing and a text search is the wrong question.
 * The right question is whether the answer is *readable*, so this decodes the
 * link and compares. The raw scan stays as a second check, because a link that
 * literally contains the word in plain text is a bug worth catching even when
 * the decoded answer is absent.
 */
export function leaksAnswer(fragment: string, answer: string): boolean {
  const word = answer.trim().toLowerCase()
  const body = fragment.startsWith('#') ? fragment.slice(1) : fragment

  if (body.toLowerCase().includes(word)) return true
  if (body.toLowerCase().includes(toBase64Url(utf8(word)).toLowerCase())) return true

  try {
    const decoded = new TextDecoder().decode(fromBase64Url(body)).toLowerCase()
    if (decoded.includes(word)) return true
    return unpack(fromBase64Url(body)).answer === word
  } catch {
    return false
  }
}

/**
 * Can a sealed link be opened by hashing a known answer list?
 *
 * This is the attack the missing nonce would have allowed, so it is here as a
 * function rather than only as a comment: for each candidate, hash it against
 * the config and compare. Without the nonce there is nothing to compare
 * against, and the function returns null.
 */
export function bruteForceSealed(payload: SharePayload, candidates: readonly string[]): string | null {
  if (payload.posture !== 'sealed') return null
  if (!payload.commitment) return null
  // The nonce is not in the link, so every candidate misses for the same reason
  // the real answer would: there is no nonce to hash with.
  const nonce = payload.nonce
  if (nonce === undefined) return null
  for (const candidate of candidates) {
    if (commitmentFor(candidate, payload.config, nonce) === payload.commitment) return candidate
  }
  return null
}
