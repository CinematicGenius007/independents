# Hushword

Working notes and spec for a browser-only word game. No account service, no game
server, no hosted database — the constraint every app in this repository is built
under.

Design direction is in Paper: *Wordle* file, three artboards, one per visual register.

## The idea in one sentence

Wordle hands you three colours and their meanings on a permanent, shared contract.
**Hushword breaks that contract.** Every link carries its own colour language and its
own redaction map, so the puzzle is not only *what word is it* — it is *what is this
board even telling me*.

A link with every option switched off is exactly Wordle, and that baseline has to be
perfect before any variation earns its place.

## The variation catalogue

Every item is opt-in. Nothing here changes the win condition: the win is still
`guess === answer`, which keeps the game decidable even when the board withholds.

### Board shape

| Option | Range | Notes |
| --- | --- | --- |
| `length` | 3–12 | Word length. |
| `rows` | 3–12 | Guesses allotted. |
| `hard` | on/off | Revealed letters must be reused in later guesses. |

### Ink — the colour language

| Option | Values | Notes |
| --- | --- | --- |
| `palette` | any three colours | The setter chooses which colour means hit, near and miss. |
| `intensity` | clear / crisp / tricky / cruel | One dial for the whole ink: house meanings, house hues shuffled, two of three pulled together, or all three reading as one family. |
| `scramble` | off/on | The *mapping* is shuffled per link, seeded, and never left as the identity. |
| `legend` | `shown` / `calibration` / `hidden` | How the solver learns the code. |
| `texture` | off/on | Adds a per-state texture so the code survives without hue. |

`legend` is the real invention:

- **shown** — the legend is printed at the top of the board. Easy, and the right
  default for a first-time player.
- **calibration** — one row is pre-filled and annotated with its true colours, so the
  solver recovers the whole code from a single worked example. The middle ground, and
  the one the design is built around.
- **hidden** — no legend at all. The code is inferred from how the board behaves. This
  is always winnable, because the win condition never depended on reading a colour;
  the solver is simply playing blind to the hints and reading the code out is a second
  deduction layered on the first.

### Redaction — withheld cells

A redacted cell shows the letter and withholds the heat. Three sub-mechanics and three
modifiers:

| Option | Values | Notes |
| --- | --- | --- |
| `redactMap` | `open` / `pattern` / `closed` | `open`: the map is visible before turn one, so it is a planning constraint. `pattern`: a repeating rule — "leading four, rows 3 and down" — so it reads as structure rather than noise. `closed`: the solver does not know which cells are barred until after committing. |
| `decoy` | off/on | Barred cells render a *wrong* colour rather than a withheld one. The board actively misleads. Brutal; off by default. |
| `shear` | off/on | The redaction window shifts one cell per row, so the holes walk diagonally down the board. |
| `budget` | 0–n | The setter *grants* the solver n **lifts**: spending one pulls a single bar back and reveals what it hid. Turns a handicap into a resource-management decision. |

### Aids and pressure

`hints` (free letter reveals — built: the setter grants them, the solver spends one
on a position), `clock` (counting up or down — built, and counting down is a real
loss), `lexicon` (a real dictionary or any letters — built, and it defaults to any
letters for a custom puzzle), `keyState` (does the on-screen keyboard carry
used-letter heat or stay clean? — built, and off means they have to remember).

### Social

`daily` (a deterministic board from the catalogue, seeded by date, identical for
everyone, no link needed), `archive`, `sheet` (the spoiler-free result grid), `duel`
(one word, two sheets, compared side by side).

## Two rules that came out of writing the spec

Both are generation-time constraints, not UI polish. They exist because the mechanics
break without them.

**A row can say nothing.** The engine used to refuse a map that barred a row end
to end, on the grounds that a row with nothing legible in it is not a clue. That
guard is gone, on request and rightly: it was a rule the engine had invented, and
the setter is the one who knows what they are making. `analyseMap` still counts the
rows that say nothing, so the cost is visible without being enforced — and a puzzle
where every cell is dark is still winnable, because a win is `guess === answer` and
is decided from the truth. The chrome announces it; the grid is under no obligation
to explain.

**A filled cell's letter colour is chosen against its ink, not once for the whole
board.** Measured by the engine: white on the house amber is 2.30:1 and fails; near-black
on the same amber is 7.94:1 and passes. So the rule is *dark ink takes a light letter,
light ink takes a dark letter*. Scrambled palettes make this load-bearing rather than
cosmetic, because the setter can pick any three colours and the solver still has to read
every letter.

The floor is the **large-text** threshold of 3:1, not 4.5:1. The first version of the
engine enforced 4.5:1 and rejected the shipped green at 4.35:1 — but across every possible
colour the better of a light and a dark letter tops out at about 4.27:1, so the stricter
floor would have condemned a narrow band for no operational reason. 4.5:1 is still
measured and reported as advice, because the on-screen keyboard reuses the same ink at a
smaller size. The house green draws that advice.

**A scrambled code with no key and no worked example is a coin flip.** `separation()`
— half lightness, half deuteranopia-simulated distance — decides it. Below **0.10** the
generator refuses an untaught code outright; above **0.15** two inks are unmistakably
different. The house ink sits at **0.163**, Tricky at 0.068, Cruel at 0.047.

## Sharing without a server

This is the part worth being blunt about.

> If the browser can grade a guess instantly, the answer is in the browser, and the key
> would be sitting in the link next to it. Encryption cannot fix that.

Any table that lets a solver play also lets a solver search it: feedback is a total
function of the answer, so an oracle in the client is an answer in the client. That
leaves four honest postures, and the setter picks one.

**Open — the default.** The word travels in the URL **fragment** (`#…`), never in the
path or query. Fragments are never sent to a server, so even hosted, no server, log or
CDN ever sees the word. Payload is deflate plus base64url. This is privacy from
infrastructure, not from the solver, and the UI says so.

**Sealed — enforced.** The share link holds only
`SHA-256(salt ‖ rules ‖ answer)`; the word never leaves the setter's browser. The
protocol is the one Sealed Orders already uses in this repository: the solver plays,
returns a receipt of their guesses, the setter's browser grades it and publishes a
reveal link carrying the full feedback grid, the answer and the nonce, and the solver
recomputes the commitment. Cheating is prevented, and the cost is three hops over chat.
Best for a duel, not for sharing with the world.

**Vault — genuinely encrypted.** An optional passphrase, PBKDF2-HMAC-SHA-256 to
AES-GCM. The link alone is inert; the passphrase travels in a second message. This is
the only mode where the link is real ciphertext, and the only one where holding the
link is not the same as holding the answer.

**Taint — makes Open defensible.** Every link carries a commitment to its own answer,
so a setter cannot swap the word after someone has played it. And revealing the answer
inside the app is a deliberate two-step that permanently stamps the result sheet
**PEEKED**, which the solver cannot remove before sending it on. Cheating is not
prevented; it is recorded, and visible to whoever receives the sheet.

### Daily

`SHA-256("hushword:v1:daily:" + YYYY-MM-DD)` indexes the catalogue. Deterministic, no
server, the same board for everyone on the same day, and the same word for a whole
group without anybody agreeing on anything.

## Difficulty is measured, not guessed

From the answer's feedback signature, compute the expected surviving-candidate count
after each row, plus the share of the candidate set eliminated per turn. That gives a
per-link label — "solves in ~4.1 guesses, 18% fail rate for a median player" — instead
of a vibe. The `CASE READOUT` panel in the design shows the live version: candidates
remaining against the pool.

## Motion

Six moves cover the whole game. All values are the spec handed to the engineer.

| Move | Trigger | Timing |
| --- | --- | --- |
| **Ink drop** | a row is submitted | each cell fills with a wipe from the top-left, 12 ms stagger per cell, 180 ms `cubic-bezier(.2,.8,.2,1)`; letters do not move while the ink sweeps under them |
| **Redaction sweep** | a cell is barred | the bar slides across in 140 ms; the heat colour bleeds out behind it rather than snapping off |
| **Lift** | a lift is spent | the bar retracts upward 140 ms with a 2 px settle bounce; the revealed colour fades up under it |
| **Colour scramble** | the link's palette is first shown | the legend swatches cross-fade through a half-tone dissolve over 320 ms, so the solver notices the code differs from the one they know |
| **Stamp** | the game ends | the stamp lands at 4° with 6% overshoot in 220 ms, and the paper shifts 1 px |
| **Retract** | a win on a redacted row | all bars on that row retract together, 40 ms stagger, 260 ms each |

Reduced motion replaces every one of these with an opacity cross-fade and keeps the
12 ms stagger as a 0 ms stagger.

## Direction

Four registers were explored against the same puzzle — turn 3, four barred cells, a
scrambled code recovered from the example row — so they could be compared
apples-to-apples.

**Nocturnal arcade is the chosen direction.** Wet asphalt ground, hot pink and cyan,
lit tiles with a glow on anything that carries meaning, a scanline pass over the whole
room, and a dashed dark slot where a cell has not been played. The three rejected
registers are recorded here only so nobody rebuilds on them:

- *Declassified dossier* — cool copier white on a steel desk, toner black, one
  stamp-pad red, hairline rules instead of cards.
- *Riso press room* — cool paper, riso blue and fluorescent pink, hard offset shadows
  standing in for ink misregistration, condensed press type.
- *Minimal* — white ground, the board as the only colour on the page. Rejected because
  a game whose entire subject is colour should not be shy about it.

**01 · Declassified dossier.** Cool copier white on a steel desk, toner black, one
stamp-pad red, cold process blue for anything interactive. Hairline rules instead of
cards, dotted-leader form fields, row numbers down the margin like a printed form. The
redaction bar is the visual signature. Archivo for display, Space Mono for every label
and figure.

**02 · Riso press room.** Cool paper, riso blue and fluorescent pink, hard offset
shadows standing in for ink misregistration, a dot grid on the ground, thick printed
rules. Bricolage Grotesque condensed for display — press-poster type — over Space Mono.

**03 · Nocturnal arcade.** Wet asphalt, hot pink and cyan, glowing filled cells, a
scanline pass over the whole room, dashed empty tiles that read as dark slots. Space
Grotesk over Space Mono, with the numbers set to a wide-track label rhythm.

What is deliberately shared across all three: the single-accent rule (the brand colour
is never one of the three feedback colours — green, amber and grey are reserved for
data, and a brand colour that collided with a hint would be a bug, not a taste
problem), the letter-against-ink contrast rule, the fixed-width row lanes for the
margin annotations, and the layout skeleton, so the difference is voice and not
structure.

## What is designed

Six screens exist in the Paper file, all in the arcade register:

| Screen | What it settles |
| --- | --- |
| **Play** | The hero board: the calibration row, the redacted row, the ink key, the redaction map, the lift budget, the live candidate count. |
| **Mobile play** | The same puzzle at 390×844. The rails collapse into a legend strip and one readout line; the keyboard sits low for thumbs. |
| **Field manual** | Twelve cards, one per variation, each with a tiny example grid. The page that explains the idea in five seconds. |
| **Compose** | The rule builder: word, length, rows, the three ink roles with swatch pickers, scramble, legend mode, redaction map, decoys, shear, lift budget, aids — plus a live preview, a live difficulty readout, and the four sharing postures. |
| **Motion** | Six keyframe strips with timings, drawn as real intermediate states rather than described. |
| **Daily and share** | The date-seeded daily, the spoiler-free sheet, the pasted result, the `PEEKED` inset, and the four sharing postures side by side. |
| **The ink editor** | The intensity dial (clear / crisp / tricky / cruel), the three roles with swatch pickers, the seeded shuffle, the separation meter, and a real deuteranopia comparison. |
| **The map editor** | A paintable grid with the guard enforced at the stroke, the same shape recognisable as a sentence, the declared/withheld choice, decoys, shear, and the lift grant. |
| **Map editor, mobile** | The same brush on a phone. It fits: 46px cells are above the 44px minimum touch target, so nothing has to be given up to the smaller screen. |

## Where the build stands

The engine and the interface are both built: `apps/hushword`, 101 tests, a headless
playtest, no dependency beyond React, no backend. It is a static bundle and nothing
else — the typefaces are committed as WOFF2 rather than fetched from a CDN or taken
as npm packages, so that the word "dependency" keeps meaning what it says. Read its
README for the five things the playtest changed, because three of them were mistakes
in *this* document — a letter contrast figure, a separation floor, and a guessed
guess-count.

Everything that was open here has since been closed, and two of the closings were
mistakes rather than gaps:

- **The catalogue is real, and its size is not what makes a case hard.** 3,618 curated
  answers — 2,018 of six letters, 1,600 of five — and 175,472 dictionary guesses covering
  every length from three to twelve, held as two pools so the reference player narrows
  among one and probes among the other. The first version of this claim was wrong.
  Expanding the answers from 724 to 1,780 did move the average from 2.88 guesses to 3.10,
  which read as a flattening curve; playing the same list strided down to 250, 500 and
  1,000 gives 2.65, 2.70 and 3.05 against 3.02 for the full 2,018. The climb stops at
  about a thousand answers. So the remaining distance to a Wordle-like 3.9 is neither
  pool size nor the words being chosen too *common* — it is the player model, which
  narrows optimally and reads the ink perfectly once taught. The costs a person pays are
  measured separately, and they come to more than the gap.
- **A puzzle may be any length from three to twelve, and any word at all.** The dictionary
  now reaches the whole range the rules allow: ten lazy modules, one per length, 18,843
  words at twelve. Every length is therefore rated, and the free lexicon is a choice a
  setter makes rather than one the engine forces on them. This reverses a decision
  recorded here earlier — the list was shrunk back on the argument that outside four to
  nine it was doing neither of its two jobs. It is doing both now, because a *sample* of
  it is enough to rate against, and a setter is allowed to type a word we do not have.
- **What a redaction costs is measured, and the answer is a surprise:** the shipped
  default costs nothing, because it withholds rows 3 to 6 and by then the solver has
  usually narrowed to one candidate. Starting the same map at row 1 costs +1.79 guesses
  and halves the solve rate. The compose screen shows the number live.
- **A decoy is now modelled rather than explained away.** A barred cell that reports a
  wrong colour is a board that argues, and a solver who believes it solves 0 of 30
  cases where the cautious solver solves 27. The playtest runs both readings.
- **The link is packed to bits** — 108 open, 60 sealed, 105 vaulted, 119 for a reveal,
  down from 288 / 273 / 460. Writing it exposed three flaws, all fixed: a sealed link
  whose nonce was derived from a seed that was also in the link, a vaulted link that
  carried a commitment over its own plaintext, and a five-bit length field that could
  not hold a 32-character nonce and silently wrote zero instead.
- **The interface renders and plays.** Hash routing, because a puzzle already *is* a
  fragment. The board is the input rather than a separate field, a submitted row is
  held back and then told a cell at a time, the three colours are settable by hand with
  the engine refusing an illegible result, the daily ships in a clean dressing as well
  as the puzzle, and a sealed puzzle can be graded into a reveal the solver can check.

Still open, and stated in the engine's README: a long word still pulls a large
dictionary module, the answer list is small for a shipped game, the deception a decoy
performs is not modelled, and nothing is remembered between visits.

## Open questions

- Whether `legend: hidden` is fun or merely hard. It is the most novel mode and the
  most likely to need a playtest before it ships.
- Whether `decoy` should exist at all: a board that lies is a different game from a
  board that withholds.
- Whether the daily should be one board or a small set, since a 6×6 with the classic
  inks is a different commitment than a redacted one.
- Whether `Vault` earns its complexity given `Sealed` already covers the adversarial
  puzzle.
