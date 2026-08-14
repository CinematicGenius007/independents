# Four new independents

Working notes for four original browser applications built for this repository. The
rule for this batch: no concept may be a re-skin of an existing product. Each one has
to rest on a mechanic that is either genuinely unused or an unfamiliar fusion of an
old formal idea with a new interaction.

Every app in this repository is frontend-only: no account service, no game server, no
hosted database. That constraint is treated as a design input, not an obstacle.

## How the four were chosen

The starting list held around fifteen candidates. Most died for the same three
reasons, and those reasons are worth recording because they are the actual filter:

- **Already exists in a stronger form.** Rules-as-objects puzzles (Baba Is You),
  time-ghost puzzles (Braid), dataflow assembly puzzles (Zachtronics), inductive
  rule-guessing (Zendo, Eleusis). A weaker second version of a solved design is not
  worth building.
- **The novelty is decoration.** "Quantum" boards that are ordinary boards with a
  particle skin. A writing tool that renders prose as a shape but grades nothing real.
  If the mechanic survives removing the theme, it was never the mechanic.
- **Not playable without a backend or a model.** Anything that needs a language model
  to judge the player's output, or a server to hold a session, cannot ship here.

What survived is four ideas that each put the player in a position that ordinary
software does not put them in.

## 1. Fogwalk — planning without knowing where you are

**The move.** You do not control a token. You control a *set* of possible tokens.
The board is a maze; your position is unknown and starts as "any open cell". You
choose a direction, and every possible you slides that way until it hits a wall. A
plan is only a solution if it works in every world at once.

**Why it is new.** Games ask you to reason about one state. This asks you to reason
about a belief set, and the pleasure is the moment you notice that walls *merge*
possibilities: two candidate positions that slide into the same corner become one.
You win by collapsing a cloud into a single point. That is the synchronizing-word
problem from automata theory (Černý, 1964) turned into a physical act. The formal
idea is sixty years old; nobody has made it a thing you feel with your hands.

**Why it is fun rather than merely clever.** Fog cells and hazards mean a plan that is
right in seven worlds and fatal in the eighth is a loss, so the failure is legible and
teachable. Difficulty is a real, computable quantity: the length of the shortest
synchronizing plan.

**Backing it.** A breadth-first search over belief states (a bitmask per cell set)
generates, certifies, and rates every level, so no level ships unsolvable and no
difficulty label is guessed.

## 2. Bloomwright — you write the growth, not the drawing

**The move.** You never draw. You write a handful of rewrite rules, an axiom, and an
angle, and a turtle draws what those rules become after N generations. The puzzle is
to hit a target silhouette by editing rules whose effects are one-to-many and
non-obvious.

**Why it is new.** Lindenmayer systems (1968) are a botany formalism that lives in
screensavers and demo art. As a *puzzle verb* they are unused: the interesting thing
about a rewrite rule is that a two-character edit changes the whole plant, so the
player is doing search in a space with no gradient, guided by a live preview. It is
programming without the vocabulary of programming.

**Why it is fun.** Immediate visual feedback on every keystroke, a scrubbable
generation slider so you can watch the shape unfold, and scoring by overlap against
the target so partial progress is visible. Failure is beautiful, which is rare.

## 3. Tonguecracker — an invented language, generated fresh every time

**The move.** You are shown scenes (shapes, counts, colours, relations) with captions
in a language you have never seen. Nothing is explained. You infer word order, plurals,
adjective agreement, and case marking from examples, then prove it by *producing* a
caption for a scene you have not been shown.

**Why it is new.** Language-inference games exist as hand-authored campaigns, which
means one playthrough. Here the grammar is generated: word order, affix positions,
agreement rules, and lexicon are all sampled per game, so the deduction is real and
repeatable, and the same generator that makes the language grades the answer exactly.

**Why it is fun.** Production, not multiple choice. The moment a rule clicks is the
whole payload, and being wrong tells you exactly which feature you mis-modelled.

## 4. Sealed Orders — a two-player duel with no server in the middle

**The move.** Two players, one small board, simultaneous hidden turns. Each turn you
program three steps for your piece, the app seals them behind a hash, and you send your
opponent a link. The whole match lives in those links; nothing is stored anywhere. A
well goes to whoever sits down on it first, and settling on the same well at the same
moment means neither of you takes it.

**Why it is new.** Programmed movement is old, and asynchronous play by link is old,
but the missing piece has always been trust: without a server, whoever moves second
can see the first player's move and change theirs. A commit-then-reveal scheme fixes
that, and it fits in a URL. The cryptography is not a theme, it is the reason the game
is playable at all.

**Why it is fun.** Simultaneous programming means every turn is a read of the other
person, and collisions punish the greedy plan. The link-passing makes it play well over
any chat app, at any pace.

## Process

Each app was built engine-first: the rules, generator, and solver landed as plain
TypeScript with tests, and every mechanic was played against itself headlessly before a
pixel was drawn. Findings from those runs are recorded in each app's README under "What
the playtests changed".

That order paid for itself. The harnesses did not merely confirm the designs — they
broke two of them:

- **Fogwalk** had no move budget. Random flailing solved 95% of easy boards, because
  sliding thins the fog whether or not you meant it to. The budget exists because of
  that number.
- **Bloomwright** shipped two levels whose starting grammars sat close enough to the
  answer that a hill climber found them by accident, and one whose hidden grammar scored
  0.96 from a *wrong* start — a level that could not tell right from wrong at all.
- **Tonguecracker** was demanding that players learn colour words in a tier whose
  languages never say them, and occasionally shipped puzzles where the grammar was
  determined but two meanings shared a spelling. Both are now generation-time rejections.
- **Sealed Orders** was a stalemate machine on its first rules: pieces blocked each
  other, seven in ten matches drew, and the contested-well rule never fired once in two
  hundred matches. It took two rewrites — pieces passing through each other, then
  arrival timing deciding claims — before a bot that reads its opponent could beat one
  that just charges.

## Design direction

The first build of all four shared one look — dark panels, rounded cards, a stat row —
which is exactly the generic interface any of these could have had. They now take their
direction from four separate references, applied one to an app and never blended:

| App | Reference | What it gave |
| --- | --- | --- |
| Fogwalk | a dark acrylic space painting | No cards at all. An aurora ground, hairline rules, chrome slabs, and possibilities drawn as luminous spheres that fade rather than slide. |
| Bloomwright | a sepia pencil sketch of a man reading a broadsheet | A printed page: nameplate, printer's rules, columns, small caps, and figures set like a stock table. |
| Tonguecracker | a flat two-colour line-art illustration set | One black line weight, a pale blue field, and exactly two accents used for state and nothing else. |
| Sealed Orders | a loose ink-and-marker cartoon | White paper, one flat cyan block with a scalloped cloud edge, heavy outlines, hard offset shadows, speech bubbles. |

A fifth reference — a flash-lit photograph — was left unused. It has a palette and a
mood but no interface vocabulary to borrow, and inventing one from it would have meant
mixing it with something else.

## What shipped

| App | What you do | Certified by |
| --- | --- | --- |
| [Fogwalk](../apps/fogwalk) | Herd a cloud of possible positions into one cell, past ratchets and gates | Belief-state BFS solves every level before it ships; par sits beside the Černý bound |
| [Bloomwright](../apps/bloomwright) | Write rewrite rules until the plant matches the specimen — briefly | Two-way shape score, a symbol budget, and a box-counting dimension |
| [Tonguecracker](../apps/tonguecracker) | Buy evidence one question at a time, then speak the language | Every rival grammar enumerated live; par is a greedy questioner's count |
| [Sealed Orders](../apps/sealed-orders) | Program three secret steps and pass a link | Commit-reveal seals audited; each turn priced against its own equilibrium |
