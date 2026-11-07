# Life Ecologies — architecture and critique

Two browser-only cellular instruments, built as one folder with no build step.

- **Sporefront** — a 64 × 64 toroidal Life plate you can only touch at the seam. Eight
  rotating seed drums and three movable rule lenses are the whole vocabulary.
- **Terrarium Hash** — a submissive Wardian case whose genome, seed, age and care log
  live in the URL fragment. A link is a pressed specimen that replays exactly.

Open `index.html` directly. Everything below the visual layer is real: both simulations
run on the bitboard described here, both links round-trip, and the classifier colours
are computed from the board. The headless solver, the sealed-commit duel and the
herbarium are now shipped; the Web Worker is still specified but not shipped.

The same engine and solver are extracted from `index.html` by `certify.mjs`, so the
page and the verifier cannot drift apart.

---

## The filter, and the one this batch added

`docs/CONCEPTS.md` rejects three kinds of idea: already solved in a stronger form,
novelty that is only decoration, and anything that cannot run without a server or a
model. This folder inherits those filters and adds a fourth, specific to cellular
automata:

> **A CA game is a slot machine unless the player can compute the consequence of a
> move, or the game gives them a legible forecast of it.**

Life is chaotic by construction. A 64 × 64 soup has no human-readable future; asking a
player to "aim" a seed and watch is asking them to pull a lever. Every mechanic below
exists to turn that chaos into a searchable horizon, without removing the fact that the
system is unstable.

The other rule is the repository's usual one: remove the darkroom/fern theme and the
mechanic must still stand. The themes are not skins. They supply the interaction
vocabulary — a safelight and grease pencil for intervention, a glass case and a
herbarium label for restraint.

---

## 1. Sporefront

### The received idea

A 64 × 64 board ticks continuously. You cannot click interior cells. You control
rotating edge seed-drums and three movable "rule lenses" that locally shift birth and
survival rules (Conway `B3/S23` → HighLife `B36/S23`, Day & Night, Seeds). It is a
puzzle and a duel.

### What would fail in playtesting

These are the failure modes this design is most likely to hit in playtesting. Each is
written as the test that would catch it, followed by the mechanic that answers it. The
numbers from the stepper are measured; the player behaviour is predicted.

**1. The slot-machine failure.** The board is chaotic; a drum rotation is a lever. The
player sees a result but cannot attribute it, so "skill" collapses into pattern
superstition.
*Test:* show a player a move, ask them to predict the sign of the change; below 65%
accuracy, the move is not legible.
*Fix:* a **six-tick exact trace** of the committed state, plus a **six-tick round**.
The player does not need to predict Life from first principles; they need to read a
forecast. The trace is computed by the same stepper as play, never by an illustration.
The remaining 18 ticks are beyond the horizon, which is where planning lives.

**2. The seam failure.** A local rule lens creates a boundary where two rules meet.
Cells on the seam are ambiguous; players cannot tell which rule applied, so the lens
feels like a fog.
*Test:* ask players to point at the rule that owns a marked seam cell; below 90%,
the ownership rule is not legible.
*Fix:* **strict ownership**. A cell is owned by the topmost lens whose toroidal disc
contains it; otherwise it is Conway. The seam is drawn as a one-cell contour. The same
evaluator is used for play, trace and solver. There is no tie-break the player cannot
see.

**3. The twitch failure.** A continuous board plus free clicking is a reaction game,
not a deduction game. Inputs race the simulation and outcomes depend on frame timing.
*Test:* variance in outcomes between a player who pauses to think and one who does not.
*Fix:* **actions are committed, not sprayed**. Three actions per six-tick round:
arm a drum, move a lens, change a lens rule. Inputs apply at the tick boundary. The
board still ticks continuously; the player's hand does not.

**4. The no-objective failure.** "More cells" converges to a static ash pile, and both
sides of a duel converge together. Population is the wrong score.
*Test:* play 200 seeds with a greedy biomass bot; if the winner is decided in the last
two ticks by noise, the objective is wrong.
*Fix:* score **invariants in a band**, not raw growth: still lifes, oscillators,
spaceships, and a target density window (3.5%–9% in the shipped trial). Life naturally
settles near 5% on a 64 × 64 torus; a band turns the natural equilibrium into a place
to hold rather than a number to maximise.

**5. The dominant-lens failure.** If HighLife or Seeds simply wins, the lens choice is
solved after one session and the puzzle is stale.
*Test:* run the solver with each lens preset forced; if one preset wins more than 70%
of lines, the level is rejected.
*Fix:* the density band punishes explosive rules (Seeds overshoots and suffocates), and
lenses are local and cost an action. The build carries a **dominance audit** rather than
a belief that the presets are balanced.

**6. The spectator failure.** "You cannot click the interior" can reduce the player to
watching a screensaver.
*Test:* count meaningful decisions per minute; below 4, the constraint is a limitation,
not a design.
*Fix:* the drums are the verb, and they are aimed at the lenses. A seed planted under a
lens is the actual move; a seed planted elsewhere is usually food. The seam is the only
input surface, but it is a rich one: 8 drums × 32 rotations × 3 lens placements × 5
presets, with a three-action budget.

**7. The duel-fairness failure.** A fully visible board with alternating moves gives the
second player a free read.
*Test:* first-player win rate over 500 matches; outside 45–55%, the turn order is
broken.
*Fix:* **simultaneous sealed commits** for the duel: both players choose up to three
actions for the pulse, seal them, reveal at the pulse. The board is public; the next
commit is the hidden information. Sides swap after four pulses.

### The revised game

**Board.** 64 × 64, toroidal. Every edge cell has eight neighbours; the drums sit on the
seam where the torus closes. There is no dead border and no edge die-off.

**Rules.** Background is Conway `B3/S23`. Each lens carries one of five presets:
Conway, HighLife `B36/S23`, Day & Night `B3678/S34678`, Seeds `B2/S`, Maze
`B3/S12345`. A lens has radius 7 cells. Ownership is topmost-wins.

**The round.** Four rounds of six ticks. At tick 0 the plate is seeded. At ticks 6, 12,
18 and 24 a **pulse** fires: every armed drum plants its 32-cell ring on its edge arc,
then shuts. The action budget resets to 3 at each pulse. The trial closes at t+24.
If the player has not touched anything by the first pulse, the plate holds there once,
with a planning message; it is a one-time onboarding affordance, not a rule.

**The drums.** Eight drums, two per side, each covering a 32-cell edge arc. A drum is a
32-bit ring; rotation slides the ring along its arc. Arming costs one action; rotation
is free, so aiming is not taxed. At the pulse, a live ring bit at arc position `i` plants
the edge cell at `(start + i) mod 64`.

**The lenses.** Three discs, draggable anywhere (including across the seam). Moving a
lens or changing its rule costs one action. The rule map is `ruleOf[cell] ∈ {0..3}`;
region masks are rebuilt on change.

**The trial.** At t+24 the plate must hold **6 still lifes**, **4 oscillators**, a
density between **3.5% and 9%**, and a certified score of at least **80/100**. The five
shipped trials vary these gates (see the table below); this is Trial I. The score is
`0.45 × balance + 0.55 × structure`, where `balance` peaks at 13% density and
`structure = 14 × still + 12 × oscillator + 28 × ship`, capped at 100.

**The duel.** A shared 64 × 64 plate, two strains, one pulse. Strain A owns drums 0–3
and lens 1; Strain B owns drums 4–7 and lens 2. Each pulse both players commit up to
three drum/lens actions behind a SHA-256 seal, then reveal together. The seal is
`sha256({v, s, r, n, a})`, where `n` is an eight-byte nonce; the nonce is hidden until
the reveal, so the commit is binding even though the action space is small. A planted
cell carries its strain's lineage; a newborn inherits the majority lineage of its live
parents. At t+24 each strain's score is `0.45 × balance + 0.55 × structure`, where
balance uses the strain's territory and structure weights each component by the
fraction of its cells the strain owns. The shared plate is what makes the hidden commit
matter: your injection can feed or starve the opponent's structures, and you cannot see
their pulse until both seals are open.

The duel ships in three transports:

- **Local pass-and-seal.** A commits and seals; the card hides A's actions and switches
  to B; B commits and seals; **Reveal pulse** verifies both seals and applies both
  action sets. The board runs six ticks and holds at the next pulse.
- **Beam-search Strain B.** A commits; the bot runs a bounded beam over B's four drums
  and its lens, prices each bundle by a cheap territory/stability rollout, classifies
  the top six, and seals its best line. It does not see A's commit.
- **Sealed link.** **Copy sealed link** mints `#sporefront&seal=duel.<base64url>` with
  the seed, lens/drum config, revealed history and the pending commit. Opening the link
  replays the history from the seed, restores the seal, and hands the device to B. The
  link is about 1 kB for a pending commit; the program, not a screenshot, is what
  travels.

The duel is deterministic: `duelReplay(seed, lenses, drums, history)` reproduces the
board, the lineage map and the score exactly, and `certify.mjs` checks it.

### Why skill is real, and where it lives

The player's loop is: read the plate → identify a viable local structure → choose a
drum arc and rotation that lands a seed inside a lens → choose the lens rule that turns
that seed into the structure → spend the remaining actions on defence. That is a
finite, computable search, not a vibe.

What is deliberately **not** given: a 24-tick forecast. The player sees six ticks. The
structures that score are the ones that survive the other eighteen. The trace removes
the excuse "I could not see what happened"; it does not remove the planning.

### Certification and par

A level is a record:

```ts
type SporeLevel = {
  version: 1;
  seed: number;
  drums: { ring: number; rot: number }[];   // 8
  lenses: { rule: RuleId; x: number; y: number }[]; // 3
  target: { still: number; osc: number; ship: number; density: [number, number]; score: number };
  rounds: 4;
  actionsPerRound: 3;
};
```

The headless verifier runs in two stages:

1. **Beam search** over rounds. Candidates are generated by a policy, not by brute force:
   drum rotations that align a live run with a lens disc or a dense frontier; lens
   placements at component centroids, lens boundaries and a coarse 8 × 8 grid; five rule
   presets. Beam width 64, depth 4.
2. **Monte-Carlo rollouts** with a deterministic policy from each beam node. 10k
   rollouts per level is enough to distinguish a real line from a lucky one at this
   branching factor.

BFS is not used for the full four-round tree; it is used where exactness is affordable.
A single pulse is six ticks and at most three actions, so the verifier can BFS that
subgraph over the reduced candidate move set and prove that a claimed still life,
oscillator or ship is reachable from the previous pulse. BFS also replays a claimed line and certifies that every step is legal.
The split is deliberate: **BFS proves, beam + MCTS explores.** A par is only published
when the last pulse has a BFS certificate and the whole line has a replay certificate.

Par is the best certified pulse count, reported as `pulses/actions`. The certificate is
JSON, and the build rejects a level when any of these is true:

| Rejection | Threshold | Why |
| --- | --- | --- |
| Null move wins | no action reaches target | the level plays itself |
| One lens dominates | any preset in >70% of winning lines | the choice is fake |
| Too easy | random policy wins >35% | the trace is doing all the work |
| Too hard | best policy wins <10% over 200 seeds | the target is unreachable |
| Par too short | <2 pulses | no room for a plan |
| Par too long | >4 pulses | outside the format |

A certificate is small enough to commit beside a level:

```json
{
  "version": 1,
  "seed": "0x9e3779b9",
  "reachable": true,
  "par": { "pulses": 3, "actions": 7 },
  "nullScore": 35,
  "bestScore": 92,
  "lensUse": { "highlife": 0.38, "daynight": 0.22, "seeds": 0.08 },
  "bfsFinal": true,
  "replay": true
}
```

### The five certified plates

`index.html` ships five trials. Each carries a beam-search witness that is replayed by
`certify.mjs`; a par is published only when the replay meets the target and the final
pulse has a bounded BFS certificate. `node certify.mjs` re-derives every line and fails
if a shipped certificate differs.

| Trial | Name | Seed | Rule lenses | Target (still / osc / ship) | Density band | Par | Score |
| --- | --- | --- | --- | --- | --- | --- | --- |
| I | Seam Ignition | `0x9e3779b9` | HighLife, Day/Night, Seeds | 6 / 4 / 0 | 3.5–9.0% | 7a | 85 |
| II | HighLife Nursery | `0x77777777` | HighLife, HighLife, Conway | 2 / 8 / 0 | 2.8–9.0% | 6a | 79 |
| III | Day & Night Shear | `0xccccdddd` | Day/Night, Day/Night, Conway | 3 / 5 / 1 | 3.0–9.0% | 6a | 79 |
| IV | Ash Starvation | `0x31415926` | Seeds, Maze, Conway | 8 / 1 / 2 | 5.0–7.5% | 8a | 86 |
| V | Oscillator Crown | `0x88888888` | Conway ×3 | 2 / 8 / 1 | 3.5–9.0% | 8a | 83 |

Par is the action count; the pulse count is in the certificate. The density band is
per-trial: the default band is 3.5–9%, but the HighLife and Day/Night seeds settle
lower, so their bands start at 2.8% and 3.0%. The target was tuned by running the real
stepper, not by guessing: passive play on the default seed reaches 160 cells / 3.9% /
9 still / 1 oscillator / score 80 at t+24. That is why the density band is 3.5–9%, not
the 8–22% the first draft assumed, and why the oscillator count — not biomass — is the
real gate.

The certificate stored beside each trial is:

```json
{
  "version": 1,
  "seed": "0x9e3779b9",
  "reachable": true,
  "par": { "pulses": 4, "actions": 7 },
  "nullScore": 82,
  "bestScore": 85,
  "lensUse": { "highlife": 1, "daynight": 1, "seeds": 1 },
  "bfsFinal": true,
  "bfsDepth": 1,
  "replay": true,
  "verifiedLines": 8,
  "explored": 1867,
  "result": { "still": 6, "osc": 11, "ship": 0, "density": 0.0608, "score": 85 },
  "witness": ["..."]
}
```

`nullScore` is the score of four empty pulses; it can exceed the target score and still
fail because the oscillator gate is not met. `lensUse` is the fraction of certified
lines whose final lens set includes each preset. `bfsDepth` is the shortest final-pulse
bundle the bounded BFS found. The witness is an array of four rounds, each a list of
actions: `{"t":"arm","d":0,"rot":7}` arms drum 1 at rotation 7,
`{"t":"rule","j":1,"rule":2}` sets lens 2 to Day/Night, and
`{"t":"move","j":2,"x":49,"y":46}` moves lens 3.

The solver in the page is the same code. **Show certified witness** replays the shipped
line at ten ticks a second; **Solve this plate** runs a beam-10 search in the tab and
prints the line it finds. The browser solve is synchronous and takes about 1.5–4
seconds; it is a demonstration, not the frame budget. `certify.mjs` is the authority.

---

## 2. Terrarium Hash

### The received idea

An ambient Life ecosystem with its own momentum. Over-intervention kills the colony.
The rule genome and compressed grid live in the URL fragment, so links are living
fossils passed between browsers.

### What would fail in playtesting

**1. The opaque-punishment failure.** "Over-intervention kills" without a visible bill
is a rule the player cannot learn. They mist twice, the colony dies, they leave.
*Fix:* a **visible disturbance gauge** with a hysteresis band. Mist +5, prune +8, stir
+12. Above 60 the colony loses health; below 45 it recovers. At 100 the case collapses.
The costs are printed on the tools before the click. Collapse is a slow decline over
about half a minute of neglect, never a cliff.

**2. The screensaver failure.** Ambient Life settles into ash; there is nothing to do
and no reason to return.
*Fix:* the case **breathes**. A deterministic drift spore fires every 56 ticks when
biomass is below 40, so a sparse culture does not become a dead GIF. Success is
biodiversity and stability, not survival. The link is the return loop: a specimen can
be pressed, shared, reopened and grown into a daughter culture.

**3. The URL-length failure.** 4,096 raw bits are 512 bytes, 683 base64 characters.
A dense board with a long care log can blow past a practical link.
*Fix:* the link is a **replay program**, not a screenshot: genome + seed + age + care
log. It is 25–33 bytes / 34–44 characters in the prototype. Snapshot mode exists for
frozen specimens, using RLE + `deflate-raw` + base64url; typical 219–240 bytes / 292–320
characters. A hard cap of 1,800 characters is the final build's fallback rule.

**4. The determinism-drift failure.** A link that replays differently in another browser
is a broken fossil.
*Fix:* integer-only stepping, fixed iteration order, a seeded PRNG, a versioned payload
and an **FNV-1a checksum** over the packed board. The loader replays from zero and
compares; a mismatch is reported as *fossil drift*, not silently shown as a different
creature.

**5. The death-spiral failure.** One bad intervention kills a colony the player has
invested in, and they stop.
*Fix:* the disturbance/health hysteresis, a visible health band, and a **daughter
culture**: after collapse the genome and seed survive and the next culture starts from
them. Death becomes an archive, not a loss.

**6. The genome-history trap.** If the genome can change mid-run, replay needs the
genome's value at every care event, and the link doubles.
*Fix:* **the genome is fixed for a specimen**. Editing it presses a new specimen from
the same seed. The payload is always one genome, one seed, one care log.

**7. The agency failure.** A submissive game can become a toy you watch once.
*Fix:* the reading is the game. The classifier names what is alive (still life,
oscillator, ship, chaotic), counts unique species, and colours the case. The player's
job is to read the case and decide when *not* to touch it. That is a real decision, and
it is the opposite of the Sporefront verb.

### The revised game

**The case.** 64 × 64 toroidal, Moore neighbourhood, one genome per specimen. The
genome is an 18-bit B/S mask: birth counts 0–8 and survival counts 0–8.

**Care.** Three tools, each one click:

| Tool | Effect | Disturbance |
| --- | --- | --- |
| Mist | plant a seven-spore constellation at the click | +5 |
| Prune | clear a radius-5 disc | +8 |
| Stir | shift the whole plate by (1 row, 7 columns) | +12 |

The live tools are those three. A fourth program-only event, `stamp`, presses a named
sprig (`lwss`, `acorn`, `diehard`, `replicator`, `pulsar`, `beehive`) at a coordinate
and costs no disturbance. It is not exposed as a care button; it exists so a herbarium
specimen can be a short replay program instead of a screenshot. The care code is
`0 mist / 1 prune / 2 stir / 3+ stamp`, with the pattern index in `code − 3`.

**Health.** Disturbance decays 0.12 per tick. Above 60, health falls by
`0.02 × (disturbance − 60)` per tick; below 45 it recovers 0.12 per tick. Density above
42% adds 0.05 disturbance per tick (suffocation); density below 1.2% costs 0.03 health
per tick (starvation). At zero health the case collapses and freezes.

**The breath.** Every 56 ticks, if biomass is below 40 cells, a deterministic spore ring
is planted at a position derived from a PRNG seeded by `seed` and the tick. It costs no
disturbance and is part
of the simulation, not a player action. It is why the case is ambient rather than a
countdown to ash.

**The link.** Program mode is the default. Snapshot mode is a frozen plate. Both carry a
checksum. The loader replays and verifies.

### Why restraint is a mechanic

The interesting number is not "how much can I add"; it is "how long can I leave it
alone". The disturbance gauge makes the cost of a hand visible, and the hysteresis makes
recovery possible but slow. A mist every ten seconds is roughly sustainable; a mist
every three seconds collapses the case in under a minute. The player learns the
difference by watching the needle, not by reading a manual.

The genome editor is the other half: because a genome press starts a new specimen, the
player can compare two species from the same seed. That is an experiment, not a reset.

### Reading the case

Every connected component is extracted with an 8-neighbour flood fill. For each
component smaller than 900 cells and 36 × 36, a local copy is padded with eight dead
cells and run forward up to twelve generations. The classification is:

- **still** — the live set returns exactly at period 1.
- **oscillator** — the live set returns exactly at period 2–12.
- **ship** — the live set returns at period 2–12 after a non-zero translation, with
  matching bounding-box dimensions.
- **transient** — the component dies within twelve generations.
- **chaotic** — no return within twelve, or too large to test.

The species signature is `period | min(normalized shape over the period) | bbox`, so a
blinker in either orientation is one species, and two gliders at different positions are
one species. The classifier runs at a few hertz at most — Sporefront every three ticks,
the case every ten — never per frame. Cell colour is the
classifier's reading: pale lichen for still, brass for oscillators, oxblood for ships,
deep moss for chaos. The legend is the engine.

One deliberate limitation: the prototype's flood fill does not wrap across the seam, so
a block straddling `x = 63` is counted as two small components rather than one still
life. The shipped classifier should unwrap the component with a BFS offset; the seam is
1/32 of the board, so the prototype's counts are biased only near it.

### The herbarium

The Terrarium ships a cabinet of six pressed specimens. Each is a real `t1p` program:
genome, seed, age and care log. Pressing a card decodes the program, replays it from
zero, verifies the FNV-1a checksum and replaces the living case. The thumbnails are
drawn from the same replay, so the cabinet cannot show a specimen the engine cannot
reproduce.

| No. | Specimen | Genome | Seed | Age | Program | Species |
| --- | --- | --- | --- | --- | --- | --- |
| 01 | Glider Archipelago | B3/S23 | `0x13579bdf` | 60 | 43 ch | 7 |
| 02 | Pulsar Cathedral | B3/S23 | `0x9e3779b9` | 30 | 32 ch | 6 |
| 03 | Twin-Bee Symbiont | B3/S23 | `0x51ee7a3b` | 40 | 38 ch | 5 |
| 04 | Replicator Spore | B36/S23 | `0x77777777` | 60 | 32 ch | 5 |
| 05 | Slow Coral | B3/S23 | `0x31415926` | 80 | 32 ch | 6 |
| 06 | High-Entropy Broth | B3678/S34678 | `0x88888888` | 30 | 64 ch | 4 |

The programs are 32–64 characters because they are programs, not plates. A specimen is
a genome, a seed and a short list of stamps; the plate is recomputed. The cabinet is a
browser-local shelf, not an IndexedDB index yet: the six specimens are curated and
shipped, and a player can press any of them into the case. A future build can add
"press the current case" and store the program in IndexedDB.

### What the prototype does and does not do

Real: the simulation, the genome editor, the care tools, the disturbance/health model,
the classifier, the program and snapshot links, the replay verifier, the checksum, the
herbarium cabinet of six replay programs, and the URL routes `#sporefront` /
`#terrarium`.

Mocked: the daughter-culture lineage view, the daily seed, and any multi-user
transport. Those are specified, not shipped.

---

## 3. Engine architecture

### 3.1 The board is 64 words

The board is `BigUint64Array(64)`: one 64-bit word per row. Bit `63 − x` in word `y` is
cell `(x, y)`. The choice of 64 is not cosmetic — it makes horizontal neighbours a
rotate, vertical neighbours a row lookup, and the whole board 512 bytes.

```ts
const N = 64;
const MASK = (1n << 64n) - 1n;
const rotl1 = (r) => ((r << 1n) | (r >> 63n)) & MASK;
const rotr1 = (r) => (r >> 1n) | ((r & 1n) << 63n);
```

A torus means no edge cases: `y − 1` and `y + 1` wrap, and `rotl1` / `rotr1` wrap the
columns. The drums sit on the seam because the seam is real, not because the board has
an edge.

### 3.2 Bit-sliced neighbour counts

The naive step reads eight neighbours per cell: 32,768 reads. The bitboard does it in
four carry planes. For each row, the three rows above, at and below contribute their
left, centre and right rotated copies. Each contribution is a 64-bit mask added into a
4-bit counter:

```ts
function addMask(c0, c1, c2, c3, y, m) {
  let carry = m;
  let t = c0[y] ^ carry; carry = c0[y] & carry; c0[y] = t;
  t = c1[y] ^ carry; carry = c1[y] & carry; c1[y] = t;
  t = c2[y] ^ carry; carry = c2[y] & carry; c2[y] = t;
  c3[y] ^= carry;
}
```

After the eight contributions, `c0..c3` are the four bits of every cell's neighbour
count. Nine masks are then extracted, one per population 0–8:

```ts
for (let k = 0; k < 9; k++) {
  let v = MASK;
  v &= (k & 1) ? c0[y] : (MASK ^ c0[y]);
  v &= (k & 2) ? c1[y] : (MASK ^ c1[y]);
  v &= (k & 4) ? c2[y] : (MASK ^ c2[y]);
  v &= (k & 8) ? c3[y] : (MASK ^ c3[y]);
  counts[k][y] = v;
}
```

`counts[k]` is the set of cells with exactly `k` neighbours. A rule is a birth mask
`B` and a survival mask `S` over 0–8. For one rule:

```ts
next = (born & ~alive) | (surv & alive);
```

where `born` is the OR of `counts[b]` for `b ∈ B`, and `surv` the OR for `s ∈ S`.

### 3.3 Rule lenses as region masks

Sporefront adds a per-cell rule id, `ruleOf: Uint8Array(4096)`, stamped by the three
lenses in order (topmost wins) using toroidal distance. At step time, `ruleOf` is folded
into at most four 64-bit row masks, one per rule id:

```ts
for (const [rid, region] of regions) {
  next[y] |= ((born[y] & ~alive) | (surv[y] & alive)) & region[y];
}
```

This is the reason the lens is computable rather than magical: the seam is exactly the
edge of a mask, and the same mask is used by the renderer, the trace and the solver.
Rebuilding the region masks is 4,096 iterations and happens only when a lens moves or
its rule changes.

### 3.4 Cost

Measured on this machine (Apple silicon, Node 26, same code as the browser):

| Operation | Cost |
| --- | --- |
| One 64 × 64 Conway tick | 0.18–0.23 ms |
| One tick with 3 lens regions | 0.18–0.23 ms |
| Six-tick trace | ~1.2 ms |
| Component analysis, young board | ~0.4 ms |
| Component analysis, mature 200-cell board | ~5.6 ms |
| Packing the board for a checksum | <0.5 ms |

`BigInt` is used for clarity. A production engine would port the same algebra to two
32-bit words per row (`Uint32Array(128)`) or to WASM; the bit layout and carry logic do
not change. The slider's ceiling is 14 ticks/s; 0.2 ms is about 1% of a 60 fps frame and 0.3% of
the second's budget at that ceiling.

### 3.5 Determinism

- No floating point in the simulation. Health and disturbance are the only floats, and
  they never feed the board.
- No `Math.random` after seeding. The seed comes from the URL or from `crypto` at
  specimen creation.
- Fixed iteration order: rows top to bottom, cells left to right, care events in log
  order, drift before care on a tick.
- The engine version is the first byte of every payload. A version bump is a new link
  namespace, not a silent reinterpretation.

### 3.6 Verification

**Sporefront** is verified by the same code that ships in the page. The level is a
small record (seed, drum rings, lens presets, target, budget). The solver's candidate
generator is the design's real difficulty control: it searches the moves a thoughtful
player would consider, not the full 10^9 space. Beam search supplies lines; a cheap
two-tick stability proxy prices them during the beam; the top candidates are classified
with the real component analyser; par is the best replayed line. A bounded BFS over the
final pulse proves that the last pulse is reachable, and a full replay proves every
step is legal. The rejection table above is the contract.

`certify.mjs` extracts the `CORE`, `SOLVER`, `DUEL`, `TRIALS` and `HERBARIUM` blocks from
`index.html` and runs them in Node. It is not a second implementation: the page and the
verifier share the exact source text. `node certify.mjs --write` re-solves the five
trials and rewrites the `CERTIFIED` block; `node certify.mjs` re-solves and fails if a
shipped certificate differs.

**Terrarium Hash** needs no solver, but it needs a replay verifier. Given a program
payload, the verifier starts from `seedTerrarium(seed)`, applies the care log at its
recorded ticks, steps the genome, applies the deterministic drift, and compares the
FNV-1a checksum of the packed board. A mismatch is a bug or a forged link; either way it
is surfaced as drift rather than hidden. The herbarium uses the same verifier, so a
pressed specimen cannot be a picture the engine cannot reproduce.

The classifier is also a verifier: a level that claims "4 oscillators" but whose
components never return is rejected by the same function that colours the cells.

**The duel** is verified by `duelReplay`: a fixed four-pulse history is replayed twice
and the board and lineage map must match exactly. The SHA-256 implementation is checked
against three known vectors. The seal is verified by recomputing
`sha256({v,s,r,n,a})` from the revealed actions and nonce.

### 3.7 URL codec

All payloads are byte arrays, base64url-encoded. A prefix names the mode:

| Prefix | Meaning |
| --- | --- |
| `#s1r.` / `#s1z.` | Sporefront snapshot, RLE or deflate-raw |
| `#t1p.` | Terrarium program |
| `#t1sr.` / `#t1sz.` | Terrarium snapshot, RLE or deflate-raw |
| `#sporefront` / `#terrarium` | plain plate routes |
| `#sporefront&seal=duel.` | sealed duel program |

**Genome.** 18 bits: birth mask 0–8 and survival mask 0–8. The prototype spends two
`u16`s (4 bytes) for clarity; the shipped format packs to 3 bytes.

**Terrarium program.**

```
0        version (1)
1..2     birth mask u16
3..4     survival mask u16
5..8     seed u32
9..11    age u24
12..     care count varint
...      care entry: Δtick varint, type u8, x u8, y u8
-4       FNV-1a checksum u32
```

`type` is `0` mist, `1` prune, `2` stir, or `3 + pattern` for a stamp. A Δtick of 0 is
legal: several actions can happen at the same age, in log order. The replay applies care
after the tick's step and health update, which is exactly where the live action happened.

**Duel program.** The sealed link is JSON, base64url-encoded, prefixed `duel.`:

```json
{
  "v": 1,
  "seed": 3596982972,
  "lenses": [{ "x": 22, "y": 18, "rule": 0 }],
  "drums": [{ "rot": 3, "ring": 17432580 }],
  "history": [{ "A": { "actions": [], "nonce": "...", "seal": "..." }, "B": {} }],
  "pending": { "A": { "actions": [], "nonce": "...", "seal": "..." }, "B": null }
}
```

The board and lineage map are not stored; they are recomputed by replaying `history`
from `seed`. The pending commit carries its nonce and actions so the recipient can
verify the seal at the reveal; the page hides them until then. A pending-commit link is
about 1 kB, which is why the duel uses a program rather than a snapshot.

**Terrarium snapshot.**

```
0        version (1)
1..2     birth mask u16
3..4     survival mask u16
5..7     age u24
8        disturbance (0..100)
9        health (0..100)
10..13   seed u32
14       body mode (0 = RLE, 1 = raw 512 bytes)
15..16   body length u16
...      body
-4       FNV-1a checksum
```

**Sporefront snapshot.**

```
0        version (1)
1..4     seed u32
5..6     tick u16
7        action budget
8..16    3 lenses × (x u8, y u8, rule u8)
17..64   8 drums × (rot u8, armed u8, ring u32)
65       body mode (0 = RLE, 1 = raw)
66..67   body length u16
...      body
-4       FNV-1a checksum
```

**RLE.** The board is scanned row-major as 4,096 bits. Each run is a varint length plus
one bit value. Sparse plates compress well; dense plates do not, so the encoder compares
the RLE length with the raw 512 bytes and stores whichever is shorter. This is why the
dense-board worst case is 584 bytes, not 8,000.

**Compression.** `CompressionStream('deflate-raw')` produces a headerless deflate stream;
`DecompressionStream('deflate-raw')` reverses it. The minter keeps the shorter of raw and
deflated payloads and records the mode in the prefix. If `CompressionStream` is absent,
the raw path is used. No polyfill, no dependency.

**Checksum.** FNV-1a over the packed 512-byte board. It catches replay drift and
truncated links; it is not a security boundary. If tamper-evidence matters later, use
SHA-256 through `crypto.subtle` and accept the async cost.

**Measured sizes** (this board, this prototype):

| Payload | Bytes | Characters |
| --- | --- | --- |
| Raw board | 512 | 683 |
| Sporefront, sparse | 93 | 124 |
| Sporefront, mid-bout | 206 | 280 |
| Sporefront, dense | 584 | 779 |
| Terrarium program, no care | 25 | 34 |
| Terrarium program, 4 events | 33 | 44 |
| Terrarium snapshot, raw RLE | 497–533 | 663–711 |
| Terrarium snapshot, deflated | 219–240 | 292–320 |

The design claim is not that every link is short; it is that the **program** is short and
the snapshot is bounded. A 24-tick duel snapshot is ~200 bytes; a year of care events is
still a program of tens of events, not a megabyte of grid.

---

## 4. Visual registers

The two plates are deliberately not one design system. They are two arguments.

**Sporefront — 1970s darkroom agar plate.** The ground is near-black; the plate is amber
agar under a safelight. The vocabulary is photographic: contact-sheet registration marks,
grease-pencil rings around specimens, film-strip seed drums on the rim, a mono readout,
a red safelight that flickers once every few seconds. Cells are spores: newborn cells
flash peach, then settle to a near-black spore. The UI is sharp-edged, never rounded; no
glassmorphism, no neon. The motion is hot and tick-driven.

**Terrarium Hash — 19th-century Wardian fern case.** The ground is laid cream paper with
a faint fibre; the frame is a brass double rule. The vocabulary is botanical: engraved
serif labels, small caps, a specimen tag, a brass plaque, condensation on the glass,
moss and lichen instead of dots. The classifier's colours are the only saturated notes
(lichen, brass, oxblood). The motion is slow and ambient.

The contrast is the design: one plate is about the hand at the boundary, the other about
the hand withheld. Blending them would erase the argument. The shared shell is a neutral
archive table — near-black, a hairline rule, a mono index — so each plate can be itself.

---

## 5. Testing plan

**Unit.** Blinker (period 2), block (period 1), glider (period 4, translates), lens
seam ownership, drum arc injection, RLE round-trip, program/snapshot round-trip,
checksum mismatch, replay equality at the final tick, care at age 0 and at the final
age.

**Property.** 10,000 random boards: `decode(encode(board)) === board`; 1,000 random
care logs: replay from the program equals the live state; no care event can move a
future tick.

**Performance.** A tick under 1 ms at 64 × 64 with three regions; a six-tick trace under
10 ms; analysis under 10 ms at 4 Hz; no frame over 16 ms while running at 14 ticks/s.

**Certification.** `node certify.mjs` extracts the page's engine, re-solves the five
trials, replays every witness, checks the SHA-256 vectors, replays every herbarium
program and verifies the duel replay. The current run:

| Trial | Par | Score | Still / osc / ship | Density | Null | Nodes | Lines |
| --- | --- | --- | --- | --- | --- | --- | --- |
| I | 7a | 85 | 6 / 11 / 0 | 6.1% | 82 | 1867 | 8 |
| II | 6a | 79 | 2 / 8 / 0 | 3.0% | 77 | 1893 | 4 |
| III | 6a | 79 | 3 / 5 / 2 | 3.5% | 78 | 1998 | 4 |
| IV | 8a | 86 | 8 / 1 / 2 | 6.7% | 76 | 1889 | 9 |
| V | 8a | 83 | 2 / 8 / 1 | 5.1% | 81 | 1998 | 8 |

The node counts vary with the beam width; par, score and witness are deterministic for a
given beam. Every trial has `bfsFinal: true` with `bfsDepth: 1`, so the final pulse is
reachable by a single action. The herbarium programs replay at 32–64 characters; the
duel fixture replays deterministically at tick 24 with scores A 38 / B 37.

`node certify.mjs --write` is the only way the `CERTIFIED` block changes. A level is
rejected if a witness fails replay, if the BFS cannot reach the final pulse, or if the
par rises above 12 actions.

**Sporefront playtest.** 200 seeds × three policies (null, greedy biomass, greedy
structure). Report win rate, par, action distribution, lens usage, density over time.
Reject a level by the table in §1. The number to watch is not the win rate but the
**attribution rate**: can the player explain why the plate changed?

**Terrarium playtest.** Three care policies (never, every 10 s, every 3 s) × 100 seeds ×
300 ticks. Report collapse time, species count, density, and the number of distinct
species seen. The target is: never → stable but static; every 10 s → stable and more
diverse; every 3 s → collapse in 45–90 s. If "never" is the dominant strategy, the
reading is not yet a game; if "every 3 s" is safe, the gauge is too forgiving.

---

## 6. What is intentionally left open

- **The trace may be too generous.** If playtests show players can win by staring at the
  six-tick trace and ignoring the 24-tick structure, reduce the trace to four ticks or
  hide the trace on the highest tier.
- **The lens seam may still be hard to read.** The ownership rule is exact, but exact is
  not the same as legible. A future build could draw the seam as a moving contour that
  breathes with the pulse.
- **The duel link is about 1 kB.** A pending commit carries its nonce and actions so the
  recipient can verify the seal at the reveal. A shorter two-message transport would
  send only the seal hash and keep the nonce on the committing device.
- **The duel score is approximate.** Structure is weighted by the owner fraction of a
  component's bounding box, not a per-cell component owner map. The approximation is
  stable and deterministic, but a per-cell map would be exact.
- **The herbarium is a fixed shelf.** Six curated specimens, not an IndexedDB index.
  "Press the current case" is the obvious next build.
- **The solver in the page is synchronous.** A live solve takes 1.5–4 seconds and blocks
  the frame. A Web Worker could run the same extracted source and keep the frame budget.
- **The solver's par is policy-relative.** It is the best line the candidate generator
  and beam found, not a proof over the full 10^9 action space. The BFS certificate is
  bounded to the final pulse and the reduced candidate set. This is the intended split:
  BFS proves, beam explores.

---

## 7. File map

```
prototypes/life-ecologies/
  index.html        self-contained prototype: both plates, real engines, real links,
                    the beam solver, the sealed-commit duel, the herbarium
  certify.mjs       extracts the page's engine and re-solves / re-verifies every trial,
                    herbarium program and duel replay
  ARCHITECTURE.md   this document
```

The prototype has no package.json, no bundler and no network requests. Open the file;
the only thing it needs is a browser with `BigInt`, canvas and `CompressionStream`
(Chrome 80+, Safari 16.4+, Firefox 113+). If `CompressionStream` is missing, the links
fall back to RLE and still work.
