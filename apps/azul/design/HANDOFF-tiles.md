# Handoff: make the Azul tiles match the real set

You are taking over the tile artwork for the Azul clone in `apps/azul` (React 19 + Vite + TypeScript, pnpm). The goal is to make the five tiles, and the faded spaces printed on the board's wall, look as close as possible to the physical Azul set. The person you are working for wants it about 99.99% similar.

## Reference material (read these first)

All of it is in `apps/azul/design/reference/`:

- `table-angle.webp`: the table at an angle, with every tile visible up close (1200×1200). This is the clearest source for the black and yellow tiles.
- `wall-closeup.webp`: a low-angle close-up of a wall.
- `board-wall.webp`: a player board seen from above, showing pattern lines, the wall prints and the floor line.
- `crops/`: enlarged crops of single tiles: `black-photo1.png`, `black-board.png`, `yellow-photo1.png`, `yellow-closeup.png`, `turquoise-board.png`.
- `exported-svg/`: the current tiles as standalone SVGs, exported from the code: glazed versions, `*-print` versions, and `first.svg` for the starting-player marker.

The user also shared a higher-resolution photo of the board from above that was never saved to disk. If you need it, ask them to drop it into `design/reference/`.

## Where the code lives

- `src/ui/Tile.tsx`: the `Tile` component (glazed tile, or `pounce` for the faded wall print), `FirstMarker`, colours (`GLAZES`, `EDGES`, `GLAZE_TEXT`, `DAMASK`, `LATTICE`, `STAR`) and `TileDefs`. `TileDefs` holds the shared gradients and clip path, and is mounted once in `src/main.tsx`.
- `src/ui/tileGeometry.ts`: the patterns, built from geometry rather than traced:
  - `lemoyneStar` and `chamferedSquare`: the turquoise tile.
  - `damask`: the yellow tile. It uses the eight symmetries of a square (`dihedral`), log-spiral `volute`s, sawtooth `acanthus` leaves and `petal`s.
  - `lattice`: the black tile.
  - The helpers `rotations`, `kite`, `cross`, `rect` and `circlePath`.
- `src/styles.css`: `.tile--ink` / `.tile--first` (drop shadow) and `.tile--pounce .tile__print` (print opacity and saturation).

The user asked for this mathematical approach, so keep it: describe a motif once, then reflect and rotate it.

Constraints:
- Every coordinate is in a 24×24 viewBox centred on (12, 12).
- A glazed tile is: the side (`EDGES`) → the face, inset by `FACE_TRANSFORM` → the pattern → sheen and specular gradients clipped to the face → a lit rim.
- Gradients must keep living in the global `TileDefs`. Flying tiles are `cloneNode` copies, so per-tile ids would break once the original unmounts.
- The wall-colour order is fixed by the engine and matches the real board: row 0 is blue, yellow, red, black, turquoise, and each row below shifts one step right. Do not change `COLORS`.

## Where each tile stands, and what the user has said

- **Blue (`cobalt`) and red (`crimson`):** plain glossy tiles, no motif. The colours could be tuned against the photos.
- **Yellow (`saffron`):** warm orange-gold with red ink.
  - Current structure: a fleur-de-lis on each axis, a facing pair of C-scrolls on each diagonal, serrated leaves into the corners, and a four-point star in the centre.
  - User feedback: it "doesn't actually match yet". The likely gaps are the density and lacy look of the real damask and the exact shape of the scrolls and lilies. Compare against `crops/yellow-photo1.png` and `crops/yellow-closeup.png`.
- **Black (`basalt`):** near-black with a teal pattern.
  - Current structure: dotted rosettes, a plus-shaped cross of bars with knobbed ends, arrow-tipped fleurs and a small centre star. All of it is rotated 45° in the `Lattice` component, at the user's request, so rosettes sit at the middle of each side and fleurs at the corners and centre.
  - The user said it was "a small issue" before that rotation. Check whether it now matches, especially the rosette shape and bar/fleur weight. Compare against `crops/black-board.png` and `crops/black-photo1.png`.
- **Turquoise (`verdigris`):** a white field with cut corners inside a thin turquoise border, carrying a turquoise eight-pointed star made of 8 separate diamonds. On the board print the whole square is white. The user has not complained about this one.
- **Starting-player marker (`FirstMarker`):** a cream tile with a blue "1". It has not been checked against reference.
- **Wall prints (`pounce`):** the face drawn flat, plus a 22% white wash, at opacity 0.52 with saturate 0.75, on the app's dark board. The real board prints are vivid and matte. Readability against the glazed tiles matters, because a printed space must never be mistaken for a placed tile.

## Paper design file

The tiles are also in the user's Paper file "Azul", on the artboard **"Tiles — from code"**: https://app.paper.design/file/01M17G3VERXG6W92DBZG0SAG3G/1-0

They are editable vectors. If the user edits them there, read the changed shapes back (with the Paper MCP tools: `get_jsx` or `get_computed_styles`) and port the numbers into `tileGeometry.ts` / `Tile.tsx`. If you change the code, refresh the artboard.

One known issue on that artboard: the yellow and black prints are drawn slightly smaller than the other three, because they are copies of the glazed tiles with the edge and gloss removed, so the face is still inset.

## How to check your work

1. Run `pnpm --dir apps/azul dev --port 5185`, or use the `azul` entry in `.claude/launch.json` with the browser preview.
2. Start a solo game. The wall, pattern lines, displays and "Remaining tiles" panel all show tiles.
3. For close inspection, temporarily mount a gallery: render `<Tile color=… style={{width:300,height:300}} />` behind a `?gallery` check in `src/main.tsx`. Remove it before finishing.
4. Look at each tile next to its reference crop at both large and small (≈56px) sizes.
5. Run `pnpm --dir apps/azul type-check` and `pnpm --dir apps/azul test`. All 60 tests should still pass.

Do not commit unless the user asks. A separate agent may be committing the rest of the uncommitted work, so check `git status` and coordinate before touching files outside `Tile.tsx`, `tileGeometry.ts` and the tile rules in `styles.css`.
