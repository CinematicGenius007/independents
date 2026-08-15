# independents

Small, self-contained browser applications. Each one lives in its own directory under
`apps/`, installs its own dependencies, and runs on its own. There is no shared
framework, no monorepo tooling, and no build orchestration — the only thing these
projects have in common is a constraint: **everything runs in the browser**. No account
service, no game server, no hosted database.

| App | What it is |
| --- | --- |
| [Scribble Club](apps/pictionary) | Multiplayer drawing and guessing over WebRTC, with a hand-drawn paper interface |
| [Fogwalk](apps/fogwalk) | A maze where you do not know where you are: every possible you moves at once |
| [Bloomwright](apps/bloomwright) | A puzzle where you never draw — you write the rules a plant grows by |
| [Tonguecracker](apps/tonguecracker) | A language invented fresh each round, inferred from examples and then spoken |
| [Sealed Orders](apps/sealed-orders) | A two-player duel with no server, made fair by a commit-reveal seal in the link |
| [Azulejo](apps/azul) | The tile-laying game *Azul* for two to four, played peer to peer over WebRTC |
| [Sudoku Solver](apps/sudoku-solver) | A solver and playable grid |
| [Ultimate Tic-Tac-Toe](apps/ultimate-ttt) | Tic-tac-toe nested inside tic-tac-toe |

Design notes for the newer batch are in [docs/CONCEPTS.md](docs/CONCEPTS.md), including
why each concept was chosen and what its playtests changed.

## Working on one

Use a current Node.js LTS release and pnpm 11. Everything happens inside the app's own
directory:

```bash
cd apps/fogwalk
pnpm install
pnpm dev
```

Most apps also carry `pnpm test`, `pnpm type-check`, `pnpm build`, and a headless
playtest harness under `scripts/`.
