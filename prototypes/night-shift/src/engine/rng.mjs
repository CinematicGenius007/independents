/* Seeded randomness. The generator state lives in the game state (state.rng), so a
 * shift replays exactly from its seed and the list of player actions. */
export function seedFrom(str) {
  let h = 2166136261 >>> 0;
  for (const ch of String(str)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h || 1;
}

/** Next float in [0,1). Mutates state.rng (mulberry32). */
export function rnd(state) {
  let a = (state.rng = (state.rng + 0x6d2b79f5) >>> 0);
  a = Math.imul(a ^ (a >>> 15), a | 1);
  a ^= a + Math.imul(a ^ (a >>> 7), a | 61);
  return ((a ^ (a >>> 14)) >>> 0) / 4294967296;
}
export const rint = (state, lo, hi) => lo + Math.floor(rnd(state) * (hi - lo + 1));
export const pick = (state, arr) => arr[Math.floor(rnd(state) * arr.length)];

/** Stateless jitter in [-1,1] from two integers. Used for vital-sign noise, so
 * reading vitals never advances the game's generator. */
export function jitter(a, b) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 2147483648 - 1;
}
