import { BOT_STYLES } from '@/game/bots';
import { tilesHeld } from '@/game/engine';
import { TILE_COUNT } from '@/game/tiles';

import {
  ABLATIONS,
  compare,
  formatReport,
  mean,
  pairedDelta,
  playGame,
  POLICIES,
  share,
  STUDENT,
  summarize,
  verdict,
  type GameRecord,
} from '..';

describe('stats', () => {
  it('gives a share its Wilson interval', () => {
    const half = share(5, 10);
    expect(half.rate).toBe(0.5);
    expect(half.ci.low).toBeCloseTo(0.2366, 3);
    expect(half.ci.high).toBeCloseTo(0.7634, 3);
    // Never outside 0–1, even at the edges.
    expect(share(0, 10).ci.low).toBeCloseTo(0, 12);
    expect(share(0, 10).ci.low).toBeGreaterThanOrEqual(0);
    expect(share(10, 10).ci.high).toBeCloseTo(1, 12);
    expect(share(10, 10).ci.high).toBeLessThanOrEqual(1);
    expect(share(0, 0).ci).toEqual({ low: 0, high: 1 });
  });

  it('gives a mean its interval', () => {
    const m = mean([1, 2, 3, 4, 5]);
    expect(m.mean).toBe(3);
    expect(m.sd).toBeCloseTo(Math.sqrt(2.5), 9);
    expect(m.ci.high - m.mean).toBeCloseTo((1.959964 * Math.sqrt(2.5)) / Math.sqrt(5), 6);
  });

  it('pairs two runs game by game', () => {
    const d = pairedDelta([10, 20, 30], [8, 18, 29]);
    expect(d.mean).toBeCloseTo(5 / 3, 9);
    expect(() => pairedDelta([1], [1, 2])).toThrow(RangeError);
  });

  it('calls a delta only when its interval clears zero', () => {
    expect(verdict(mean([1, 1.1, 0.9, 1, 1]))).toBe('helps');
    expect(verdict(mean([-1, -1.1, -0.9, -1]))).toBe('hurts');
    expect(verdict(mean([1, -1, 2, -2]))).toBe('unclear');
  });
});

describe('policies', () => {
  it('the student is the Shark: it follows the same advisor the coach does', () => {
    expect(STUDENT.style).toBe(BOT_STYLES.shark);
  });

  it.each(ABLATIONS.map((p) => [p.id, p] as const))('%s switches exactly one thing off', (_, policy) => {
    const changed = Object.keys(STUDENT.style).filter(
      (key) => STUDENT.style[key as keyof typeof STUDENT.style] !== policy.style[key as keyof typeof policy.style],
    );
    expect(changed).toHaveLength(1);
  });

  it('have distinct ids and each names the principle it measures', () => {
    expect(new Set(POLICIES.map((p) => p.id)).size).toBe(POLICIES.length);
    for (const p of ABLATIONS) expect(p.principle).toMatch(/^[CHT]\d$/);
  });
});

describe('playing a game', () => {
  const seat = 2;
  const { final, record } = playGame('sim-test-1', seat, STUDENT.style, 'club');

  it('plays to the end with every tile accounted for', () => {
    expect(final.phase.type).toBe('ended');
    const tiles = [...final.wall, ...final.discards.map((d) => d.tile), ...final.players.flatMap(tilesHeld)];
    expect(new Set(tiles.map((t) => t.id)).size).toBe(TILE_COUNT);
    expect(tiles).toHaveLength(TILE_COUNT);
  });

  it('records the student’s result from the engine’s settlement', () => {
    if (final.phase.type !== 'ended') throw new Error('not ended');
    const { result } = final.phase;
    expect(record.seat).toBe(seat);
    if (result.type === 'mahJongg') {
      expect(record.net).toBe(result.payments[seat]);
      expect(record.outcome).toBe(result.winner === seat ? 'won' : 'lost');
      expect(record.fed).toBe(result.winner !== seat && result.discarder === seat);
    } else {
      expect(record).toMatchObject({ outcome: result.type, net: 0, fed: false });
    }
  });

  it('replays exactly from its seed', () => {
    expect(playGame('sim-test-1', seat, STUDENT.style, 'club').record).toEqual(record);
  });
});

describe('summaries and the report', () => {
  const rec = (i: number, outcome: GameRecord['outcome'], net: number, extra: Partial<GameRecord> = {}): GameRecord => ({
    seed: `t-${i}`,
    seat: (i % 4) as GameRecord['seat'],
    outcome,
    net,
    fed: false,
    selfDrawn: false,
    dead: false,
    handValue: outcome === 'won' ? 30 : 0,
    ...extra,
  });
  const student = [rec(0, 'won', 120), rec(1, 'lost', -30), rec(2, 'wall', 0), rec(3, 'won', 90)];
  const ablated = [rec(0, 'won', 120), rec(1, 'lost', -60, { fed: true }), rec(2, 'lost', -25), rec(3, 'lost', -50, { fed: true })];

  it('adds up a run', () => {
    const s = summarize(ablated);
    expect(s.mahJongg.count).toBe(1);
    expect(s.fedWinner.count).toBe(2);
    expect(s.net.mean).toBeCloseTo(-15 / 4, 9);
    expect(summarize(student).wallGames.count).toBe(1);
    expect(summarize(student).meanWinValue).toBe(30);
  });

  it('compares two policies on the same deals only', () => {
    const c = compare(student, ablated);
    expect(c.mahJongg.mean).toBeCloseTo(1 / 4, 9);
    expect(c.net.mean).toBeCloseTo((0 + 30 + 25 + 140) / 4, 9);
    expect(() => compare(student, [...ablated].reverse())).toThrow(RangeError);
  });

  it('prints the student’s table and each ablation’s delta', () => {
    const report = formatReport([
      { policy: 'student', table: 'club', records: student },
      { policy: 'no-defense', table: 'club', records: ablated },
    ]);
    expect(report).toContain('| club bots | 4 | 50.0% (');
    // Three of the four games had a winner, so a fair share is 3/4 ÷ 4.
    expect(report).toContain('fair share 18.8%');
    expect(report).toContain('| T2 | Ignores exposures');
    expect(report).toContain('+25.0 pp');
  });
});
