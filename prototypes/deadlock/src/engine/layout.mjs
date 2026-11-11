// Pure geometry: where each cart stands before executing tape op k. No DOM.
// wp[k] = position when pc == k. The renderer interpolates wp[a] -> wp[b] over the
// ticks a transition takes, so motion is always a function of engine state.
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

export function cartWaypoints(level, ci) {
  const cart = level.carts[ci];
  const L = level.layout;
  const depot = L.depots[cart.id];
  const hutAt = L.huts[cart.id];
  const hut = { x: hutAt.x + Math.sign(500 - hutAt.x) * 74, y: hutAt.y + 30 }; // parks beside its hut, toward the middle
  const loop = L.loops && L.loops[cart.id];
  const nWork = cart.tape.filter((o) => o.k === 'work').length;
  const wp = [depot];
  let pos = depot;
  let padPos = null;
  let w = 0;
  const nextTarget = (k) => {
    for (let j = k + 1; j < cart.tape.length; j += 1) {
      const o = cart.tape[j];
      if (o.k === 'lock' || o.k === 'try') return L.pads[o.r];
    }
    return hut;
  };
  for (let k = 0; k < cart.tape.length; k += 1) {
    const op = cart.tape[k];
    if (op.k === 'lock' || op.k === 'try') { padPos = L.pads[op.r]; pos = padPos; }
    else if (op.k === 'travel') {
      const tgt = nextTarget(k);
      pos = lerp(padPos || pos, tgt, padPos ? 0.62 : 0.55);
      if (!padPos) padPos = null;
    } else if (op.k === 'work') {
      w += 1;
      const a = Math.PI / 2 + (w / Math.max(1, nWork)) * Math.PI * 2;
      pos = loop ? { x: loop.cx + loop.rx * Math.cos(a), y: loop.cy + loop.ry * Math.sin(a) } : pos;
    } else if (op.k === 'done') pos = hut;
    wp.push(pos);
  }
  return wp;
}

// Where a blocked cart waits: just short of the pad it wants.
export function waitSpot(level, ci, res, from) {
  const pad = level.layout.pads[res];
  const d = Math.hypot(pad.x - from.x, pad.y - from.y);
  return d > 150 ? lerp(from, pad, 0.4) : from;
}
