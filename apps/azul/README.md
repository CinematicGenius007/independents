# Azulejo

Azulejo is the tile-laying game *Azul* — Michael Kiesling's, published by Plan B Games — played
in the browser by two to four people with nothing in the middle. No account service, no game
server, no hosted database. The players hold the game between them over WebRTC, and whoever
opened the room deals from the bag.

The rules implemented are the base game, exactly: five glazes of twenty tiles, factory displays
at two per player plus one, pattern lines that fill right to left, a floor line charging
-1 -1 -2 -2 -2 -3 -3, wall-tiling that scores each tile by the runs it joins, and an end
triggered by the first completed horizontal line, followed by 2 a row, 7 a column and 10 a
colour. The variant grey board is not included.

None of the artwork is Plan B's. The visual identity here is drawn from the ceramic the game is
named for: glazed indigo ground, panels of tin-glaze white, and a *pounce* — the pricked stencil
outline a tile-setter dusts charcoal through — marking every space on the wall with the motif
that belongs to it. Each of the five glazes carries its own motif, so the board is readable
without depending on hue.

## What the interface tells you

A digital board can do three things a wooden one cannot, and this one does exactly those three.

**It shows the reckoning.** A line you could play is marked with what it would earn if it fires
this round and what the spillage would cost — `+4  −2` — before you commit to the click. Nobody
should have to count runs in their head to know what a move is worth.

**It counts the firing out loud.** The engine tiles every wall at once, because that is what the
rules say. Watching it that way is a number changing, so the position is unwound and replayed:
each tile arrives on its space in turn, ringed, with the points it just earned, and the scores
climb behind it. The host holds the next deal back for exactly as long as that takes.

**It shows the tiles travelling.** Every move — yours, a peer's, the house's — flies its handful
from the pile it came off to the slots it lands in. Without that, an opponent's turn is a diff
you did not see happen.

Alongside those: the count of tiles nobody has seen yet, per colour, because that is something a
player reads off a real table by looking; number keys to place and `Esc` to put a handful back;
and a rules sheet, since the game deserves to be playable by someone who has never met it.

Built with React 19, TypeScript, Vite and Trystero.

## Run locally

```bash
pnpm install
pnpm dev
```

Other commands:

```bash
pnpm test          # Vitest: rules, bot, and a full game replicated across peers
pnpm type-check    # TypeScript with no emit
pnpm build         # production build in dist/
pnpm playtest      # bot tournament; pnpm playtest 500 2 for 500 two-seat games
```

## Playing

Three ways in. **Play alone** opens a table against the house and never touches the network.
**Open a room** gives you a five-character code and a link to send; two to four seats, and the
house takes any that are left empty. **Join a room** takes a code someone read out to you.

A turn is two clicks: take every tile of one colour from a display or from the centre, then
choose which pattern line receives them. Tiles the line cannot hold fall to the floor and cost
points. The first player to take from the centre in a round also takes the starting player
marker, which costs a point and buys the first turn of the next round.

## How it is put together

```
src/engine/   the rules, as pure functions over plain JSON
src/net/      rooms, replication, and the one file that imports Trystero
src/ui/       tiles, boards, the table
```

**The engine never touches randomness.** Transitions take a state and return a new one; the
tiles that come out of the bag are passed *in* as data. This is what makes four browsers agree:
they replay the same ordered list of events and land on identical boards without ever comparing
them.

**Only the host holds the bag.** Draws are broadcast already drawn, so no other peer has the
future sitting in its memory. Every other transition is deterministic and travels as a two-field
event. A peer that receives an event out of sequence does not guess — it asks for the position,
which is a few hundred bytes.

**A host that vanishes is survivable.** The remaining players elect one of themselves
deterministically, and the new host derives a bag by subtracting every tile visible on the
boards and on the table from the hundred the game contains. The only thing lost is the order of
the bag, which nobody could see anyway. A seat whose player is gone is played by the house until
they come back, and a returning player is given their own seat back by name.

## Where the numbers come from

`pnpm playtest` runs the three house levels against each other and prints win rates and score
spreads. Two hundred four-seat games:

| style      | win rate | mean score |
| ---------- | -------- | ---------- |
| apprentice | 9.0%     | 42.2       |
| artisan    | 28.1%    | 50.4       |
| master     | 38.6%    | 55.3       |

Every game runs exactly five rounds, which is not a bug but the floor of the game: a wall row
can gain at most one tile per round, so no game of Azul can end sooner, and bots that fill every
pattern line every round always hit it.
