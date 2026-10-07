# Ultimate Tic-Tac-Toe

Tic-tac-toe nested inside tic-tac-toe, for two players on one screen or online.

## Rules

1. The board is nine small boards in a three-by-three grid.
2. The cell you play in sends your opponent to the matching small board.
3. Three in a row on a small board wins that board.
4. Three won boards in a row on the big grid wins the game.
5. Sent to a board that is already decided? Play anywhere.
6. If every small board is decided and nobody has three in a row, it is a draw.

## Playing online

Online play goes through the repository's rooms service
([`services/rooms`](../../services/rooms)) and appears only when `VITE_ROOMS_URL` is set at
build time.

There is no host. Every message goes through the service, which puts it in order and keeps the
room's log; every browser — the sender included — folds the log through one reducer
(`src/net/table.ts`). Same messages, same order, same board. That settles the awkward cases
without anyone in charge: two people claiming a side at once are seated in the order the room
received them, a move from anyone not seated on the side to play is ignored identically
everywhere, and a reload simply reads the log again and arrives back in the same seat.

The first two people in a room play; anyone after them watches. A rematch swaps sides.

## Developing

```bash
pnpm install
pnpm dev           # http://localhost:5173
pnpm test          # rules and the online table reducer
pnpm type-check
pnpm build
```

For online play locally, run the rooms service (`pnpm dev` in `services/rooms`) and put this in
`.env.local`:

```
VITE_ROOMS_URL=http://127.0.0.1:8787
```
