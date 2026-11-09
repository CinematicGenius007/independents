/* The whole copy deck. Nineteen tracks, written for a first-time visitor: what it is, what you do, who plays, how long.
   No engineering vocabulary lives on the page; the formal lineage stays in each project's own README.
   side A = LIVE (the nine apps that exist), side B = ROADMAP (the ten concepts in the workshop). */

export const SITE = {
  title: 'INDEPENDENTS',
  subtitle: 'SCATTERED WORKS',
  catalog: 'IND-LP-019',
  headline: 'Nineteen small games, one record.',
  lede: 'Each one opens in a browser tab, with nothing to install and no account. Nine are ready to play today. Ten are still in the workshop.',
  sideA: { key: 'LIVE', count: 9, long: 'Side A', note: 'Ready to play' },
  sideB: { key: 'ROADMAP', count: 10, long: 'Side B', note: 'In the workshop' },
};

/* slug, title, side, sitting (mm:ss on the leader), word on the plate, hook, what you do, who plays, try-next, where it opens */
export const TRACKS = [
  { slug: 'fogwalk', name: 'Fogwalk', side: 'A', time: '05:00', word: 'FOG', hook: 'A maze where you never know exactly where you are.',
    you: 'Every place you could be moves at once. Pick directions until the fog agrees on a single spot.', who: 'Just you', like: 'tonguecracker', href: '../../apps/fogwalk/', look: '#7fe0d0' },
  { slug: 'bloomwright', name: 'Bloomwright', side: 'A', time: '04:12', word: 'GROWTH', hook: 'You never draw the plant. You write the rule it grows by.',
    you: 'Choose how one branch turns into three, then watch a whole garden follow your rule.', who: 'Just you', like: 'terrarium', href: '../../apps/bloomwright/', look: '#d9b26f' },
  { slug: 'tonguecracker', name: 'Tonguecracker', side: 'A', time: '03:48', word: 'LANGUAGE', hook: 'A brand-new language, invented fresh every round.',
    you: 'Read a few sentences, work out how the grammar behaves, then say something back in it.', who: 'Just you', like: 'lexicon', href: '../../apps/tonguecracker/', look: '#8fc4e8' },
  { slug: 'sealed-orders', name: 'Sealed Orders', side: 'A', time: '02:30', word: 'SECRET', hook: 'Three secret moves, locked inside a link.',
    you: 'Program your orders, send the link, and reveal together. Nobody can peek and nobody can cheat.', who: 'Two players', like: 'shadow', href: '../../apps/sealed-orders/', look: '#35c9e0' },
  { slug: 'hushword', name: 'Hushword', side: 'A', time: '04:05', word: 'REDACTED', hook: 'The word game where some of the clues are blacked out.',
    you: 'Guess the word from partial hints. Every link is its own puzzle with its own hidden letters.', who: 'Solo, or pass the link', like: 'sealed-orders', href: '../../apps/hushword/', look: '#d9a521' },
  { slug: 'pictionary', name: 'Scribble Club', side: 'A', time: '06:10', word: 'SKETCH', hook: 'Draw it. They guess it.',
    you: 'Sketch a secret word while friends race to name it, all on one shared page of paper.', who: 'You and friends', like: 'cartel', href: '../../apps/pictionary/', look: '#f4efe3' },
  { slug: 'azul', name: 'Azulejo', side: 'A', time: '07:20', word: 'TILES', hook: 'Lay tiles. Build the wall.',
    you: 'Draft coloured tiles, fill your pattern lines, and score a wall the way Portuguese tile masters would.', who: 'Two to four players', like: 'cartel', href: '../../apps/azul/', look: '#6d9be0' },
  { slug: 'longhaul', name: 'Long Haul', side: 'A', time: '05:55', word: 'BALLAST', hook: 'Eat the stones. Then dump them behind you.',
    you: 'Haul a growing pile of stones through a maze, slowing down as it grows, and drop it to block the devils.', who: 'Just you', like: 'driftwatch', href: '../../apps/longhaul/', look: '#ff9b3e', pending: true },
  { slug: 'boards', name: 'Sudoku & Tic-Tac-Toe', side: 'A', time: '03:33', word: 'GRIDS', hook: 'One grid that solves itself, and one grid inside a grid.',
    you: 'Solve a Sudoku with a helpful solver, or play tic-tac-toe where every move sends your opponent to a different board.', who: 'Solo, or two players', like: 'sporefront', href: '../../apps/sudoku-solver/', look: '#58e6a9' },

  { slug: 'sporefront', name: 'Sporefront', side: 'B', time: '04:40', word: 'SPORES', hook: 'Scatter a few spores and watch a living board decide what to do.',
    you: 'Seed a wrap-around board, tune a few rules, and try to grow a pattern that settles down and stays.', who: 'Just you', like: 'terrarium', href: '../life-ecologies/index.html#sporefront', look: '#58e6a9' },
  { slug: 'terrarium', name: 'Terrarium Hash', side: 'B', time: '05:15', word: 'GARDEN', hook: 'A tiny glass garden whose whole recipe lives in its web address.',
    you: 'Mist it, prune it, stir it. Copy the link and your garden grows the same way on any screen.', who: 'Just you', like: 'bloomwright', href: '../life-ecologies/index.html#terrarium', look: '#7be0a0' },
  { slug: 'driftwatch', name: 'Driftwatch', side: 'B', time: '06:02', word: 'CURRENT', hook: 'Ride the ocean current with a single valve.',
    you: 'Vent and flood at just the right depths so the sea carries your bathysphere onto the beacon.', who: 'Just you', like: 'loomweight', href: '../submissive-systems/index.html#driftwatch', look: '#8d7cff' },
  { slug: 'loomweight', name: 'Loomweight', side: 'B', time: '04:44', word: 'RHYTHM', hook: 'Keep a loom weaving in time. You never steer it.',
    you: 'The loom runs a three-beat rhythm against a four-beat card. Your job is to catch the tangles as they appear.', who: 'Just you', like: 'bloomwright', href: '../submissive-systems/index.html#loomweight', look: '#b79bff' },
  { slug: 'deadlock', name: 'Deadlock', side: 'B', time: '03:57', word: 'STANDOFF', hook: 'Keep the trains from waiting on each other forever.',
    you: 'Run a railway of shared track and break the standoff before every train is stuck waiting for another.', who: 'Just you', like: 'byzantine', href: '../cs-formalisms/index.html#deadlock', look: '#f2b84b' },
  { slug: 'byzantine', name: 'Byzantine Choir', side: 'B', time: '05:31', word: 'TRUST', hook: 'A line of signal towers, and a few of them are lying.',
    you: 'Cut and delay messages so every honest tower still ends up with the same order, traitors or not.', who: 'Just you', like: 'sealed-orders', href: '../cs-formalisms/index.html#byzantine', look: '#35c9e0' },
  { slug: 'gc', name: 'Garbage Collector', side: 'B', time: '04:19', word: 'TIDY', hook: 'Tidy a messy memory before the pause clock runs out.',
    you: 'Mark what is still in use, sweep the rest away, then pack what is left, all inside a tight time budget.', who: 'Just you', like: 'deadlock', href: '../cs-formalisms/index.html#gc', look: '#e9a63a' },
  { slug: 'cartel', name: 'Cartel of Cartographers', side: 'B', time: '07:08', word: 'TREATIES', hook: 'Draw the realms. Sign the treaties. Break them.',
    you: 'Place map tiles, swallow your neighbours, and sign covenants that limit what the signer is allowed to do.', who: 'You and friends', like: 'azul', href: '../hybrid-boardgames/index.html#cartel', look: '#ff6b5a' },
  { slug: 'shadow', name: 'Shadow Bidding', side: 'B', time: '03:26', word: 'SEALED BID', hook: 'Chess where you bid for the right to move first.',
    you: 'On a tiny five-by-five board, seal a secret bid, reveal together, and see who earns the opening move.', who: 'Two players', like: 'sealed-orders', href: '../hybrid-boardgames/index.html#shadow', look: '#4fd8ee' },
  { slug: 'lexicon', name: 'Lexicon Quarantine', side: 'B', time: '04:51', word: 'ENCIRCLE', hook: 'Words against walls.',
    you: 'One player inks chains of letters into words. The other surrounds them and quarantines whatever runs out of room.', who: 'Two players', like: 'boards', href: '../hybrid-boardgames/index.html#lexicon', look: '#58e6a9' },
];

export const bySlug = Object.fromEntries(TRACKS.map((t, i) => [t.slug, Object.assign(t, { i })]));
export const pad2 = n => String(n).padStart(2, '0');
export const sideName = t => t.side === 'A' ? 'LIVE' : 'ROADMAP';
export const openLabel = t => t.pending ? 'ARRIVING SOON' : t.side === 'A' ? 'PLAY ' + t.name.toUpperCase() : 'PEEK AT ' + t.name.toUpperCase();
export const openUrl = t => t.href + (t.href.includes('#') ? '&' : '#') + 'from=root&v=1';
