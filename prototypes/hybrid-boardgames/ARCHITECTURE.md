# Hybrid board games

Three browser-only board games, each fusing three older ones. Same constraint as the rest of
this repository: no account service, no game server, no hosted database. Read
[`docs/CONCEPTS.md`](../../docs/CONCEPTS.md) and [`docs/HUSHWORD.md`](../../docs/HUSHWORD.md) first;
this file uses their method (engine first, play it against itself, record what broke).

| Game | Parents | Players | Transport | Register in the prototype |
| --- | --- | --- | --- | --- |
| **Cartel of Cartographers** | Carcassonne · Tigris & Euphrates · Sidereal Confluence | 3–4 | WebRTC (host deals) | Gilded-Age railroad stock certificate |
| **Shadow Bidding** | Chess · Modern Art · Diplomacy | 2 | URL commit-reveal, or WebRTC | Venetian counting-house ledger |
| **Lexicon Quarantine** | Boggle · Go | 2, asymmetric | history in the URL, or WebRTC | Samizdat typewriter zine |

## What is in this folder

```text
index.html        self-contained prototype, built from src/ (open it; no server needed)
src/engine.js     the three rule sets, three bot families, SHA-256 and the link codec
src/ui.js         the three tables; calls only HB.SB / HB.CC / HB.LQ
src/*.css         one stylesheet per register
build.mjs         inlines src/ into index.html (no bundler, no dependencies)
harness.mjs       headless protocol checks, rule checks and bot tournaments
ui-smoke.mjs      drives the built page in headless Chrome (deep links, the link desk, audit, shear preview)
diagrams/*.mmd    diagram sources; the .svg beside each is rendered by ondine 0.0.3
```

```bash
node build.mjs                 # regenerate index.html
node harness.mjs               # full report, about seven minutes
node harness.mjs --quick       # smoke test, under a minute
node harness.mjs --only=cc     # one section: sb, cc, lq or rules (comma-separated)
node ui-smoke.mjs              # the built page in headless Chrome; skipped when there is no Chrome
npx ondine@0.0.3 diagrams/*.mmd
```

`index.html` and `harness.mjs` load the **same** `src/engine.js`. A number quoted below is a number the
page obeys. Samples are 60–200 games, so a gap under about eight points is noise; where a claim rests on
a gap that small it is marked *suspected*.

**What exists and what is only specified.** The engines, bots, link codec, hash chain, commit and
coin are built and checked. The prototype page plays all three games against bots, and Shadow Bidding can be
played by two people with no bot and no server: the **link desk** (a modal on the Shadow Bidding table) steps
through the three-hop commit → answer → reveal protocol on pasted links, and a `#sb1/…` link opens it by itself.
`#cartel`, `#shadow` and `#lexicon` deep-link to the tables. The WebRTC rooms are still *specified here and not
wired*: a ported app would put them behind the same engine calls.

---

## Principles shared by all three

1. **The engine is a pure function of `(seed, ordered moves)`.** No clock, no `Math.random`, no
   ambient state. Every bot gets an explicit seeded RNG. Replays and link-borne histories are
   therefore bit-identical on both ends.
2. **Hidden information is solved by the transport, not hidden in the client.** If the browser can
   grade a move, the answer is in the browser (HUSHWORD.md says this bluntly, and it applies here).
   So secrecy is either a hash commitment (Shadow Bidding), a host that deals and never discloses the
   bag (Cartel), or absent by design (Lexicon: the whole position is public).
3. **Cheating is detected, not prevented.** A broken seal, a diverging hash chain or a `PEEKED` stamp is
   shown to the other player. Nothing here pretends to stop a determined client; it makes tampering
   visible, which is all a serverless game can promise.
4. **A hybrid earns its place only if removing one parent breaks the game.** Each critique below ends
   with that test.

---

## 1. Cartel of Cartographers

### The move

A 7×7 map. Each turn you may **seat a director** and then **lay one tile** from a hand of three.
Tiles that touch form a *realm*. A realm holds at most one director per commodity (Coal, Timber,
Cattle, Grain). When anyone lays a tile of commodity *c* in a realm, **the owner of that realm's
*c* director banks a point in *c*, not the player who laid it.** A tile that joins two realms holding the
same commodity of director starts a **hostile merger**: the realm with more tiles of that commodity wins,
the loser's director is unseated and the winner takes **two** spoil points. Players can also sign
**covenants**, binding promises the engine enforces by deleting the moves that would break them.

Why it is a hybrid and not a collage: Carcassonne supplies the shared map, Tigris & Euphrates supplies the
rule that *other people's tiles score for you* and that a placement can be an attack, and Sidereal
Confluence supplies the idea that a promise is a game object. The third only works because of the second: a
covenant is worth signing because a hostile merger is a real threat.

![Covenant lifecycle: proposal, storage, move filtering, expiry](diagrams/cc-covenant.svg)

*A covenant is not a rule the player remembers; it is a filter the move generator applies.*

### Refined ruleset (as built in `CC`)

| Rule | Value | Source of the value |
| --- | --- | --- |
| Board | 7×7, three tiles pre-placed in a row from the seeded bag | |
| Bag | 12 tiles per commodity, seeded shuffle | |
| Hand | 3 tiles; one drawn after each turn | first draft 2; changes the final score by nothing measurable (1.2 → 1.2), see critique |
| Placement | **any empty square**; a lone tile founds a realm | first draft required adjacency, see below |
| Director | one per commodity per realm; sits on a tile of its own colour; returns to its owner when unseated | |
| Score | the owner of a realm's *c* director banks +1 in *c* whenever *c* is laid there | T&E |
| Merger winner | more tiles of that commodity in the pre-merger realm; tie → the older director | deterministic |
| Spoil | winner's owner **+2** in that commodity per *opposing owner's* unseated director | T&E; first draft +1; worth +0.8 final (5.1 → 5.9) |
| Final | **sum of your three weakest commodities** (you drop only your best), tie-break the strongest | T&E counts one, the first draft two; see critique |
| Covenants | `embargo`, `nomerge`, `feed`; 1–3 of the promiser's own turns; at most 2 per promiser | |
| Buy-in | a third seat joins a mutual `nomerge`/`embargo` pair between two others for **1 point** (burned, taken from its lowest non-empty colour); both members must have a covenant slot free | the treaty tax, see critique |
| Escape | discarding a tile is never blocked | see critique |

Covenant templates are a closed set on purpose. An open "promise anything" text field cannot be enforced
by a move filter; three templates can, and each is a pure predicate over `(state, move)`.

### Critique

**Where the first draft broke (measured).**

- **The map was one blob.** The first rule required every tile to touch an existing one. In the first
  harness run every row showed **0.0 mergers** and all five rows came out identical, because a single
  growing realm has nothing to merge. The Tigris & Euphrates parent was dead on arrival. Placement is now free, and a
  game averages **7.8 hostile mergers and 8.6 directors unseated**, which is nearly every director on the
  board. The pendulum went too far (below).
- **T&E's "weakest colour counts" scored zero, and three of the four proposed fixes did nothing.** With four
  colours and about fifteen tiles a head, the average lowest pile was **0.00**, so every game fell through to
  the tie-break. Counting the two weakest gave **1.2** (n = 120). Measured one lever at a time against that
  first draft (Greedy ×3, 120 games each):

  | Rules | Avg final | Best seat's final | Spread |
  | --- | --- | --- | --- |
  | first draft: hand 2, spoil 1, two weakest | **1.2** | 2.8 | 2.7 |
  | + hand 3 | 1.2 | 3.0 | 2.9 |
  | + hand 3, spoil 2 | 1.2 | 3.1 | 3.0 |
  | + the **three** weakest count (shipped) | **5.9** | 13.7 | 12.9 |
  | shipped but spoil 1 | 5.1 | 11.3 | 10.5 |
  | shipped but hand 2 | 5.9 | 13.2 | 12.3 |

  The bigger hand and the bigger spoil are not what fix a sparse score. **The scores were never sparse; they were
  concentrated.** A player banks about 17 points a game but piles them into one or two colours (the gap between
  a player's best and worst colour averages 10), and a rule that counts the two weakest sees almost none of them.
  Dropping only the best colour sees most of them. Hand 3 changes nothing measurable (shipped with hand 2:
  5.9 again); it stays because the brief asked for it and a larger hand gives a human something to plan with.
  Spoil 2 is worth about 0.8 of a final point. The average final of **5.9** sits in the 4–9 band, with a spread
  of **12.9** between the best and worst seat, so the games are decided, not tied.
**Stalemate.** None possible in the rule sense: the game ends when hands and bag are empty (45 turns).
The nearest thing is a *frozen* table in which every director is protected by a covenant. All-diplomat tables
reach that state: **16.2 treaties, 1.5 mergers, 0.0 directors unseated**, and the spread between best and
worst seat drops from **12.9 to 3.5** (average final 5.9 → 3.7). That is not a bug (peace is a legitimate outcome) but it means the covenant is strong
enough that a table of cooperators plays a different, quieter game.

**Runaway leader, now shown.** Directors are the only engine of scoring, and a hostile merger removes one and pays
the winner, so one early large realm can snowball. Mitigations in the rules: a covenant cap (2 per promiser) and
counting several colours, which punishes a player who owns a single rich colour. The first draft's note called the
first-seat advantage *suspected* (37% / 29% / 32%). **That figure was an artefact**: the harness binned wins by
bot *kind*, not by seat. Counting by seat, a Greedy mirror gives **44% / 29% / 27%** for seats 1 / 2 / 3 under the
shipped rules and **51% / 28% / 19%** under the first draft (n = 120, ±5; n = 300 gives 48 / 31 / 20). Every
row of the harness has the first seat winning 41–53%. So it is real, it predates these changes, and the shipped
rules do not fix it. *A flat komi does not either*: I tried giving later seats +2 / +4 and +3 / +6 final points
(n = 300): mean finals equalised (8.3 / 9.0 / 9.8) and win rates barely moved (41 / 35 / 23). The first seat wins
through **variance**, not a higher mean: it is the only seat that can seat a director before any realm
has formed, and an early lead compounds. The fix has to act on the opening (a director-draft in reverse seat order,
or a free first director for later seats), not on the total. *Open.*

**Kingmaking and collusion, and the buy-in.** Pairwise covenants let two players protect each other and expose the
third. Under the shipped scoring, two diplomats and a greedy third seat give the greedy seat **50%** of wins against
21% and 27%, and a final of **8.0** against 5.0 and 4.7 (n = 120): the treaty tax is real. A signer removes its
own options and the non-signer pays nothing. The buy-in lets the excluded seat join the pair for one point.
With a `joiner` bot (it proposes and signs nothing; it buys in when a merger could reach it) the third seat falls
to **40%** of wins and a final of **5.8** against 5.0 and 4.6; it bought in **2.2** times a game. The treaty tax is
**cut, not removed**: ten points of the fifty came back, and the third seat still wins more than a third. Part of
that is the seat effect above rather than the tax. Making the buy-in cheaper than a point, or free when the
buyer has no points, would likely close the rest; I did not test it. A table where every seat signs everything
(`diplomat ×3`) is quiet and tight: average final **3.7**, spread **3.5**, and no one is unseated.

**Covenants cannot trap you, and that weakens them.** I expected deadlocks: a player holding two covenants
and a hand of tiles none of which can be placed. The harness found **zero** in 450 games and a check
proves why: discarding a tile is never blocked, so a player can always step out of a covenant by
paying a tile. The "force majeure, pay damages" path in the engine is therefore reachable only by a `feed`
obligation on its last turn. The consequence is the real critique: *the enforcement strength of a
covenant is the value of one tile placement*, not infinity. For a table that wants a harder promise, set
`escape: 'none'` in the rules and accept deadlocks.

**Information.** Hands are hidden; the bag order is hidden from everyone but the host. If the bag were seeded
from a value every player knows, every player could compute every hand. So the **host deals**
(the Azulejo pattern): tiles are sent already drawn, and no guest holds the future.

**Does removing a parent break it?** Remove T&E and the map is a solitaire. Remove the covenants and it
is T&E on a free grid, noisy and brutal (8.6 unseated per game). Remove Carcassonne's free placement and, as
measured, nothing happens at all. Each parent is load-bearing.

### Engine spec

```ts
interface CCState {
  tile: Int8Array      // 49, -1 empty else commodity 0..3
  dir: (Dir | null)[]  // 49, a director sits on its tile
  reserve: boolean[][] // [seat][commodity] directors still in hand
  score: number[][]    // [seat][commodity]
  hands: number[][]    // host-only for other seats' hands
  bag: number[]        // host-only
  cov: Covenant[]      // public
  turn: number; mover: number
}
type Move = { d: {cell:number, c:number} | null; h: number; c: number; x: number } // x = -1 is a discard
legalMoves(st, seat) -> { moves, blocked, forced }   // `blocked` is what the UI hatches
apply(st, seat, move, forced) -> Event[]
buyInOptions(st, seat) -> { members, kind, left, offer }[]   // treaties between two OTHER seats this seat could join
buyIn(st, seat, option) -> boolean                         // pays the point, signs the four promises
final(st, seat)                                            // sum of the `count` (3) weakest colours
```

`legalMoves` returning `blocked` as well as `moves` is deliberate: the interface shows *which* squares a
promise has struck out, because a promise you cannot see is not a mechanic.

### Open

- **The first seat wins about half of games** (44–53% in every Greedy row, 41–53% across all rows). A komi does not
  help; the opening does need work (see "Runaway leader, now shown").
- The treaty tax is cut from 50% to 40%, not removed. A cheaper buy-in is the next probe.
- The bots do not plan, so how humans use `feed` is unknown, and no bot buys in *strategically* (the Joiner buys
  whenever a merger could reach it).
- Four seats were not run. The harness uses three.

---

## 2. Shadow Bidding

### The move

Gardner 5×5 minichess (no castling, no en passant, pawns promote to a queen, **no check: a king can be
captured, and capturing it wins**). Each turn both players write **a move and a bid** in secret. Reveal them
together. **The higher bid moves first** and pays its bid. The other move is then **re-validated against
the board the first move produced**; if its piece was taken or its path is now blocked, it **fizzles**.
Equal bids go to a coin.

The bid does not buy a move. It buys the **order in which two moves collide**. On a quiet turn the order
does not matter and the right bid is 0; the bid matters only when the moves interact. That is why it is a
poker face and not a tax.

![Resolution of one turn: bids, order, payment, re-validation](diagrams/sb-resolve.svg)

*Every branch is deterministic given the two orders and one coin bit.*

### Refined ruleset (as built in `SB`)

| Rule | Value | Why |
| --- | --- | --- |
| Board | 5×5 Gardner | a full 8×8 with king capture resolves in far fewer turns than a sealed-link game can afford, and 5×5 keeps the hop count survivable |
| Treasury | start 5, **+1 income per turn**, **vault limit 9** | see "runaway" |
| Bid | integer 0..treasury, packed into 4 bits (max 15) | |
| Payment | only the first mover pays. `ledger`: to the rival. `pot`: to a centre pot that the next capturer takes | |
| Tie | coin from `SHA-256(commit ‖ opener order ‖ nonce)` | fair, ungrindable; see protocol |
| Fizzle | the loser's illegal move becomes a pass; its bid was never paid | |
| End | king captured; else after 30 turns without a capture or pawn move, or 80 turns, material lead ≥ 2 wins, otherwise a draw | |
| Treasuries | **public** | a wallet nobody can verify is a wallet nobody can audit |

### Critique

**Initiative is worth more than money.** Greedy never bids. An All-in bot that bids its whole treasury every
turn beats it **100–0**. In a ledger game it even feeds Greedy its own coins, which Greedy never spends. A
one-coin bid beats any zero-bidder, so the game against a naive player is already decided on turn one. The
interesting game is entirely between players who *model each other's bids*.

**Is the bid economy deep?** *Partly.* Economist (a bot that predicts its rival's move, simulates both orders
and bids what going first is worth) beats Greedy **100–0** and beats All-in **66–35**, but All-in is a
one-line strategy and loses by only a third. In an Economist mirror only **36%** of turns involve a payment
and a game pays **3.4 coins in total**: the economy is thin, not inflated. I do not claim the sealed bid
is deep for human players. The turn evaluator below, which reuses the Sealed Orders technique, answers the part a
bot tournament cannot: how often the bid matters at all.

**Runaway inflation / snowball.** In `ledger` mode every bid is a transfer, so wealth could accumulate in
whoever is winning. With no vault limit the peak treasury in an Economist mirror was **22.9**, against **9.0**
with the limit of 9. And yet the **win rate did not move** (48–52% either way): the bots bid only the minimal
amount needed to win the order, so wealth never decided anything. The cap stays as insurance against human
hoarding, not as a measured necessity. Overflow above the cap is burned.

**`ledger` vs `pot`.** In `pot` mode every bid goes to the pot and the next capturer takes it, so a bid is a
bet on capturing. Measured: games shrink from **16.4** to **10.4** turns and kings are captured in **94%** of games
against **71%**. The pot makes captures explosive. `ledger` is the default; `pot` is a variant for a table that
wants shorter games.

**Stalemate.** King capture makes decisive games the norm: **49–100%** end on a king (the low end is
Economist against All-in, which trades down). The remainder are adjudicated on material. Draws are **0–15%**, the high end being Greedy against Greedy, which never advances
anything. The 30-turn quiet limit keeps a sealed-link game from outliving its players.

**Asymmetry.** The board is mirrored, so first-move advantage is replaced by **tie luck** and by **who seals**.
White won the tie coin **48%** of 3,579 tie turns, so the coin is fair. The remaining asymmetry is
*information order*: the opener plays in plain after seeing a hash, the sealer is committed first. Neither can
change a move, so this is not an information gap, but it **is an abort advantage**: the sealer learns the
outcome before the opener does and can simply not send link 3. That cannot be prevented. It is equalised by
alternating the sealer every turn (below).

**A trap I almost shipped.** A tie coin derived from the sealer's own nonce can be *ground*: the sealer tries
nonces until the coin favours them. So the coin mixes the nonce with the **opener's plain order**, which the
sealer cannot know when choosing a nonce, and the opener cannot know the nonce when choosing an order. The
harness checks that changing only the opener's bid changes the coin stream.

**Does removing a parent break it?** Remove Modern Art and it is chess with fizzles: a coin flip on contested
squares. Remove Diplomacy's simultaneity and the bid has nothing to resolve. Remove chess's board and the
bid has no consequence. All three are load-bearing; Chess is the one a player will feel first.

### The turn evaluator

After every resolved turn the page prints, for the seat reading it: *"Going first on this turn was worth +X
material; equilibrium bid mix was [lo..hi] coins (mean m). You bid b, they bid c."* plus a verdict, and draws the
mix as bars with your bid marked. It is a 1-ply payoff matrix solved by **fictitious play**, the technique
`apps/sealed-orders/src/engine/analysis.ts` uses: both sides repeatedly best-respond to the other's history and the
empirical frequencies converge on an equilibrium of the zero-sum matrix.

- **Rows and columns** are White's and Black's every legal (move or pass, bid 0..purse) pair: a typical position is
  48×48, a tactical one 78×66.
- **A cell** is the material swing for White once the two sealed orders resolve, plus `coinValue` (0.5) material per
  coin of treasury swing. It is built without resolving every cell: the board outcome depends only on (move, move,
  who goes first), so the board is resolved `2 × moves²` times and the bids only decide *who* goes first and *what
  it costs*, which is arithmetic (ledger payment, pot capture, income and the vault limit are all replayed
  exactly). The whole solve takes 10–30 ms, so it runs inline after every turn.
- **"Worth"** is `value(you first) − value(they first)` for the two moves actually played, in material only. A
  king capture shows as "the game (a king)" rather than +200.
- **The verdict** compares your bid with the best bid *in hindsight* against what the rival actually sent. `sharp`:
  nothing better was available (a bid of 0 on a quiet turn counts). `overpaid`: you paid more than the order was
  worth, or more than needed. `underbid`: a higher bid would have won an order worth more than it cost. This is hindsight
  and not equilibrium regret; a sharp read can lose a coin flip of a guess.
- **Checked** (harness): matching pennies → 50/50, a dominant row is found, rock-paper-scissors → thirds; in the
  sudden-death duel the order is worth the game and the equilibrium bid is the whole purse; on a quiet opening the
  order is worth 0 and the equilibrium bid is 0; against a bid of 1 the sharp bid is 2, so 3 is called overpaid.

**What it says about the economy** (24 games a row, both seats analysed on every turn, n ≈ 300–390 turns):

| Pairing | Going first matters (≥ 0.5) | Decides the game | Equilibrium bid on those turns | Verdicts |
| --- | --- | --- | --- | --- |
| Economist mirror | **35%** | 9% | 4.3 coins | 74% sharp, 0% overpaid, 26% underbid |
| Economist vs Greedy | 30% | 6% | 3.6 | Economist 92 / 0 / 8; Greedy 78 / 0 / 22 |
| All-in vs Economist | 31% | 6% | 0.9 (All-in has spent its purse) | All-in 22 / 78 / 0; Economist 78 / 0 / 22 |

So the bid is **a decision on roughly a third of turns and a ritual on the other two thirds**: on a quiet turn the
solver says 0 and the bots agree. On the collision turns the equilibrium asks for about four coins and the Economist
pays far less (3.4 coins in a whole game), so it **underbids** about a quarter of the time in a mirror and never
overpays. All-in overpays 78% of the time, which is its design. That upgrades the earlier claim: the economy is thin
because the bots under-bid, not because there is nothing to bid for. One assumption carries a lot of this: one coin
is counted as 0.5 material. On a typical rook-for-rook collision (worth 10) the equilibrium bid is the whole purse
at 0.15 and 0.5 material per coin and **collapses to 1 coin at 1.5**: the price of going first is only as high as
the price you put on money, and the page says so under the bars.

### Engine spec

```ts
type Order = { f: number; t: number; bid: number } | null   // f = -1: pass
resolve(st, [white, black], coin: 0|1) -> Event[]           // mutates st; deterministic
movesFor(board, side) -> {f,t}[]                            // pseudo-legal
```

Events are `auction`, `move`, `fizzle`, `pass`, `pot`. The UI draws the auction (the two seals breaking) from
`auction` and the journal from the rest.

```ts
analyseTurn(pre, [white, black], side, { coinValue?, rounds? })
  -> { worth, decisive, mine, theirs, bestBid, regret, verdict: 'sharp'|'overpaid'|'underbid', text,
       eq: { mix: number[], lo, hi, mean, value, gap }, size: [rows, cols] }
explainTurn(analysis) -> string      // the sentence the page prints
fictitious(matrix, rounds) -> { row, col, lo, hi, value }   // any zero-sum matrix
// the link desk (pure; the caller keeps the secrets)
parseLink(text) -> link | throws     deskRole(link) -> { kind: 'seal'|'respond'|'reveal'|'verify'|'over', side, turn, st }
deskSeal / deskRespond / deskReveal / deskVerify   // one call per hop; each returns the next link and, at the end, the resolved turn
```

### Open

- The evaluator is **1-ply**: it values material and a coin rate, not position. A bid that buys a pin or a king-side
  attack is invisible to it, so "overpaid" is a statement about this turn's material only.
- `pot` mode is solved (the pot capture is in the payoff) but was not audited over games.
- `pot` mode with Economist ends on a king in 94% of games, which may be too sharp to be fun.
- 8×8 was not run. The 5×5 choice is made for hop count, not measured against a bigger board.
- The desk has no timeout and no abort handling beyond showing the other side the link it was sent.

---

## 3. Lexicon Quarantine

### The move

A 7×7 grid of letters. The **Poet** traces words through touching cells (diagonals included, no cell
twice in a word) and **inks** every new cell the word passes through, scoring the letters' values plus a
length bonus. The **Censor** has two actions a round: **bar** an un-inked letter with a stone, or **turn** any 2×2
block a quarter-turn (one action; at most one turn a round, then it jams for a round). **A turn is a cut:** the ink
that was joined to the poem's main body and is no longer once the block has turned is *sheared*. It dies, and
its points go. Ink groups connect **orthogonally**; a group's *air* is the number of free squares touching it
orthogonally. **An ink group with one breath or fewer is quarantined**: its cells die and its points go. A stone
group with none is lifted.

The Poet wins at **60 points**, or by inking a connected path from the left edge to the right. The Censor wins
if the Poet has no legal word at the start of a round (silenced) or after seven rounds.

![One round: word, sweep, Censor actions, sweep](diagrams/lq-round.svg)

*Both sides sweep after their own action, so threats are real but never instant: the Poet always sees the air count.*

Boggle sets the Poet's verb, Go sets the Censor's. They meet on the same 49 cells, which is the whole
reason to put them in one game: a word is simultaneously a score and a group with air.

### Refined ruleset (as built in `LQ`)

| Rule | Value | Why |
| --- | --- | --- |
| Board | 7×7, generated from a seed by planting six dictionary words along random paths, filling the rest by letter frequency, and re-rolling until at least 25 words exist | a random grid is often unplayable |
| Lexicon | 3,199 words, 3–6 letters | |
| Letter value | 1 (eaiotnrsl) · 2 (dugcmhpb) · 3 (the rest); bonus `2 × (length − 3)` | |
| **Anchor** | after the first word, every word must pass through an inked cell | see critique |
| **Air floor** | ink with ≤ 1 breath is quarantined (stones: 0) | see critique |
| Censor | 2 actions a round; a 2×2 turn costs one of them, then the turn jams for one round (`rotCool` 2) | see "The rotation verb" |
| **Shear** | after a turn, ink inside the block that *was* in the main body and no longer is dies (`shear: 'cut'`) | see "The rotation verb" |
| Main body | the biggest orthogonal ink group; tie → more points, then the lowest cell index | deterministic |
| Poet suicide | a word that leaves its own new ink at or under the floor is illegal | as in Go |
| Win | Poet: 60 points or a left-to-right ink group. Censor: silenced, or round **7** passes | six rounds was too few once turns cut (27%), see the table |

### Critique

**The first rules were a Poet's game.** With 12 rounds and a target of 30, the Poet won **100%** and finished
in two rounds, against all three of the first Censor bots (random, hunter, scrambler). A one-ply *denial*
Censor (take whichever stone or turn most reduces the Poet's best word) fared no better: the Poet still won
every game at a target of 70 inside eight rounds.

**The Go layer never fired.** Under the first rules the Poet lost **0.1 cells of ink per game** to
encirclement, even against a Censor that hunted the weakest group. A Boggle word is a chain of diagonals, so it
inks small orthogonal groups, each with three or four breaths. Nobody was playing Go. That is the exact
failure CONCEPTS.md warns about: *the novelty is decoration*.

Two changes, both measured against the Denier Censor (60 seeds, at the target of 60 and six rounds, with the
first-draft turn that only moves things, so the first row is the *old rules on the new clock*, not the original 100%):

| Rules | Poet wins | Ink quarantined per game |
| --- | --- | --- |
| v1: no anchor, floor 0 | **92%** | 0.1 |
| + anchor only | 58% | 0.3 |
| + air floor 1 (the shipped rules at the time) | **50%** | 1.7 |
| air floor 2 | 28% | 5.2 |
| + a turn that shears, six rounds | 27% | 2.7 |
| + a turn that shears, **seven rounds (shipped)** | **43%** | 3.5 |

The **anchor** (a poem grows from itself) is what makes Go relevant: a Poet who must keep passing through
existing ink cannot sprawl, so its groups have a frontier the Censor can squeeze. The **air floor** makes the
squeeze lethal at one breath instead of none. The Censor no longer needs to surround; it needs to threaten.
Floor 2 is brutal (28%) and not the default.

**Asymmetric imbalance by skill.** The Poet is easier to play well than the Censor. Against a random Censor the
careful Poet wins **100%**; against the Denier **43%**. A greedy Poet versus the Denier wins **23%**, a careful
one **43%**. So the Censor's skill range (100% → 43%) is much wider than the Poet's (23% → 43%). The Poet is the
beginner's seat and the Censor is the expert's. That is a design feature if it is named, and the prototype says
so in its role switch.

**The rotation verb: from nothing to the sharpest tool.** The first draft's turn moved letters, ink and stones
together, so it changed *who was next to whom* and nothing else. Removing it changed nothing (50% both ways against
the Denier), and the Scrambler, which rotates, did five points *worse* than the stone-only Hunter. That ablation was
also leaky: `rotCool: 99` still allowed one free turn on round 0, so it was never a true stone-only Censor. Fixed:
`rotCool ≥ 99` now removes the verb.

The new turn is a **cut**. After it, the ink in the block that was part of the main body and is no longer joined to
it dies and loses its points. A turn therefore does something no stone can: it needs no breath to be low, only a
*joint* in the poem, and a Boggle poem is made of joints (a word is a chain of diagonals, which are not
orthogonal connections). Measured one switch at a time (Careful Poet vs Denier, 60 seeds, seven rounds):

| Turn | Poet wins | Cells sheared / game |
| --- | --- | --- |
| rotation removed (stone-only) | **78%** | 0 |
| moves things, as in the first draft | 72% | 0 |
| **cuts ink it severs from the body (shipped, `'cut'`)** | **43%** | 3.9 |
| kills *all* ink in the block that is outside the body (`'all'`) | 25% | 6.0 |
| shipped but with no jam (turn every round) | 13% | 6.7 |

`'all'` and the unjammed turn are too strong, so they are not the default. **The same Poet and the same seeds, with
rotation on and with it removed** (120 seeds, gap with a 95% interval; the lower end is above zero in every row,
and the harness fails if it is not):

| Censor | vs Careful Poet | vs Wary Poet |
| --- | --- | --- |
| Denier (rotation removed → on) | 83% → 41%, worth **43 ± 11** points | 84% → 41%, **43 ± 11** |
| Scrambler (no rotation = Hunter) | 96% → 71%, worth **25 ± 9** | 93% → 61%, **33 ± 10** |

The Wary Poet is a probe for "can a Poet defend?": it counts ink outside the main body as a liability. With soft
weights it is no better than the Careful Poet: the same 41% against the Denier, and 10 points *worse* against the Scrambler (61% vs 71%), which is within noise. **A Poet that
knows about shear does not escape it**, because avoiding loose ink costs about what it saves. That is the design
doing its job, but it is a bot's answer; a human may do better. Hence the page hatches loose ink in the Poet's
grid (dashed outline) and, for the Censor, hatches the cells a turn would cut as the pointer moves over the block.

Interpretation notes. The brief asked for a turn that costs **one** action and jams for **one** round. The engine
already charged one of the two actions; it is unchanged. "Cooldown 1 round" is read as *jammed for one round*
(`rotCool: 2`); `rotCool: 1` would be no jam at all and is the 13% row above. Seven rounds is the one
change outside the verb: with six, the Poet wins 27% against the Denier and the verb alone swings the match.

**The crossing win still dominates.** Against the Denier the Careful Poet wins 43% of games and **25% of all games**
end with a poem that crosses the page, so about three Poet wins in five are crossings and the 60-point target
is the minor road (it was three in four before). The careful Poet's `span` heuristic aims at it, so this is partly
the bot, but the second win condition is much easier than the first. *Open:* make crossing need a longer or a
diagonal-proof path, or lift the target and drop the page.

**Stalemate.** Impossible: seven rounds is a clock. **Silencing** happens in 8% of games against the Denier (2% against the Scrambler), which is
still rare as a strategy; the clock is how the Censor usually wins. Shear raises it, because dead ink is not a cell the Poet can use.

**Does removing a parent break it?** Remove Go and the Poet is a Boggle solver racing a clock. Remove Boggle and
the Censor has nothing to enclose. The anchor rule is what welds them, and it is not in either parent.

### Engine spec

```ts
findWords(st)   -> { word, path, gain }[]       // every legal, anchored word
evalPath(st, path) -> { ok, why, mv }           // for a human tracing by hand
poetMove(st, mv) -> { ok, st, lifted, fresh }   // pure: returns the next state
censorApply(st, { k: 'stone' | 'rot', cell })   // mutates; a turn shears first, then sweeps ink, then stones
mainBody(st) -> Set<cell>                       // the ink group a turn measures against
previewRot(st, tl) -> { torn, tornFrom, lost }   // what a turn would cut, without doing it (the hover hatch)
```

Sweeps happen in a fixed order: after a Censor action, **shear (turns only), then ink, then stones**; after a Poet word,
**stones only**, then the suicide check on the new ink.

### Open

- The 3,199-word lexicon is a curated subset. Contested spellings are not adjudicated.
- The crossing win (above).
- `shear: 'cut'` is tuned against bots. A human Censor who sees the hatch may be stronger, and a human Poet who
  keeps one tight body may be too; the Wary Poet did not find that play.
- No second human rule set has been tried at a different board size.

---

## Protocols

### A. Stateless commit-reveal over URLs (Shadow Bidding)

The whole match lives in the link: the full history, a hash chain over it, and at most one pending step.
Nothing is stored anywhere. The grammar is a URL **fragment**, never a path or query, so no server
or CDN sees it (HUSHWORD.md, "Open").

![Three links per turn: sealed, opened, revealed](diagrams/sb-links.svg)

*The sealer commits first, the opener plays in plain, the sealer reveals. Roles alternate every turn.*

**Byte layout** (big-endian), then base64url after `#sb1/`:

```text
ver(1)=1  flags(1)  matchId(4)  start(1)  cap(1)  turns(2)
history:  turns × [ orderWhite(2) orderBlack(2) coin(1) ]
chain(8)                       truncated SHA-256, hash-chained over the history
pending:  kind(1) ...
   0                                         nothing pending
   1 sealed  : side(1) commit(16)
   2 opened  : side(1) commit(16) opener_order(2)
   3 reveal  : side(1) commit(16) order(2) nonce(16)
```

`order` is 14 bits: `from(5) to(5) bid(4)`, with `from = 31` for a pass. `flags` bit 0 is
`pot` mode. A 12-turn game is 152 characters; a 40-turn game is under 400.

```text
commit  = SHA-256("sb1|" ‖ matchId ‖ "|turn|side|" ‖ order ‖ nonce)[0..16]
coin    = SHA-256("sb1:coin|" ‖ commit ‖ opener_order ‖ nonce)[0] & 1
chain₀  = SHA-256("sb1:chain|" ‖ matchId)[0..8]
chainₙ  = SHA-256(chainₙ₋₁ ‖ orderW ‖ orderB ‖ coin)[0..8]
```

**Why a nonce.** There are fewer than a thousand orders in a position, so a bare hash is brute-forced instantly.
A 128-bit nonce is not. It lives only in the sealer's browser until reveal. The harness checks that the
sealed link contains neither before link 3.

**Verification.** The opener recomputes `commit` from link 3 and compares in constant time. The history is
checked by recomputing `chain`; a link whose history was edited fails to decode. The harness covers
these cases: round-trip, replay reproduces the exact board and treasuries, a one-bit change in the history breaks
the chain, a bid of +1 breaks the seal.

**Abort.** A sealer who dislikes the outcome can simply not send link 3. No protocol prevents this. It is
**detected socially**: link 2 is a signed-in-effect record of the opener's move and the sealer's hash, and
the opener can show it. The alternation of sealers makes abort a symmetric option, not a seat advantage.
`seal: 'every' | 'half' | 'never'` trades fairness for hops: three links a turn when alternating, two when one
player always seals.

**The link desk (built).** On the Shadow Bidding table, *Paste / inspect a sealed link* opens a dialog that reads
whatever link it is given (the whole address, the part after `#sb1/`, or the bare code) and does the one thing that
link is waiting for. Opening a `#sb1/…` address does it on load, and the fragment is then replaced by `#shadow`.

| Pending in the link | Who holds it | The desk offers | Produces |
| --- | --- | --- | --- |
| none | the sealer of turn *n* (side *n* mod 2) | pick a move and a bid on a mini board | link 1 (sealed) |
| `sealed` | the opener | the same picker, for the other colour | link 2 (answered) |
| `opened` | the sealer | *Reveal*, using the nonce saved in this browser | link 3 (revealed), and the turn already resolved with its audit |
| `reveal` | the opener | recompute the hash and compare; then *Verify and play* | the resolved turn, its audit, and the picker for turn *n + 1* |

Two things the layout above does not say. **Each side keeps a secret** (`localStorage`, memory if it is blocked):
the sealer its order and nonce (they cannot be recovered from link 2), and the opener its plain order. The opener
needs it because **link 3 does not carry the opener's order, and the tie coin is derived from it**. If the opener's
browser lost it, the desk asks for link 2 (which holds it in plain) and checks that it matches the seal. **A broken
seal is shown, not played**: the two hashes are printed side by side and the verify button stays disabled. An edited
history fails to open at all (`history chain broken`). Garbage, a link for the wrong phase, and a reveal on a browser
without the nonce each give a message.

The harness plays 17 turns (51 hops) between two simulated devices that share nothing but URL text, and
`ui-smoke.mjs` plays the same hops by clicking the real page. A limit worth knowing: the hash chain covers the move
history, not the match header, so `start`, `cap` and `mode` in a link can be edited without the chain noticing.

**Cost, stated plainly.** Three links per turn is about 75 exchanges for a 25-turn game. That is
correspondence chess, not a quick game. The *live* mode (below) seals and reveals in one round-trip.

### B. WebRTC room sync

One JSON envelope for every game; one channel. Host-authoritative replication, the pattern in
[`apps/azul/src/net/protocol.ts`](../../apps/azul/src/net/protocol.ts): peers replicate an ordered log of
events and never send a board, and a peer that sees a gap asks for a snapshot instead of guessing. The relay is
whichever of Trystero or `services/rooms` the app already uses; the payload is identical.

![Room sync: hello, roster, begin, act, event, ack, resync](diagrams/room-sync.svg)

*Guests send intent; only the host orders events. A guest that sees a gap resyncs instead of guessing.*

```ts
type Envelope<T> = { v: 1; app: 'hybrid-cartel-v1' | 'hybrid-bidding-v1' | 'hybrid-lexicon-v1'; room: string; from: PeerId; seq: number; t: T }

type Common =
  | { t: 'hello'; name: string; fresh?: boolean }
  | { t: 'roster'; hostId: PeerId; seats: Seat[]; config: Rules; started: boolean }
  | { t: 'begin'; seed: string; seats: Seat[]; rulesHash: string }
  | { t: 'resync'; lastSeq: number }
  | { t: 'snapshot'; seq: number; state: unknown; seats: Seat[] }
  | { t: 'ack'; seq: number }

type Cartel =
  | { t: 'act'; move: CCMove }                                  // guest → host
  | { t: 'event'; seat: number; move: CCMove; drawn: number[] } // host → all; `drawn` goes only to the owner
  | { t: 'propose'; id: number; offer: Covenant[] }
  | { t: 'sign'; id: number; accept: boolean }

type Bidding =
  | { t: 'seal'; turn: number; commit: string }                 // both sides, same turn
  | { t: 'reveal'; turn: number; order: Order; nonce: string }  // after both seals are in
  | { t: 'tie'; turn: number; coin: 0 | 1 }                     // derived by both; sent only as a check

type Lexicon =
  | { t: 'word'; path: number[] }
  | { t: 'acts'; acts: ({ k: 'stone' | 'rot'; cell: number })[] }
```

Notes that are not obvious from the types:

- **Cartel's `event` carries `drawn` only to the seat that drew.** Other guests receive the move and a
  count, not the tile, so no peer holds the future of the bag. Snapshots omit other seats' hands.
- **In live Shadow Bidding both sides `seal` first, then both `reveal`.** Two round-trips settle a turn, not
  three links, and neither side can see the other's order before sealing. The host does not decide anything;
  it only orders the messages.
- **Covenant `sign` is a two-phase commit.** A covenant exists only after every named party has accepted the
  same `id` and `offer`. Until then it is a proposal and filters nothing.
- **Lexicon has no hidden information**, so it needs no commit-reveal: the history is the whole state. As a
  link it is `seed ‖ moves` and can be replayed by anyone; "undo" is not sending.
- `rulesHash` in `begin` pins the exact option set so two clients with different defaults cannot desync.

### C. Deterministic tie-breaking

Everything that could vary is named here. If it is not on this list, the engine does not break the tie.

| Where | Situation | Resolution |
| --- | --- | --- |
| SB | Equal bids | coin = `SHA-256(commit ‖ opener_order ‖ nonce)[0] & 1`; 0 → White first |
| SB | The sealer is whom | side = turn mod 2; the opener of turn *n* seals turn *n + 1* |
| SB | Second move no longer legal | it becomes a pass, never an error; no refund (its bid was never paid) |
| SB | Pawn reaches the far rank | queen, no choice |
| SB | King captured | immediate end; the second move is **not** executed |
| SB | Bid exceeds treasury | clamped to the treasury before comparison |
| SB | Treasury exceeds the vault limit | clamped after income; overflow is burned |
| SB | No capture or pawn move for 30 turns, or turn 80 | material lead ≥ 2 wins, else draw |
| CC | Hostile merger | more tiles of that commodity in the *pre*-merger realm wins (+2 spoil to the winner's owner); a tie goes to the older director (turn placed) |
| CC | Buy-in | the point is taken from the buyer's lowest colour that holds one; no point, no buy-in; the pair must be unsigned by the buyer and every promiser must have a slot free |
| CC | Several commodities contested by one tile | resolved in commodity order 0..3 |
| CC | Final scores equal | sum of the three weakest, then the strongest, else a draw |
| CC | A covenant makes every placement illegal | discarding is always legal; otherwise force majeure + damages |
| CC | A `feed` is not honoured by its last turn | promisee banks +1 in that commodity |
| CC | Bag order | shuffled from `mulberry32(hash("cc" ‖ seed))`; the host deals, never the seed |
| LQ | Board generation | seed + bump counter `0..39`; first board with ≥ 25 words wins |
| LQ | Two words with equal gain (bots only) | lexicographic |
| LQ | Rotation | always clockwise; the block is addressed by its top-left cell |
| LQ | Shear: which group is the main body | the biggest orthogonal ink group; tie → more points, then the lowest cell index |
| LQ | Same-round sweep order | after a Censor action: shear (turns only), ink, then stones; after a Poet word: stones, then the suicide check |

### D. Headless bot harnesses

`harness.mjs` is the playtest of record and is read as a design document: three sections, one per game,
plus the protocol and rule checks. **A rule that no bot can exercise is a rule nobody has tested.** That is how
the two silent failures above (a map with no mergers and a Go layer with no captures) were caught: a table
of identical rows or a column of zeros.

| Game | Bots | What each is for |
| --- | --- | --- |
| Shadow Bidding | **Random** | floor: any rule that lets it win is broken |
| | **Greedy** | best one-ply material, never bids; the "no economy" baseline |
| | **All-in** | bids its whole treasury every turn; the "initiative is everything" baseline |
| | **Economist** | predicts the rival's move, simulates both orders, bids the price of going first scaled by 0.5 (ledger) or 0.8 (pot) |
| Cartel | **Greedy** | maximises its own weak-colour value minus half the others' gain; never signs |
| | **Diplomat** | Greedy plus: proposes a mutual `nomerge` when a hostile-merger square touches both realms |
| | **Joiner** | Greedy that proposes and signs nothing but buys into a treaty a merger could reach |
| | **Broker** | Diplomat plus the Joiner's buy-in |
| Lexicon | **Greedy / Careful / Wary Poet** | best gain; best gain + air + page span; Careful minus a penalty on ink outside the main body |
| | **Random / Hunter / Scrambler / Denier Censor** | random stones; squeeze the weakest group; best rotation then hunt; one-ply denial of the Poet's best word |

Each row is a probe, not an opponent. The question a tournament answers is not "who wins" but "does this rule
change anything": ablations (`anchor`, `libFloor`, `rotCool`, `shear`, `cap`, `mode`, `covenants`, `hand`, `spoil`, `count`, `buyIn`) run the same pairing with
one rule switched.

**What a ported app adds.** The engine ports unchanged as TypeScript with Vitest (as `apps/hushword` did), the
bots become `scripts/playtest.ts`, and the checks above become tests. The seams to keep: engine has no DOM,
bots take an explicit RNG, every transport sends `Order`/`Move` objects and never a board.

---

## Visual registers

One register per game, never blended (CONCEPTS.md, "Design direction").

| Game | Reference | What it gave |
| --- | --- | --- |
| Cartel | Gilded-Age railroad stock certificate | cream rag paper, engraved bottle-green rules, rosettes, a share register, seals as directors; realms drawn as silhouettes, so the map reads as territory |
| Shadow Bidding | Venetian counting-house ledger | vellum folio with oxblood rulings, DARE / AVERE columns, ducats, red sealing wax for anything still hidden; the seal is the interaction |
| Lexicon Quarantine | Samizdat typewriter zine | photocopy grey, near-black ribbon, red pen, censor bars that are real black rectangles; the paper grain is an SVG turbulence filter |

Shared on purpose: legal moves are always visible and illegal ones say why (covenant squares are hatched,
rotation previews its 2×2), the engine's own numbers are shown (air counts, realm sizes, link lengths), and
nothing moves unless a rule moved it. `prefers-reduced-motion` removes animation.
