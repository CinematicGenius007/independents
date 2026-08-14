# Sealed Orders

Sealed Orders is a two-player duel with nothing in the middle. No server, no account, no
lobby — the entire match travels in links you send each other however you like.

Both players program three steps at once, in secret, and a well goes to whoever sits
down on it first. The problem with playing that by hand is obvious: whoever moves second
can read the first move and answer it. So nobody plays in the open until the other side
is already locked in. One player publishes a hash of their orders, the other then plays
openly, and only afterwards is the hash opened and checked. The cryptography is not
decoration here — it is the only reason simultaneous play works without a referee.

Built with React 19, TypeScript, and Vite.

## Run locally

```bash
pnpm install
pnpm dev
```

Other commands:

```bash
pnpm test                    # Vitest suite (rules, boards, and the protocol)
pnpm type-check              # TypeScript with no emit
pnpm build                   # production build in dist/
pnpm tsx scripts/playtest.ts # bot tournament across four playing styles
```

There are two ways to play. **Play the ghost** puts you against a local opponent that
computes a best reply to what it expects you to do. **Pass a link** is the real game:
act, copy the link, send it, and wait.

## The rules

- Each turn you program **three steps** — `N`, `E`, `S`, `W`, or wait. So does the other
  player, at the same time, without seeing yours.
- A well goes to whoever **sits down on it first** and is still there when the turn ends.
  Walking across it does nothing, and arriving on beat one beats arriving on beat three.
- Settle on the same well on the same beat and **neither of you takes it**; both pieces
  go back where the turn began.
- Wells **change hands**. Sit on one they hold with nobody there to answer, and it is
  yours. A lead has to be defended.
- **Hold three at once** and the match ends. Otherwise the water counted at the end of
  every turn decides it after twelve turns, and the deep well in the centre pays double.

## The protocol

Turn one is sealed by the first player, turn two by the second, and so on, so neither
player is permanently the one who plays in the open.

```text
seal    →  a SHA-256 hash of "matchId : turn : orders : nonce" goes in the link
open    →  the other player, now safe, sends their orders in plain text
reveal  →  the sealed orders and the nonce are published, and the hash is rechecked
```

The nonce is what makes the seal worth anything. Three steps from five options is only
125 possibilities, so a bare hash of the orders could be brute-forced instantly; a
128-bit nonce alongside them cannot be. The nonce stays in the sealing player's own
browser until reveal — `leaksSealedOrders` and a test that greps the encoded link for the
orders both exist to keep that honest.

Cheating is not prevented, it is **detected**: a reveal that does not hash to the
published commitment is shown as a broken seal, and the match is marked untrustworthy.
Since neither player has any way to alter what the other already sent, that is exactly
as much as a serverless game can promise — and it is enough.

## Reading a turn as a game

Every turn is a one-shot simultaneous game, which means it has an equilibrium and
a move can be measured against it. After each turn the app collapses the 125
possible order strings into the distinct plans they actually represent — usually
somewhere near seventy — builds the payoff matrix over them, solves it by
fictitious play, and reports what your order was worth against the mix a rational
opponent plays.

So the feedback is not "you lost that well" but "that order gave up 1.3 against
their best mix, and this one was worth more". It is the difference between being
told the result and being told the cost.

## What the playtests changed

`scripts/playtest.ts` runs bot tournaments. It broke and rebuilt this game three times.

**The first rules produced a stalemate machine.** Pieces blocked each other on contact
and a shared destination sent both home, so two players who wanted the same well simply
jammed. Seven in ten matches ended in a dead draw and the contested-well rule, the whole
point of the design, never once fired in two hundred matches. Pieces now pass through
each other and everything is decided where they *finish*.

**Punishing both players equally taught nobody anything.** With a shared well wasted for
both sides, the cautious bot that avoided races lost to the greedy one 50% to 7%, because
a penalty you both pay is not a penalty at all. Adding arrival timing — the well goes to
whoever sat down first, and a tie wastes the turn — turned the same collision into a
question worth thinking about.

**The bots were also the wrong evidence.** Losing to a rusher might only mean the
cautious heuristic was bad, so a `reader` bot was added: it evaluates all 125 of its
possible orders against the orders it expects from the other side, and plays the best
reply. That settled it. The reader beats the rusher four to one, and it beats it by the
same margin from either seat, which is also the check that sealing first costs nothing.

| Pairing            | First | Second | Draw |
| ------------------ | ----- | ------ | ---- |
| reader vs rush     | 52%   | 12%    | 37%  |
| rush vs reader     | 13%   | 49%    | 38%  |
| reader vs ghost    | 73%   | 16%    | 12%  |
| rush vs ghost      | 67%   | 15%    | 18%  |
| reader vs reader   | 12%   | 12%    | 77%  |

The last row is the honest caveat. Two *identical* policies on a balanced board deadlock,
and no amount of scoring tweaks fixes that — it is what identical play means. Wells are
now placed to be distance-balanced rather than mirror-symmetric, which helped, and the
double-paying centre well pushed decisive results up further. Human opponents are never
each other's mirror, but a bot playing itself always is.

Playing it by hand added one more thing: turn resolution was invisible, so pieces just
appeared somewhere new. Both sets of orders are public once a seal is broken, so each
turn is now narrated exactly.

## Layout

```text
src/engine/board.ts     seeded, distance-balanced boards
src/engine/rules.ts     beats, arrival timing, claims, water, verdicts
src/engine/protocol.ts  commit-reveal, match encoding, seal auditing
src/engine/bot.ts       four opponents, including the best-reply reader
scripts/playtest.ts     the tournament that rewrote the rules twice
```
