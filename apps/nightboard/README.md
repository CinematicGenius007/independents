# Nightboard

Twelve hours. Twenty-one beds. You decide who gets one.

You are the charge nurse of an emergency department from 19:00 to 07:00. You never treat
anyone. You decide who gets which bed, who goes first, what is held back and who is called
in from home. The whole night runs in the browser: no account, no server.

Two rules drive the simulation, and they are why real hospitals jam:

1. A care step starts only when everything it needs is free at the same moment.
2. A patient keeps the place they are in until the next place is theirs.

How the game works and why is in [DESIGN.md](DESIGN.md). The player's manual is
[docs/HANDBOOK.md](docs/HANDBOOK.md), which the build also turns into the in-game handbook.

## Developing

```bash
pnpm install
pnpm dev           # http://localhost:5173 (landing page); the game is /play.html
pnpm test          # engine rules, handbook compiler, site metadata and a full production build
pnpm playtest      # one headless night with a naive player: pnpm playtest [seed] [--smart] [--log]
pnpm build         # dist/
pnpm preview
```

In the game, `?seed=ANYTHING` plays a different night and `?start=shift` skips the start
screen. In `pnpm dev` only, `window.App` lets you drive a shift from the browser console.

## Layout

| Path | What it is |
| --- | --- |
| `src/engine/` | The simulation: hospital, case book, patients, NEWS2, scenario and the minute tick. Plain ES modules with no DOM. |
| `src/ui/` | The PULSE ED screen and the desk, the backdrop, Guide Mode, Orientation and the in-game handbook. `main.js` is the entry. |
| `src/site/` | Build time only: the handbook compiler, the page metadata and the Vite plugin that joins them. |
| `index.html`, `play.html`, `handbook.html`, `404.html` | The four pages. |
| `docs/HANDBOOK.md`, `diagrams/` | The manual and its diagrams. |
| `public/` | Icons and the social card, copied as they are. |
| `test/` | Vitest suites. |
| `scripts/playtest.mjs` | Headless night for balancing. |

## Deploying

`vercel.json` builds with `pnpm build` and serves `dist/` with clean URLs (`/play`,
`/handbook`), security headers and a year-long cache on hashed assets. Set the project's
root directory to `apps/nightboard`.

Set `SITE_URL` to the public origin (for example `https://nightboard.example`) in the
build environment. Canonical links, `og:image` and `sitemap.xml` need absolute URLs, so
without it the build leaves them out and says so.

Every page gets a description, Open Graph and Twitter tags, the icons and the web manifest.
The landing page carries structured data (`WebSite` and `VideoGame`). `llms.txt` and
`llms-full.txt` give AI search a plain summary and the whole manual as text.

## Content

Nightboard is fiction. Harbourside General, its staff and its patients are made up. The
clinical content is written to be plausible and consistent, from general emergency
medicine knowledge, and has not been reviewed by a clinician. It is not medical advice.
