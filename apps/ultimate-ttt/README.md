# Ultimate Tic-Tac-Toe

An advanced nested tic-tac-toe game with excellent UX, built with React and Vite.

## Setup & Run

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## Game Rules

1. Win small 3x3 boards to claim them
2. Your move determines which board your opponent must play in next
3. Win 3 small boards in a row (horizontally, vertically, or diagonally) to win the game
4. If sent to an already-won board, you can play in any available board

---

## Making It Multiplayer - Implementation Strategies

### Option 1: **Peer-to-Peer with WebRTC (NO SERVER)** ⭐ RECOMMENDED

**Pros:** Zero server costs, instant moves, private by default
**Cons:** Requires both players online simultaneously

**Implementation:**
```javascript
// Use PeerJS library (wraps WebRTC)
import Peer from 'peerjs';

// Player 1 creates a room
const peer = new Peer();
peer.on('open', (id) => {
  console.log('Share this room code:', id);
});

// Player 2 joins with room code
const conn = peer.connect(roomCode);

// Send moves
conn.send({ boardIdx, cellIdx, player });

// Receive moves
conn.on('data', (move) => {
  handleOpponentMove(move);
});
```

**Steps:**
1. Add `peerjs` to package.json
2. Generate room code (peer ID) when "Create Game" clicked
3. Allow second player to join via room code
4. Sync game state via data channel
5. Use PeerJS cloud server (free) for initial connection

---

### Option 2: **Serverless with WebSockets (AWS Lambda/Vercel)**

**Pros:** Scalable, no dedicated server, async play possible
**Cons:** Small cost at scale (~$0.20 per million messages)

**Implementation with Ably (Serverless WebSocket):**
```javascript
import { Realtime } from 'ably';

const ably = new Realtime('YOUR_API_KEY');
const channel = ably.channels.get(`game-${roomId}`);

// Publish move
channel.publish('move', { boardIdx, cellIdx, player });

// Subscribe to moves
channel.subscribe('move', (message) => {
  handleOpponentMove(message.data);
});
```

**Services to consider:**
- **Ably** - 6M messages/month free
- **Pusher** - 200k messages/day free
- **Supabase Realtime** - Free tier available

---

### Option 3: **Firebase Realtime Database** 💡 EASIEST

**Pros:** Easy setup, real-time sync, free tier generous
**Cons:** Google dependency, overkill for simple game

**Implementation:**
```javascript
import { ref, set, onValue } from 'firebase/database';

// Create game room
const gameRef = ref(db, `games/${roomId}`);

// Update game state
set(gameRef, gameState);

// Listen to changes
onValue(gameRef, (snapshot) => {
  const data = snapshot.val();
  updateGameState(data);
});
```

**Free tier:** 10GB/month, 100 simultaneous connections

---

### Option 4: **Simple REST API + Polling**

**Pros:** Super simple, works everywhere, no WebSocket complexity
**Cons:** Slight delay (1-2 sec), more server requests

**Implementation:**
```javascript
// Poll for game state every second
setInterval(async () => {
  const response = await fetch(`/api/game/${roomId}`);
  const gameState = await response.json();
  if (gameState.lastMove !== lastSeenMove) {
    updateGame(gameState);
  }
}, 1000);

// Post move
await fetch(`/api/game/${roomId}/move`, {
  method: 'POST',
  body: JSON.stringify({ boardIdx, cellIdx, player })
});
```

**Backend options:**
- Vercel Serverless Functions + Upstash Redis
- Cloudflare Workers + Workers KV
- Supabase PostgreSQL

---

## Recommended Stack for Minimal Server Requirements

**Best Choice: PeerJS (WebRTC) + Firebase (fallback)**

```
1. Primary: PeerJS for real-time P2P
   - Zero server costs
   - Instant gameplay
   - Works 95% of the time

2. Fallback: Firebase for state sync
   - When WebRTC fails (corporate firewalls)
   - Async play capability
   - Free tier is generous
```

**Cost Estimate:**
- **0-1000 games/day**: FREE
- **10,000 games/day**: ~$0-5/month
- **100,000 games/day**: ~$10-20/month

---

## Quick Start for Multiplayer

### 1. Add PeerJS
```bash
npm install peerjs
```

### 2. Add multiplayer component
Create `src/Multiplayer.jsx` with:
- Room creation/joining UI
- PeerJS connection logic
- Game state synchronization
- Player turn management

### 3. Modify App.jsx
- Add multiplayer mode toggle
- Pass connection object to game logic
- Disable opponent moves (receive-only)
- Add "waiting for opponent" states

### 4. Deploy
```bash
npm run build
# Upload dist/ to Vercel/Netlify
```

That's it! You now have multiplayer with zero server costs.

---

## Architecture Comparison

| Solution | Setup Time | Server Cost | Latency | Reliability |
|----------|-----------|-------------|---------|-------------|
| WebRTC (PeerJS) | 2 hours | $0 | <50ms | 95% |
| Firebase | 3 hours | $0-5/mo | 100-200ms | 99.9% |
| Ably/Pusher | 2 hours | $0-20/mo | 50-100ms | 99.9% |
| REST + Polling | 4 hours | $5-10/mo | 1-2s | 99% |

**Winner**: WebRTC for real-time games with tight budgets!