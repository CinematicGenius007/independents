const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

/**
 * base64url by hand.
 *
 * `Buffer` only exists on the server and `btoa` only takes a string, so the
 * codec carries its own alphabet. It is also the reason a link can be built in
 * a test file and opened in a tab without anything polyfilled.
 */
export function toBase64Url(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]
    const b = bytes[i + 1]
    const c = bytes[i + 2]
    out += ALPHABET[a >> 2]
    out += ALPHABET[((a & 0x03) << 4) | ((b ?? 0) >> 4)]
    if (b === undefined) break
    out += ALPHABET[((b & 0x0f) << 2) | ((c ?? 0) >> 6)]
    if (c === undefined) break
    out += ALPHABET[c & 0x3f]
  }
  return out
}

export function fromBase64Url(text: string): Uint8Array {
  const clean = text.replace(/[^A-Za-z0-9_-]/g, '')
  const out = new Uint8Array(Math.floor((clean.length * 6) / 8))
  let bits = 0
  let value = 0
  let position = 0
  for (const character of clean) {
    const index = ALPHABET.indexOf(character)
    if (index < 0) throw new Error(`not base64url: ${character}`)
    value = (value << 6) | index
    bits += 6
    if (bits >= 8) {
      bits -= 8
      out[position] = (value >> bits) & 0xff
      position += 1
    }
  }
  return out
}

export function concat(...parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

/** Always compares the whole thing, so a tag check cannot be timed. */
export function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0)
  return diff === 0
}
