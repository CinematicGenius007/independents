# Hushword

A word game where every link carries its own colour language and its own redacted
cells. No account service, no game server, no hosted database — a puzzle travels in
the URL.

```bash
pnpm install
pnpm dev          # the app
pnpm test         # 96 tests: the engine, and the app as somebody uses it
pnpm type-check
pnpm playtest     # plays the catalogue against itself and prints the findings
pnpm lexicon      # regenerates the guess pool from the system dictionary
```

## What it is

Wordle hands you three colours and their meanings on a permanent, shared
contract. Hushword breaks that contract. A link decides what its three colours
mean, which cells are allowed to tell you anything, and how many guesses you get,
so the puzzle is not only *what word is it* — it is *what is this board even
telling me*.

Switch everything off and you have Wordle. That baseline is the default puzzle.

## The rules

**The feedback is the ordinary two-pass one.** A repeated letter consumes a
repeated letter, so guessing two R's against a word holding one earns one shifted
and one absent, in that order. A solver that disagrees with the board is
unplayable, so almost everything else is built on this being exactly right.

**Three rules came out of writing it. The first one has since been withdrawn.**

1. *A row can say nothing, if that is what you want.* The engine used to refuse a
   map that barred a row end to end, on the grounds that a row with nothing
   legible in it is not a clue. That guard is gone, on request and rightly: it was
   a rule the engine had invented, and the setter knows what they are making.
   `analyseMap` counts the rows that say nothing, so the cost is visible without
   being enforced — and a board with every cell dark is still winnable, because a
   win is `guess === answer`, decided from the truth, and the chrome announces it.

2. *A letter colour is chosen against its own ink, never once for the board.*
   White on the house amber reads at 2.30:1 and fails; near-black on the same
   amber reads at 7.94:1 and passes. The floor is the large-text threshold of
   3:1, because a tile letter is 30px and bold by construction — holding it to
   4.5:1 rejected the shipped green at 4.35:1, and across every possible colour
   the better of a light and a dark letter tops out at about 4.27:1. The 4.5:1
   target is measured and reported as advice, since the keyboard reuses the same
   ink smaller.

3. *A scrambled code with no key and no worked example is a coin flip.*
   `separation()` — half lightness, half deuteranopia-simulated distance — decides
   it. Below **0.10** the generator refuses an untaught code; above **0.15** two
   inks are unmistakably different. The house ink sits at 0.163, Tricky at 0.068,
   Cruel at 0.047.

## The catalogue is in two halves

| | | |
| --- | --- | --- |
| **answers** | 3,618 hand-curated words — 2,018 of six letters, 1,600 of five | what a puzzle may be set to |
| **guesses** | 175,472 from Webster's Second International, three to twelve letters | what a solver may type |

The split is not bookkeeping. It is what makes the difficulty number mean
something: the reference player narrows its beliefs among the *answers* while
probing among the *guesses*, which is the position a person is in. Measuring
against one merged list — as the first version did — makes both the search and
the keyboard wrong at once.

**Where the catalogue stops being the lever, measured.** Playing the six-letter
answers strided down to 250, 500 and 1,000 words gives 2.65, 2.70 and 3.05
guesses; the full 2,018 gives 3.02. The average climbs until there are about a
thousand answers to narrow between and then flattens, so the second half of the
list buys variety — a daily that comes round less often — rather than difficulty.
It is described that way here rather than credited with a hardness it does not
have.

**The answers were gap-filled by diff, not by memory.** The first pass at the list
was written from memory, and memory is strong on the words a person reaches for
and blind to the ordinary ones just outside that reach. `FIVE_GAPS` and `SIX_GAPS`
in `answers.ts` are the output of diffing Webster's against the list and keeping
the 443 words still plainly in use. The diff settled a question as well: of the
13,000 six-letter entries the list was missing, nearly all were archaic — `abacay`,
`acoin`, `adital` — so a 1934 dictionary can be *read* for answers but not mined
for them.

**Three to twelve letters, and the dictionary reaches all of it.**

| Length | Answers | Dictionary | What the composer says |
| --- | --- | --- | --- |
| 5–6 | curated | yes | rated against the catalogue |
| 3–4, 7–12 | none | yes | rated against a sample of the dictionary, which reads easier than the real thing |

The dictionary is one module per word length and arrives when a word of that
length is needed, so a six-letter puzzle never downloads the twelve-letter list —
and each module is **front-coded**, a shared-prefix length and a tail, which is
worth about a quarter of the bytes on sorted English. The nine-letter list costs
77 KB gzipped instead of 103, and the twelve-letter list — the largest at 18,843
words — costs 67.

Five and six are still the only lengths with a curated answer list, and that is
the *daily's* contract rather than the game's: a daily has to be fair to
strangers, so it draws from a pool somebody judged. **A setter's own word is not
restricted:** a puzzle made for friends may be a
nickname, a surname, a word from another language or a word that has not been
coined yet, so the composer checks the shape and nothing else. What it does *say*
is whether the word is one it recognises — catalogued, real, or neither — because
that is worth knowing and not worth enforcing. The lexicon defaults to **any
letters accepted** for the same reason: a friend who cannot type their guess is
not being tested, they are being blocked.

The dictionary is also a 1934 one, so it predates `modem`, `pixel`, `laptop` and
`vegan`. The union is the only way to guarantee the obvious property: anything the
game will set as an answer, a solver is allowed to type. The gap is small enough to
measure rather than patch with an exception list, and the test suite measures it.

## Sharing without a server

> If a browser can grade a guess instantly, it is holding the answer, and a key in
> the link would be sitting next to it.

Any table that lets a solver play also lets a solver search it, because feedback
is a total function of the answer. So there are three postures, and only one of
them encrypts anything.

| Posture | Fragment carries | Worth |
| --- | --- | --- |
| **open** | the answer | Fragments are never sent to a server, so no host, log or CDN sees the word. It is not a secret from the solver, and the app says so. |
| **sealed** | a commitment and nothing else | The word and the nonce stay with the setter. The solver plays, sends their guesses back, and the setter's browser grades them. |
| **vault** | ChaCha20 ciphertext and an HMAC-SHA-256 tag | Inert until the passphrase arrives. PBKDF2-HMAC-SHA-256 at 150,000 iterations, encrypt-then-MAC, tag compared without an early exit. |

The commitment covers everything that decides the puzzle, not just the word: a
setter who changes the row count after the fact breaks the seal exactly as loudly
as one who changes the answer.

The hashing, the cipher and the key derivation are all in this package, with no
dependency and nothing to `await`, because a puzzle that cannot be opened from a
plain file is not much of a puzzle. `crypto.subtle` answers asynchronously and
only on a secure origin. Everything is checked against the published vectors —
FIPS 180-4, RFC 4231, RFC 6070, RFC 8439 — rather than trusted because it looks
right.

## The wire

The first format was JSON with short keys: 273 characters for a sealed link, and
its keys cost more than the answer did. It is now packed to bits — **108 open,
60 sealed, 105 vaulted, 119 for a reveal** on the six-letter house case, and the
playtest prints the current four — and, more usefully, it is the place where the
*shape* of a link is stated rather than implied by whichever fields happened to be
set.

Three fields are absent by design rather than merely optional: the answer unless
the posture is `open` or `reveal`; the nonce unless the posture is `open` or
`reveal`; and the commitment when the posture is `vault`.

**Three flaws the packed format exposed, because it forced every field to
justify itself.**

- **A sealed link with the nonce beside the commitment was not sealed.** The
  commitment is `SHA-256(config ‖ answer ‖ nonce)`. The nonce was being derived
  from the seed, which is in the link — so with a curated answer pool of a couple
  of thousand words, anybody holding the link could hash every candidate and read
  the answer off in milliseconds. The nonce is now 128 bits, generated at build
  time, and it never travels in a sealed link. There is a test that brute-forces
  the link over the whole catalogue to prove it.
- **A vaulted link with a commitment over the plaintext was not encrypted.**
  Same attack, and the HMAC tag already authenticates the ciphertext properly. A
  vault carries no commitment at all.
- **A 32-character nonce does not fit in a five-bit length field.** It wrote the
  low five bits of 32, which is zero, so every reveal silently decoded to nothing
  — the right answer, no nonce, six words of gibberish as the guesses. The length
  field is six bits wide and `writeString` now throws rather than truncating. The
  bug was invisible in the sealed links, which carry no nonce at all, and only
  appeared when a reveal had one to carry.

The nonce is not a detail of the commitment scheme. It *is* the scheme.

## What the playtest changed

`pnpm playtest` plays the catalogue against itself. It found five things, and all
five changed the code.

**The shipped green failed its own legibility rule** — see rule 2 above.

**The separation thresholds were wrong the way a guess is wrong.** The first pair
was 0.12 and 0.20. Against those, the house ink rated merely *tight* — the default
palette, alarming the setter for nothing. The pair is now 0.10 and 0.15, chosen so
the four shipped presets land one to an obvious verdict each.

**The link was too long**, and fixing it found the two cryptographic flaws above.

**Withholding cells changes nothing a perfect player can do — and that is the
finding, now measured rather than assumed.**

```
nothing barred                    avg 3.08  solved 40/40
4 barred from row 3               avg 2.88  solved 34/40  costs -0.19 guesses
4 barred from row 2               avg 3.44  solved 27/40  costs +0.37 guesses
4 barred from row 1               avg 4.87  solved 15/40  costs +1.79 guesses
```

The cost of a redaction is entirely a question of *when* it starts. The shipped
default begins at row 3 — by which point the reference player has usually already
narrowed to one candidate, so it withholds the rows that were not doing any work,
and costs nothing. Start at row 1 and it more than doubles the fail rate. The
compose screen now reports that number live, so the setter can see what they are
choosing.

What is *not* modelled is the deception: a decoyed cell is a lie, and the honest
thing a careful player does with a lie it cannot detect is treat it as noise, so
decoys are modelled as uninformative. A decoyed map therefore measures the same as
a barred one. The information loss is measured; the betrayal is not.

**The deception a decoy performs is now measured, and it is ruinous.** A decoyed
cell reports a wrong colour, and the wrongness is derived from the answer — so it
cannot be modelled as a function of the candidate, and a solver who *believes* the
board narrows to a smaller and wrong set rather than to nothing. The playtest runs
both readings:

```
barred, honest                    believed 27/30 solved vs cautious 27/30 · lie costs +0 guesses, 0 rows lost
barred, and lying                 believed 0/30 solved vs cautious 27/30 · lie costs +3 guesses, 5 rows lost
```

A decoy is not a redaction with the information removed. It is a board that
argues, and the honest number for it is the one above.

**Five tests failed on their first run** because the words they used were not in
the catalogue, and one answer-list entry was a typo of mine (`founde`). Then a
later expansion quietly added twenty-five *seven*-letter words to the six-letter
list. The dictionary check is now part of the suite and the lengths are asserted,
so both fail the build rather than shipping.

## The app

React and Vite, one entry chunk, no router — the hash is already the link, so
`#/compose` is a page, `#/grade` is a page, and anything else that is not empty is
a puzzle. Styling is the arcade design from the Paper file: the scanline ground, the
ink drop, the redaction sweep, the stamp, one column under 60rem, and
`prefers-reduced-motion` dropping every animation while keeping the states.

**The typefaces are in the repository, not behind a CDN.** Space Grotesk and Space
Mono are committed as latin-subset WOFF2 in `src/assets/fonts/` with their OFL
licences beside them, which is why a page that promises "no server, no account" no
longer makes a request to `fonts.googleapis.com` on load. The other apps here use
`@fontsource/*` packages; this one deliberately does not, because its own
documentation promises *no dependency beyond React* and spending a package on two
files would make that sentence false. Only the weights the design renders are
included — the previous Google request asked for Grotesk 500, which nothing used —
and the subsets were read out of their font tables rather than assumed, since
"latin" quietly carries the minus sign the steppers need (U+2212) and the middot in
the readout (U+00B7).

**The board is the input.** There is no separate field: the row you are filling in
is a row of the grid, each letter pops in as it is typed, and a rejected guess
shakes the row rather than only raising a toast.

**The board and the keyboard are sized together, and both are measured.** Ten keys
at their comfortable 34px, plus two wide ones, are 403px across — which does not
fit the 342px a 390px phone leaves, and the whole page scrolled sideways on every
iPhone until this was measured rather than assumed. `useSizes` works out the room
once (the rails take 620px above 60rem, nothing below) and divides it between the
tiles and the keys in step, so a twelve-letter board and a narrow phone both give
way instead of overflowing. The keys stop at 22px rather than vanishing, and a
phone smaller than an SE scrolls, which is the honest answer.

**A row is told, not shown.** Submitting holds the colour back for 260ms while the
letters sit on empty tiles, then wipes each cell in 170ms behind the one before
it. Input is locked for exactly as long as that takes — `REVEAL_MS` is exported
from the same module that owns the two numbers, because two timings that have to
agree should be one number. The keyboard colours in only after the row has landed.

**The ink is settable, not just selectable.** Four presets are the shorthand; the
whole instrument is three rows of swatches, one per role, and the engine decides
whether what you pointed at is legible — a duplicate colour, a letter that fails
its contrast floor, or an untaught code too tight to read are all refused on the
spot, with the reason.

**A redaction is a shape you point at.** Eight one-tap shapes — nothing, the
house, alternate, shear, checker, last two, one row, everything — and then a grid
to paint if none of them is what you meant. Nothing is refused: a whole row can be
barred, or every cell, and the analysis says what that costs rather than stopping
you.

**A free letter is a position, not a letter.** The setter grants a few and the
solver spends one to be told the letter at a cell they choose. It is worth less
than a lift — a lift shows you heat you were owed, a free letter shows you
something you were not — and knowing letters is never the same as having guessed
the word, so it cannot end the puzzle.

**The board explains itself to a screen reader.** Each row is a labelled group —
*"Row 1: d, right letter, wrong spot; a, right letter, right spot; …"* — with the
cells hidden behind it, so a game about colour is not reduced to a list of letters.
A polite live region announces each row as it lands, and the outcome when it does.

**Two aids that can end a puzzle, and one that can only take something away.** A
lift pulls one bar back. A free letter gives away the letter at a position the
solver chooses, and knowing letters is never the same as having guessed the word,
so it cannot end anything. The clock can: counting up is a stopwatch, counting
down is a real loss with `OUT OF TIME` on the sheet. And the keyboard can be told
to forget — with the heat off, a solver has to remember what they have tried.

**A puzzle you come back to.** A half-finished case is kept, so a link a friend
sent you is still there tomorrow; a finished one is filed as a result instead. The
daily remembers its run, its length and its dressing, and keeps an archive of the
last week.

**Two themes, and only one of them touches the data.** Dark is the arcade; light
is the same room with the lights on — pure white ground, ink black, the two chrome
colours darkened until they carry on paper, and every glow removed, because a glow
on white is a smudge. The three feedback inks do not change, because ink is the
only thing on the page that is data.

**Three to twelve letters, and any word at all.** The composer checks the shape of
a setter's word and nothing else; whether it is a dictionary word is a label, not
a gate. Every length now carries a rating, because the dictionary reaches all ten
of them, so the free lexicon is a choice a setter makes rather than one the engine
forces on them.

**The daily ships in two dressings of the same word.** `the puzzle` is what the link
decides; `clean` is the house ink, the legend shown and nothing withheld — the
game this one is a version of, for anyone who would rather play that. The choice
is remembered, and changing it never changes the answer.

**A sealed puzzle can be graded.** `#/grade` lists the sealed puzzles this browser
made, takes the receipt the solver sent back, decides the board, and produces a
reveal — the word, the nonce, the commitment and every guess — which the solver
opens to see `SEAL VERIFIED` or `BROKEN SEAL`. The word lives in the setter's
browser and nowhere else between sending the link and grading the receipt, and
the screen says so.

## Hosting

`pnpm build` produces `dist/` and nothing else: an `index.html`, one CSS file, eleven
JavaScript files — one entry chunk and ten lazy dictionary modules, one per board
length — and the five font files, all content-hashed. There is no server function, no
environment variable and nothing to configure, so any static host will do.
`vercel.json` is there because that is how the other apps here are deployed, and it
needs three things said about it.

**The project's root directory must be `apps/hushword`, not the repository root.**
There is no root `package.json` — each app is its own workspace — so Vercel has to be
pointed at the app, where `pnpm-lock.yaml` lives and `--frozen-lockfile` can mean
something.

**There are no rewrites, and none are wanted.** Routing is in the fragment, so a
deep link like `#/compose` never reaches the host as a path: the server only ever
serves `/`. A catch-all rewrite would add nothing and would hide a genuine 404 behind
a 200.

**The headers are azul's, with one addition.** `clipboard-write=(self)` is named
explicitly because this app copies things — a link, and a sheet — through
`navigator.clipboard`, and `copyText` swallows a refusal and reports it as a failed
copy. So a policy that quietly disallowed clipboard access would break a feature
without breaking a test. The rest is the shared set: `nosniff`,
`strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, and camera, microphone
and geolocation denied because nothing here asks for them.

`buildCommand` is `pnpm build`, which is `tsc --noEmit && vite build` — so a type
error fails the deploy rather than shipping.

**A content security policy is now possible and has not been added.** Until the fonts
moved into the repository this page could not be served under `default-src 'self'`,
because it fetched CSS and type from Google. It could now — but the app styles itself
with React inline styles throughout, and whether those survive `style-src 'self'`
depends on whether the browser treats React's CSSOM writes as inline styles. That is
a thing to check in a browser, not to declare in a header file, so it is left as a
follow-up rather than guessed at.

## Not done

- **The headline 3.0 is a floor, and the gap to a Wordle-like 3.9 is the player
  model, not the pool.** The pool question is settled: 2.65 at 250 answers, 3.05 at
  1,000, 3.02 at 2,018 — flat past a thousand. What remains is that this player
  narrows optimally, never wastes a probe and reads the ink perfectly once it has
  been taught. The costs a person pays are measured separately and come to more
  than the gap: +0.50 to +1.12 guesses to read an untaught ink, as much as +1.79
  for a redaction, +3 for believing a board that lies. They are added to
  `effective` rather than folded into the playtest average, so the average stays a
  floor and says so.
- **One artboard is now the app; seven still are not.** *01 · Play* was rebuilt
  against the shipped screen: the same rails in the same order, the map moved left
  to where the app puts it, the feedback tiles changed from the neon-bordered
  treatment the design started with to the matte fills the app actually paints, the
  board and keyboard back to their real 54px and 34px, and the footer carrying the
  link the app writes instead of a mock address bar. The others have drifted to the
  same degree and nothing was done about them: *02 · Mobile play* still shows a
  *redaction map* panel and a candidates/clock row the app does not have, and its
  frame is 844px tall while the real mobile page scrolls. That needs the same pass,
  not a note.

## The tests

Two suites, two environments, separated by a directive at the top of each file.

| | |
| --- | --- |
| `src/engine/engine.test.ts` | 85 tests, node. The rules, the ink metric, the redaction, the wire, the vault against its published vectors, and the flaws the packed format exposed. |
| `src/ui/app.test.tsx` | 16 tests, jsdom. What a person can see and do: a link opens a board, typing fills the row rather than a field, a rejected guess says why, a row explains itself cell by cell, a free letter gives a letter, a lift pulls a bar back, a half-finished puzzle survives a remount, a twelve-letter board opens and the composer can reach it, the keyboard gives way before the page does, and the lights turn on. |

The app suite is deliberately thin — enough to catch a screen that stops working,
not a second copy of the engine tests. Writing it found three real defects: the
composer had lost its heading in the minimal pass, the keyboard accepted clicks
before the dictionary had arrived and then refused them, and Node 22 ships a
competing `localStorage` that shadows jsdom's. It also caught a fourth thing that
was not a defect in the code at all: a stepper button is replaced when React
re-renders, so six clicks on a held reference are one click, which is exactly how
the composer's length control was being driven and exactly why it looked stuck.

**And a fifth, which is the one worth reading.** The test that saves a
half-finished puzzle failed about one run in twenty, and the first two theories
about why were wrong. Making it fail on demand — the scenario run thirty times
inside one test — showed that the guess was never submitted at all: all seven
keystrokes, Enter included, were dropped by a handler whose closed-over dictionary
was `null` even though the keys had gone live in the DOM. The listener is stable
and reads the current handler through a ref, and that ref was being updated in an
`useEffect`, which runs after paint. So there was a window, real in a browser and
easy to hit in a test, where the board was visibly enabled and deaf at the same
time. It is a `useLayoutEffect` now, which runs inside the same commit that enables
the keys. Six failures in thirty became none in thirty, and eight consecutive full
suite runs are clean.

## Modules

| File | What it holds |
| --- | --- |
| `rules.ts` | The marks, candidate narrowing, hard mode, the lexicon |
| `palette.ts` | The ink, the separation metric, the presets, the guard rules |
| `redaction.ts` | Withheld cells, patterns, shear, decoys, lifts, and the editor's `paint` / `recognisePattern` / `analyseMap` |
| `game.ts` | A puzzle in progress: the truth against what is shown |
| `difficulty.ts` | The reference player, and what a redaction and an ink cost |
| `link.ts` | The four postures, the commitment, the nonce, and the sealed puzzle the setter keeps |
| `wire.ts` | The packed fragment format, in bits |
| `words.ts` / `answers.ts` / `lexicon/` | The catalogue, in two halves, one module per word length |
| `sha256.ts`, `chacha.ts`, `bytes.ts` | Hashing, the vault, base64url |
| `rng.ts` | mulberry32, and a seed a person can say out loud |
| `ui/Play.tsx`, `ui/Compose.tsx`, `ui/Grade.tsx`, `ui/bits.tsx` | The four screens |
| `ui/store.ts` | What the browser remembers: a half-finished case, results, and the daily's preferences |
