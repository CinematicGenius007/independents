# independents-rooms

Multiplayer rooms for every app in this repository, on Cloudflare Workers and Durable
Objects. One Worker, one Durable Object per room, and no game logic anywhere in it.

The apps used to signal peer to peer over public Nostr and MQTT relays. That needed no
infrastructure, and it was the problem: strangers' relays that came and went, browsers
that could not reach each other through their NATs, and a dropped connection that turned
a seated player into a stranger. This service replaces all of that with one always-on
place every client can reach.

## What a room does

The service knows nothing about any game. A room does four things:

1. **Presence.** Who is here, announced as they arrive and leave.
2. **Sequencing.** Every relayed message gets a room-wide `seq`. A Durable Object is
   single-threaded, so that number is a total order every client agrees on — enough to
   run a deterministic game in lockstep with nobody in charge.
3. **Relay.** To the room, to one peer, or echoed back to the sender too.
4. **Memory, for games that ask.** Registered games can keep a log that is replayed on
   join, so a late arrival or a reload rebuilds the board from history.

Two choices shape everything else:

- **Identity outlives the socket.** Each browser tab has a client id and a secret. A
  reload or a network blip reconnects as the same member, so seats survive.
- **Leaving is not instant.** A dropped socket gets an 8-second grace period. Reconnect
  inside it and no one is ever told you left. Without this, a host blinking off for two
  seconds would trigger a host election in every game built on top.

State lives in SQLite inside each room, so a room that hibernates between messages — and
it does, keepalive pings are answered by the runtime without waking it — wakes up exactly
as it was. Empty rooms are wiped six hours after the last person leaves.

## Games

| game | how it uses rooms | `maxPeers` | log |
| --- | --- | --- | --- |
| `azul` | host-authoritative: one peer holds the bag and replicates its own sequenced events | 12 | no — the bag is hidden |
| `ultimate-ttt` | lockstep: every client folds the log in sequence; no host | 10 | yes, 2,000 entries (~20 games) |

Adding a game is one entry in [`src/games.ts`](src/games.ts), plus a copy of the client in
the app (see below).

## API

```
GET /health                                   liveness
GET /v1/games                                 hosted games and their limits
GET /v1/rooms/:game/:code                     room status: { game, peers, seq }
GET /v1/rooms/:game/:code   (Upgrade: websocket)
    ?client=<8-64 url-safe chars>&secret=<16-128>&name=<display name>
```

On the socket, JSON text frames. Client to server:

```ts
{ t: 'send', data: any, to?: string, echo?: boolean, rebase?: boolean }
```

Server to client:

```ts
{ t: 'welcome', self, peers: [{id, name}], seq, log?: Envelope[], resumed }
{ t: 'join',  peer: {id, name} }
{ t: 'leave', peer: {id, name} }          // only after the grace period
{ t: 'msg', seq, from, data, direct? }    // an Envelope
{ t: 'error', code, message }
```

The bare text `ping` is answered with `pong`. Limits: 64 KB per message, a burst of 40
messages then 8 a second per client. Close codes 4000 (replaced by a newer connection),
4400, 4403 (wrong secret for that client id) and 4409 (room full) are final; anything else
should be retried, and the client does.

The full contract, with comments, is [`src/protocol.ts`](src/protocol.ts).

## The browser client

[`client/rooms-client.ts`](client/rooms-client.ts) is the one client every app uses:
stable identity per tab, reconnect with jittered backoff, a keepalive that notices a
silently dead socket, an outbox that delivers sends made while reconnecting, and presence
that stays correct across a reconnect.

The apps are deliberately standalone — no shared packages — so each carries a copy:

```bash
pnpm sync-client           # copy the canonical client into every app
pnpm sync-client --check   # fail if any copy has drifted
```

An app opts in at build time with `VITE_ROOMS_URL`. Without it, Azul falls back to
peer-to-peer and Ultimate TTT hides online play, so nothing breaks before this is
deployed.

## Developing

```bash
pnpm install
pnpm dev          # wrangler dev on http://localhost:8787
pnpm test         # Worker tests in the real runtime, then the client tests
pnpm type-check
```

The Worker tests run inside `workerd` through `@cloudflare/vitest-plugin`: real Durable
Objects, real WebSockets, hibernation forced with `evictDurableObject`, and alarms fired
on demand. They cover ordering under concurrent senders, reconnection inside the grace
period, wrong secrets, replacement, capacity, the log and rebasing, hibernation, and
cleanup.

To point an app at a local service, put this in its `.env.local`:

```
VITE_ROOMS_URL=http://127.0.0.1:8787
```

## Deploying

What is left to do on the server side, once:

1. **Pick the account.** `wrangler whoami` lists every account the login can reach. Add
   the right one to `wrangler.jsonc`:

   ```jsonc
   "account_id": "<the account id>",
   ```

2. **Deploy.**

   ```bash
   pnpm deploy
   ```

   The first deploy creates the Durable Object class from the `v1` migration. Note the
   `https://independents-rooms.<subdomain>.workers.dev` URL it prints.

3. **Optional: your own domain.** If the zone is on that Cloudflare account, uncomment the
   `routes` block in `wrangler.jsonc` (for example `rooms.cinematicgenius007.com`) and
   deploy again. Cloudflare creates the DNS record and certificate.

4. **Point the apps at it.** In each app's Vercel project, add an environment variable
   and redeploy:

   | project | variable | value |
   | --- | --- | --- |
   | Azulejo | `VITE_ROOMS_URL` | the Worker URL from step 2 or 3 |
   | Ultimate TTT | `VITE_ROOMS_URL` | the same URL |

   It is read at build time, so it takes effect on the next deployment.

5. **Optional: lock it to your apps.** The API is public for now. To restrict which sites
   may open rooms, set `ALLOWED_ORIGINS` in `wrangler.jsonc` to a comma-separated list of
   origins and deploy.

Logs: `pnpm tail`, or the Workers dashboard (observability is on).
