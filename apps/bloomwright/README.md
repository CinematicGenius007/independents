# Bloomwright

Bloomwright is a puzzle in which you never draw anything.

You are given a pressed specimen — a plant grown by a grammar you cannot see. You have
an axiom, a handful of rewrite rules, an angle, and a number of generations. A turtle
walks whatever string those rules produce, and your job is to make its plant land on
top of the specimen. A two-character edit changes the whole organism, which is the
entire pleasure and the entire difficulty.

It is built with React 19, TypeScript, and Vite. Nothing leaves the browser.

## Run locally

```bash
pnpm install
pnpm dev
```

Other commands:

```bash
pnpm test                    # Vitest suite (rewriting, turtle, scoring, levels)
pnpm type-check              # TypeScript with no emit
pnpm build                   # production build in dist/
pnpm tsx scripts/playtest.ts # gradient and hill-climber report for every level
```

## The alphabet

| Symbol  | Meaning                                        |
| ------- | ---------------------------------------------- |
| `F`     | draw forward                                   |
| `G`     | move forward without drawing                   |
| `+` `-` | turn left / right by the angle                 |
| `[` `]` | remember this spot / jump back to it — a branch |
| `\|`    | turn right around                              |
| `>` `<` | shorten / lengthen every step after this       |
| `A` `B` | buds: they draw nothing, they become their rule |

A rule replaces every occurrence of its symbol, all at once, once per generation. Buds
are what make an L-system more than a doodle: `A → F[+A]F[-A]+A` describes a plant that
keeps growing out of its own tips.

## How it is scored

Both plants are normalised into the unit square — position and scale are never the
puzzle — then burned into a 64×64 occupancy grid and compared in **both** directions:
how much of your ink lands on the specimen, and how much of the specimen you covered.
The two are combined as a harmonic mean.

That symmetry matters. A single overlap number rewards a scribble that covers
everything, and a coverage number rewards drawing one correct twig. Requiring both is
what makes the percentage worth chasing.

## Three ways to be close

**Shape.** The two-way match score described above.

**Brevity.** Every level carries a symbol budget: the length of the grammar that drew
the specimen. Matching a plate is one thing; saying it as briefly as it was said is
another, and it is the half that rewards understanding rather than fiddling. Rules that
rewrite a symbol to itself cost nothing, because they are not saying anything.

**Density.** A branching plant is not a line and not a region — it fills space at a rate
between the two, and box counting measures that rate. The plate reports your drawing's
dimension beside the specimen's, which gives you a way to be close before you are right.

And when you are wrong, the **difference view** says where: uncovered specimen in red,
stray ink in blue. That was the single biggest usability gap — a score of 46% tells you
that you are wrong without telling you anything you can act on.

## What the playtests changed

`scripts/playtest.ts` asks two questions of every level, because a rule-writing puzzle
is only fair if its score is a *guide* rather than a verdict.

**Does moving one symbol closer to the answer show up in the number?** For every level,
deleting any single symbol from the hidden rules lowers the score — 100% of edits are
informative. There are no plateaus where the player is editing blind.

**Can a player with no insight brute-force it?** A hill climber that makes random rule
edits and keeps whatever raises the score clears `thicket`, `weave`, and `crown` within
a couple of hundred edits, and never once clears `comb`, `edge`, `sapling`, or `fern` in
400. Those four need you to actually see the branching in the specimen, which is the
skill the game is about.

Two levels were rebuilt because of these runs:

- **Weave** originally started at 0.96 — the mutual recursion its rules describe barely
  changed the ink, so the level could not tell a correct grammar from a wrong one. Its
  hidden grammar was replaced with one whose two buds visibly disagree, dropping the
  start to 0.24.
- **Crown** shipped a starting grammar that already contained the `G` it was meant to
  teach, handing over the answer at 0.62. The starting rule was pared back to 0.27.

Current report:

| Level   | Start score | Informative edits | Hill climber | Median edits |
| ------- | ----------- | ----------------- | ------------ | ------------ |
| kink    | 0.08        | 100%              | 1/6          | 378          |
| comb    | 0.06        | 100%              | 0/6          | —            |
| edge    | 0.14        | 100%              | 0/6          | —            |
| thicket | 0.53        | 100%              | 4/6          | 69           |
| sapling | 0.35        | 100%              | 0/6          | —            |
| fern    | 0.46        | 100%              | 0/6          | —            |
| weave   | 0.24        | 100%              | 3/6          | 183          |
| crown   | 0.27        | 100%              | 3/6          | 72           |

## Layout

```text
src/engine/lsystem.ts   rewriting, the alphabet, expansion limits
src/engine/turtle.ts    string to normalised line segments
src/engine/match.ts     rasterising and the two-way shape score
src/engine/levels.ts    the eight specimens and their starting grammars
src/ui/                 the plate and the rule editor
scripts/playtest.ts     gradient and hill-climber harness
```
