// Small statistics for the AI evaluation. Pure, so they have tests in the normal suite.

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

const percent = (x: number) => Math.round(x * 100);

// "3 of 32 (9%, 95% CI 3–24%)"
export function share(k: number, n: number): string {
  const [low, high] = wilson(k, n);
  return `${k} of ${n} (${n ? percent(k / n) : 0}%, 95% CI ${percent(low)}–${percent(high)}%)`;
}
