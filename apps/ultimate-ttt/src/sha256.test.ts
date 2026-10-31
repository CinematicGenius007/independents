import { describe, expect, it } from 'vitest'
import { sha256 } from './sha256'

const hex = (b: Uint8Array) => [...b].map(x => x.toString(16).padStart(2, '0')).join('')
const enc = (s: string) => new TextEncoder().encode(s)

describe('sha256', () => {
  it('matches the known vectors', () => {
    expect(hex(sha256(enc('')))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    expect(hex(sha256(enc('abc')))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('agrees with the platform digest on longer input', async () => {
    const text = `X:${Array.from({ length: 70 }, (_, i) => (i * 7) % 81).join(',')}`
    const native = new Uint8Array(await crypto.subtle.digest('SHA-256', enc(text)))
    expect(hex(sha256(enc(text)))).toBe(hex(native))
  })
})
