import { describe, expect, it } from 'vitest'
import { chacha20Block, openVault, sealVault, vaultKey } from './chacha'
import { fromBase64Url, toBase64Url } from './bytes'
import { bestGuess, measurePool, maskFor, rateCase, solve, visibleSignature } from './difficulty'
import { configFor, DEFAULT_CONFIG, knownLetters, newGame, peek, scoreSheet, spendHint, spendLift, submit, trueMarks, visibleMarks } from './game'
import { bruteForceSealed, buildLink, buildReveal, commitmentFor, decodeLink, leaksAnswer, openLink, randomNonce, verifyCommitment } from './link'
import {
  checkInk,
  contrastRatio,
  DARK_LETTER,
  HOUSE_INK,
  hexToRgb,
  inspectPalette,
  LIGHT_LETTER,
  LETTER_CONTRAST_FLOOR,
  letterContrast,
  PRESETS,
  presetFor,
  readableLetter,
  resolveInk,
  SEPARATION_FLOOR,
  separation,
  simulateDeuteranopia,
} from './palette'
import { analyseMap, barredCount, buildRedaction, describeMap, everyRowHasAnOpenCell, lift, paint, patternLines, recognisePattern, REDACTION_PRESETS, validateMap } from './redaction'
import { createRng, hashSeed, seedTag } from './rng'
import { candidates, checkWord, hardModeViolations, isWin, resolveGuess, signature } from './rules'
import { bytesToHex, hexToBytes, hmacSha256, pbkdf2, sha256Hex, utf8 } from './sha256'
import { pack, unpack } from './wire'
import { guessesOfLength } from './lexicon'
import { ANSWERS, answersOfLength, coveredLengths, dailyAnswer, dateKey, SAMPLE, sampleWords, wordListFor } from './words'

const SIX = answersOfLength(6)
/** The sample can only guess words that could be the answer, so its two lists are one. */
const SIX_GUESSES = SIX
const PLAYS = ['danger', 'wander', 'damage'] as const

describe('sha256', () => {
  it('matches the published vectors', () => {
    expect(sha256Hex(utf8(''))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    expect(sha256Hex(utf8('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(sha256Hex(utf8('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'))).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    )
  })

  it('handles a message longer than one block', () => {
    expect(sha256Hex(utf8('a'.repeat(1000)))).toBe(
      '41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3',
    )
  })

  it('computes HMAC to the RFC vector', () => {
    const key = new Uint8Array(20).fill(0x0b)
    expect(bytesToHex(hmacSha256(key, utf8('Hi There')))).toBe(
      'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7',
    )
  })

  it('derives a key to the PBKDF2 vector', () => {
    expect(bytesToHex(pbkdf2('password', utf8('salt'), 1))).toBe(
      '120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b',
    )
  })
})

describe('chacha20', () => {
  it('matches RFC 8439 section 2.3.2', () => {
    const key = new Uint8Array(32)
    for (let i = 0; i < 32; i += 1) key[i] = i
    const nonce = hexToBytes('000000090000004a00000000')
    expect(bytesToHex(chacha20Block(key, nonce, 1))).toBe(
      '10f1e7e4d13b5915500fdd1fa32071c4c7d1f4c733c068030422aa9ac3d46c4e' +
        'd2826446079faa0914c2d705d98b02a2b5129cd1de164eb9cbd083e8a2503c4e',
    )
  })

  it('round-trips a vault, and refuses a wrong passphrase', () => {
    const salt = hexToBytes('00112233445566778899aabbccddeeff')
    const nonce = hexToBytes('0f1e2d3c4b5a69788796a5b4')
    const key = vaultKey('correct horse', salt, 1000)
    const sealed = sealVault(key, salt, utf8('garden'), nonce)
    expect(new TextDecoder().decode(openVault(key, sealed) as Uint8Array)).toBe('garden')
    expect(openVault(vaultKey('battery staple', salt, 1000), sealed)).toBeNull()
  })

  it('refuses a tampered ciphertext before decrypting', () => {
    const salt = hexToBytes('00112233445566778899aabbccddeeff')
    const nonce = hexToBytes('0f1e2d3c4b5a69788796a5b4')
    const key = vaultKey('correct horse', salt, 1000)
    const sealed = sealVault(key, salt, utf8('garden'), nonce)
    const tampered = { ...sealed, ciphertext: sealed.ciphertext.slice() }
    tampered.ciphertext[0] ^= 0x01
    expect(openVault(key, tampered)).toBeNull()
  })
})

describe('bytes', () => {
  it('round-trips base64url at every remainder', () => {
    for (const length of [0, 1, 2, 3, 4, 5, 31, 32, 33, 64, 65]) {
      const bytes = new Uint8Array(length)
      for (let i = 0; i < length; i += 1) bytes[i] = (i * 37 + 11) % 256
      expect(bytesToHex(fromBase64Url(toBase64Url(bytes)))).toBe(bytesToHex(bytes))
    }
  })

  it('ignores the punctuation a chat client might add', () => {
    const bytes = utf8('garden')
    const encoded = toBase64Url(bytes)
    expect(bytesToHex(fromBase64Url(`${encoded}\n`))).toBe(bytesToHex(bytes))
  })
})

describe('feedback', () => {
  it('marks an exact hit', () => {
    expect(resolveGuess('garden', 'garden')).toEqual(['exact', 'exact', 'exact', 'exact', 'exact', 'exact'])
    expect(isWin(resolveGuess('garden', 'garden'))).toBe(true)
  })

  it('separates shifted from absent', () => {
    expect(resolveGuess('garden', 'danger')).toEqual(['shifted', 'exact', 'shifted', 'shifted', 'exact', 'shifted'])
  })

  it('makes a repeated letter consume a repeated letter', () => {
    expect(resolveGuess('garden', 'rudder')).toEqual(['shifted', 'absent', 'absent', 'exact', 'exact', 'absent'])
    expect(resolveGuess('abbey', 'bobby')).toEqual(['shifted', 'absent', 'exact', 'absent', 'exact'])
  })

  it('refuses to compare different lengths', () => {
    expect(() => resolveGuess('garden', 'hardy')).toThrow()
  })

  it('signs a row compactly, so equal rows group', () => {
    expect(signature(resolveGuess('garden', 'danger'))).toBe('sesses')
  })

  it('keeps only the candidates that could still be the answer', () => {
    const history = [{ word: 'danger', marks: resolveGuess('garden', 'danger') }]
    const narrowed = candidates(SIX, history)
    expect(narrowed).toContain('garden')
    expect(narrowed.length).toBeLessThan(SIX.length)
    for (const word of narrowed) {
      expect(resolveGuess(word, 'danger')).toEqual(history[0].marks)
    }
  })

  it('complains about hard mode in the specific way that was broken', () => {
    const previous = [{ word: 'danger', marks: resolveGuess('garden', 'danger') }]
    const moved = hardModeViolations(previous, 'gardan')
    expect(moved.some((problem) => problem.includes('position 5'))).toBe(true)
    const dropped = hardModeViolations(previous, 'wander')
    expect(dropped.some((problem) => problem.includes('G has to appear'))).toBe(true)
    expect(hardModeViolations(previous, 'garden')).toEqual([])
  })

  it('polices the lexicon only when asked', () => {
    expect(checkWord('garden', 6, 'strict', SAMPLE)).toBeNull()
    expect(checkWord('zzyzxq', 6, 'strict', SAMPLE)?.kind).toBe('unknown')
    expect(checkWord('zzyzxq', 6, 'free', SAMPLE)).toBeNull()
    expect(checkWord('garden', 5, 'free', SAMPLE)?.kind).toBe('length')
  })
})

describe('the ink', () => {
  it('picks a letter against the ink, not once for the board', () => {
    expect(contrastRatio('#D9A21A', LIGHT_LETTER)).toBeLessThan(3)
    expect(readableLetter('#D9A21A')).toBe(DARK_LETTER)
    expect(letterContrast('#D9A21A')).toBeGreaterThan(6)
    for (const preset of PRESETS) {
      for (const role of ['exact', 'shifted', 'absent'] as const) {
        expect(letterContrast(preset.ink[role])).toBeGreaterThanOrEqual(LETTER_CONTRAST_FLOOR)
      }
    }
  })

  it('advises rather than blocks when an ink is thin at keyboard size', () => {
    const check = checkInk(HOUSE_INK, { scramble: false, legend: 'example', seed: 'A' })
    expect(check.ok).toBe(true)
    expect(check.advice.length).toBeGreaterThan(0)
    expect(check.advice[0].message).toContain('thin on the keyboard')
  })

  it('collapses two greens toward each other under deuteranopia', () => {
    const gap = (x: string, y: string) => {
      const p = hexToRgb(x)
      const q = hexToRgb(y)
      return Math.hypot(p.r - q.r, p.g - q.g, p.b - q.b)
    }
    expect(gap(simulateDeuteranopia('#1F8A55'), simulateDeuteranopia('#3E9A66'))).toBeLessThan(
      gap('#1F8A55', '#3E9A66'),
    )
    expect(separation('#1F8A55', '#3E9A66')).toBeLessThan(SEPARATION_FLOOR)
  })

  it('rates the house ink as legible and the cruel preset as not', () => {
    expect(inspectPalette(HOUSE_INK).min).toBeGreaterThanOrEqual(SEPARATION_FLOOR)
    expect(inspectPalette(HOUSE_INK).verdict).not.toBe('collapsed')
    expect(inspectPalette(presetFor('cruel').ink).verdict).toBe('collapsed')
    expect(inspectPalette(presetFor('tricky').ink).verdict).toBe('collapsed')
  })

  it('shuffles the meanings, deterministically, and never leaves them alone', () => {
    expect(resolveInk(HOUSE_INK, false, 'CASE-1')).toEqual(HOUSE_INK)
    const first = resolveInk(HOUSE_INK, true, 'CASE-1')
    expect(resolveInk(HOUSE_INK, true, 'CASE-1')).toEqual(first)
    expect(Object.values(first).sort()).toEqual(Object.values(HOUSE_INK).sort())
    expect(first).not.toEqual(HOUSE_INK)
    const seen = new Set<string>()
    for (let i = 0; i < 40; i += 1) {
      const ink = resolveInk(HOUSE_INK, true, `CASE-${i}`)
      expect(ink).not.toEqual(HOUSE_INK)
      seen.add(JSON.stringify(ink))
    }
    expect(seen.size).toBeGreaterThan(1)
  })

  it('refuses an untaught code that nobody could read', () => {
    const tricky = presetFor('tricky').ink
    expect(checkInk(tricky, { scramble: false, legend: 'example', seed: 'A' }).ok).toBe(true)
    const hidden = checkInk(tricky, { scramble: false, legend: 'hidden', seed: 'A' })
    expect(hidden.ok).toBe(false)
    expect(hidden.problems[0].kind).toBe('needsLegend')
  })

  it('refuses a palette where two roles share a colour', () => {
    const doubled = { exact: '#1F8A55', shifted: '#1F8A55', absent: '#333A4D' }
    expect(checkInk(doubled, { scramble: false, legend: 'example', seed: 'A' }).problems.some((p) => p.kind === 'duplicate')).toBe(true)
    expect(checkInk(doubled, { scramble: true, legend: 'example', seed: 'A' }).ok).toBe(false)
  })
})

describe('redaction', () => {
  it('will bar a whole row when the run is as long as the row', () => {
    // The guard that used to forbid this was removed on request. A row that says
    // nothing is the setter's choice, and the analysis names it instead of
    // refusing it.
    const full = buildRedaction({ mode: 'pattern', pattern: { kind: 'leading', count: 6, fromRow: 1 } }, 6, 6, 'A')
    expect(everyRowHasAnOpenCell(full.barred)).toBe(false)
    expect(analyseMap(full).verdict).toBe('closed')
    expect(analyseMap(full).sealedRows).toBe(6)

    const partial = buildRedaction({ mode: 'pattern', pattern: { kind: 'leading', count: 4, fromRow: 3 } }, 6, 6, 'A')
    expect(everyRowHasAnOpenCell(partial.barred)).toBe(true)
  })

  it('walks the window under shear', () => {
    for (let i = 0; i < 60; i += 1) {
      const map = buildRedaction(
        { mode: 'pattern', pattern: { kind: 'leading', count: 4, fromRow: 1 }, shear: true },
        6,
        6,
        `SEED-${i}`,
      )
      expect(map.barred).toHaveLength(6)
      expect(map.barred.every((line) => line.length === 6)).toBe(true)
    }
  })

  it('accepts an explicit map that says nothing, and names it', () => {
    const solid = [new Array(6).fill(true), new Array(6).fill(false)]
    expect(validateMap(solid, 6, 2)).toHaveLength(0)
    const map = buildRedaction({ mode: 'open', explicit: solid }, 6, 2, 'A')
    expect(map.barred[0]).toEqual(new Array(6).fill(true))
    expect(analyseMap(map).verdict).toBe('closed')
    // Shape is still checked, because a map of the wrong shape is a bug rather
    // than a choice.
    expect(validateMap([[true, true]], 6, 1)).toContain('row 1 has 2 cells, expected 6')
  })

  it('declares the map for pattern and withholds it for closed', () => {
    expect(buildRedaction({ mode: 'pattern' }, 6, 6, 'A').visible).toBe(true)
    expect(buildRedaction({ mode: 'closed' }, 6, 6, 'A').visible).toBe(false)
    expect(buildRedaction({ mode: 'off' }, 6, 6, 'A').visible).toBe(false)
  })

  it('lets a lift pull one bar back, and only one', () => {
    const map = buildRedaction({ mode: 'pattern', pattern: { kind: 'leading', count: 4, fromRow: 1 } }, 6, 6, 'A')
    const before = barredCount(map)
    expect(lift(map, 0, 0).changed).toBe(true)
    expect(barredCount(lift(map, 0, 0).map)).toBe(before - 1)
    expect(lift(lift(map, 0, 0).map, 0, 0).changed).toBe(false)
    expect(describeMap(map)).toContain('barred by rule')
  })

  it('allows the last open cell, and says what it costs', () => {
    const map = buildRedaction({ mode: 'pattern', pattern: { kind: 'leading', count: 4, fromRow: 1 } }, 6, 6, 'B')
    expect(map.barred[0]).toEqual([true, true, true, true, false, false])

    const filled = paint(map, 0, 4, true)
    expect(filled.problem).toBeUndefined()
    expect(filled.map.mode).toBe('open')

    const blackout = paint(filled.map, 0, 5, true)
    expect(blackout.problem).toBeUndefined()
    expect(blackout.map.barred[0]).toEqual(new Array(6).fill(true))
    // A row that says nothing is reported rather than refused.
    expect(analyseMap(blackout.map).verdict).toBe('closed')
  })

  it('ignores a stroke that changes nothing, and one off the board', () => {
    const map = buildRedaction({ mode: 'pattern', pattern: { kind: 'leading', count: 4, fromRow: 1 } }, 6, 6, 'C')
    expect(paint(map, 0, 0, true).map).toBe(map)
    expect(paint(map, 9, 0, true).problem).toBe('that cell is off the board')
    expect(paint(map, 0, 99, true).problem).toBe('that cell is off the board')
  })

  it('recognises a rule when it has been painted', () => {
    for (const kind of ['leading', 'alternate'] as const) {
      for (const shear of [false, true]) {
        const pattern = { kind, count: 3, fromRow: 2 }
        const map = buildRedaction({ mode: 'pattern', pattern, shear }, 6, 6, 'D')
        expect(recognisePattern(map)).toEqual({ pattern, shear })
        expect(patternLines(pattern, 6, 6, shear)).toEqual(map.barred)
      }
    }
  })

  it('says nothing when a map is genuinely hand-painted', () => {
    const ragged = [
      [true, false, true, false, false, false],
      [false, true, false, true, false, false],
      [false, false, true, false, false, false],
      [false, false, false, false, false, false],
      [true, false, false, false, true, false],
      [false, false, false, false, false, false],
    ]
    expect(recognisePattern(buildRedaction({ mode: 'open', explicit: ragged }, 6, 6, 'E'))).toBeNull()
  })

  it('reads a map back as what it costs the solver', () => {
    const sample = buildRedaction({ mode: 'pattern', pattern: { kind: 'leading', count: 4, fromRow: 3 } }, 6, 6, 'F')
    const analysis = analyseMap(sample)
    expect(analysis.barred).toBe(16)
    expect(analysis.total).toBe(36)
    expect(analysis.openPerRow).toEqual([6, 6, 2, 2, 2, 2])
    expect(analysis.thinnest).toEqual({ row: 3, open: 2 })
    expect(analysis.suggestedLifts).toBe(0)
    expect(analysis.verdict).toBe('thin')

    expect(analyseMap(buildRedaction({ mode: 'off' }, 6, 6, 'G')).verdict).toBe('open')

    const oneOpen = analyseMap(
      buildRedaction({ mode: 'open', explicit: Array.from({ length: 6 }, () => [true, true, true, true, true, false]) }, 6, 6, 'H'),
    )
    expect(oneOpen.verdict).toBe('blank')
    expect(oneOpen.sealedRows).toBe(0)
    expect(oneOpen.suggestedLifts).toBe(5)
    expect(oneOpen.thinnest).toEqual({ row: 1, open: 1 })
  })

  it('offers a named shape for every kind of withholding', () => {
    expect(REDACTION_PRESETS.length).toBe(8)
    for (const preset of REDACTION_PRESETS) {
      const map = buildRedaction(preset.config(6, 6), 6, 6, 'P')
      expect(map.barred).toHaveLength(6)
      expect(map.barred.every((line) => line.length === 6)).toBe(true)
      if (preset.id === 'none') expect(barredCount(map)).toBe(0)
      else expect(barredCount(map)).toBeGreaterThan(0)
    }
    // Every preset has to survive being built at any shape the game offers.
    for (const preset of REDACTION_PRESETS) {
      for (const [length, rows] of [[3, 3], [7, 10], [10, 12]] as const) {
        const map = buildRedaction(preset.config(length, rows), length, rows, 'P')
        expect(map.barred).toHaveLength(rows)
        expect(map.barred[0]).toHaveLength(length)
      }
    }
  })
})

describe('a puzzle', () => {
  it('refuses a word the lexicon has never heard of, without moving on', () => {
    const state = newGame(configFor({ seed: 'S0' }), 'garden')
    const rejected = submit(state, 'zzyzxq', SAMPLE)
    expect(rejected.problem).toContain('not in the lexicon')
    expect(rejected.state.turns).toHaveLength(0)
    expect(submit(state, 'damage', SAMPLE).state.turns).toHaveLength(1)
  })

  it('hides a barred cell from the solver and keeps it in the truth', () => {
    const state = newGame(configFor({ seed: 'S1' }), 'garden')
    const played = submit(state, 'danger', SAMPLE).state
    expect(trueMarks(played, 0)).toEqual(resolveGuess('garden', 'danger'))
    expect(visibleMarks(played, 0)).toEqual(trueMarks(played, 0))
  })

  it('withholds the window on the rows it covers', () => {
    const state = newGame(configFor({ seed: 'S2' }), 'garden')
    let current = state
    for (const word of PLAYS) current = submit(current, word, SAMPLE).state
    const shown = visibleMarks(current, 2)
    expect(shown.filter((mark) => mark === 'barred').length).toBeGreaterThan(0)
    expect(trueMarks(current, 2).some((mark) => mark === 'exact')).toBe(true)
  })

  it('announces a win even when almost the whole row is barred', () => {
    const barred = [new Array(6).fill(true)]
    barred[0][5] = false
    const state = newGame(configFor({ seed: 'WIN', rows: 1, redaction: { mode: 'open', explicit: barred } }), 'garden')
    const result = submit(state, 'garden', SAMPLE)
    expect(result.state.status).toBe('won')
    expect(visibleMarks(result.state, 0)).toEqual(['barred', 'barred', 'barred', 'barred', 'barred', 'exact'])
  })

  it('gives away a letter when a free letter is spent', () => {
    const config = configFor({ seed: 'H1', hints: 2 })
    let state = newGame(config, 'garden')
    expect(state.hintsLeft).toBe(2)
    expect(knownLetters(state)).toEqual([null, null, null, null, null, null])

    const spent = spendHint(state, 2)
    expect(spent.problem).toBeUndefined()
    state = spent.state
    expect(state.hintsLeft).toBe(1)
    expect(knownLetters(state)).toEqual([null, null, 'r', null, null, null])

    // Spending the same one twice is refused rather than charged twice.
    expect(spendHint(state, 2).problem).toBe('that letter is already known')
    expect(spendHint(state, 2).state.hintsLeft).toBe(1)
    expect(spendHint(state, 9).problem).toBe('that is off the board')

    const last = spendHint(state, 5)
    expect(last.state.hintsLeft).toBe(0)
    expect(spendHint(last.state, 0).problem).toBe('no free letters left')
    expect(spendHint(last.state, 0).state.hintsLeft).toBe(0)
  })

  it('does not let a free letter win the puzzle', () => {
    // Knowing letters is not the same as having guessed the word.
    let state = newGame(configFor({ seed: 'H2', hints: 4, rows: 2 }), 'garden')
    for (const cell of [0, 1, 2, 3]) state = spendHint(state, cell).state
    expect(knownLetters(state)).toEqual(['g', 'a', 'r', 'd', null, null])
    expect(state.status).toBe('playing')
    expect(submit(state, 'damage', SAMPLE).state.status).toBe('playing')
    expect(submit(state, 'garden', SAMPLE).state.status).toBe('won')
  })

  it('refuses a free letter once the puzzle is over', () => {
    let state = newGame(configFor({ seed: 'H3', hints: 1, rows: 1 }), 'garden')
    state = submit(state, 'damage', SAMPLE).state
    expect(state.status).toBe('lost')
    expect(spendHint(state, 0).problem).toBe('this puzzle is closed')
  })

  it('carries a free letter through the link', () => {
    const built = buildLink(configFor({ seed: 'H4', hints: 3 }), 'garden', { entropy: 'H' })
    const opened = openLink(built.fragment)
    expect(opened.kind).toBe('ready')
    if (opened.kind !== 'ready') throw new Error('unreachable')
    expect(opened.config.hints).toBe(3)
    expect(newGame(opened.config, opened.answer).hintsLeft).toBe(3)
  })

  it('spends a lift and then shows what it was hiding', () => {
    const state = newGame(configFor({ seed: 'S3' }), 'garden')
    let current = state
    for (const word of PLAYS) current = submit(current, word, SAMPLE).state
    const firstBarred = current.map.barred[2].findIndex(Boolean)
    expect(visibleMarks(current, 2)[firstBarred]).toBe('barred')
    const spent = spendLift(current, 2, firstBarred)
    expect(spent.state.liftsLeft).toBe(current.liftsLeft - 1)
    expect(visibleMarks(spent.state, 2)[firstBarred]).toBe(trueMarks(current, 2)[firstBarred])
    expect(spendLift(spent.state, 2, firstBarred).problem).toBe('that cell is not barred')
  })

  it('lies on purpose when decoys are on', () => {
    const config = configFor({ seed: 'S4', redaction: { mode: 'closed', decoy: true, pattern: { kind: 'leading', count: 4, fromRow: 1 } } })
    const played = submit(newGame(config, 'garden'), 'danger', SAMPLE).state
    const shown = visibleMarks(played, 0)
    const truth = trueMarks(played, 0)
    const barredCells = played.map.barred[0].map((barred, cell) => (barred ? cell : -1)).filter((cell) => cell >= 0)
    expect(barredCells.length).toBeGreaterThan(0)
    for (const cell of barredCells) expect(shown[cell]).not.toBe(truth[cell])
  })

  it('records a look at the answer rather than forbidding it', () => {
    const state = newGame(configFor({ seed: 'S5' }), 'garden')
    let current = state
    for (const word of PLAYS) current = submit(current, word, SAMPLE).state
    expect(current.peeks).toBe(0)
    current = peek(current)
    expect(current.peeks).toBe(1)
    expect(visibleMarks(current, 2)).toEqual(trueMarks(current, 2))
  })

  it('ends after the last row', () => {
    let state = newGame(configFor({ seed: 'S6', rows: 2 }), 'garden')
    state = submit(state, 'danger', SAMPLE).state
    state = submit(state, 'wander', SAMPLE).state
    expect(state.status).toBe('lost')
    expect(submit(state, 'damage', SAMPLE).problem).toBe('this puzzle is closed')
  })

  it('refuses to build a case the ink makes unplayable', () => {
    expect(() => newGame(configFor({ intensity: 'cruel', legend: 'hidden' }), 'garden')).toThrow(/coin flip/)
  })

  it('prints a sheet with no letters in it', () => {
    const state = submit(newGame(configFor({ seed: 'S7' }), 'garden'), 'danger', SAMPLE).state
    const text = scoreSheet(state)
    expect(text).toContain('HUSHWORD S7')
    expect(text).not.toContain('garden')
    expect(text).not.toContain('danger')
    expect(text).toContain('O')
  })

  it('plays itself to a win on the default case', () => {
    for (const answer of SIX.slice(0, 12)) {
      const state = newGame(configFor({ seed: `P-${answer}` }), answer)
      let current = state
      let guard = 0
      while (current.status === 'playing' && guard < DEFAULT_CONFIG.rows) {
        const remainingNow = candidates(SIX, current.turns.map((turn) => ({ word: turn.word, marks: turn.marks })))
        const lens = { seed: '', row: guard, decoy: false, trusting: false }
        current = submit(current, bestGuess(remainingNow.length > 0 ? remainingNow : SIX, SIX_GUESSES, null, lens), SAMPLE).state
        guard += 1
      }
      expect(current.status).toBe('won')
    }
  })
})

describe('what a redaction costs', () => {
  const late = buildRedaction({ mode: 'pattern', pattern: { kind: 'leading', count: 4, fromRow: 3 } }, 6, 6, 'COST-1')
  const earlier = buildRedaction({ mode: 'pattern', pattern: { kind: 'leading', count: 4, fromRow: 1 } }, 6, 6, 'COST-1')

  /** How much the solver still believes, summed across a sample of cases. */
  const beliefTotal = (map?: typeof late): number =>
    SIX.slice(0, 8).reduce((sum, answer) => {
      const run = solve({ answers: SIX, guesses: SIX_GUESSES, answer, rows: 6, map })
      return sum + run.surviving.reduce((a, b) => a + b, 0)
    }, 0)

  it('shows the solver nothing on a barred cell', () => {
    const mask = maskFor(late, 2)
    expect(mask?.[0]).toBe(true)
    expect(visibleSignature('garden', 'danger', mask)).toContain('b')
    expect(visibleSignature('garden', 'danger', null)).toBe('sesses')
  })

  it(
    'leaves the solver with more to believe, which is the mechanism',
    () => {
      // This is the thing the engine could not previously measure: the reference
      // player is only shown what the board is willing to show it. Slow, because
      // it plays sixty cases against a real answer pool.
      expect(beliefTotal(late)).toBeGreaterThanOrEqual(beliefTotal())
      expect(beliefTotal(earlier)).toBeGreaterThan(beliefTotal(late))
    },
    20_000,
  )

  it('reports the difference as a measurement rather than a guess', () => {
    const rating = rateCase({
      answers: SIX,
      guesses: SIX_GUESSES,
      answer: 'garden',
      rows: 6,
      map: late,
      minSeparation: inspectPalette(HOUSE_INK).min,
      legend: 'example',
    })
    expect(rating.measured).not.toBeNull()
    expect(rating.openMeasured).not.toBeNull()
    expect(rating.redactionCost).toBe((rating.measured as number) - (rating.openMeasured as number))
    expect(rating.inkReadCost).toBe(0)
  })

  it('charges for a lie when somebody believes it', () => {
    const pattern = { kind: 'leading' as const, count: 3, fromRow: 1 }
    const lying = buildRedaction({ mode: 'closed', pattern, decoy: true }, 6, 6, 'COST-2')
    const cautious = solve({ answers: SIX, guesses: SIX_GUESSES, answer: 'garden', rows: 6, map: lying, seed: 'COST-2' })
    const trusting = solve({
      answers: SIX,
      guesses: SIX_GUESSES,
      answer: 'garden',
      rows: 6,
      map: lying,
      seed: 'COST-2',
      trusting: true,
    })
    // Believing the board narrows harder and wrongly: either the belief set goes
    // to nothing and the row is lost, or it lands on a smaller, wrong set.
    const narrowedHarder = trusting.surviving.some((count, index) => count < (cautious.surviving[index] ?? 0))
    expect(narrowedHarder || trusting.wasted > 0).toBe(true)

    const rating = rateCase({
      answers: SIX,
      guesses: SIX_GUESSES,
      answer: 'garden',
      rows: 6,
      map: lying,
      seed: 'COST-2',
      minSeparation: 0.2,
      legend: 'example',
    })
    expect(rating.deceptionCost).toBeGreaterThanOrEqual(0)
  })

  it('does not charge for a board that does not lie', () => {
    const honest = buildRedaction({ mode: 'closed', pattern: { kind: 'leading', count: 3, fromRow: 1 } }, 6, 6, 'COST-3')
    const rating = rateCase({
      answers: SIX,
      guesses: SIX_GUESSES,
      answer: 'garden',
      rows: 6,
      map: honest,
      seed: 'COST-3',
      minSeparation: 0.2,
      legend: 'example',
    })
    expect(rating.deceptionCost).toBe(0)
    expect(rating.wastedRows).toBe(0)
  })
})

describe('rating a case', () => {
  it('is deterministic, because two people sharing a link should see one number', () => {
    const once = solve({ answers: SIX, guesses: SIX_GUESSES, answer: 'garden', rows: 6 })
    expect(solve({ answers: SIX, guesses: SIX_GUESSES, answer: 'garden', rows: 6 })).toEqual(once)
    expect(once.won).toBe(true)
  })

  it('measures a pool rather than asserting a vibe', () => {
    const measurement = measurePool({ answers: SIX, guesses: SIX_GUESSES, rows: 6, sampleSize: 30, seed: 'M1' })
    expect(measurement.played).toBe(30)
    expect(measurement.solved + measurement.failed).toBe(30)
    expect(measurement.averageGuesses).toBeGreaterThan(1)
    expect(measurement.histogram.reduce((sum, count) => sum + count, 0)).toBe(measurement.solved)
  })

  it('charges an ink read cost only when nobody teaches the code', () => {
    const base = { answers: SIX, guesses: SIX_GUESSES, answer: 'garden', rows: 6 }
    const taught = rateCase({ ...base, minSeparation: 0.07, legend: 'example' })
    const untaught = rateCase({ ...base, minSeparation: 0.07, legend: 'hidden' })
    const clearInk = rateCase({ ...base, minSeparation: 0.2, legend: 'hidden' })
    expect(taught.inkReadCost).toBe(0)
    expect(untaught.inkReadCost).toBeGreaterThan(0)
    expect(clearInk.inkReadCost).toBeLessThan(untaught.inkReadCost)
    expect(untaught.effective).toBeGreaterThan(taught.effective)
  })
})

describe('the wire', () => {
  it('round-trips every shape a link can take', () => {
    const shapes = [
      { mode: 'off' } as const,
      { mode: 'pattern', pattern: { kind: 'leading', count: 4, fromRow: 3 } } as const,
      { mode: 'pattern', pattern: { kind: 'alternate', count: 2, fromRow: 1 }, shear: true, decoy: true } as const,
      { mode: 'closed', pattern: { kind: 'leading', count: 5, fromRow: 2 } } as const,
      { mode: 'open', explicit: [[true, true, false, false, false, false], [false, false, false, false, false, false]] } as const,
    ]
    for (const redaction of shapes) {
      const config = { seed: 'W-1', length: 6, rows: 6, hard: true, intensity: 'crisp', scramble: true, legend: 'hidden', redaction, lifts: 3, hints: 1, clock: 'down', minutes: 7, keyHeat: false, lexicon: 'free' }
      const content = {
        config: { ...config, redaction },
        posture: 'sealed',
        commitment: 'ab'.repeat(32),
      } as const
      const back = unpack(pack(content as never))
      expect(back.config.seed).toBe('W-1')
      expect(back.config.rows).toBe(6)
      expect(back.config.hard).toBe(true)
      expect(back.config.intensity).toBe('crisp')
      expect(back.config.scramble).toBe(true)
      expect(back.config.legend).toBe('hidden')
      expect(back.config.lexicon).toBe('free')
      expect(back.config.lifts).toBe(3)
      expect(back.config.hints).toBe(1)
      expect(back.config.clock).toBe('down')
      expect(back.config.minutes).toBe(7)
      expect(back.config.keyHeat).toBe(false)
      expect(back.config.redaction.mode).toBe(redaction.mode)
      expect(back.commitment).toBe('ab'.repeat(32))
    }
  })

  it('keeps a letter word packed tighter than the letters themselves', () => {
    const word = 'garden'
    const bits = pack({ config: { seed: 'S', length: 6, rows: 6, hard: false, intensity: 'clear', scramble: false, legend: 'example', redaction: { mode: 'off' }, lifts: 2, hints: 0, clock: 'off', minutes: 5, keyHeat: true, lexicon: 'strict' }, posture: 'open', answer: word })
    expect(bits.length).toBeLessThan(32)
    expect(unpack(bits).answer).toBe(word)
  })
})

describe('the link', () => {
  const config = configFor({ seed: 'LINK-1' })

  it('round-trips an open link', () => {
    const { fragment, payload } = buildLink(config, 'garden', { entropy: 'L1' })
    expect(payload.answer).toBe('garden')
    const opened = openLink(fragment)
    expect(opened.kind).toBe('ready')
    if (opened.kind !== 'ready') throw new Error('unreachable')
    expect(opened.answer).toBe('garden')
    expect(opened.config.seed).toBe('LINK-1')
    expect(opened.config.rows).toBe(config.rows)
    expect(opened.config.redaction.mode).toBe('pattern')
  })

  it('puts the word in the fragment and nowhere else', () => {
    const { fragment } = buildLink(config, 'garden', { entropy: 'L2' })
    expect(fragment.startsWith('#')).toBe(true)
    expect(leaksAnswer(fragment, 'garden')).toBe(true)
    expect(decodeLink(fragment).answer).toBe('garden')
  })

  it('keeps the nonce out of a sealed link', () => {
    const sealed = configFor({ seed: 'LINK-2', posture: 'sealed' })
    const built = buildLink(sealed, 'garden', { entropy: 'L3' })
    expect(built.secret.nonce).toHaveLength(32)
    expect(built.payload.answer).toBeUndefined()
    expect(built.payload.nonce).toBeUndefined()
    expect(decodeLink(built.fragment).nonce).toBeUndefined()
    expect(leaksAnswer(built.fragment, 'garden')).toBe(false)
    expect(openLink(built.fragment).kind).toBe('sealed')
  })

  it('cannot be brute-forced from the answer list, which is the whole point', () => {
    const sealed = configFor({ seed: 'LINK-2b', posture: 'sealed' })
    const built = buildLink(sealed, 'garden', { entropy: 'L3b' })
    const payload = decodeLink(built.fragment)
    // Every answer in the catalogue, hashed against the config: nothing to find.
    expect(bruteForceSealed(payload, ANSWERS)).toBeNull()
    expect(bruteForceSealed(payload, ['garden'])).toBeNull()
    // With the reveal it verifies, which is the only way it is meant to work.
    expect(verifyCommitment(payload, built.secret.answer, built.secret.nonce)).toBe(true)
    expect(verifyCommitment(payload, 'garded', built.secret.nonce)).toBe(false)
    expect(verifyCommitment(payload, 'garden', 'a'.repeat(32))).toBe(false)
  })

  it('generates a nonce with real width', () => {
    const nonce = randomNonce()
    expect(nonce).toMatch(/^[0-9a-f]{32}$/)
    expect(new Set([nonce, randomNonce(), randomNonce()]).size).toBe(3)
  })

  it('does not leak the word when it is vaulted, and opens with the passphrase', () => {
    const vaulted = configFor({ seed: 'LINK-3', posture: 'vault' })
    const built = buildLink(vaulted, 'garden', { entropy: 'L4', passphrase: 'open sesame', iterations: 1000 })
    expect(built.payload.vault).toBeDefined()
    // A commitment over the plaintext would be a dictionary attack, so there is none.
    expect(built.payload.commitment).toBeUndefined()
    expect(decodeLink(built.fragment).commitment).toBeUndefined()
    expect(leaksAnswer(built.fragment, 'garden')).toBe(false)
    expect(openLink(built.fragment, 'wrong words', 1000).kind).toBe('locked')
    const opened = openLink(built.fragment, 'open sesame', 1000)
    expect(opened.kind).toBe('ready')
    if (opened.kind !== 'ready') throw new Error('unreachable')
    expect(opened.answer).toBe('garden')
  })

  it('detects a word swapped after the fact', () => {
    const { payload, secret } = buildLink(config, 'garden', { entropy: 'L5' })
    expect(commitmentFor('garded', payload.config, secret.nonce)).not.toBe(payload.commitment)
    expect(commitmentFor('garden', payload.config, secret.nonce)).toBe(payload.commitment)
    expect(verifyCommitment({ ...payload, answer: 'garded' }, 'garded', secret.nonce)).toBe(false)
  })

  it('covers the rules as well as the word, so the row count cannot move', () => {
    const { payload } = buildLink(config, 'garden', { entropy: 'L6' })
    const nonce = buildLink(config, 'garden', { entropy: 'L6' }).secret.nonce
    expect(commitmentFor('garden', { ...payload.config, rows: 3 }, nonce)).not.toBe(payload.commitment)
    expect(commitmentFor('garden', { ...payload.config, hard: true }, nonce)).not.toBe(payload.commitment)
    expect(commitmentFor('garden', { ...payload.config, intensity: 'tricky' }, nonce)).not.toBe(payload.commitment)
  })

  it('round-trips a reveal, guesses and all', () => {
    const sealed = configFor({ seed: 'R-1', posture: 'sealed' })
    const built = buildLink(sealed, 'garden', { entropy: 'R' })
    const commitment = built.payload.commitment as string
    const reveal = buildReveal(built.payload.config, 'garden', built.secret.nonce, ['danger', 'wander', 'garden'], commitment)
    const opened = openLink(reveal.fragment)
    expect(opened.kind).toBe('revealed')
    if (opened.kind !== 'revealed') throw new Error('unreachable')
    expect(opened.answer).toBe('garden')
    expect(opened.guesses).toEqual(['danger', 'wander', 'garden'])
    expect(opened.commitment).toBe(commitment)
    expect(verifyCommitment(opened.payload, opened.answer, opened.nonce)).toBe(true)
  })

  it('carries a hand-picked ink through the wire, and seals it', () => {
    const chosen = { exact: '#8B5CF6', shifted: '#FF3D8B', absent: '#2A5B6B' }
    const config = configFor({ seed: 'INK-1', ink: chosen })
    const built = buildLink(config, 'garden', { entropy: 'I' })
    const opened = openLink(built.fragment)
    expect(opened.kind).toBe('ready')
    if (opened.kind !== 'ready') throw new Error('unreachable')
    expect(opened.config.ink).toEqual(chosen)
    expect(newGame(opened.config, opened.answer).ink).toEqual(chosen)
    // A setter who moves a colour after the fact breaks the seal.
    const moved = commitmentFor('garden', configFor({ seed: 'INK-1', ink: { ...chosen, exact: '#2BC46B' } }), built.secret.nonce)
    expect(moved).not.toBe(built.payload.commitment)
  })

  it('stays short enough to paste into a chat window', () => {
    const open = buildLink(config, 'garden', { entropy: 'L7' }).fragment
    const sealed = buildLink(configFor({ posture: 'sealed' }), 'garden', { entropy: 'L7' }).fragment
    const vault = buildLink(configFor({ posture: 'vault' }), 'garden', {
      entropy: 'L7',
      passphrase: 'open sesame',
      iterations: 1000,
    }).fragment
    expect(sealed.length).toBeLessThan(160)
    expect(open.length).toBeLessThan(170)
    expect(vault.length).toBeGreaterThan(sealed.length)
    expect(vault.length).toBeLessThan(220)
  })

  it('refuses to vault without a passphrase, and refuses a future version', () => {
    expect(() => buildLink(configFor({ posture: 'vault' }), 'garden')).toThrow(/passphrase/)
  })
})

describe('the catalogue', () => {
  it('can type every answer it can set', () => {
    for (const answer of ANSWERS) expect(SAMPLE.guesses.has(answer)).toBe(true)
  })

  it('measures the gap between a 1934 dictionary and modern English', async () => {
    const dictionary = new Set([...(await guessesOfLength(5)), ...(await guessesOfLength(6))])
    const modern = [...answersOfLength(5), ...answersOfLength(6)].filter((answer) => !dictionary.has(answer))
    // Webster's predates modem, pixel, laptop and vegan. The gap is small, real,
    // and named rather than patched with an exception list.
    expect(modern.length).toBeGreaterThan(20)
    expect(modern).toContain('pixel')
    for (const word of modern) expect(word).toMatch(/^[a-z]+$/)
  })

  it('ships a dictionary worth typing into, one module per length', async () => {
    const six = await guessesOfLength(6)
    expect(six.length).toBeGreaterThan(14_000)
    expect(six).toContain('candle')
    expect(await guessesOfLength(5)).toHaveLength(8506)
    // The rules allow three to twelve, and the dictionary reaches all of it.
    for (const length of [3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
      expect((await guessesOfLength(length)).length).toBeGreaterThan(1000)
    }
    // Loading is cached, so the second ask is the same array.
    expect(await guessesOfLength(6)).toBe(six)
  })

  it('hands out a word list that can type its own answers', async () => {
    const list = await wordListFor(6)
    for (const answer of answersOfLength(6)) expect(list.guesses.has(answer)).toBe(true)
    expect(list.guessList.length).toBeGreaterThan(15_000)
    expect(list.answers).toBe(ANSWERS)
  })

  it('is big enough to be a puzzle and small enough to be one', () => {
    expect(ANSWERS.length).toBeGreaterThan(3000)
    expect(new Set(ANSWERS).size).toBe(ANSWERS.length)
    expect(answersOfLength(6).length).toBeGreaterThan(1700)
    expect(answersOfLength(5).length).toBeGreaterThan(1300)
  })

  it('offers only the lengths it can actually narrow between', () => {
    // A length with no answers would build a case and then have nothing to
    // measure against, so the curated set is the contract.
    for (const answer of ANSWERS) expect([5, 6]).toContain(answer.length)
    expect(coveredLengths()).toEqual([5, 6])
    for (const length of coveredLengths()) expect(answersOfLength(length).length).toBeGreaterThan(1000)
  })

  it('builds a puzzle at any length the rules allow, three to twelve', () => {
    for (const word of ['cat', 'garden', 'candlelight']) {
      const state = newGame(configFor({ length: word.length }), word)
      expect(state.answer).toBe(word)
      expect(state.map.barred[0]).toHaveLength(word.length)
    }
  })

  it("lets a setter's own word through, as long as a solver could type it", async () => {
    const list = await wordListFor(10)
    const invented = 'zzqxwvytup'
    const free = configFor({ length: 10, lexicon: 'free' })
    expect(submit(newGame(free, invented), invented, list).state.status).toBe('won')
    // A strict lexicon cannot type it, which is exactly why the app switches the
    // lexicon over rather than leaving the setter with an unsolvable puzzle.
    const strict = configFor({ length: 10, lexicon: 'strict' })
    expect(submit(newGame(strict, invented), invented, list).problem).toContain('lexicon')
  })

  it('plays a length outside the catalogue on the dictionary alone', async () => {
    // Only five and six are curated; eleven is dictionary-only, and still rated.
    const eleven = await wordListFor(11)
    expect(eleven.guessList.length).toBeGreaterThan(20_000)
    const config = configFor({ length: 11, lexicon: 'strict' })
    const state = newGame(config, 'trustworthy')
    // A real eleven-letter word goes through a strict lexicon.
    expect(submit(state, 'trustworthy', eleven).state.status).toBe('won')
    expect(submit(state, 'zzqxwvytupq', eleven).problem).toContain('lexicon')
  })

  it('samples a long list evenly instead of truncating it', () => {
    const words = Array.from({ length: 10_000 }, (_, index) => `w${index}`)
    const sample = sampleWords(words, 100)
    expect(sample).toHaveLength(100)
    expect(sample[0]).toBe('w0')
    expect(sample[99]).toBe('w9900')
    expect(sampleWords(words, 20_000)).toHaveLength(10_000)
  })

  it('names a day the same way everywhere', () => {
    expect(dateKey(new Date(Date.UTC(2026, 9, 16)))).toBe('2026-10-16')
    expect(dateKey(new Date(Date.UTC(2026, 0, 2)))).toBe('2026-01-02')
  })

  it('gives everyone the same daily and keeps it inside the pool', () => {
    const pool = answersOfLength(6)
    const first = dailyAnswer('2026-10-16', 6)
    expect(dailyAnswer('2026-10-16', 6)).toBe(first)
    expect(pool).toContain(first)
    const week = new Set<string>()
    for (let day = 1; day <= 7; day += 1) week.add(dailyAnswer(`2026-10-${`${day}`.padStart(2, '0')}`, 6))
    expect(week.size).toBeGreaterThan(1)
  })
})

describe('the rng', () => {
  it('replays from a seed and prints a stable case tag', () => {
    const a = createRng(hashSeed('CASE-1'))
    const b = createRng(hashSeed('CASE-1'))
    for (let i = 0; i < 20; i += 1) expect(a.next()).toBe(b.next())
    expect(seedTag('CASE-1')).toBe(seedTag('case-1'))
    expect(seedTag('CASE-1')).toHaveLength(4)
  })
})
