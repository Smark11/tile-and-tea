// Small, dependency-free statistics for the win-rate simulator: a share with
// its Wilson interval, a mean with its normal interval, and the paired
// difference between two policies played on the same deals.

/** z for a two-sided 95% interval. */
export const Z95 = 1.959964;

export type Interval = { readonly low: number; readonly high: number };

/** A share (e.g. Mah Jongg rate) with its 95% Wilson score interval, which behaves well near 0 and 1. */
export type Share = { readonly count: number; readonly n: number; readonly rate: number; readonly ci: Interval };

export function share(count: number, n: number): Share {
  if (n === 0) return { count, n, rate: 0, ci: { low: 0, high: 1 } };
  const p = count / n;
  const z2 = Z95 * Z95;
  const center = (p + z2 / (2 * n)) / (1 + z2 / n);
  const half = (Z95 * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / (1 + z2 / n);
  return { count, n, rate: p, ci: { low: Math.max(0, center - half), high: Math.min(1, center + half) } };
}

/** A sample mean with its 95% interval (normal approximation; the simulator's samples are in the hundreds). */
export type Mean = { readonly n: number; readonly mean: number; readonly sd: number; readonly ci: Interval };

export function mean(values: readonly number[]): Mean {
  const n = values.length;
  if (n === 0) return { n, mean: 0, sd: 0, ci: { low: 0, high: 0 } };
  const m = values.reduce((a, b) => a + b, 0) / n;
  const variance = n > 1 ? values.reduce((a, v) => a + (v - m) * (v - m), 0) / (n - 1) : 0;
  const sd = Math.sqrt(variance);
  const half = (Z95 * sd) / Math.sqrt(n);
  return { n, mean: m, sd, ci: { low: m - half, high: m + half } };
}

/**
 * The mean of `a[i] - b[i]` with its 95% interval: two policies played on the same deals, so the
 * luck of the deal cancels and the interval is much tighter than comparing two separate means.
 */
export function pairedDelta(a: readonly number[], b: readonly number[]): Mean {
  if (a.length !== b.length) throw new RangeError('paired samples must be the same length');
  return mean(a.map((v, i) => v - b[i]));
}

/** Whether an interval lies wholly on one side of zero. */
export const excludesZero = (ci: Interval): boolean => ci.low > 0 || ci.high < 0;
