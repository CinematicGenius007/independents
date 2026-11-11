# Launching Night Shift

A plan, not a record. Decisions still open are marked **Decide**.

## What we are launching

A free-to-try browser game: a landing page (`/`), the game (`/play`) and the handbook (`/handbook`). No accounts, no server, nothing to install. One sentence for every channel:

> Twelve hours. Twenty-one beds. You are the charge nurse, and you decide who gets one.

**Decide:** free forever, free with a paid version later, or pay what you want on itch.io. The landing page does not promise "free" yet, on purpose.

## Who it is for

| Audience | Why they care | Where they are |
|---|---|---|
| Management and simulation players | A hard, honest system to master | r/WebGames, r/incremental_games, itch.io, Steam later |
| Medical drama viewers | It feels like the inside of the show | TikTok, YouTube Shorts, Instagram Reels |
| Nursing and medical students | It teaches triage, flow and why departments jam | r/nursing, r/medicalschool, educators (ask moderators first) |
| Engineers | Hospital gridlock is deadlock; the Engineer Lens shows it | Hacker News (Show HN), Lobsters |

## Before launch

1. **Name.** "Night Shift" is a crowded name. Search app stores, Steam, itch.io and the trademark registers before buying a domain. A clear fallback is "Night Shift: ER" or "Charge".
2. **Domain.** Buy it, add it to Cloudflare, build with `SITE_URL` set (see Hosting).
3. **A clinician read.** One emergency nurse or doctor reading the case book (`docs/CASEBOOK.md`) for anything wrong. Credit them on the landing page if they agree. This is the strongest trust signal the game can have.
4. **Playtest.** Five people who are not engineers or nurses play Orientation and one shift without help. Watch, do not explain. Fix what confuses two or more of them.
5. **Analytics.** Cloudflare Web Analytics: free, cookieless, so no cookie banner. Track page views only at first.
6. **Feedback.** A link in the end-of-shift review to a short form (three questions: what confused you, what was the best moment, would you play another night).
7. **Social card check.** Paste the URL into the LinkedIn post inspector and the Facebook sharing debugger to confirm the card.

## Launch week

| Day | Channel | What |
|---|---|---|
| 1 | itch.io | Page with screenshots and the trailer clip. Embeds `/play` or links to it. |
| 2 | r/WebGames | "I made a game where you are the ER charge nurse at night" with a 20 second clip of a gridlock |
| 3 | Show HN | Lead with the engineering angle: hospital gridlock is deadlock, and the game teaches it |
| 4 to 7 | Short video | Three clips: a STEMI handled well, a gridlock and the bed huddle, a night going wrong |

Answer every comment in the first 48 hours. Fix the top complaint and post the fix.

## What to measure

- Landing page to `/play`: are people starting?
- Orientation started and finished (already saved locally per chapter; add an analytics event later).
- Shifts finished: do people play to 07:00?
- Second shift started (the "new night" button): the real sign they like it.

## Things not to do

- Do not use the name, logos, characters or stills of any TV show in marketing. Say "for fans of medical dramas" if needed.
- Do not use a red cross or red crescent as a logo or icon. Those emblems are legally protected.
- Do not present it as training or medical guidance. The landing page and footer already say it is fiction.

## Hosting: Cloudflare, not Vercel

The site is static files. Both hosts can serve it; the difference is cost, terms and fit.

| | Cloudflare (Workers static assets) | Vercel (Hobby) |
|---|---|---|
| Price for this site | Free; static asset requests are not billed | Free within limits |
| Bandwidth | No bandwidth charge for static assets | 100 GB a month on Hobby |
| Commercial use on the free plan | Allowed | Hobby is for non-commercial use only |
| A traffic spike from Reddit or HN | No cost change | Can hit limits; then the site pauses or you upgrade |
| Analytics | Web Analytics, free and cookieless | Paid add-on beyond the basics |
| Where it shines | Static sites, caching, DNS in one place | Next.js and server rendering, which we do not use |

**Decision: Cloudflare.** Nothing here uses Vercel's strengths, and a viral day costs nothing on Cloudflare. (Cloudflare Pages works too; Cloudflare now points new projects at Workers with static assets, so that is what `wrangler.jsonc` sets up.)

### Setting it up

1. Cloudflare dashboard, Workers and Pages, Create, import the GitHub repo.
2. Root directory: `prototypes/night-shift`.
3. Build command: `node build.mjs`. Deploy command: `npx wrangler deploy`.
4. Build variable: `SITE_URL=https://<your domain>`. Without it the build leaves out canonical links, the social image URL and the sitemap.
5. Add the custom domain to the Worker.

`dist/_headers` sets security headers and caches `assets/` for a year (the file names carry a content hash, so a change gets a new name).

## What the site ships

| File | For |
|---|---|
| `favicon.ico`, `favicon.svg` | Browser tabs (the SVG is used where supported) |
| `apple-touch-icon.png` | iPhone and iPad home screen |
| `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `site.webmanifest` | Android home screen and install |
| `assets/og.*.jpg` | The card shown when a link is shared (1200 by 630) |
| Meta tags, Open Graph, Twitter card, canonical | Search results and link previews, on every page |
| JSON-LD (`WebSite`, `VideoGame`) | Structured data for search engines |
| `robots.txt`, `sitemap.xml` | Crawlers |
| `llms.txt`, `llms-full.txt` | AI search and assistants: a plain summary and the whole handbook as text |
| `404.html` | Missing pages |

The handbook page is the strongest search and AI-answer asset: it is long, specific, plain text about how emergency departments work. Keep it current.
