import { createRng, shuffle } from '../rng';

const take = (rng: () => number, n: number) => Array.from({ length: n }, rng);

describe('createRng', () => {
  it('repeats the same sequence for the same seed', () => {
    expect(take(createRng(123), 50)).toEqual(take(createRng(123), 50));
    expect(take(createRng('east'), 50)).toEqual(take(createRng('east'), 50));
  });

  it('produces different sequences for different seeds', () => {
    expect(take(createRng(1), 10)).not.toEqual(take(createRng(2), 10));
    expect(take(createRng('a'), 10)).not.toEqual(take(createRng('b'), 10));
  });

  it('pins the sequence so saved seeds keep replaying the same deal', () => {
    // If this changes, every stored seed (saved games, daily drills) breaks.
    expect(take(createRng(42), 3)).toEqual([0.6011037519201636, 0.44829055899754167, 0.8524657934904099]);
  });

  it('stays in [0, 1)', () => {
    for (const x of take(createRng(7), 10_000)) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('is roughly uniform', () => {
    const buckets = new Array(10).fill(0);
    for (const x of take(createRng(2027), 100_000)) buckets[Math.floor(x * 10)]++;
    for (const count of buckets) {
      expect(count).toBeGreaterThan(9_500);
      expect(count).toBeLessThan(10_500);
    }
  });
});

describe('shuffle', () => {
  it('does not mutate its input', () => {
    const input = [1, 2, 3, 4, 5];
    shuffle(input, createRng(1));
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });

  it('handles empty and single-item arrays', () => {
    expect(shuffle([], createRng(1))).toEqual([]);
    expect(shuffle(['x'], createRng(1))).toEqual(['x']);
  });

  it('places every item in every position about equally often (unbiased)', () => {
    const n = 4;
    const trials = 40_000;
    const rng = createRng('fairness');
    const counts = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let t = 0; t < trials; t++) {
      shuffle([0, 1, 2, 3], rng).forEach((item, pos) => counts[item][pos]++);
    }
    const expected = trials / n;
    for (const row of counts) {
      for (const c of row) expect(Math.abs(c - expected) / expected).toBeLessThan(0.05);
    }
  });
});
