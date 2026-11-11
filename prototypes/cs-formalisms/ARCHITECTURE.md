# Live Software / CS Formalismes

Working architecture for three browser-only games about running programs rather than
writing them. This document is deliberately written before the interface: each game is
specified as a pure state machine and a headless certifier first, and only then as a
thing with a surface.

The three specimens are:

| Specimen | Formal object | Player's verb | Failure it makes visible |
| --- | --- | --- | --- |
| **Deadlock** | the synchronous product of cart automata and a resource monitor | **schedule**: spend holds and priority loans at the exact edge where a cycle is still open | deadlock, livelock, priority inversion |
| **Byzantine Choir** | an oral-message tree with an adversarial sender at one or more leaves | **censor**: cut a link or delay a relay so every honest leaf resolves to one order | equivocation, split brain, the 3f+1 threshold |
| **Garbage Collector** | a mutator trace crossed with a tricolour mark-and-compact DAG and a pause budget | **reclaim**: shade, scan, sweep and slide before the mutator outruns the heap | lost reachability, fragmentation, pause overrun |

They belong together because they are the same shape at three different scales. Each is
a finite transition system with an acceptance condition, a resource the player spends,
and a failure that is invisible in ordinary software until it is catastrophic. Each can
be certified in the browser, from a seed, without a server. None of them is a quiz about
computer science; the formalism is the board.

---

## 0. The filter, applied again

`docs/CONCEPTS.md` uses three filters: no stronger existing version, novelty must not be
decoration, and playable without a backend or a model. These three pass the third filter
trivially, so the work is in the first two. The useful test is: **remove the theme. Does
the mechanic still exist?**

- Remove the Swiss railway board from Deadlock and what remains is: fixed instruction
  tapes, a finite set of exclusive resources, a scheduler, and a small budget of
  temporal and priority interventions. That is still a game about breaking a wait-for
  cycle before it closes. Pass.
- Remove the semaphore towers from Byzantine Choir and what remains is: a graph, two
  rounds of oral messages, an adversary that may equivocate, and a player who removes
  edges. That is still a game about making a message tree robust. Pass.
- Remove the CRT from Garbage Collector and what remains is: a linear heap with
  reachability, a mutator that allocates and mutates, and a collector that must move
  live data within a per-pause cost. That is still a spatial compaction puzzle. Pass.

But all three are at risk of a fourth failure that `CONCEPTS.md` names in its playtest
section without giving it a heading: **the textbook failure**. The game can present the
formal object correctly and still be a lecture with buttons. A diagram of the Coffman
conditions is not a mechanic. A list of the 3f+1 threshold is not a mechanic. A legend
that says "black must not point to white" is not a mechanic. The fixes below are mostly
about turning each definition into a consequence the player feels before it is named.

The other shared risk is **prevention passivity**. Deadlock and Byzantine Choir are both
"set up an intervention, then watch". The player must be able to pause, inspect, and act
inside the causal window; the certifier then makes the window legible rather than
turning the game into a blind pre-commitment. The prototypes in `index.html` are built
around that principle.

---

## 1. Deadlock

### 1.1 The idea, tested

Three or more worker carts run fixed tapes. Each tape is a short program of `lock`,
`unlock`, `travel` and `try` operations over track sections. A section is a mutex: one
cart at a time. The player has a tiny budget of **holds** (delay a cart at a signal) and
**priority loans** (lend a waiting cart's priority to the holder for a bounded lease).
The goal is to get every cart to its terminus before its connection time, without a
circular wait, a polite spin, or a three-party inversion.

This is a strong mapping because a railway interlocking already *is* a resource
allocation diagram. Sections are held, signals are requests, a train standing in a
section is a lock, and a deadlock is a physical impossibility that a dispatcher can see
on the board. The theme is not a skin; it supplies the readout.

### 1.2 Critique

**a. The player can arrive too late, and that is the lesson, not a bug.**
A deadlock is not a state you repair; it is a state you avoid. The first build of the
prototype put the three carts at the start and let the player watch the cycle close at
tick five. The only winning interventions happened before the first lock. If the game
does not make that window explicit, players will think the game is broken. The board
must show the **open window** (the cycle is not yet closed) and the **closed window**
(the wait-for graph is a cycle; reset is the only move). A certification panel should
say, in words, *"the cycle closed at tick 5; a hold placed after tick 2 has no effect on
this cycle."* Failure becomes a timeline fact, not a scolding.

**b. A priority boost is a generic speed-up unless it is an inheritance protocol.**
"Boost a cart" is the kind of power that survives the theme removal as "make the thing
you want go faster", which is not a formal mechanic. The sharpened rule: a loan is
**attached to the holder of a resource, not to the waiter**, and it has a **lease**.
You cannot boost the blocked high-priority cart into acquiring the lock; boosting it does
nothing because it is not runnable. You must identify the low-priority holder that the
high-priority cart is waiting on and lend *that* cart the priority. The lease expires, so
the loan is not a permanent stat buff; it buys the holder enough CPU to release. This is
priority inheritance, and it makes the wrong click legible: boosting the waiter is a
no-op, boosting the medium-priority hog makes the inversion worse.

A second nuance: an ordinary priority scheduler with no preemption and no fairness can
serialize the ring by accident, because the highest-priority cart grabs two resources
before anyone else runs. The board therefore uses one of two explicit disciplines, shown
on the plate:

- **synchronous lockstep** for the ring and the polite-retry board, so every cart
  acquires its first section before any cart requests its second;
- **priority preemptive** for the inversion board, so a medium-priority cart can starve
  the low-priority holder.

The discipline is part of the level, not a hidden implementation detail. The product
automaton includes it.

**c. The Coffman checklist is a lecture.**
Mutual exclusion, hold-and-wait, no preemption and circular wait are correct, and they
are also the most likely thing to turn the game into a multiple-choice quiz. The board
should not list them as instructions. It should have an **anatomy overlay** that lights
each condition *on the diagram* once the state satisfies it: the occupied section is
mutual exclusion, the cart sitting in a section while its next signal is red is
hold-and-wait, the absence of a forced-release lever is no preemption, and the red loop
is circular wait. The player reads the board first and the names second. The overlay is
off by default.

**d. Livelock does not exist in a pure blocking model, so it must be modelled honestly.**
If every cart either blocks or eventually runs, a finite deterministic system either
reaches a deadlock or makes progress. Livelock needs a **polite retry** rule: a cart that
finds its next section occupied releases everything, backs off, and retries from the top.
Two polite carts with equal backoff can then reacquire in the same order forever. That is
a real cycle in the product graph, not a scripted cutscene. The engine detects it by
hashing a progress signature `(pc, held, blocked)`; a repeated signature with no cart
advancing is a livelock. The player's hold breaks the symmetry by delaying one cart's
reacquisition past the other's attempt. A boost can also break the symmetry on a
priority-dispatched board, but the clean fix is a stagger.

**e. The budget needs two currencies with different temporal scopes.**
A hold is cheap in authority but expensive in time: it delays a cart and can miss a
connection. A loan is cheap in time but scarce in authority: it is a lease, and using it
on the wrong holder wastes it. If both were just "one token", the game would collapse
into "spend a token". The two currencies should be displayed separately, and the level's
budget should sometimes be zero in one of them. The inversion level, for example, gives
zero holds and one loan; the ring gives one hold and zero loans. The player learns the
difference by being prevented from using the wrong tool.

**f. Difficulty is a property of the intervention search, not a hand label.**
A board is hard when the shortest winning intervention plan is long relative to the
budget, when the winning actions live in a narrow time window, or when the obvious
action is a trap. The certifier measures all three. The level generator rejects boards
that are won by zero interventions, boards that cannot be won within budget, and boards
whose only winning plan is to hold the same cart repeatedly without changing the state.
"Par" is the certified minimum number of interventions, with ticks as a tie-breaker.

### 1.3 The sharpened game

**Role.** You are the interlocking dispatcher. You do not drive the carts and you cannot
edit their tapes. You watch the board and spend the two currencies at the right moment.

**Core verb.** *Read the wait-for graph, find the edge where the cycle is still open, and
spend a hold or a loan there before it closes.*

**The board.** A schematic track plan with sections `A`, `B`, `C`, … drawn as double-line
rail. Each section has an occupancy lamp and a holder. Each cart is a small train with a
priority, a connection time and a visible tape. The tape is the cart's program: a row of
lock/unlock/travel/try chips, with the current chip lit. The player can read every tape
at all times. There is no hidden information; the difficulty is the interaction of the
tapes, not guessing them.

**The two interventions.**

- **Hold** (temporal): set a cart's next dispatch back by `H` ticks. The cart keeps any
  sections it already holds. A hold is the scheduler yield: it changes *when* a cart
  runs, not *what* it owns. It is the right tool for breaking a circular wait at the
  entry, and the wrong tool for a cart that already holds the section the cycle needs.
- **Loan** (authority): give the current holder of a named section the priority of the
  highest-priority cart waiting on it, for a bounded lease. The holder becomes runnable
  ahead of the medium-priority cart, releases, and the waiter inherits the section. It is
  the right tool for inversion, and a no-op on a blocked waiter.

**Three failure states, six boards.**

1. **The Ring** (deadlock, lockstep). Three carts, three sections, each holds one and
   needs the next. Without intervention the cycle closes. A hold on one cart at the
   entry lets the next cart take two sections and unwind the ring. The lesson: break the
   cycle before the first lock, not after.
2. **Inversion** (priority inversion, priority preemptive). A low-priority holder has the
   section a high-priority cart needs. A medium-priority cart is runnable and outranks
   the holder. The high-priority cart's connection time is tight. A loan to the holder
   releases the section in time; a loan to the waiter does nothing; a hold on the holder
   makes it worse. The lesson: lend to the holder, not the waiter.
3. **The Polite Ring** (livelock, lockstep). Two carts each hold one section, try the
   other, release, back off, and repeat. No one is blocked forever, so a deadlock
   detector sees nothing; the state repeats. A hold at the entry, or during the backoff,
   staggers the reacquisition and lets one cart take both. The lesson: progress can stop
   without a block.
4. **The Dining Switchyard** (deadlock, lockstep, `n = 4`). Four carts sit down at four
   sections and each reaches for its neighbour's plate. One hold at the entry leaves
   three carts seated and lets the fourth take two sections; the table unwinds. The
   lesson scales the ring from three parties to four without changing the verb.
5. **Convoy Cascade** (deadlock, lockstep, `par = 2`). Two independent convoys meet in
   one yard and two waits close at the same instant. A single hold unwinds one pair and
   lets the other close behind it; the certified plan needs two holds. The lesson: the
   wait-for graph can have more than one cycle, and par is not always one.
6. **Double Inheritance** (priority inversion, priority preemptive, `par = 2`). Two
   high-priority carts wait on two low-priority holders while the medium hog runs. One
   loan frees one waiter and the other still misses; the plan must lend both holders.
   The lesson: inheritance is per-holder, and a budget can force more than one loan.

The three new boards are certified by the same search as the first three; the headless
report prints their par and the default failure each one exercises.

**Win and loss.** Win when every cart reaches its terminus at or before its connection
time. Lose on a closed wait-for cycle (deadlock), a repeated progress signature
(livelock), or a missed connection. The board stamps the failure on the diagram, and the
ledger records the tick and the edge responsible.

**Feedback.** After every tick the player sees the wait-for edges, the effective
priorities, the remaining lease, the remaining hold, and the slack to each connection.
The anatomy overlay is opt-in. The certifier panel shows the current state count and,
after a reset, the certified minimum plan.

### 1.4 Formal model

A level is

```
L = (Carts, Resources, Tapes, Discipline, Budget, Horizon, Deadlines)
```

Each cart `i` has a finite control automaton

```
A_i = (Q_i, q_i0, F_i, δ_i)
```

where `Q_i` is the set of tape positions, `q_i0` the first position, `F_i` the terminus,
and `δ_i` a partial transition function. The alphabet is

```
Σ_i = { lock(r), unlock(r), travel(n), try(r, b), done }
```

The global state is

```
g = (q_1 … q_n, μ, wait, busy, hold, boost, tick, mode)
```

where `μ : Resources → Cart ∪ {free}` is the ownership map, `wait` records each blocked
cart's requested resource, `busy` records absolute travel-until ticks, `hold` and `boost`
record intervention timers, and `mode` is `lockstep` or `priority`.

A **lockstep** transition advances every runnable cart by one operation, resolving
contention against the state at the start of the tick and applying all effects at the
end. A **priority** transition advances exactly one runnable cart, the one with the
highest effective priority `base + (boost active ? boostAmount : 0)`, with ties broken by
cart index. A cart is runnable when it is not done, not blocked, not in travel, and not
inside a hold.

The product automaton is

```
P = A_1 × … × A_n × M
```

where `M` is the resource monitor: ownership, wait queues, timers. The reachable states
of `P` from `g_0` are the board's state space.

**Deadlock.** `g` is deadlocked when every unfinished cart is blocked in `wait` and no
timer can fire. Equivalently, the wait-for graph has a cycle that covers all unfinished
carts. The engine reports the cycle as a list of `(cart, resource, holder)` triples.

**Livelock.** Build the progress signature

```
σ(g) = (q_1, held_1, blocked_1, … , q_n, held_n, blocked_n)
```

excluding absolute time. If a reachable path repeats `σ` three times with no cart entering
`F_i`, the board is livelocked. In the full certifier this is an SCC in `P` that contains
no accepting transition and no resource progress; the prototype uses the repeated
signature because it is exact for the boards it ships.

**Priority inversion.** `g` is inverted when there is a blocked cart `h`, a resource `r`
with `μ(r) = l`, and a runnable cart `m` such that

```
priority(h) > priority(l)  and  priority(m) > effective_priority(l)
```

and `h` is waiting on `r`. The engine reports the chain `h → l` and the competing `m`.
A lease on `l` raises `effective_priority(l)` above `m` for its duration.

**Interventions.** A hold sets `hold_i = tick + H` and costs one hold token. A loan on a
cart `c` sets `lease_c = tick + L`; while active and while `c` holds a resource, `c` runs
at `max(base_c, max waiter priority)`. If `c` holds nothing, the loan is a no-op. A loan
costs one loan token. The lease is not transferable; if the holder changes, the loan does
not follow the resource. This is deliberate: the player must identify a holder, not a
section, and boosting the blocked waiter must be visibly useless. The prototype uses a
fixed `+3` priority step for the lease so the readout stays legible; the production rule
is full inheritance, `max(base_c, max waiter priority)`, with the same certification
interface.

**Determinism.** Given a level and a sequence of interventions at named ticks, the run is
deterministic. No RNG is used at runtime. Seeds exist only for level generation.

### 1.5 Pure-TypeScript engine

Proposed package layout for the app build (the prototype inlines a compact version):

```
src/engine/
  types.ts          Cart, Resource, Op, Level, GlobalState, Intervention
  tapes.ts          parse/validate tapes, op cost, terminus checks
  monitor.ts        lock/unlock/try, wait queues, wake-by-priority
  schedule.ts       lockstep and priority transitions, timers
  product.ts        canonical keys, reachable-state enumeration
  failures.ts       deadlock cycle, livelock signature, inversion chain
  certify.ts        lexicographic Dijkstra over (state, budget)
  generate.ts       seeded level sampler + rejection rules
  rng.ts            xorshift / splitmix, no Math.random
src/engine/*.test.ts
scripts/certify.ts  headless report for every level
```

Types, sketched:

```ts
type CartId = string
type ResourceId = string
type Op =
  | { kind: 'lock'; resource: ResourceId }
  | { kind: 'unlock'; resource: ResourceId }
  | { kind: 'travel'; ticks: number }
  | { kind: 'try'; resource: ResourceId; backoff: number }
  | { kind: 'done' }

interface Cart {
  id: CartId
  priority: number
  deadline: number
  tape: Op[]
}

interface GlobalState {
  tick: number
  mode: 'lockstep' | 'priority'
  pc: Record<CartId, number>
  held: Record<CartId, ResourceId[]>
  owner: Record<ResourceId, CartId | null>
  wait: Record<CartId, ResourceId | null>
  busyUntil: Record<CartId, number>
  holdUntil: Record<CartId, number>
  boostUntil: Record<CartId, number>
  done: Record<CartId, boolean>
  budget: { hold: number; loan: number }
  status: 'running' | 'won' | 'deadlock' | 'livelock' | 'missed'
}
```

Invariants checked in development builds:

- an owned resource appears in exactly one cart's `held`;
- a cart in `wait` owns no resource it is waiting for;
- `busyUntil`, `holdUntil` and `boostUntil` are monotone within a run;
- a done cart holds nothing;
- the lockstep effect is a pure function of the start-of-tick state.

### 1.6 Headless certifier

This is the **product-automata state-space deadlock finder**. It searches the product for
a winning intervention plan.

```
frontier = priority queue ordered by (interventionsUsed, ticks)
push (g0, [])
while frontier:
  (g, plan) = pop
  if g.status == 'won': return CERTIFIED(plan)
  if g.status in {'deadlock','livelock','missed'}: continue
  push (step(g), plan + [step])
  for each cart c with budget.hold > 0:
     push (hold(g, c), plan + [hold(c)])       // same tick, +1 intervention
  for each cart c with budget.loan > 0:
     push (loan(g, c), plan + [loan(c)])       // same tick, +1 intervention; no-op if c holds nothing
```

The cost is lexicographic: a plan with fewer interventions wins even if it takes more
ticks. This matches the game's promise that par is the number of things you had to do,
not the number of ticks you watched. The search is capped by `maxStates` and `horizon`;
on exhaustion it returns `UNKNOWN`, never `UNSOLVABLE`.

The prototype implements the frontier as a **0–1 BFS**: every transition costs either 0
(one scheduler step) or 1 (one hold or loan), so one FIFO bucket per intervention count
is exact and avoids re-sorting the whole frontier on every pop. Within a bucket the queue
is FIFO, which keeps ticks non-decreasing because a step appends `tick + 1` at the back.
The change is not cosmetic: the certified search for a generated four-cart yard now runs
in milliseconds instead of seconds, which is what makes the in-browser generator usable.

**Seeded yard generation.** `generateDeadlockLevel(seed)` rejection-samples instruction
tapes from a `mulberry32` stream keyed by `hashSeed(seed)`, builds a procedural schematic
(`generatedYardLayout`), and accepts a board only when the same certifier returns a plan
with `1 <= par <= budget`. It additionally replays the default schedule with no
interventions and rejects any board whose default run does not end in a deadlock or
livelock, or pass through a detected priority inversion. Two shapes are sampled:

- a 3- or 4-cart section ring with plain `lock` tapes, or a polite `try` ring that
  livelocks;
- a 4-cart priority board with one low-priority holder, one high-priority waiter, one
  medium hog, and a second low-priority cart that also starves.

The generated level carries `seed`, `defaultFailure`, and the certified `par`, so the
board label, the URL, and the certificate all name the same object.


**Certificates.** A successful search returns the plan, the full state trace, and the
number of states explored. A failed search over the full horizon and the full budget
returns a **rejection proof**: the set of terminal failure states reachable from every
intervention sequence, grouped by deadlock cycle / repeated signature / missed deadline.
For the app, the generator uses the rejection proof to avoid shipping unsolvable boards;
the UI uses it to explain *why* a board cannot be won after the window closes.

**Difficulty measures.**

- `par` = minimum interventions.
- `window` = the number of ticks in which the first winning intervention remains
  available.
- `trapCount` = interventions that look plausible (they change the wait-for graph) but
  have no winning continuation.
- `stateCount` = reachable product states within the budget.

A level is shipped only if `par <= budget`, `window >= 2`, and at least one advertised
failure is exercised by the optimal plan. A level whose only winning plan is "hold every
cart and serialize everything" is rejected as a degenerate solution.

**Headless playtest.** `scripts/certify.ts` prints, for each level: par, window, trap
count, state count, the certified plan, and a random-play survival rate over 500 seeded
runs. The survival rate is the number the design claims: a board that random play wins
90% of the time is not a puzzle, it is a slot machine.

### 1.7 Visual register

**Reference.** A 1960s Swiss railway interlocking board (Stellwerk), photographed under
working light: dark instrument panel, ivory schematic lines, brass lever tops, signal
red and muted green lamps, engraved labels in a Swiss grotesque, every line on a grid.
One reference, applied to this app only.

**Palette.** Slate `#171a16`, panel `#20241f`, ivory `#e7dfc9`, hairline `#4b5147`,
brass `#b08d57`, signal red `#d24a3a`, muted green `#7f9f72`, warning amber `#d6a84f`.

**Type.** Helvetica Neue / Arial for the plate and labels, uppercase with tight
tracking; SF Mono or Menlo for numbers, ticks and tape code. No rounded cards. The board
is one continuous instrument; the ledger is a ruled inset, not a floating card.

**What to avoid.** Dark SaaS panels, glowing purple, rounded stat cards, generic
"dashboard" chrome. The board must look like an object with screws, not a web page with a
theme. The wait-for arcs are drawn like red pencil on the schematic, not like a graph
library.

### 1.8 What the playtest must prove

- A player who has never heard of Coffman can point at the cycle before the overlay is
  on.
- The inversion board teaches "boost the holder" without a tooltip: the waiter click
  must visibly do nothing.
- The ring board's winning window is discovered by stepping, not by reading the answer.
- Random play loses more than it wins, and the failure is always nameable as one of the
  three states.

---

## 2. Byzantine Choir

### 2.1 The idea, tested

A Napoleonic optical semaphore network relays an order from a commander on a hill to
lieutenants in the field. The network is a graph of towers and line-of-sight links. One
or more towers are traitors and run a minimax lie generator; they may tell different
things to different neighbours. The player is the signals officer: they can **cut** a
link for a round, or **delay** a relay so it arrives late. The honest lieutenants decide
by majority over the messages that reach them. The goal is for every honest lieutenant to
end on the same order — and, if the commander is loyal, on the commander's order.

The mapping is good because a semaphore relay *is* an oral-message protocol: messages are
spoken, repeated, and can be misquoted; there is no signature on a flag. Cutting a cable
is a physical act with a real cost, and delay is a real timing fault, not a second kind of
delete.

### 2.2 Critique

**a. Cutting is too strong if it is just "delete the traitor".**
If the player can identify a traitor and cut all of its links, Byzantine agreement becomes
network administration. The cut must remove honest messages too, must be budgeted, and
must leave the honest subgraph connected enough to decide. The interesting decision is
not "cut the bad tower"; it is "which edge carries the contradiction, and can I remove it
without also removing the last honest witness?" The board should make the cost of a cut
visible on the honest side: a cut link is a hole in the choir, not a clean kill.

**b. The classic algorithm is trivial on a complete, synchronous graph.**
With `n >= 3f+1`, a complete graph, no message loss and no timing faults, the oral-message
protocol already tolerates `f` traitors; the player has nothing to do. The game must
degrade the assumptions in a way that is still formally honest: missing line-of-sight
links, a limited number of shutters per round, and a decision deadline that makes late
messages unusable for relay. The puzzle is then a network design problem inside a
byzantine round, not a reimplementation of the algorithm.

**c. "Delay" must have a precise semantics or it is a second cut.**
The rule used here: a delayed **round-1** message arrives at the end of round 2; the
lieutenant can count it in its own decision but cannot relay it (it arrived after the
relay window). A delayed **round-2** relay arrives after the decision and is dropped.
That makes delay a real trade: you can still inform the recipient, but you remove the
recipient's ability to inform others. It is an **interrogation** tool and a **quarantine**
tool at once. The UI must label `LATE` and `DROPPED` differently, and the certifier must
carry the arrival round in the message tree.

**d. The 3f+1 threshold is the lesson; do not hide it.**
The tribunal panel should show `n`, `f`, `3f+1`, and a live verdict: `slack 1`,
`exact`, or `impossible`. A board at `n = 4, f = 1` is exactly at the threshold; a board
at `n = 5, f = 1` has one unit of slack; a board at `n = 3, f = 1` cannot guarantee
agreement with oral messages. The prototype should include an **impossibility board** or
at least a live threshold calculator, because the theorem is more felt when the player
tries every cut and the certifier says "no strategy exists". The escape hatch — a
**sealed order** (a signature) that makes messages unforgeable — is a proposed second
resource for the full game; it turns the theorem into a physical choice rather than a
trivia answer.

**e. The adversary must be a real minimax, not a scripted liar.**
The traitor's messages should be chosen to maximise the honest disagreement under the
player's best response. If the traitor is a fixed script, the player can memorise the
level. The certifier enumerates traitor placements and message assignments (or uses
alpha-beta with memoisation for larger boards) and returns the worst witness. The UI can
show the witness only when the player asks for it, so the transcript remains evidence,
not an answer key.

**f. "Agree" and "obey" are different games.**
If the commander is loyal, the loyal lieutenants must not only agree, they must agree on
the commander's order (validity). If the commander is suspect, the requirement is
agreement on *some* order; obeying a traitor is not a virtue. The level must state which
game it is, and the certifier must use the right predicate. This distinction is the
heart of Lamport's problem and is usually flattened into "consensus".

**g. Hidden traitor identity changes the quantifier.**
If the player does not know who the traitors are, a safe network must be safe for every
placement of `f` traitors. That is much harder than being safe for one known suspect. The
prototype uses two modes: a **tribunal** board with a known suspect (the minimax is over
that suspect's messages) and a **blind** board where the player must be robust to all
placements. The UI must say which quantifier is in force. A game that silently switches
between them is lying about its theorem.

### 2.3 The sharpened game

**Role.** You are the signals officer at the central station. You cannot forge an order
and you cannot speak for a tower. You can open, cut or delay links between towers.

**Core verb.** *Listen to the choir, find the tower whose voice disagrees with itself,
and close the shutter on the link that carries the contradiction before the round
closes.*

**The board.** A night map with the commander on a hill and lieutenants on ridges and in
valleys. Each tower has a semaphore mast whose arms show the order it is sending:
both arms up = `ATTACK`, both down = `RETREAT`. Links are line-of-sight paths. A missing
link is a hill or a forest; a cut link is a severed cable with a red cross; a delayed link
is an amber dashed path with an hourglass. The map is the network; the dispatch table
below it is the message tree flattened into a matrix.

**The round.** Two rounds, both shown at once or stepped:

1. The commander sends its order to every lieutenant with an open, undelayed link.
2. Every lieutenant relays what it heard to every other lieutenant with an open,
   undelayed link. Honest lieutenants relay faithfully; traitors may equivocate.
3. Each honest lieutenant decides by majority over its direct order and the relays that
   arrived on time. A tie defaults to `RETREAT` (the safe order). A late round-1 direct
   order counts in the decision but cannot be relayed. A late round-2 relay is dropped.

**The interventions.**

- **Cut** (quarantine): remove a link for both directions. Cost: one cut token. It stops
  a lie, but it also stops an honest relay. The board shows the hole.
- **Delay** (interrogation): push a link's messages one round late. Cost: one delay
  token. It can preserve a direct order while removing the recipient's ability to relay
  it, and it can expose an equivocator by making the two versions of its story arrive at
  different times.

**The verdict.** The tribunal panel shows the worst-case witness: which tower is the
traitor, what it sent to whom, which honest lieutenants split. The player wins when the
worst case over all admissible traitor placements and message assignments is
`CONCORD`. The board is lost if any witness produces a split or a validity failure.

**The boards.**

1. **The Schism** (known suspect, `n = 5`, `f = 1`, missing `C–E` and `A–E`). The eastern
   tower has only two relay sources. The suspect can tie it by lying to one and telling
   the truth to the other. The player must cut the lie's link, not the honest witness's.
2. **The Empty Chair** (suspect commander, `n = 4`, `f = 1`, one missing link). The
   commander may be the traitor. The loyal lieutenants must agree even if the commander
   is not trustworthy. The optimal action is often to remove one of the commander's
   contradictory links, not to cut a lieutenant.
3. **The Threshold** (theorem board, optional). `n = 3`, `f = 1`, oral messages. The
   certifier reports that no cut/delay strategy can guarantee agreement; the player can
   inspect the counterexample. A sealed-order variant is the escape hatch.
4. **The Pyrenees Relay** (known suspect, `n = 6`, `f = 1`, `par = 1`). Six towers on a
   mountain chain. The eastern ridge has lost its direct order (`C–E`) and two relays
   (`A–E`, `F–E`), so it hears only the suspect and one honest witness. Cutting the
   suspect's link is the single winning move; cutting the honest witness is the tempting
   mistake. The board has one tower of slack over `3f + 1` and uses it.
5. **The Rhine Frontier** (known suspects, `n = 7`, `f = 2`, `par = 2`). Seven towers and
   two traitors, exactly at `3f + 1`. The river bend `G` has no direct order and two of
   its three relays are lies. The only safe action cuts both traitor links; cutting the
   honest witness leaves the split, and a delay can remove only one lie from the tally.
   The board makes the two-traitor quantifier physical: two holes in the choir, not one.

**The adversary's lie tree.** The witness is no longer only a sentence in the tribunal.
The **Adversary Lie Tree** panel flattens the minimax witness into one branch per
dispatch a traitor tailors for one honest neighbour: recipient, value, arrival state, and
a `CONTRADICTION` marker when the same tower tells two neighbours different things. It is
sealed until the player reveals the witness (the dispatch table remains the evidence),
and clicking a branch highlights the same link on the map. The tree is generated from the
same `lieTreeRows(level, state, witness)` data the certifier uses, so it cannot disagree
with the verdict.

**Seeded networks.** `generateByzantineLevel(seed)` samples a topology (`n = 4…6`,
`f = 1`, known suspect), starves one honest lieutenant by removing its direct order and
all but two relays, then runs the minimax witness solver over the default network and
`certifyBy` over the cut/delay budget. It rejects a network that is already safe, one
with no safe action, and the degenerate answer that cuts every commander link. The level
carries `seed`, `defaultWitness`, and the certified par.


**Feedback.** The dispatch matrix shows the value on every edge, with cut and late states
struck through. The decision chips show each honest lieutenant's tally and output. The
map shows the witness's traitor only behind a "reveal witness" control. The tribunal
panel shows the quantifier and the threshold.

### 2.4 Formal model

A level is

```
L = (Towers, Commander, Edges, Trusted, f, Goal, TrueOrder, Budget, Missing)
```

A **placement** is a set `T ⊆ Towers` of traitors with `|T| = f`. If `Trusted`, the
commander is not in `T`; otherwise it may be. The honest set is `H = Towers \ T`.

A **message assignment** `m` gives, for each traitor and each outgoing link, a value in
`{A, R}` (and for the commander, one value per round-1 link). Honest senders are
deterministic: the commander sends `TrueOrder`; a lieutenant relays the direct value it
received on time, or nothing.

A **network action** `a` assigns each edge a state in `{open, cut, delay}` subject to the
budget. The message tree is

```
Tr(a, T, m)
```

with root `Commander`, depth 2, and one branch per open edge. A branch is labelled with
its arrival round: `1` (on time), `2` (late). The decision of an honest lieutenant is

```
D(l) = majority( direct(l) ∪ { relay(s,l) : s ∈ H, arrival(s,l) = 1 } )
```

with ties and empty tallies resolving to `R`. A late **direct** order still counts in
`direct(l)`; a late **relay** does not count, because it arrived after the decision
window. The asymmetry is the whole reason delay is not a second kind of cut. The **agreement predicate** is

```
Φ(a, T, m) =
  all l ∈ H_output have D(l) = v, and
  (Commander ∉ T  ⇒  v = TrueOrder)
```

where `H_output` is the honest lieutenants (the commander is not a decider). The
certifier computes

```
V(a) = max_{T, m admissible} [ ¬Φ(a, T, m) ]
```

and the game is won when `V(a) = 0` (safe). The player's search is

```
∃a with cost(a) ≤ budget and V(a) = 0.
```

This is a finite two-player game: the player chooses the network, the adversary chooses
the placement and the messages. For known-suspect boards, `T` is fixed and only `m`
varies; for blind boards, both vary. The distinction is explicit in the UI.

**Theorem anchor.** With oral messages, `n >= 3f+1` is necessary and sufficient for
agreement in a complete synchronous graph (Lamport, Shostak, Pease, 1982). The game
does not change the theorem; it changes the network and the timing, and it makes the
threshold a budget line rather than a footnote.

### 2.5 Pure-TypeScript engine

```
src/engine/
  types.ts        Tower, Edge, Placement, Message, Decision, Level
  network.ts      edge state, cuts/delays, arrival rounds, connectivity
  protocol.ts     honest relay, majority, tie rule, validity/agreement
  adversary.ts    enumerate placements × message assignments, minimax witness
  certify.ts      AND-OR search over network actions with budget
  threshold.ts    n/f/3f+1 calculations, impossibility certificates
  generate.ts     seeded topology sampler + rejection rules
src/engine/*.test.ts
scripts/certify.ts
```

Types, sketched:

```ts
type Value = 'A' | 'R'
type EdgeState = 'open' | 'cut' | 'delay'

interface Edge { a: TowerId; b: TowerId; blocked?: boolean }

interface Placement { traitors: Set<TowerId> }

interface Message {
  from: TowerId
  to: TowerId
  round: 1 | 2
  arrival: 1 | 2
  value: Value
  kind: 'order' | 'relay'
}

interface Witness {
  placement: Placement
  messages: Message[]
  decisions: Record<TowerId, Value>
  split: boolean
  valid: boolean
}
```

The adversary enumerates placements and assignments; for `n <= 7` and `f <= 2` this is
small. For larger boards, memoise on `(round, received values per honest node, network
action)` and alpha-beta prune on the first split. Symmetry reduction: towers with the
same neighbourhood and role are interchangeable, so placements that differ only by a
symmetry are evaluated once.

### 2.6 Headless certifier

This is the **message-tree minimax solver**. For each candidate network action `a` within
budget:

1. Enumerate admissible placements `T`.
2. For each, enumerate traitor message assignments `m` (with honest relays computed, not
   enumerated).
3. Build `Tr(a, T, m)`, compute the honest decisions, evaluate `Φ`.
4. Keep the first failing witness, ranked by number of honest lieutenants in the
   minority; if no failure, the action is safe.

The certifier returns one of:

- `SAFE(action, certificate)` — a network action and the proof that every placement and
  assignment agrees;
- `UNSAFE(action, witness)` — the worst counterexample, with the traitor's messages and
  the split decision;
- `IMPOSSIBLE(proof)` — no action within budget is safe; for a theorem board, this is the
  intended result and the proof is the threshold calculation plus the exhaustive
  enumeration.

**Difficulty measures.** `par` = minimum cut+delay cost of a safe action; `margin` =
number of alternative safe actions; `witnessDepth` = number of honest lieutenants the
adversary can flip before the player acts; `blindCost` = minimum safe action when the
traitor placement is unknown (larger than the known-suspect cost, and often infinite).

**Level generation.** Sample a topology, a missing-link set, a suspect/placement mode,
and a budget; run the certifier. Reject if the default network is already safe (no
puzzle), if no action is safe (unless the level is a theorem board), or if the only safe
action is to cut every edge (degenerate). Prefer boards where the default witness flips
exactly one honest lieutenant and the winning action is a single edge.

The prototype's `certifyBy` uses the same enumeration, with two performance guards that
do not change the verdict. First, messages addressed to another traitor are removed from
the adversary's assignment space: no honest decision counts them, so they cannot change
`safe` or `unsafe`. Second, certification stops at the **first failing witness**; only a
safe action (which has no failing witness) is evaluated exhaustively, and the full minimax
is reserved for the tribunal and the lie tree. On the seven-tower, two-traitor board this
turns a 34-second exhaustive check into a sub-second one while preserving the certificate.

**Playtest.** The harness reports, for each board: default witness, par, number of safe
actions, and the fraction of random cut/delay sets that are safe. A board where random
interventions are safe 80% of the time is not teaching the threshold.


### 2.7 Visual register

**Reference.** A Napoleonic optical semaphore station at night: a sapper's map on a
planning table, lit by a lantern, with engraved hachures, a compass rose, wax seals, and
signal masts. One reference, applied to this app only.

**Palette.** Night `#07111c`, indigo `#10263a`, parchment `#ddceb0`, ink `#1d1a14`,
signal gold `#e8b85c`, vermilion `#b6402c`, verdigris `#5f8372`.

**Type.** Iowan Old Style / Palatino / Georgia for the map and titles, uppercase with wide
tracking; Courier / typewriter for dispatches and the matrix. Small caps for labels. The
map is a drawing, not a dashboard; the dispatch table is a ledger, not a data grid.

**What to avoid.** Blending with Bloomwright's sepia broadsheet. Bloomwright is a printed
newspaper: columns, stock tables, a nameplate. Byzantine Choir is a **night military map**:
a dark room, a lit parchment chart, luminous signal beams, hachures, wax. No newspaper
columns, no page-wide body text, no stock-table figures. The two can share a serif
heritage without sharing a layout.

**Motion.** Signal lamps breathe; beams sweep slowly; a wax seal stamps when the verdict
changes. Cut links snap with a short red flash; delayed links pulse amber. The map should
feel colder and larger than the railway board.

### 2.8 What the playtest must prove

- The player can point to the equivocating tower from the dispatch matrix before the
  witness is revealed.
- Cutting the honest witness is a legible, tempting mistake, not a random failure.
- The threshold panel changes the player's strategy: at `n = 4` they look for the exact
  edge; at `n = 5` they have slack.
- The theorem board produces the feeling of impossibility, not the feeling of a bug.

---

## 3. Garbage Collector

### 3.1 The idea, tested

A live program allocates blocks, stores pointers and drops roots. The player is the
collector: mark from the roots, sweep the unreachable, and slide live blocks together,
all inside a per-pause time budget. The heap is a linear address space on a CRT logic
analyzer; the mutator is a trace; the collector is a set of physical operations on the
heap map.

This is the most directly spatial of the three, and the most likely to become
bookkeeping. The mapping is strong because compaction is literally moving rectangles and
rewriting arrows; the formal content is reachability under mutation.

### 3.2 Critique

**a. Manual pointer rewriting is tedium, not formalism.**
A sliding compaction touches every pointer to every moved object. If the player has to
retype addresses, the game becomes a spreadsheet. The engine should rewrite pointers
automatically and show the **forwarding table** as the visible truth during the move.
The player's decision is *when* to pause, *which region* to compact, and *whether* to
spend the pause on marking or moving. The pointer fix-up is the engine's job; the
consequences are the player's.

**b. A pause budget without allocation pressure is a number.**
If the heap never fills, the player can pause forever and collect perfectly. The trace
must allocate at a rate that forces a decision, and fragmentation must make "enough total
free space" insufficient. Allocation needs a **contiguous** run. Sweeping creates holes;
only compaction merges them. The board shows the largest free run next to the next
allocation's size, so the player can see the difference between free bytes and usable
bytes.

**c. Incremental marking without a write barrier is a lie.**
If the mutator runs while the collector is marking and the engine ignores the writes, the
game is teaching a broken algorithm. The tri-colour invariant must be enforced: no black
object may point to a white object once the mark is in progress. A store that creates such
an edge is a **dirty edge**; the player must shade the source or the target before the
sweep, or enable the barrier and pay for it. The invariant is the mechanic.

**d. The tri-colour names are abstract; the states must be visible.**
White, grey and black are standard but not self-explanatory. The screen should use three
distinct fills, a legend, and an alarm that names the invariant in words: "black → white:
the sweep would lose this block." The player should be able to see a live object about to
be lost, not infer it from a colour.

**e. Full compaction is always correct, so it is not a choice.**
If compaction is cheap and complete, the optimal policy is "compact every pause". The
pause budget and the cost model must make full compaction occasionally impossible or
wasteful. Two levers: **partial compaction** (slide only a prefix up to a chosen seam, so
the pause cost is proportional to the moved region) and **timing** (compact before a
large allocation when the live set is small, or after a sweep when the garbage is gone).
The prototype exposes the seam as a click on the heap; the architecture specifies a
region-compaction API for the full app.

**f. The mutator must be visible ahead, or the puzzle is guessing.**
A logic analyzer shows the trace; the player should see the next few events. The
challenge is combinatorial planning, not memory. Hidden future events would make the
certifier's guarantee meaningless to the player. The trace window is part of the
instrument, not a cheat.

**g. The win condition is program completion under real-time constraints, not "collect
everything".**
A perfect collector that pauses too long has failed the program. The score is the
schedule: did the trace finish, did any pause exceed the budget, did any allocation fail,
did any live pointer dangle? The board should be able to win with garbage still on the
heap if the program has finished; the goal is liveness, not cleanliness.

### 3.3 The sharpened game

**Role.** You are the collector operator at the memory scope. The program is running; you
can stop it at a safepoint, spend a bounded pause, and let it run again.

**Core verb.** *Keep the mutator alive with the smallest pauses: shade the edge, sweep the
dead, slide the live.*

**The board.** A linear heap of cells, grouped into blocks with IDs and sizes. Roots are
arrows from a register panel. Pointers are arcs. Free cells are hatched. The tri-colour
state is visible on every block. The trace is a scrolling logic-analyzer strip with a
playhead, and the pause budget is a segmented LED bar.

**The operations.**

- **Mark roots** (shade every root grey). Cheap; starts or restarts a mark.
- **Scan** a grey block: turn it black and shade its white children grey. Cost is the
  block's size. This is the incremental unit.
- **Shade** a block: turn it grey so it will be re-scanned. This is the manual write
  barrier; used on a black source after a store, or on a target that must be kept alive.
- **Sweep**: remove every white block and coalesce the free runs. Cost is the number of
  swept blocks. Refused while a black → white edge exists.
- **Compact** (full or to a chosen seam): slide live blocks left, rewrite pointers through
  a forwarding table, and merge the free space. Cost is the number of live cells moved.
- **Barrier on/off**: auto-shade the target of a store into a black object. Each hit adds
  one cycle of debt to the next pause. The debt is the price of not thinking ahead.

**The trace.** A deterministic sequence of `alloc`, `store`, `rootAdd`, `rootDrop` and
`retire` events. The player can step one event, run to the next allocation, or pause at
any safepoint. The next four events are visible. An allocation that cannot fit stalls the
mutator and shows a red `ALLOC WAIT`; the player must free a contiguous run. If the pause
budget is exceeded, the program glitches; if a sweep removes a live target, the program
corrupts.

**The boards.**

1. **Three Colours** (mark-sweep-compact basics). A heap with two garbage holes and a
   large allocation that needs a contiguous run. Marking the live set costs more than one
   pause, so it must be split; sweeping alone does not merge the holes; a full slide
   costs the whole of a later pause. Teaches the sequence.
2. **The Write** (incremental marking). The player starts a mark, resumes, and the
   mutator stores a pointer from a black block to a white one. The dirty edge is flagged;
   the player must shade and re-scan before sweeping, or turn on the barrier and pay the
   debt. Teaches the invariant.
3. **The Seam** (partial compaction). The live set is too large for a full slide within
   the pause budget, but a partial slide to a chosen seam creates the run the next
   allocation needs. Teaches the spatial trade.
4. **Synthesized Workload** (seeded). `generateGcLevel(seed)` builds a mutator trace with
   two temporary holes and a large allocation whose size equals the total free space, so
   it only fits after a slide. Heap capacity, block sizes, and the pause budget are drawn
   from the seed. The workload is accepted only if the constructive planner returns a
   schedule that replays to `TRACE COMPLETE` with peak pause inside the budget and at
   least one compact. The generated level carries `seed` and the certified schedule, so
   Auto-collect replays the exact proof the certifier produced.

**Feedback.** The screen shows live / garbage / free cells, the largest free run, the next
allocation size, the current mark frontier, the pause cost of every operation before it is
committed, and the forwarding table during a slide. The status line names the failure:
`PAUSE OVERRUN`, `ALLOC FAIL`, `DANGLING POINTER`, `TRACE COMPLETE`.

**The fragmentation and locality readout.** A second live panel reads the heap two ways.
`pointerSpan` is the sum of the address distances every live pointer must cross; `maxSpan`
is the longest single arc; `largestRun` is the usable free run; `fragmentation` is
`1 − largestRun / freeCells`. The panel shows the current heap beside the *projected* heap
after a full slide: the live set packed at address zero, one free run, and the shortened
pointer spans. The difference between the two columns is the **pointer-span tension** the
slide removes. It is computed by `gcLocality(heap)` on every render, from the same value
heap the collector is operating on, so it is a readout of the current state rather than a
replay of a scripted example.


### 3.4 Formal model

A level is

```
L = (Capacity, PauseBudget, Trace, InitialHeap)
```

The mutator is a deterministic finite automaton

```
M = (S, s_0, E, τ, F)
```

where `S` is the trace position, `E` the event alphabet, `τ` the transition function and
`F` the terminal position. The heap is

```
H = (Blocks, owner, ptr, roots, colours, markStack, forwarding)
```

where `Blocks` is an ordered list of live and free runs, `owner` maps block IDs to
addresses, `ptr` is a set of directed edges, `roots ⊆ Blocks`, and `colours : Blocks →
{white, grey, black}`.

The traces in this batch are **rooted DAGs**: an allocation always precedes the stores
that point to it, so a child is discovered after its parent and no cycle is generated.
The engine's reachability is cycle-safe anyway, so a later trace may contain cycles
without changing the certifier or the invariant checks. That is why the heap is specified
as a DAG engine rather than a tree: sharing (two parents pointing at one child) is
normal, and the mark stack must not assume a unique path.

The collector state is

```
C = (phase, pauseUsed, barrierDebt, lastSweep)
```

where `phase ∈ {mutator, paused}`. The product is `M × H × C`.

**Transitions.**

- `mutator(event)`: applies `τ` to the heap if the phase is `mutator`.
- `pause`: phase := paused; `pauseUsed := barrierDebt`; `barrierDebt := 0`.
- `resume`: phase := mutator; `pauseUsed := 0`.
- `markRoots`: shade roots grey; cost 1.
- `scan(b)`: if `colour(b) = grey`, set black, shade white children grey; cost `size(b)`.
- `shade(b)`: if white or black, set grey; cost 1.
- `sweep`: remove white blocks; coalesce free; cost number of removed blocks; requires no
  black → white edge.
- `compact(seam)`: slide live blocks in the prefix to the left; update `owner` and `ptr`
  through `forwarding`; cost number of moved cells; requires no white blocks in the
  prefix (sweep first).

**Invariants.**

- `I1` (tri-colour): during a mark, no black block has a pointer to a white block, and no
  root is white.
- `I2` (ownership): every non-free block has exactly one address range; ranges partition
  the heap.
- `I3` (reachability): every block reachable from a root is not swept.
- `I4` (pause): `pauseUsed <= PauseBudget` at every pause; a violation is a terminal
  failure.
- `I5` (allocation): an allocation of size `s` succeeds only if some free run has length
  `>= s`; the chosen run is the first fit, deterministically.

**Acceptance.** The trace reaches `F`, no `I4` violation, no allocation failure, and no
`I3` violation. The score is lexicographic: `(peakPause, totalPause, compactionCells)`.

### 3.5 Pure-TypeScript engine

This is the **tricolor mark-and-compact DAG engine**: a value-level heap, a mark stack, a
forwarding table, and a schedule search. No DOM, no time, no RNG.

```
src/engine/
  types.ts        Block, Heap, Colour, Event, Trace, CollectorState
  heap.ts         allocate, store, rootAdd/drop, coalesce, first-fit
  tricolor.ts     markRoots, scan, shade, dirty edges, invariant checks
  sweep.ts        sweep, dangling-pointer detection
  compact.ts      full/region sliding, forwarding table, pointer rewrite
  trace.ts        parse/validate a trace, deterministic event automaton
  certify.ts      schedule search over pause points and actions
  generate.ts     seeded trace/heap sampler + rejection rules
src/engine/*.test.ts
scripts/certify.ts
```

Types, sketched:

```ts
type Colour = 'white' | 'grey' | 'black'

interface Block {
  id: string
  size: number
  colour: Colour
  free: boolean
  ptrs: string[]
}

interface Heap {
  capacity: number
  blocks: Block[]          // address order, partitions the heap
  roots: Set<string>
  markStack: string[]
  forwarding: Map<string, string>
}

interface Event {
  kind: 'alloc' | 'store' | 'rootAdd' | 'rootDrop' | 'retire'
  id?: string
  size?: number
  src?: string
  dst?: string
}

interface ScheduleStep {
  atTrace: number
  op: 'pause' | 'resume' | 'markRoots' | 'scan' | 'shade' | 'sweep' | 'compact'
  target?: string
  seam?: string
}
```

The engine is pure: no DOM, no time, no RNG. The trace is data. The heap is a value. Every
operation returns a new heap plus a cost, so the certifier can branch without cloning
side effects.

### 3.6 Headless certifier

The certifier searches the product `M × H × C` for a schedule that reaches the end of the
trace without violating `I3`–`I5`.

```
frontier = priority queue ordered by (peakPause, totalPause, tracePosition)
push (initial)
while frontier:
  s = pop
  if s.trace == F and s.valid: return CERTIFIED(schedule)
  if s.invalid: continue
  for each legal pause point and collector action:
     push (apply(s, action))
  push (stepMutator(s))          // if not paused
```

Because the mutator trace is fixed, the branching is only over **when to pause** and
**what to do in the pause**; the heap transition itself is deterministic. The search is
capped by `maxStates` and a per-pause action depth. Dominance pruning: if two states have
the same trace position, heap layout, colours, roots and mark stack, the one with lower
`(peakPause, totalPause, barrierDebt)` dominates.

The prototype replaces the full frontier search with a **constructive planner plus a
replay certificate**. `planGcSchedule(level)` is a deterministic policy: run the mutator
until the next allocation cannot fit (counting both free cells and reclaimable garbage),
pause, mark, scan the grey blocks that fit, resume when the pause is full, sweep when the
mark is complete, then slide — full if the live set fits the remaining pause, otherwise to
the cheapest seam whose post-slide largest run satisfies the allocation. The planner can
start a fresh pause when the slide does not fit, so a split mark is a normal outcome, not
a failure. `certifyGc` then replays the schedule from a fresh heap and accepts only if the
replay reaches `TRACE COMPLETE` and its actual peak pause is inside the budget. The
certificate is therefore a concrete run, not a policy promise. This is exact for the
shipped traces (the planner is deterministic and the replay is the proof); the production
app keeps the frontier search for boards that need optimality, not just feasibility.

**Certificates.** A winning schedule is a list of `(traceIndex, op, target, seam)` steps,
with the pause cost of each. The certifier also produces:

- `minPeakPause` — the smallest peak pause over all winning schedules;
- `minTotalPause` — the smallest total pause;
- `mustMove` — a lower bound on compaction cells for the board (the sum of live cells
  that must cross a hole to create the next contiguous run);
- `rejection` — for an unsolvable board, the set of trace positions at which every
  schedule runs out of budget or heap.

**Level generation.** Sample a heap capacity, pause budget, and a trace with a mix of
allocations, stores and root changes. Run the certifier. Reject if the board is solvable
without compaction (no spatial decision), if it is solvable with zero pauses (trivial), if
it is unsolvable, or if the only winning schedule uses the maximum pause at every
safepoint (no timing choice). Prefer boards where the optimal schedule splits a mark
across two pauses and uses a partial compaction.

**Headless playtest.** Report the certified schedule, the peak pause, the number of
compaction cells, and the survival rate of three policies: never collect, greedy
collect-every-pause, and the certified schedule. The gap between greedy and certified is
the puzzle's difficulty.

### 3.7 Visual register

**Reference.** A 1980s CRT logic analyzer on a service bench: beige instrument case, dark
green phosphor screen, cyan and amber traces, a graticule, chunky keys, a rotary knob,
and a printed service-manual card taped to the side. One reference, applied to this app
only.

**Palette.** Screen `#04120a`, phosphor `#8dffb4`, dim phosphor `#3f7a55`, amber
`#ffb35c`, cyan `#6fe0ff`, magenta cursor `#ff6fae`, fault `#ff5a4e`, bezel `#c9c2b1`,
key `#2a2b27`.

**Type.** IBM Plex Mono / SF Mono / Menlo on the screen; a condensed grotesque for the
bezel labels; a typewriter face for the service notes. The screen is a screen: scanlines,
a slight vignette, a phosphor afterglow, a blinking cursor. The bezel is a physical
object: screws, seams, a power LED, a key legend.

**What to avoid.** Cyberpunk neon, purple gradients, a generic terminal window, modern
flat buttons. The instrument must look like it was built in 1984 and still works. The
service notes are paper, not a tooltip.

**Motion.** The trace playhead advances; blocks slide with a short ease when compacted;
pointer arcs redraw; the pause meter fills segment by segment; a fault flashes the screen
and stamps the status line. No particle effects.

### 3.8 What the playtest must prove

- The player can predict whether the next allocation fits from the largest-run readout.
- The dirty-edge alarm is understood before the first sweep; the player can say why the
  target would be lost.
- The pause budget forces a split mark, not just a slower mark.
- A partial compaction is chosen for a reason (the seam), not by trial and error.
- The program can finish with garbage still on the heap, and that feels like a win rather
  than a failure.

---

## 4. Shared architecture

### 4.1 Engine-first, again

Each app follows the repository's order: rules, generator, solver and tests land as plain
TypeScript; a headless playtest runs before a pixel is drawn. The engines must not import
React, the DOM, `Date`, `Math.random`, or any browser API. Time is a tick; randomness is a
seed; rendering is a pure function of state. The prototype in `index.html` is a compact
inlined mirror of these engines, not a separate implementation with different rules.

### 4.2 Determinism and the browser-only constraint

Every board is a seed. The generator samples a level, certifies it, and either ships it or
rejects it. The certificate travels with the level (in the URL hash or in the bundled level
data), so a shared link is a shared puzzle and a shared proof. There is no server to ask
whether a board is solvable; the browser already knows. The certifiers are bounded by
state caps and run in a Web Worker in the full app; the prototype runs the small boards on
the main thread and caps the search.

**The hash grammar.** The prototype now implements the shared-link promise rather than
deferring it. The fragment names the specimen and, optionally, the active board or the
seed that generated it:

```
#deadlock                      the Deadlock specimen, default board
#deadlock/ring                 a curated board by id
#deadlock/gen:RAIL-101         a generated yard, regenerated from the seed
#byzantine/pyrenees            a curated network
#byzantine/gen:RELAY-201       a generated network
#gc/colours                    a curated trace
#gc/gen:HEAP-301               a generated workload
```

The grammar is deliberately shallow: `specimen[/board|gen:seed]`. A seed is the whole
level, so a link carries no mutable board data and cannot drift from the certifier. On
load `applyHash()` selects the specimen and board (or regenerates the seed); every board
selection, generation, and tab change rewrites the hash with `history.replaceState`, so
the address bar is always a valid share link without polluting history. `hashchange` is
handled for back/forward navigation, and a `Copy link` control on each specimen writes the
normalised URL to the clipboard. Generated levels are deterministic functions of the
seed, so the same link opens the same tapes, topology, or trace in every browser.


### 4.3 The three registers, never blended

| App | Reference | Surface | Type | Motion |
| --- | --- | --- | --- | --- |
| Deadlock | Swiss railway interlocking board | dark slate instrument, ivory schematic, brass levers | grotesque + mono | signal lamps, red pencil arcs |
| Byzantine Choir | Napoleonic optical semaphore at night | indigo night, parchment map, gold beams, wax | serif + typewriter | breathing lamps, sweeping beams |
| Garbage Collector | 1980s CRT logic analyzer | beige case, green phosphor, graticule, keys | mono + condensed grotesque | scanlines, sliding blocks, playhead |

The shared shell is a thin archive label, not a design system. It switches the specimen;
it does not tint the games into a family. The games are allowed to disagree about
everything except the standard of evidence.

### 4.4 What the prototype is and is not

`prototypes/cs-formalisms/index.html` is a self-contained interactive specimen:

- six Deadlock boards, four Byzantine networks, and two GC traces, one set per game,
  with a three-way switcher;
- real deterministic engines for the small boards, not animations of a script;
- intervention controls that change the state and can win or lose;
- a certifier readout on each board, computed from the same rules;
- seeded generators behind **Generate seeded yard**, **New seeded network**, and
  **Synthesize workload**, each accepting only a certified board;
- shareable hash links (`#deadlock/ring`, `#byzantine/gen:RELAY-201`,
  `#gc/gen:HEAP-301`) and a **Copy link** control per specimen;
- the Adversary Lie Tree and the Fragmentation & Locality readout, both live from state;
- architectural annotations in each game's own register.

It is **not** the production app: no Web Worker, no full level campaign, no audio, no
persistence, and no optimality proof for GC boards beyond the replayed certificate. The
architecture above is the production target. The prototype's job is to make the verbs
felt and to expose the places where the formal model needs a better interface before the
app build starts.


---

### 4.5 Control-to-formalism map

The prototype's controls are not UI affordances bolted onto a proof; each one is a named
transition. This is the map a reviewer should use when checking the mock against the
architecture.

| Specimen | Control | Formal transition |
| --- | --- | --- |
| Deadlock | **Step tick** | one transition of the product `P` under the level's scheduling discipline |
| Deadlock | **Hold** | set `hold_i = tick + H`; cost one hold token |
| Deadlock | **Loan** | set `lease_c = tick + L`; cost one loan token; a no-op if `c` holds nothing |
| Deadlock | **Certify** | lexicographic Dijkstra over `(P, budget)`; returns a plan and par |
| Deadlock | **Generate seeded yard** | seeded rejection sampling of 3–4 tapes, filtered by the same Dijkstra: default failure and `1 ≤ par ≤ budget` |
| Deadlock | **Copy link** | serialise the active board or seed into the hash; the seed regenerates the same product |
| Deadlock | board arcs / lamps | the wait-for graph, occupancy map, and Coffman anatomy read off the state |
| Byzantine Choir | click a link | cycle that edge through `open → cut → delay`; a network action |
| Byzantine Choir | **Transmit relays** | switch the dispatch view between round I and round II |
| Byzantine Choir | **Certify** | enumerate placements × assignments; report a safe action or a witness |
| Byzantine Choir | **Reveal witness** | expose the minimax counterexample; hidden by default so the transcript is evidence |
| Byzantine Choir | **Adversary Lie Tree** | one branch per traitor→honest-neighbour dispatch in the worst witness; marks equivocation |
| Byzantine Choir | **New seeded network** | seeded topology + starvation, certified by the minimax witness solver |
| Garbage Collector | **Step event** | one mutator transition in `M` |
| Garbage Collector | **Pause / Resume** | enter/leave a safepoint; charge `barrierDebt` at the pause |
| Garbage Collector | **Mark roots / Scan / Shade** | tri-colour `markRoots`, `scan`, `shade`; each has a cell cost |
| Garbage Collector | **Sweep / Compact** | sweep white blocks and coalesce; slide a prefix through the forwarding table |
| Garbage Collector | **Barrier** | choose automatic target shading and pay debt, or shade manually |
| Garbage Collector | **Auto-collect** | replay one certified schedule from the planner + replay certifier |
| Garbage Collector | **Synthesize workload** | seeded trace whose plan/replay certificate reaches `TRACE COMPLETE` inside the pause budget |
| Garbage Collector | **Fragmentation & Locality** | `gcLocality`: current vs projected post-slide free runs, largest run, pointer spans, tension |

The point of the table is falsifiability: if a control cannot be written as a transition
above, it is decoration and should be removed.

---

## 5. Open questions

1. **Deadlock: should holds be stackable?** The ring level currently needs one hold long
   enough to cover the critical window. Stacking makes the budget more granular but can
   turn the interface into a timer. The alternative is a single hold whose duration is a
   level constant; the player chooses *when*, not *how long*. The prototype uses the
   constant for legibility.
2. **Byzantine: how much should the tribunal reveal?** A known suspect makes a clean
   network puzzle; a blind placement makes a harder theorem game. The full app should
   ship both, clearly labelled, and never let the UI imply one quantifier while the
   certifier uses the other.
3. **Garbage Collector: is partial compaction worth the interface cost?** The seam is the
   most interesting spatial decision, but it adds a mode and a forwarding table to read.
   The prototype should test whether players can predict the cost of a seam before the
   full app commits to it.
4. **All three: how much of the certificate should be visible during play?** A live
   minimax witness can become an answer key. The design instinct is to show the *shape* of
   the guarantee (safe/unsafe, par, threshold) and hide the witness behind a deliberate
   "show me the counterexample" action.

---

## 6. The certificate contract and the headless report

### 6.1 What "certified" means in this build

| Game | Generator | Certifier | Rejection rules |
| --- | --- | --- | --- |
| Deadlock | seeded tapes + procedural yard | 0–1 BFS over the product of carts and monitor | no plan, `par = 0`, `par > budget`, default run does not deadlock/livelock/invert |
| Byzantine Choir | seeded topology + starved tower | minimax witness over placements × assignments, early exit on failure | default already safe, no safe action, degenerate commander cut |
| Garbage Collector | seeded mutator trace + fragmentation | constructive planner, then replay of the returned schedule | no replay to `TRACE COMPLETE`, peak over budget, no slide, fewer than two pauses |

The important invariant is that **the same engine functions run in the browser and in the
report**. The HTML is still self-contained; the verification script does not re-implement
the rules. It reads `index.html`, lifts the block between `/* ===== engine:start ===== */`
and `/* ===== engine:end ===== */` into a Node `vm` context, and calls the exported
functions. If a rule changes in the page, the report changes with it, or fails.

### 6.2 The report

`prototypes/cs-formalisms/scripts/certify.mjs` takes an optional seeds-per-game argument
(default 20) and prints one line per board:

```
node prototypes/cs-formalisms/scripts/certify.mjs 20
```

For each board it reports the game-specific measure (Deadlock par and explored states,
Byzantine default witness and par, GC peak pause and slides) and then checks the contract:
the certificate exists, its cost is inside the budget, and the certificate replays to a
win. For Deadlock it also verifies the default run fails and that the generated boards
have 3–4 carts. For Byzantine it verifies the default network is unsafe and that the
chosen cuts/delays make the minimax witness concordant. For GC it verifies the replay
reaches `TRACE COMPLETE`, the peak pause is inside the budget, the schedule contains a
slide, the mark is split across at least two pauses, and the projected slide never
lengthens a pointer span.

The current run passes **490 checks**: 6 curated Deadlock boards, 4 curated Byzantine
boards, 2 curated GC traces, and 20 generated seeds per game (60 generated boards). The
script exits non-zero on the first failed contract, so it can run in CI as-is.

### 6.3 What the report deliberately does not claim

- **No optimality for GC.** The planner returns a feasible schedule, not the minimum peak
  pause. The production app's frontier search (described in §3.6) is the optimality path.
- **No universal Byzantine safety.** The generator samples known-suspect boards with
  `n ≤ 6`; it does not claim the blind-placement quantifier or the `n = 7, f = 2` search
  for every topology. The two curated boards carry those cases.
- **No certificate in the URL.** The link carries the seed, not the proof. The proof is
  recomputed locally by the same deterministic certifier, which is the point of the
  browser-only constraint: a link cannot carry a stale or forged certificate.
