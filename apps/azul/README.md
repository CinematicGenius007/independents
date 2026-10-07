# Azulejo

Azulejo is the tile-laying game *Azul* — Michael Kiesling's, published by Plan B Games — played
in the browser by two to four people. No account and no install: open a room, send the code,
and whoever opened it deals from the bag.

The rules implemented are the base game, exactly: five glazes of twenty tiles, factory displays
at two per player plus one, pattern lines that fill right to left, a floor line charging
-1 -1 -2 -2 -2 -3 -3, wall-tiling that scores each tile by the runs it joins, and an end
triggered by the first completed horizontal line, followed by 2 a row, 7 a column and 10 a
colour. The variant grey board is not included.

None of the artwork is Plan B's. The table is drawn as an observatory print — a star chart or a
survey sheet: flat ink on white stock, hairline rules, orbit arcs running behind the content,
wide-tracked mono figures, and one signal red that does all the pointing. Each of the five
glazes is a flat ink with its own motif drawn in white line work (quatrefoil, compass star,
lozenge, chevrons, waves), so the board reads without depending on hue, and every unfired wall
space shows its motif dotted in its own glaze, so the wall teaches its pattern before a tile has
landed. The design lives in the Paper file *Azul*, artboard "Table — Astral", whose tokens
`src/styles.css` mirrors.

Tiles come in three sizes on purpose: the pattern lines are where you act, so they are largest;
the wall is what you read, a step smaller; the displays are what you choose from at a glance,
smaller still.

## What the interface tells you

A digital board can do three things a wooden one cannot, and this one does exactly those three.

**It shows the reckoning.** A line you could play is marked with what it would earn if it fires
this round and what the spillage would cost — `+4  −2` — before you commit to the click. Nobody
should have to count runs in their head to know what a move is worth.

**It counts the scoring out loud.** The engine tiles every wall at once, because that is what
the rules say. Watching it that way is a number changing, so each round is played back as a
script: one player at a time, one tile at a time, and every point carried from its tile to the
owner's score track — a hundred cells, one per point — on its own. Floor penalties fly back off
the track a point at a time, and the end-of-game bonuses are paid out the same way. The script
is a pure function of the round's reports (`src/engine/timeline.ts`), so the host and every
screen compute the same one, and the host deals the next round only when it has finished.
Space skips it on your own screen.

**It shows the tiles travelling.** Every move — yours, a peer's, the house's — flies its handful
from the pile it came off to the slots it lands in. Without that, an opponent's turn is a diff
you did not see happen.

**It has a voice.** Every sound is synthesised at the moment it is needed — this app ships no
assets and loads nothing from anywhere, so a fired tile is a filtered noise burst over a decaying
sine, which is close to what glazed ceramic actually does. Pitch carries meaning: a tile scoring
seven rings higher than one scoring one, so a good round sounds like one. The context is only
built on your first click, and the toggle is in the masthead.

Alongside those: the count of tiles nobody has seen yet, per colour, because that is something a
player reads off a real table by looking; number keys to place and `Esc` to put a handful back;
and a rules sheet, since the game deserves to be playable by someone who has never met it.

Built with React 19, TypeScript and Vite. Multiplayer goes through the repository's rooms
service ([`services/rooms`](../../services/rooms)), with Trystero as the fallback.

## Run locally

```bash
pnpm install
pnpm dev
```

Online rooms use the rooms service when `VITE_ROOMS_URL` is set at build time (in `.env.local`
for development, or the hosting project's environment for a deployment). Without it, rooms fall
back to signalling peer to peer over public Nostr and MQTT relays, which needs nothing deployed
but depends on strangers' servers and on two browsers reaching each other directly.

```
VITE_ROOMS_URL=http://127.0.0.1:8787     # services/rooms running locally
```

Other commands:

```bash
pnpm test          # Vitest: rules, bot, scoring timeline, and full games over both transports
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
src/net/      rooms, replication, and the two transports (rooms service, Trystero)
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

**A reload is not a departure.** Over the rooms service each tab keeps a stable identity, so a
reload or a network blip reconnects as the same player in the same seat, and a short grace
period means nobody else is even told. A follower that comes back mid-game asks the host for
the position at once — waiting for the next event to reveal what it missed would deadlock a game
in which it is that follower's turn.

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
