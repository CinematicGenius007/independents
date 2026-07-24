# INIT_PLAN.md

## Comprehensive Prompt: Frontend-Only Multiplayer Pictionary Game

### Overview
Build a fully client-side, multiplayer Pictionary web application. Friends join a shared room, take randomized turns drawing a secret word, and race to guess it from the live canvas. There is **zero backend infrastructure**—no servers, no APIs, no deployed databases. All application logic, state synchronization, and data persistence run in the browser.

**Functional Reference:** [skribbl.io](https://skribbl.io) (for game mechanics and flow, **not** for visual design).

---

### Core Architecture Constraints

| Layer | Technology / Approach |
|-------|----------------------|
| **Connectivity** | Peer-to-Peer via WebRTC data channels (mesh or star topology). Use a lightweight, free public STUN server (e.g., Google or Cloudflare) for NAT traversal. No TURN server required (degrade gracefully if direct connection fails). **No backend signaling server.** Room creation/joining must work via a shareable URL containing a room ID and an optional pre-shared signaling payload, or use a transient, throw-away public signaling relay (e.g., a free WebSocket echo service or QR-code handoff) solely to bootstrap the WebRTC handshake. If absolutely necessary for UX, the signaling step may use an external clipboard/QR/URL hash mechanism, but **no persistent backend code is authored or maintained by this project.** |
| **State Management** | Vanilla JS / React / Vue / Svelte—agent's choice, but all shared game state (canvas strokes, chat, scores, turns, timers) is synchronized across the WebRTC mesh. Authoritative state is deterministically derived (e.g., turn order seeded by room creation timestamp + player join order). |
| **Local Data Storage** | SQLite running in the browser via `sql.js` (or `absurd-sql` with Origin Private File System for persistence). All user preferences, statistics, saved drawings, custom word packs, and offline player profiles are stored here. |
| **Build / Deploy** | Static site (Vite, vanilla bundler, etc.). Deployable to any static host (GitHub Pages, Netlify, Cloudflare Pages) with zero serverless functions. |

---

### Functional Requirements

#### 1. Room Lifecycle
- **Create Room:** Host generates a room. A unique room ID and a WebRTC offer/answer payload are encoded into a shareable link (`https://<game-url>/#roomId=<id>&signal=<encoded-payload>`).
- **Join Room:** Guests open the link. The application parses the URL fragment to extract signaling data and establishes a WebRTC data channel directly to the host (and subsequently to all other peers).
- **Player Limit:** Support 2–8 players per room.
- **Player Identity:** No accounts. On first visit, the player chooses a nickname and selects a color/avatar. This profile is saved in local SQLite. Returning players auto-load their last-used nickname and preferences.

#### 2. Game Loop
- **Lobby:** All players see a list of joined participants. The host can adjust:
  - Drawing time per turn (30–180 seconds).
  - Number of rounds.
  - Word genre / difficulty (see §4).
  - "Custom Words" toggle (allow players to submit words).
- **Turn Order:** Randomized at game start using a deterministic seed (e.g., hash of room ID + timestamp). All clients independently compute the same order; no central arbiter.
- **Turn Flow:**
  1. Drawer gets a secret word (privately via DM over the data channel, or revealed only to their client).
  2. A countdown timer begins (visible to all).
  3. Drawer draws on a shared canvas. Stroke data (coordinates, color, brush size, tool type) is broadcast in real-time as compressed binary or minimal JSON over WebRTC.
  4. Guessers type guesses into a chat box.
  5. Correct guesses award points:
     - Guesser: points based on speed (inverse of time elapsed).
     - Drawer: points based on how many players guessed correctly.
     - Once a player guesses correctly, their chat messages in that turn are hidden from others to avoid spoiling.
  6. At timeout or after all guess correctly, the word is revealed. A scoreboard updates.
  7. Next drawer's turn begins automatically after a short intermission.
- **End Game:** After the set number of rounds, final scores are displayed. Option to "Play Again" (reshuffle order, reset scores, keep room).

#### 3. Drawing Canvas
- Responsive HTML5 Canvas or SVG.
- **Tools:** Pencil, eraser, fill bucket, undo (with history limit), clear canvas.
- **Properties:** Color picker (palette + hex input), brush size slider (1px–50px).
- **Stroke Synchronization:** Efficient delta encoding. Do not broadcast full canvas bitmaps on every stroke; stream stroke path data. On peer join mid-game, host sends a snapshot of the current canvas state as a one-time compressed image/JSON so the new player catches up.

#### 4. Word / Catchphrase System
- **Built-in Library:** A robust, categorized JSON dictionary stored in SQLite or bundled as a static asset:
  - Categories: General, Animals, Food, Places, Objects, Idioms, Pop Culture, Hard Mode.
  - Minimum 500 words across all categories at launch.
- **Word Selection:** Per turn, randomly select from the chosen category(ies) with a client-side PRNG seeded deterministically so all clients validate the word post-turn if needed.
- **Custom Words:** Host can enable a "Custom Words Only" mode where the game pulls from a user-supplied list (stored in SQLite). Host can also add words mid-lobby.
- **Hint System:** After 50% of the turn time elapses, reveal one letter of the word every 10 seconds (e.g., `_ _ _ _ _` -> `C _ _ _ _` -> `C A _ _ _`).

#### 5. Chat & Guessing UX
- Dedicated chat panel per room.
- **System Messages:** "X is drawing," "Y guessed the word!," "Time's up! The word was Zebra."
- **Proximity Hints:** If a guess is "close" (Levenshtein distance <= 2 from target), whisper to that guesser only: "You're very close!"
- **Anti-spam:** Rate limit guesses (e.g., 1 guess per 3 seconds) enforced client-side.

#### 6. Scoring & Statistics
- **In-Game Scoring:**
  - Guesser: `max(10, 100 - (seconds_elapsed * 2))`
  - Drawer: `10 * (number_of_correct_guessers)`
- **Persistent Stats (SQLite):**
  - Total games played, total words guessed, total words drawn, best streak, average guess time, favorite category, Elo-like rating (local only, just for personal tracking).
  - Export/import SQLite DB as a file so users can back up or transfer their profile.

#### 7. Offline / Solo Mode (Stretch)
- If a player is alone in a room (or chooses solo), enter a "Practice Mode" where the app randomly selects a word, the user draws it, and an optional AI (client-side tiny heuristic or pre-baked logic) guesses after a timer purely for entertainment. This ensures the app is playable even without peers.

---

### Data Schema (SQLite - Suggested)
Stored in-browser via `sql.js` or OPFS-backed SQLite:

```sql
-- players
player_id TEXT PRIMARY KEY,
nickname TEXT,
avatar_color TEXT,
created_at INTEGER

-- preferences
key TEXT PRIMARY KEY,
value TEXT

-- word_packs
pack_id INTEGER PRIMARY KEY,
name TEXT,
is_builtin BOOLEAN

-- words
word_id INTEGER PRIMARY KEY,
pack_id INTEGER,
word TEXT,
difficulty INTEGER,
category TEXT

-- stats
stat_name TEXT PRIMARY KEY,
stat_value INTEGER

-- game_history (optional)
game_id TEXT,
player_name TEXT,
score INTEGER,
role TEXT, -- 'drawer' or 'guesser'
word TEXT,
timestamp INTEGER
```

---

### Non-Functional Requirements
1. **Latency:** Drawing should feel <100ms between peers on reasonable networks. Use binary data channels and batch stroke packets.
2. **Reconnection:** If a peer drops, flag them as "disconnected." If the host drops, either:
   - Promote the longest-joined peer to host and migrate the canvas state, OR
   - Gracefully pause and allow rejoin via the same room link.
3. **No Backend Auth:** Zero cookies, zero JWT, zero OAuth. All trust is local.
4. **Security:** Since there is no server, anti-cheat is explicitly out of scope. A dishonest client can inspect the word early—this is acceptable for a friendly game among known peers.
5. **Bundle Size:** Keep the total compressed app + SQLite WASM under ~2 MB if possible.

---

### Design Direction (Placeholder)
The reference for mechanics is **skribbl.io**.  
**However, visual design, UI layout, color palette, typography, and component styling will be provided separately by the user via a design inspiration/reference.** The agent implementing this should architect the component structure to accept a design system easily (e.g., via CSS variables, a theme config, or a component library), but should **not** clone skribbl.io's aesthetic.

---

### Deliverables for the Next Agent
1. A working static-site game matching the above.
2. A `README.md` with:
   - How to run locally (`npm install && npm run dev`).
   - How the WebRTC signaling flow works (so users know how to share links).
   - How SQLite persistence functions.
3. (Optional but appreciated) A `TODO.md` noting stretch features: AI solo guesser, animated canvas replay, user-uploaded avatars.

---

**Tone of Implementation:** Keep it pragmatic. Prioritize a functional WebRTC mesh, a smooth drawing canvas, and reliable turn management over polish. Design is intentionally separated and will be layered on top.
