import { hmacSha256, pbkdf2 } from './sha256'

/**
 * ChaCha20, then an HMAC-SHA-256 tag over the ciphertext.
 *
 * RFC 8439's cipher with the 96-bit nonce, which is the shape that made it into
 * TLS. This exists for one posture only: the optional Vault, where the link on
 * its own is meant to be inert because the passphrase travels separately. The
 * other postures deliberately do not encrypt anything, and the README says why
 * at length — encrypting a puzzle the solver has to grade is theatre, because
 * the key would be sitting next to the ciphertext.
 *
 * Encrypt-then-MAC, so a tampered ciphertext is rejected before anything is
 * decrypted, and the tag is compared without an early exit.
 */

const SIGMA = new Uint32Array([0x61707865, 0x3320646e, 0x79622d32, 0x6b206574])

const rotl = (x: number, n: number): number => ((x << n) | (x >>> (32 - n))) >>> 0

function quarterRound(x: Uint32Array, a: number, b: number, c: number, d: number): void {
  x[a] = (x[a] + x[b]) >>> 0
  x[d] = rotl(x[d] ^ x[a], 16)
  x[c] = (x[c] + x[d]) >>> 0
  x[b] = rotl(x[b] ^ x[c], 12)
  x[a] = (x[a] + x[b]) >>> 0
  x[d] = rotl(x[d] ^ x[a], 8)
  x[c] = (x[c] + x[d]) >>> 0
  x[b] = rotl(x[b] ^ x[c], 7)
}

/** One 64-byte keystream block. */
export function chacha20Block(key: Uint8Array, nonce: Uint8Array, counter: number): Uint8Array {
  const state = new Uint32Array(16)
  state.set(SIGMA, 0)
  const keyView = new DataView(key.buffer, key.byteOffset, key.byteLength)
  for (let i = 0; i < 8; i += 1) state[4 + i] = keyView.getUint32(i * 4, true)
  state[12] = counter >>> 0
  const nonceView = new DataView(nonce.buffer, nonce.byteOffset, nonce.byteLength)
  for (let i = 0; i < 3; i += 1) state[13 + i] = nonceView.getUint32(i * 4, true)

  const working = new Uint32Array(state)
  for (let i = 0; i < 10; i += 1) {
    quarterRound(working, 0, 4, 8, 12)
    quarterRound(working, 1, 5, 9, 13)
    quarterRound(working, 2, 6, 10, 14)
    quarterRound(working, 3, 7, 11, 15)
    quarterRound(working, 0, 5, 10, 15)
    quarterRound(working, 1, 6, 11, 12)
    quarterRound(working, 2, 7, 8, 13)
    quarterRound(working, 3, 4, 9, 14)
  }

  const out = new Uint8Array(64)
  const outView = new DataView(out.buffer)
  for (let i = 0; i < 16; i += 1) outView.setUint32(i * 4, (working[i] + state[i]) >>> 0, true)
  return out
}

export function chacha20Xor(key: Uint8Array, nonce: Uint8Array, data: Uint8Array, counter = 1): Uint8Array {
  const out = new Uint8Array(data.length)
  let position = 0
  let block = counter
  while (position < data.length) {
    const stream = chacha20Block(key, nonce, block)
    const take = Math.min(64, data.length - position)
    for (let i = 0; i < take; i += 1) out[position + i] = data[position + i] ^ stream[i]
    position += take
    block += 1
  }
  return out
}

export interface Vault {
  readonly salt: Uint8Array
  readonly nonce: Uint8Array
  readonly ciphertext: Uint8Array
  readonly tag: Uint8Array
}

/** Slow enough to be worth something, and lowered in tests only. */
export const VAULT_ITERATIONS = 150_000

export function vaultKey(passphrase: string, salt: Uint8Array, iterations = VAULT_ITERATIONS): Uint8Array {
  return pbkdf2(passphrase, salt, iterations)
}

const TAG_OVER = (salt: Uint8Array, nonce: Uint8Array, ciphertext: Uint8Array): Uint8Array => {
  const combined = new Uint8Array(salt.length + nonce.length + ciphertext.length)
  combined.set(salt, 0)
  combined.set(nonce, salt.length)
  combined.set(ciphertext, salt.length + nonce.length)
  return combined
}

export function sealVault(key: Uint8Array, salt: Uint8Array, plaintext: Uint8Array, nonce: Uint8Array): Vault {
  const ciphertext = chacha20Xor(key, nonce, plaintext)
  const tag = hmacSha256(key, TAG_OVER(salt, nonce, ciphertext))
  return { salt, nonce, ciphertext, tag }
}

/** Null on a bad tag, on purpose: a wrong passphrase and a mangled link are the same answer. */
export function openVault(key: Uint8Array, vault: Vault): Uint8Array | null {
  const expected = hmacSha256(key, TAG_OVER(vault.salt, vault.nonce, vault.ciphertext))
  let diff = expected.length ^ vault.tag.length
  for (let i = 0; i < expected.length; i += 1) diff |= expected[i] ^ (vault.tag[i] ?? 0)
  if (diff !== 0) return null
  return chacha20Xor(key, vault.nonce, vault.ciphertext)
}
