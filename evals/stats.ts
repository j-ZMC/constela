// Small statistics for the evaluations. Pure, so they have tests in the normal suite.

// mulberry32: seeded, so a report is the same on every run.
export function seeded(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The Wilson score interval: honest at small samples and at 0 or 100%, where the usual p ± 1.96·σ says nothing.
export function wilson(k: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 1];
  const p = k / n;
  const d = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / d;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

// Nearest rank: always a value that was really measured.
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)];
}

// Whole numbers, with one decimal below 1% so a small upper bound doesn't round to 0.
const percent = (x: number) => (x > 0 && x < 0.01 ? (x * 100).toFixed(1) : String(Math.round(x * 100)));

// "3 of 32 (9%, 95% CI 3–24%)"
export function share(k: number, n: number): string {
  const [low, high] = wilson(k, n);
  return `${k} of ${n} (${n ? percent(k / n) : 0}%, 95% CI ${percent(low)}–${percent(high)}%)`;
}
