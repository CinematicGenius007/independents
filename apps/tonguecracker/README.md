# Tonguecracker

Tonguecracker invents a language, uses it in front of you, and then asks you to speak it.

You are shown pictures with captions. Nothing is glossed, nothing is explained, and no
word means what it means in any language you know. From that evidence you have to work
out where the verb sits, which side adjectives take, how "more than one" is marked,
which participant wears a marker, and what copies it — then prove it by writing a
sentence for a picture nobody has translated.

Most of the evidence is not given to you. You choose it: any scene on the rack can be
translated, and every translation costs a question. Asking well is the game.

Every language is generated fresh, so the deduction is real every time rather than a
campaign you can only play once.

Built with React 19, TypeScript, and Vite. Nothing leaves the browser.

## Run locally

```bash
pnpm install
pnpm dev
```

Other commands:

```bash
pnpm test                    # Vitest suite (grammar, certification, generation)
pnpm type-check              # TypeScript with no emit
pnpm build                   # production build in dist/
pnpm tsx scripts/playtest.ts # greedy questioner against a random one, per tier
```

## How a round goes

You are given two translations free. Everything after that you have to ask for: a rack
of scenes sits in front of you and any one of them can be translated, for the price of a
question. Then you type the sentence for a scene nobody has translated.

While you work, the interface shows two numbers and a verdict:

- **Grammars left** — how many of the tier's possible grammars still fit everything you
  have been told. It falls when you ask something that could have come back two ways,
  and it does not move at all when you ask something you could have predicted.
- **Questions**, against a par: the number a greedy questioner needs.
- **You can answer** / **Still guessing** — whether every surviving grammar agrees about
  the sentence you are about to write, and whether it contains a word you have never
  heard. A guess is always visibly a guess.

| Tier             | What the language can do                                            |
| ---------------- | ------------------------------------------------------------------- |
| **Word order**   | Subject, object, verb in one of three orders. Nothing else.          |
| **Describing**   | Colour and size words, placed before or after the noun.              |
| **One and many** | Plural marked as a prefix or a suffix; the verb may echo it.         |
| **Marked**       | A case marker on one participant, at either end of the word, which adjectives may copy — and verb agreement that may follow the doer, the thing acted on, both, or neither. |

The last tier allows 384 grammars. Two of them differ only in whether the verb agrees
with the doer or with the thing acted on, and those two are *indistinguishable* unless
you ask about a scene where exactly one of the participants is plural. Finding that
question is the game.

## What the playtests changed

`scripts/playtest.ts` plays the game from the *player's* side rather than the
generator's. Two questioners are simulated: a greedy one that always asks whatever cuts
the hypothesis space most, and a random one. If they need the same number of questions,
choosing is not a decision and the game has no spine.

**Two random captions used to settle almost the whole grammar** before the player asked
anything, because a full sentence exposes word order, adjective placement, number and
case at once. After the two free gifts, only one or two grammars survived — so the
questions were decoration. The gifts are now always singular, which leaves everything
about plurality and agreement open: eight grammars survive them in the hardest tier, and
the best available first question is worth about 2.4 bits.

**Verb agreement became a four-way choice.** Agreeing with the doer and agreeing with
the thing acted on produce identical sentences unless exactly one participant is plural,
so the rack is now stocked with every shape of plurality — a minimal pair is always
available to whoever thinks to look for one.

Current report, 20 seeds per tier:

| Tier         | Grammars in tier | Survive the gifts | Par | Random questioner | Best first question |
| ------------ | ---------------- | ----------------- | --- | ----------------- | ------------------- |
| Word order   | 3                | 1.0               | 1.1 | 2.5               | —                   |
| Describing   | 6                | 1.0               | 1.1 | 2.8               | —                   |
| One and many | 36               | 6.0               | 1.4 | 3.1               | 2.58 bits           |
| Marked       | 384              | 8.0               | 1.5 | 2.8               | 2.40 bits           |

A greedy questioner needs about half as many questions as a random one, which is the
number that says choosing is a decision rather than a formality.

An earlier fairness fix survives from the fixed-example version: in the word-order tier
colour and size are never spoken, so requiring the player to learn those words was asking
for something the evidence could not teach. Only meanings a language actually pronounces
are ever required.

Playing it by hand changed one more thing. The first languages drew from a small sound
inventory, and words like `momou`, `mouvo`, `mouso`, and `semou` were nearly impossible
to scan side by side — which punishes the wrong skill, since spotting recurrence *is*
the game. Words now avoid sharing an opening syllable where the inventory allows it.

## Layout

```text
src/engine/scene.ts     the picturable world: shapes, colours, sizes, counts, relations
src/engine/language.ts  features, generated lexicons, and rendering a scene as a sentence
src/engine/tiers.ts     what each tier's grammars may do, and how many there are
src/engine/study.ts     the rack, the surviving hypotheses, readiness, and par
src/ui/SceneView.tsx    the pictures, drawn so every marked distinction is visible
scripts/playtest.ts     greedy and random questioners
```
