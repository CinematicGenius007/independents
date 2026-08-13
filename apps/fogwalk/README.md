# Fogwalk

Fogwalk is a maze puzzle in which you do not know where you are.

Your position is not a point, it is a set: at the start you could be standing on any
open cell. When you slide in a direction, *every* possible you slides at the same time,
each one running until a wall or a patch of mud stops it. Two possibilities that stop
on the same cell become one possibility, and that is the only way the fog ever thins.
You win when a single possibility remains and it is standing on the mark.

It is built with React 19, TypeScript, and Vite. There is no account service, no game
server, and no database — levels are generated and certified in the browser from a seed.

## Run locally

Use a current Node.js LTS release and pnpm 11. From this directory:

```bash
pnpm install
pnpm dev
```

Other commands:

```bash
pnpm test               # Vitest suite (engine, generator, and game rules)
pnpm type-check         # TypeScript with no emit
pnpm build              # production build in dist/
pnpm tsx scripts/playtest.ts 40   # headless playtest across all three tiers
```

## How to play

Arrow keys, `WASD`, `HJKL`, the on-screen pad, or a swipe slides the fog. `Z` undoes,
`R` restarts.

- **Floor** is frictionless. You keep going until something stops you.
- **Mud** grabs you the moment you touch it, which makes it the sharpest merging tool
  on the board.
- **Pits** are fatal. A move that would drop you into one *in any single world* is
  refused rather than lost — but the attempt still costs a step, so probing is not free.
- **Par** is the length of a certified shortest solution. You get par + 3 moves.

Seeds are shareable: the URL carries `#play=SEED:tier`, and everybody gets the same
`DAILY-…` seed on a given day.

## Why it works this way

The board is a deterministic automaton and a plan is a word over its four-letter
alphabet. Collapsing the fog to one cell is exactly the problem of finding a
*synchronizing word* — a sequence that drives every state of an automaton to the same
state, studied since Černý in 1964. Sliding movement is what makes the automaton
non-injective, and therefore what makes synchronizing possible at all: on a board where
every move is a single step, no two possibilities ever merge and no level is solvable.

Because of that framing, everything the game claims is computed rather than asserted:

- `src/engine/solver.ts` searches belief states breadth-first, so a level's par is a
  proved shortest plan.
- `src/engine/generate.ts` never ships a board it has not solved, so a typed seed
  cannot land on an impossible puzzle.
- The hint button re-solves from your *current* fog, so it stays useful after a mistake.

## What the playtests changed

`scripts/playtest.ts` generates levels and plays each one three ways: with the certified
plan, greedily (always shrink the fog the most), and at random. Two findings changed the
design.

**Unlimited moves means the puzzle solves itself.** Random flailing cleared 95% of Calm
boards and 45% of Brisk boards when given a generous move allowance, because sliding
collapses possibilities whether or not you meant it to. Capping the allowance at par + 2
dropped random success to 18% / 0% / 0% across the three tiers. That is the reason a
move budget exists at all — without it there is no puzzle, only a stirring motion.

**Greedy play is a good difficulty dial.** Always making the move that thins the fog
most solves 63% of Calm, 43% of Brisk, and 18% of Severe levels, and it walks into a
refused fatal move on 23% of Severe boards. Those numbers are what the tier thresholds
in `TIERS` are tuned against: Calm should reward the obvious move, Severe should punish
it.

Current batch statistics, 40 levels per tier:

| Tier   | Par (mean) | Starting worlds | Greedy solves | Greedy refused | Random at par + 2 |
| ------ | ---------- | --------------- | ------------- | -------------- | ----------------- |
| Calm   | 6.0        | 30.9            | 63%           | 0%             | 18%               |
| Brisk  | 9.5        | 39.4            | 43%           | 13%            | 0%                |
| Severe | 14.3       | 49.2            | 18%           | 23%            | 0%                |

## Layout

```text
src/engine/   board rules, belief-state stepping, BFS solver, seeded generator
src/game/     the reducer that turns moves into a run, plus budget and win rules
src/ui/       board rendering and controls
scripts/      headless playtest harness
```
