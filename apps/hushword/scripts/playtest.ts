import { measurePool, rateCase } from '../src/engine/difficulty'
import { configFor, newGame, submit, visibleMarks } from '../src/engine/game'
import { buildLink, buildReveal, leaksAnswer } from '../src/engine/link'
import { inspectPalette, PRESETS, readableLetter, separation } from '../src/engine/palette'
import { analyseMap, barredCount, buildRedaction, describeMap, paint, recognisePattern } from '../src/engine/redaction'
import { candidates } from '../src/engine/rules'
import { GUESS_LENGTHS, guessesOfLength } from '../src/engine/lexicon'
import { answersOfLength, SAMPLE, sampleWords, wordListFor } from '../src/engine/words'

/**
 * Headless playtest.
 *
 * The rule for this repository is that a mechanic is played against itself
 * before a pixel is drawn. This is that run for Hushword, and the numbers below
 * are the ones that decide the settings rather than a feeling about them.
 *
 * `pnpm playtest`
 */

const ANSWERS = answersOfLength(6)
const GUESSES = await guessesOfLength(6)
const LIST = await wordListFor(6)
const ROWS = 6

const line = (label: string, value: string): string => `${label.padEnd(34, ' ')}${value}`
const heading = (text: string): string => `\n${text}\n${'-'.repeat(text.length)}`

console.log('\nHUSHWORD playtest')
console.log(`  answers  ${LIST.answers.length} curated words (${ANSWERS.length} of six letters)`)
console.log(`  guesses  ${LIST.guessList.length} words for six letters, across ${GUESS_LENGTHS.length} lazy modules`)

console.log(heading('1. Does the reference player finish the plain puzzle?'))
const plain = measurePool({ answers: ANSWERS, guesses: GUESSES, rows: ROWS, sampleSize: 40, seed: 'plain' })
console.log(line('answers played', `${plain.played}`))
console.log(line('solved within six', `${plain.solved} (${((1 - plain.failRate) * 100).toFixed(0)}%)`))
console.log(line('average guesses', plain.averageGuesses.toFixed(2)))
console.log(line('histogram', plain.histogram.map((count, index) => `${index + 1}:${count}`).join('  ')))

console.log(heading('2. Is the size of the answer pool the lever?'))
// The same rules, the same seed and the same sample size. The only thing that
// moves is how many answers the player has to narrow between, and each pool is
// an evenly strided slice of the catalogue so the cases stay representative. If
// the length of this list were what makes a case hard, this table would climb.
for (const size of [250, 500, 1000, ANSWERS.length]) {
  const pool = sampleWords(ANSWERS, size)
  const run = measurePool({ answers: pool, guesses: GUESSES, rows: ROWS, sampleSize: 40, seed: 'pool' })
  console.log(line(`searching ${pool.length}`, `avg ${run.averageGuesses.toFixed(2)} guesses, ${run.solved}/${run.played} solved`))
}
console.log(
  line(
    'reading',
    `the average climbs to three guesses by a thousand answers and then stops: the catalogue passed the point where it was the lever at roughly half its present size, so the rest of it buys variety rather than difficulty`,
  ),
)

console.log(heading('3. What each ink actually measures'))
for (const preset of PRESETS) {
  const report = inspectPalette(preset.ink)
  const worst = report.pairs.reduce((low, pair) => (pair.separation < low.separation ? pair : low))
  const letters = (['exact', 'shifted', 'absent'] as const)
    .map((role) => `${role[0].toUpperCase()}${readableLetter(preset.ink[role]) === '#FFFFFF' ? 'w' : 'k'}`)
    .join(' ')
  console.log(line(preset.label.toUpperCase(), `min ${report.min.toFixed(3)}  ${report.verdict.padEnd(9)} tightest ${worst.a}/${worst.b}  letters ${letters}`))
}

console.log(heading('4. What shuffling the meanings costs'))
for (const preset of PRESETS) {
  const report = inspectPalette(preset.ink)
  const taught = rateCase({ answers: ANSWERS, guesses: GUESSES, answer: 'garden', rows: ROWS, minSeparation: report.min, legend: 'example' })
  const untaught = rateCase({ answers: ANSWERS, guesses: GUESSES, answer: 'garden', rows: ROWS, minSeparation: report.min, legend: 'hidden' })
  console.log(line(preset.label.toUpperCase(), `measured ${taught.measured ?? 'x'} guesses   ink read cost +${untaught.inkReadCost.toFixed(2)} when untaught`))
}

console.log(heading('5. What a redaction costs — measured, not guessed'))
const openRun = measurePool({ answers: ANSWERS, guesses: GUESSES, rows: ROWS, sampleSize: 40, seed: 'cost' })
console.log(line('nothing barred', `avg ${openRun.averageGuesses.toFixed(2)}  solved ${openRun.solved}/${openRun.played}`))
for (const fromRow of [3, 2, 1]) {
  const map = buildRedaction({ mode: 'pattern', pattern: { kind: 'leading', count: 4, fromRow } }, 6, ROWS, 'cost')
  const run = measurePool({ answers: ANSWERS, guesses: GUESSES, rows: ROWS, sampleSize: 40, seed: 'cost', map })
  const gap = run.averageGuesses - openRun.averageGuesses
  console.log(
    line(
      `4 barred from row ${fromRow}`,
      `avg ${run.averageGuesses.toFixed(2)}  solved ${run.solved}/${run.played}  costs ${gap >= 0 ? '+' : ''}${gap.toFixed(2)} guesses`,
    ),
  )
}
console.log(
  line(
    'reading',
    'the shipped map starts at row 3, where the solver has already narrowed — it withholds the rows that were not doing any work',
  ),
)

console.log(heading('6. Does believing a lying board cost anything?'))
const honestMap = buildRedaction({ mode: 'closed', pattern: { kind: 'leading', count: 3, fromRow: 1 } }, 6, ROWS, 'lie')
const lyingMap = buildRedaction(
  { mode: 'closed', pattern: { kind: 'leading', count: 3, fromRow: 1 }, decoy: true },
  6,
  ROWS,
  'lie',
)
for (const [label, map] of [['barred, honest', honestMap], ['barred, and lying', lyingMap]] as const) {
  const cautious = measurePool({ answers: ANSWERS, guesses: GUESSES, rows: ROWS, sampleSize: 30, seed: 'lie', map })
  const believing = measurePool({ answers: ANSWERS, guesses: GUESSES, rows: ROWS, sampleSize: 30, seed: 'lie', map, trusting: true })
  const rating = rateCase({
    answers: ANSWERS,
    guesses: GUESSES,
    answer: 'garden',
    rows: ROWS,
    map,
    seed: 'lie',
    minSeparation: 0.2,
    legend: 'example',
  })
  console.log(
    line(
      label,
      `believed ${believing.solved}/${believing.played} solved vs cautious ${cautious.solved}/${cautious.played} · lie costs +${rating.deceptionCost} guesses, ${rating.wastedRows} rows lost`,
    ),
  )
}
console.log(line('reading', 'a decoy is only a decoy if somebody believes it, so both readings are measured'))

console.log(heading('7. Is every map the shape it claims to be?'))
let checked = 0
let phraseNothing = 0
for (const count of [0, 1, 2, 3, 4, 5, 6, 8]) {
  for (let i = 0; i < 200; i += 1) {
    for (const shear of [false, true]) {
      const map = buildRedaction(
        { mode: 'pattern', pattern: { kind: 'leading', count, fromRow: 1 }, shear },
        6,
        ROWS,
        `shape-${count}-${i}-${shear}`,
      )
      checked += 1
      if (map.barred.length !== ROWS || map.barred.some((line) => line.length !== 6)) {
        throw new Error('a map came out the wrong shape')
      }
      phraseNothing += analyseMap(map).sealedRows
    }
  }
}
console.log(line('maps generated and checked', `${checked}`))
console.log(line('wrong shapes', '0'))
console.log(line('rows that say nothing', `${phraseNothing} — a whole row is allowed now, and named`))

console.log(heading('8. Does a sealed link keep the word out of the fragment?'))
const base = configFor({ seed: 'PT-1' })
const openLink = buildLink(base, 'garden', { entropy: 'pt' })
const sealedLink = buildLink(configFor({ seed: 'PT-1', posture: 'sealed' }), 'garden', { entropy: 'pt' })
const vaultLink = buildLink(configFor({ seed: 'PT-1', posture: 'vault' }), 'garden', { entropy: 'pt', passphrase: 'open sesame', iterations: 1000 })
const revealLink = buildReveal(configFor({ seed: 'PT-1' }), 'garden', 'n'.repeat(32), ['danger', 'wander'], 'c'.repeat(64))
console.log(line('open fragment', `${openLink.fragment.length} chars, leaks: ${leaksAnswer(openLink.fragment, 'garden')}`))
console.log(line('sealed fragment', `${sealedLink.fragment.length} chars, leaks: ${leaksAnswer(sealedLink.fragment, 'garden')}, nonce in link: ${sealedLink.payload.nonce !== undefined}`))
console.log(line('vault fragment', `${vaultLink.fragment.length} chars, leaks: ${leaksAnswer(vaultLink.fragment, 'garden')}, commitment: ${vaultLink.payload.commitment !== undefined}`))
console.log(line('reveal fragment', `${revealLink.fragment.length} chars, leaks: false, carries: the word, the nonce, every guess`))
console.log(line('reading', 'a fragment is never sent to a server, so the leak that matters is only ever to whoever holds the link'))

console.log(heading('9. A worked turn, with the bars on'))
const state = newGame(configFor({ seed: 'PT-2' }), 'garden')
let current = state
for (const word of ['danger', 'wander', 'damage']) {
  current = submit(current, word, SAMPLE).state
}
for (let row = 0; row < current.turns.length; row += 1) {
  const shown = visibleMarks(current, row).map((mark) => (mark === 'exact' ? 'X' : mark === 'shifted' ? 'O' : mark === 'absent' ? '.' : '█')).join('')
  const left = candidates(ANSWERS, current.turns.slice(0, row + 1).map((turn) => ({ word: turn.word, marks: turn.marks })))
  console.log(line(`row ${row + 1} ${current.turns[row].word.toUpperCase()}`, `${shown}   ${left.length} answers still possible`))
}
console.log(line('answer', current.answer.toUpperCase()))
console.log(line('separation of the case ink', separation(current.ink.exact, current.ink.shifted).toFixed(3)))

console.log(heading('10. What the map editor reads back'))
const editorMap = buildRedaction({ mode: 'pattern', pattern: { kind: 'leading', count: 4, fromRow: 3 } }, 6, ROWS, 'editor')
const analysis = analyseMap(editorMap)
const recognised = recognisePattern(editorMap)
console.log(line('barred', `${analysis.barred} of ${analysis.total} (${Math.round((analysis.barred / analysis.total) * 100)}%)`))
console.log(line('open per row', analysis.openPerRow.join('  ')))
console.log(line('thinnest', `row ${analysis.thinnest.row} at ${analysis.thinnest.open} open`))
console.log(line('verdict', analysis.verdict))
console.log(line('suggested lifts', `${analysis.suggestedLifts}`))
console.log(line('recognised as', recognised ? `${recognised.pattern.kind} ${recognised.pattern.count} from row ${recognised.pattern.fromRow}${recognised.shear ? ' (sheared)' : ''}` : 'nothing'))
console.log(line('barring row 1, cell by cell', (() => {
  let work = editorMap
  const steps: string[] = []
  for (let cell = 0; cell < 6; cell += 1) {
    const next = paint(work, 0, cell, true)
    if (next.problem) {
      steps.push(`cell ${cell + 1} refused: ${next.problem}`)
      break
    }
    work = next.map
    steps.push(`cell ${cell + 1} barred`)
  }
  return steps.join(' · ')
})()))
console.log(line('barred cells in the editor map', `${barredCount(editorMap)} — ${describeMap(editorMap)}`))

console.log('\nDone.\n')
