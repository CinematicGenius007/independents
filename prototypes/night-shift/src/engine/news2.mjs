/* NEWS2: National Early Warning Score 2 (Royal College of Physicians, 2017).
 * Seven bedside observations, each scored 0-3. Uses SpO2 scale 1.
 * Aggregate 0-4 low, 5-6 medium (urgent review), 7+ high (emergency response).
 * Any single parameter scoring 3 also warrants urgent review. */
const band = (v, table) => { for (const [limit, score] of table) if (v <= limit) return score; return table[table.length - 1][1]; };

export function news2(v) {
  const parts = {
    rr: band(v.rr, [[8, 3], [11, 1], [20, 0], [24, 2], [Infinity, 3]]),
    spo2: band(v.spo2, [[91, 3], [93, 2], [95, 1], [Infinity, 0]]),
    o2: v.o2 ? 2 : 0,
    sbp: band(v.sbp, [[90, 3], [100, 2], [110, 1], [219, 0], [Infinity, 3]]),
    hr: band(v.hr, [[40, 3], [50, 1], [90, 0], [110, 1], [130, 2], [Infinity, 3]]),
    avpu: v.gcs < 15 ? 3 : 0,
    temp: band(v.temp, [[35.0, 3], [36.0, 1], [38.0, 0], [39.0, 1], [Infinity, 2]]),
  };
  const score = Object.values(parts).reduce((a, b) => a + b, 0);
  const red = Object.values(parts).some((s) => s === 3);
  const risk = score >= 7 ? 'high' : score >= 5 ? 'medium' : red ? 'low-medium' : 'low';
  return { score, parts, risk, red };
}
