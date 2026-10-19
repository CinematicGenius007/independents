/**
 * SHA-256, synchronously, with no dependency and nothing to await.
 *
 * A commitment has to exist the instant a link is built, and `crypto.subtle`
 * only answers asynchronously and only on a secure origin. A puzzle that cannot
 * be opened from a plain file is not much of a puzzle, so the hash is ours: the
 * ordinary FIPS 180-4 construction, checked against the published vectors in
 * the test file rather than trusted because it looks right.
 */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

const rotr = (x: number, n: number): number => ((x >>> n) | (x << (32 - n))) >>> 0

export function sha256(input: Uint8Array): Uint8Array {
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ])

  const bitLength = input.length * 8
  const padded = ((input.length + 9 + 63) >> 6) << 6
  const buffer = new Uint8Array(padded)
  buffer.set(input)
  buffer[input.length] = 0x80

  const view = new DataView(buffer.buffer)
  view.setUint32(padded - 8, Math.floor(bitLength / 4294967296))
  view.setUint32(padded - 4, bitLength >>> 0)

  const w = new Uint32Array(64)
  for (let offset = 0; offset < padded; offset += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(offset + i * 4)
    for (let i = 16; i < 64; i += 1) {
      const a = w[i - 15]
      const b = w[i - 2]
      const s0 = rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3)
      const s1 = rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10)
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0
    }

    let a = h[0]
    let b = h[1]
    let c = h[2]
    let d = h[3]
    let e = h[4]
    let f = h[5]
    let g = h[6]
    let hh = h[7]

    for (let i = 0; i < 64; i += 1) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const t1 = (hh + S1 + ch + K[i] + w[i]) >>> 0
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const t2 = (S0 + maj) >>> 0
      hh = g
      g = f
      f = e
      e = (d + t1) >>> 0
      d = c
      c = b
      b = a
      a = (t1 + t2) >>> 0
    }

    h[0] = (h[0] + a) >>> 0
    h[1] = (h[1] + b) >>> 0
    h[2] = (h[2] + c) >>> 0
    h[3] = (h[3] + d) >>> 0
    h[4] = (h[4] + e) >>> 0
    h[5] = (h[5] + f) >>> 0
    h[6] = (h[6] + g) >>> 0
    h[7] = (h[7] + hh) >>> 0
  }

  const out = new Uint8Array(32)
  const outView = new DataView(out.buffer)
  for (let i = 0; i < 8; i += 1) outView.setUint32(i * 4, h[i])
  return out
}

const BLOCK = 64

/** HMAC-SHA-256 (RFC 2104), which the tag and the key derivation both want. */
export function hmacSha256(key: Uint8Array, message: Uint8Array): Uint8Array {
  const padded = key.length > BLOCK ? sha256(key) : key
  const inner = new Uint8Array(BLOCK + message.length)
  const outer = new Uint8Array(BLOCK + 32)
  outer.set(padded)
  inner.set(padded)
  for (let i = 0; i < BLOCK; i += 1) {
    inner[i] ^= 0x36
    outer[i] ^= 0x5c
  }
  inner.set(message, BLOCK)
  outer.set(sha256(inner), BLOCK)
  return sha256(outer)
}

export function sha256Hex(input: Uint8Array): string {
  return bytesToHex(sha256(input))
}

export function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

export function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0')
  return out
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().toLowerCase()
  if (clean.length % 2 !== 0) throw new Error('hex length must be even')
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i += 1) {
    const byte = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16)
    if (Number.isNaN(byte)) throw new Error(`not hex: ${clean.slice(i * 2, i * 2 + 2)}`)
    out[i] = byte
  }
  return out
}

/**
 * PBKDF2-HMAC-SHA-256 (RFC 8018). Slow on purpose, and the only reason the
 * Vault posture is worth more than a base64 wrapper.
 */
export function pbkdf2(passphrase: string, salt: Uint8Array, iterations: number, length = 32): Uint8Array {
  const password = utf8(passphrase.normalize('NFKC'))
  const blocks = Math.ceil(length / 32)
  const out = new Uint8Array(blocks * 32)
  for (let block = 1; block <= blocks; block += 1) {
    const seed = new Uint8Array(salt.length + 4)
    seed.set(salt)
    new DataView(seed.buffer).setUint32(salt.length, block)
    let u = hmacSha256(password, seed)
    const acc = u.slice()
    for (let i = 1; i < iterations; i += 1) {
      u = hmacSha256(password, u)
      for (let j = 0; j < acc.length; j += 1) acc[j] ^= u[j]
    }
    out.set(acc, (block - 1) * 32)
  }
  return out.slice(0, length)
}
