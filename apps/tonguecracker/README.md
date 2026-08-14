# Tonguecracker

Tonguecracker invents a language, uses it in front of you, and then asks you to speak it.

You are shown pictures with captions. Nothing is glossed, nothing is explained, and no
word means what it means in any language you know. From those examples alone you have
to work out where the verb sits, which side adjectives take, how "more than one" is
marked, which participant wears a marker, and what copies it — then prove it by
building a sentence for a picture you have not been shown.

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
pnpm tsx scripts/playtest.ts # simulate three kinds of reader against every tier
```

## The four tiers

| Tier             | What the language can do                                             |
| ---------------- | -------------------------------------------------------------------- |
| **Word order**   | Subject, object, verb in one of three orders. Nothing else.           |
| **Describing**   | Colour and size words, placed before or after the noun.               |
| **One and many** | Plural marked as a prefix or a suffix; the verb may echo it.          |
| **Marked**       | One participant carries a case marker, and adjectives may copy it.    |

A round is two questions. First a reading question: here is a sentence, which of these
three pictures is it about? Then a writing question: here is a picture, build its
sentence out of word chips. The chips include the same roots wearing the wrong markers,
so a wrong answer is always a real misreading rather than a typo.

## The guarantee

The interesting engineering problem here is fairness. It is easy to generate a language
and a test; it is not easy to guarantee the examples *determine* the answer. Two things
are certified before a puzzle is allowed to exist:

**The grammar is forced.** Every possible grammar in the tier's feature space is
enumerated, and only those consistent with all the shown examples survive. A puzzle
ships only if every survivor produces the same sentence for both test scenes. If two
different grammars fit the examples and disagree about the answer, the puzzle is
discarded rather than shown.

**The words are findable.** A grammar you have inferred is useless if you cannot tell
which chunk of sound means "star". Each meaning is matched against every substring that
recurs in the same examples, and the puzzle is rejected unless there is a one-to-one
assignment of distinct spellings to meanings. A meaning that appears in only one
example, or two meanings that always appear together, are both rejected outright.

The consequence is a promise the game can actually keep: if you are wrong, the evidence
was there.

## What the playtests changed

`scripts/playtest.ts` plays the game from the *player's* side rather than the
generator's, with three readers: a word finder that only knows meanings recur, a perfect
reader that keeps every grammar consistent with the examples, and a skimmer that reads
only the first three examples.

The first run exposed a real unfairness. In the word-order tier, colour and size are
never spoken, yet the generator was demanding that every colour and size in a scene be
learnable — a requirement the examples could not possibly satisfy. Only 8% of puzzles
gave the word finder enough to identify the vocabulary it needed. Restricting the
requirement to the meanings a language actually pronounces brought that to 100%.

The second run exposed a subtler one. Word recovery was being judged by taking the
longest matching chunk for each meaning, which occasionally handed two meanings the same
spelling — 3–4% of puzzles were unanswerable for a reason no player could have guessed.
The check became an assignment problem (every meaning needs *its own* spelling), and
that check moved out of the harness and into the generator, where it now rejects
puzzles rather than merely reporting them.

Current report, 20 seeds per tier:

| Tier         | Examples | Grammars left | Words findable | Answer forced |
| ------------ | -------- | ------------- | -------------- | ------------- |
| Word order   | 4.5      | 1.0           | 100%           | 100%          |
| Describing   | 5.7      | 1.0           | 100%           | 100%          |
| One and many | 6.6      | 1.0           | 100%           | 100%          |
| Marked       | 6.8      | 1.0           | 100%           | 100%          |

Playing it by hand changed one more thing. The first languages drew from a small sound
inventory, and words like `momou`, `mouvo`, `mouso`, and `semou` were nearly impossible
to scan side by side — which punishes the wrong skill, since spotting recurrence *is*
the game. Words now avoid sharing an opening syllable where the inventory allows it.

## Layout

```text
src/engine/scene.ts     the picturable world: shapes, colours, sizes, counts, relations
src/engine/language.ts  features, generated lexicons, and rendering a scene as a sentence
src/engine/puzzle.ts    tiers, example selection, and the two certifications
src/ui/SceneView.tsx    the pictures, drawn so every marked distinction is visible
scripts/playtest.ts     three simulated readers
```
