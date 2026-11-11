// mulberry32 + FNV-1a. No Math.random, no clock: a seed names one board forever.
export function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashSeed(text) {
  let hash = 2166136261;
  const s = String(text == null ? '' : text).trim().toUpperCase();
  for (let i = 0; i < s.length; i += 1) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
export function pickInt(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }
export function pickOne(rng, items) { return items[Math.floor(rng() * items.length)]; }
export function shuffled(rng, items) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
