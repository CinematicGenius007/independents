# Scribble Club

Scribble Club is a browser-based, multiplayer drawing-and-guessing game with a hand-drawn paper-and-ink interface. It is built with React 19, TypeScript, Vite, Tailwind CSS, Trystero, and `sql.js`.

The app is frontend-only: there is no Scribble Club account service, game server, or hosted database. Multiplayer peers discover each other through public signaling relays and exchange game traffic over WebRTC data channels. Profiles, preferences, custom words, game history, and stats stay in the current browser.

## Run locally

Use a current Node.js LTS release and pnpm 11. From this directory:

```bash
pnpm install
pnpm dev
```

Vite prints the local URL, usually `http://localhost:5173`. To test multiplayer, open that URL in two or more tabs or supported browsers and join the same room.

Other useful commands:

```bash
pnpm test          # run the Vitest suite once
pnpm test:watch    # run Vitest in watch mode
pnpm type-check    # check TypeScript without emitting files
pnpm build         # type-check and create a production build in dist/
pnpm preview       # serve the production build locally
```

The development component showcase is available at `#kit`.

## Rooms and multiplayer

A room uses a six-character, ambiguity-free code such as `ABCD23`. Its shareable URL is the current origin and path followed by a hash fragment:

```text
https://example.test/path/#room=ABCD23
```

Opening the link is equivalent to entering the room code. Codes are normalized to uppercase. Because routing is in the URL fragment, a static host does not need a server-side route rewrite for room links.

Trystero uses public Nostr relays for signaling first and falls back to public MQTT relays if it cannot establish a relay connection within five seconds. Once peers find each other, control messages and compact binary drawing messages travel through WebRTC data channels in a peer mesh. The signaling relay is not an application backend and does not persist game state.

This has a few practical consequences:

- Multiplayer requires network access to a usable signaling relay and permission to establish WebRTC connections.
- Corporate firewalls, privacy extensions, restrictive networks, or a relay outage can prevent a room from connecting.
- A room code is a locator, not a password. Share it only with people you want in the room.
- Closing the last connected tab ends the live room. Local profile and statistics data remain in each browser, but the room itself is not stored on a server.
- The transport reports connecting, connected, and failed states. It tries Nostr and MQTT, but it does not currently provide a manually configured relay or manual WebRTC fallback.

The game model keeps deterministic choices, such as turn order and word selection, consistent across peers. The elected host sequences time-sensitive transitions and scoring. The initial peer pair establishes authority deterministically from peer IDs; that host then stamps join order so the longest-connected established player remains preferred. Secret words are sent only to the drawer rather than broadcast to every peer. Late join and recovery use an atomic revisioned state-and-canvas snapshot on the ordered binary channel.

## Local data and backup

Scribble Club runs SQLite in the browser through `sql.js`. The WebAssembly binary is loaded lazily, and the in-memory database is exported to one IndexedDB record after changes. Pending writes are also flushed when the page is hidden or unloaded.

Stored data includes:

- the local player profile and last-used preferences;
- the bundled word library and locally created word packs;
- aggregate statistics and game history.

No application database is uploaded or synchronized between devices. Browser storage is scoped to the site origin, so `localhost`, a deployed hostname, another browser profile, and private browsing are separate stores. Clearing site data removes the saved database.

The database layer supports exporting the complete SQLite database as bytes and importing a previously exported database after schema validation. Where the data controls are exposed in the UI, use Export before clearing browser data or changing origin, and select that exported file with Import to replace the currently open local database. Keep backups private: they can contain the nickname, preferences, custom word lists, game history, and statistics stored by that browser.

## Architecture

The code is split into layers with narrow, typed boundaries:

- `src/design/` contains the reusable sketchbook-style React components and theme primitives.
- `src/screens/` contains page-level onboarding, lobby, game, results, practice, and stats views as they are integrated.
- `src/engine/` is the pure game reducer, deterministic randomization, guessing, hints, scoring, and selectors.
- `src/canvas/` owns the 1600×1000 logical drawing surface, operation model, binary codec, deterministic replay, flood fill, history folding, and snapshots.
- `src/net/` isolates room URLs, Trystero, presence, host election, protocol messages, and state synchronization behind transport and mesh interfaces.
- `src/game/` connects network messages and local intents to engine state and React.
- `src/practice/` contains the offline practice session model and stats projection.
- `src/db/` lazily boots `sql.js`, runs schema migrations, seeds the word library, exposes repositories, and persists snapshots to IndexedDB.

The engine does not import React or Trystero. The networking layer does not interpret drawing frames, and Trystero-specific imports are contained in its adapter. Tests use an in-memory transport so protocol and host-migration behavior can be exercised without public relays.

## Browser expectations

The intended targets are current desktop and mobile releases of Chrome, Edge, Firefox, and Safari with JavaScript, WebAssembly, IndexedDB, WebSocket, Pointer Events, and WebRTC data channels enabled. A normal `localhost` development URL is suitable; deployed builds should use HTTPS so browser networking and storage features operate in a secure context.

Older browsers and embedded webviews are not supported. Private browsing or storage policies may make IndexedDB temporary or unavailable. Stylus pressure depends on the device and browser; mouse and touch input remain usable without it. Multiple tabs on one device are useful for development, but they do not reproduce every real-network or mobile-browser condition.

Automated unit, type, and production-build checks cover the core layers. Unless a release note says otherwise, do not treat those checks as proof that a full multiplayer game has been manually verified across all supported browsers, relay conditions, screen sizes, or three independent devices.

## Verification snapshot

On 25 July 2026, the project passed 261 tests across 27 files, TypeScript checking, and a production build. The complete production output is about 1.45 MB before compression and 564 KB gzip-compressed, including the single 660 KB `sql-wasm.wasm` asset (323 KB gzip), below the 2 MB compressed budget. The database and networking code are split into separate lazy/runtime chunks; SQLite is not part of the first application chunk.

Onboarding, profile restoration, room creation, solo drawing, practice timeout and advancement, stats routing, the 375 px practice layout, and production-preview boot were exercised in a real browser. A 5,000-point canvas replay is covered by the test suite and completed within the 26 ms canvas-history test file on the checkpoint machine; this is a development measurement, not a cross-device latency guarantee.

The attempted multi-tab relay check could not discover peers from the test environment through either public relay route. The lobby now reports relay connection failure explicitly, but the plan's complete two- and three-tab game acceptance remains a release-verification item for a network where WebRTC and the public relays are reachable.

## Current status

The planned application is implemented through P9, with the relay-dependent and cross-browser release checks above still open. See [TODO.md](./TODO.md) for those checks and stretch work; [CHECKPOINT.md](./CHECKPOINT.md) records the exact handoff state.
