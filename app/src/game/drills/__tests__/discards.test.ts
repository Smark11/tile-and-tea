import { cardDistances, CURRENT_CARD, readExposures, wantedBy, type HandDistance } from '../../card';
import { isRackSorted } from '../../rack';
import { copiesOf, sameKind, tileKey, type TileKind } from '../../tiles';
import { discards, DRILLS, roundReducer, startRound } from '..';
import {
  analyzeTable,
  evaluateDiscard,
  generateDiscard,
  handsWords,
  RACK_SIZE,
  READ_EXPOSURES,
  verdictOf,
  type DiscardData,
  type DiscardVerdict,
} from '../content/discards';
import type { DrillQuestion } from '../types';

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 7919 + 3);
const questions = SEEDS.map((seed) => generateDiscard(seed));
const isJoker = (k: TileKind) => k.type === 'joker';
const exposedTiles = (d: DiscardData) => d.exposures.flatMap((e) => e.groups.flat());

function minus(rack: readonly TileKind[], kind: TileKind): TileKind[] {
  const out = [...rack];
  out.splice(
    out.findIndex((k) => sameKind(k, kind)),
    1,
  );
  return out;
}

/** The referee: the closest live hand after a throw, ranking the whole card from scratch. */
function refereeClosest(d: DiscardData, kind: TileKind): HandDistance | null {
  const seen = [...d.discards, ...exposedTiles(d), kind];
  const first = cardDistances({ concealed: minus(d.rack, kind) }, CURRENT_CARD, seen)[0];
  return first.tilesAway === null ? null : first;
}

/** The referee for danger: does any possible hand of the exposed player have a place for it? */
function refereeDanger(d: DiscardData, kind: TileKind): boolean {
  return d.exposures
    .filter((e) => e.groups.length >= READ_EXPOSURES)
    .some((e) => {
      const others = d.exposures.filter((x) => x !== e).flatMap((x) => x.groups.flat());
      const read = readExposures(e.groups, [...minus(d.rack, kind), ...d.discards, ...others], CURRENT_CARD);
      return wantedBy(read, kind) !== null;
    });
}

describe('generateDiscard', () => {
  it('is deterministic in the seed', () => {
    expect(generateDiscard(1234)).toEqual(generateDiscard(1234));
    expect(generateDiscard(1234).key).not.toBe(generateDiscard(1235).key);
  });

  it('is registered as the Discards drill, training discards', () => {
    expect(DRILLS).toContain(discards);
    expect(discards.skill).toBe('discards');
    expect(discards.id).toBe('discards');
  });

  it.each(questions.map((q) => [q.seed, q] as const))('seed %i deals a possible table and a fair question', (_seed, q) => {
    const d = q.data;
    expect(d.rack).toHaveLength(RACK_SIZE);
    expect(isRackSorted(d.rack.map((kind, id) => ({ id, kind, copy: 0 })))).toBe(true);
    // Every tile comes from one 152-tile set.
    const all = [...d.rack, ...d.discards, ...exposedTiles(d)];
    for (const kind of all) expect(all.filter((k) => sameKind(k, kind)).length).toBeLessThanOrEqual(copiesOf(kind));
    // One opponent shows two real groups of 3+ of one tile each.
    expect(d.exposures).toHaveLength(1);
    for (const g of d.exposures[0].groups) {
      expect(g.length).toBeGreaterThanOrEqual(3);
      expect(new Set(g.map(tileKey)).size).toBe(1);
    }
    expect(d.discards.length).toBeGreaterThanOrEqual(8);

    const a = analyzeTable(d);
    const verdicts = a.outcomes.map((o) => verdictOf(o, a));
    expect(a.bestClosest).toBeGreaterThanOrEqual(2);
    expect(a.bestClosest).toBeLessThanOrEqual(4);
    expect(verdicts).toContain('miss');
    expect(verdicts.filter((v) => v === 'best').length / verdicts.length).toBeLessThanOrEqual(0.45);
    // There's always a throw that keeps the hand and is safe from the exposed player.
    expect(a.safeKeep).toBe(true);
    // The table teaches something: danger decides between keeping throws, or a hand is dead or set back.
    expect(verdicts.includes('good') || a.dead !== null).toBe(true);
    // Jokers are shown but locked; every other tile can be thrown.
    q.choices.forEach((c, i) => {
      expect(c.kind).toBe('tile');
      if (c.kind === 'tile') expect(!!c.locked).toBe(isJoker(d.rack[i]));
    });
    expect(q.picks).toBe(1);
    expect(q.scene.table?.discards).toEqual(d.discards);
    expect(q.choiceGroups?.reduce((s, n) => s + n, 0)).toBe(RACK_SIZE);
  });

  it('varies the exposed seat and sometimes teaches dead tiles', () => {
    expect(new Set(questions.map((q) => q.data.exposures[0].seat)).size).toBe(3);
    expect(questions.some((q) => analyzeTable(q.data).dead !== null)).toBe(true);
  });
});

describe('analyzeTable', () => {
  it.each(questions.slice(0, 12).map((q) => [q.seed, q] as const))(
    'seed %i: the shortcut and the danger read agree with independent referees',
    (_seed, q) => {
      const a = analyzeTable(q.data);
      const kinds = q.data.rack.filter((k, i) => !isJoker(k) && q.data.rack.findIndex((x) => sameKind(x, k)) === i);
      expect(a.outcomes.map((o) => o.tile)).toEqual(kinds);
      for (const o of a.outcomes) {
        const ref = refereeClosest(q.data, o.tile);
        expect(o.closest).toBe(ref?.tilesAway ?? Infinity);
        expect(o.hand).toBe(ref?.hand ?? null);
        expect(o.danger !== null).toBe(refereeDanger(q.data, o.tile));
      }
    },
  );

  it('flags the hand the rack looks closest to when dead tiles kill it or set it back, and says why', () => {
    const deadOnes = questions.map((q) => [q, analyzeTable(q.data)] as const).filter(([, a]) => a.dead);
    expect(deadOnes.length).toBeGreaterThan(0);
    for (const [q, a] of deadOnes) {
      const dead = a.dead!;
      const rackOnly = cardDistances({ concealed: q.data.rack }, CURRENT_CARD)[0];
      expect(dead.hand.hand).toBe(rackOnly.hand);
      const live = cardDistances({ concealed: q.data.rack }, CURRENT_CARD, a.seen).find((r) => r.hand === dead.hand.hand)!;
      expect(live.tilesAway).toBe(dead.liveAway);
      if (dead.liveAway !== null) expect(dead.liveAway).toBeGreaterThan(dead.hand.tilesAway);
      expect(dead.reason).toMatch(/^its (single|pair) needs .+, and (the other|all|only) .+ (on the table|still unseen)$/);
      // The coach says so when praising a throw.
      const best = a.outcomes.find((o) => verdictOf(o, a) === 'best')!;
      expect(evaluateDiscard(q, [best.index]).explanation).toMatch(/looks like your closest hand, but/);
    }
  });
});

describe('evaluateDiscard', () => {
  const pickable = (q: DrillQuestion<DiscardData>) => q.choices.map((_, i) => i).filter((i) => !isJoker(q.data.rack[i]));

  it('scores each verdict and highlights a best, safe throw from the rack', () => {
    const scores: Record<DiscardVerdict, number> = { best: 1, good: 0.5, miss: 0 };
    for (const q of questions.slice(0, 15)) {
      const a = analyzeTable(q.data);
      for (const i of pickable(q)) {
        const e = evaluateDiscard(q, [i]);
        const mine = a.outcomes.find((o) => sameKind(o.tile, q.data.rack[i]))!;
        expect(e.verdict).toBe(verdictOf(mine, a));
        expect(e.score).toBe(scores[e.verdict]);
        expect(e.best).toHaveLength(1);
        const answer = a.outcomes.find((o) => sameKind(o.tile, q.data.rack[e.best[0]]))!;
        expect(verdictOf(answer, a)).toBe('best');
        expect(answer.danger).toBeNull();
        if (e.verdict === 'best') expect(e.best).toEqual([i]);
        expect(e.target?.line).toBe(answer.hand!.line);
      }
    }
  });

  it('reaches every verdict across seeds', () => {
    const seen = new Set(questions.flatMap((q) => pickable(q).map((i) => evaluateDiscard(q, [i]).verdict)));
    expect([...seen].sort()).toEqual(['best', 'good', 'miss']);
  });

  it('explains danger, safety and the cost in plain, short paragraphs', () => {
    for (const q of questions.slice(0, 20)) {
      const seat = q.data.exposures[0].seat;
      for (const i of pickable(q)) {
        const e = evaluateDiscard(q, [i]);
        const paragraphs = e.explanation.split('\n\n');
        expect(paragraphs.length).toBeLessThanOrEqual(4);
        for (const p of paragraphs) expect(p.length).toBeLessThanOrEqual(260);
        expect(e.explanation).not.toMatch(/undefined|NaN|Infinity|\bnull\b/);
        if (e.verdict === 'good') expect(e.explanation).toMatch(/could be called/);
        if (e.verdict === 'best') expect(e.explanation).toMatch(/safe from/);
        if (e.verdict !== 'best') expect(e.explanation).toMatch(seat === 'across' ? /player across/i : new RegExp(`your ${seat}`));
        expect(e.title).not.toMatch(/wrong/i);
      }
    }
  });

  it('refuses a pick that is not one rack tile, or a Joker', () => {
    const q = questions.find((x) => x.data.rack.some(isJoker)) ?? questions[0];
    expect(() => evaluateDiscard(q, [])).toThrow(RangeError);
    expect(() => evaluateDiscard(q, [0, 1])).toThrow(RangeError);
    expect(() => evaluateDiscard(q, [RACK_SIZE])).toThrow(RangeError);
    const joker = q.data.rack.findIndex(isJoker);
    if (joker >= 0) expect(() => evaluateDiscard(q, [joker])).toThrow(RangeError);
  });

  it('is fast enough to deal a round without a stall', () => {
    const start = Date.now();
    for (let seed = 900; seed < 910; seed++) generateDiscard(seed);
    // Two rounds of five on a dev machine; a phone several times slower still deals a round in well under a second.
    expect((Date.now() - start) / 10).toBeLessThan(80);
  });
});

describe('wording', () => {
  it('names a section once for its hands in a row', () => {
    const [a, b] = CURRENT_CARD.sections[0].hands;
    const other = CURRENT_CARD.sections[1].hands[0];
    expect(handsWords([a, b, other], CURRENT_CARD)).toMatch(/^\S+ #1 or #2|, #2 or /);
    expect(handsWords([a, b], CURRENT_CARD)).not.toMatch(new RegExp(`${CURRENT_CARD.sections[0].title}.*${CURRENT_CARD.sections[0].title}`));
  });
});

describe('screenshot fixture', () => {
  it('round seed 2, tile 0 on the first question, keeps the hand but could be called', () => {
    const q = startRound(discards, 2).questions[0] as DrillQuestion<DiscardData>;
    const e = evaluateDiscard(q, [0]);
    expect(e.verdict).toBe('good');
    expect(e.explanation).toMatch(/could be called/);
  });
});

describe('round play', () => {
  it('answers on one tap and ignores taps on a locked Joker', () => {
    const q = questions.find((x) => x.data.rack.some(isJoker))!;
    const drill = { ...discards, questionsPerRound: 1, generate: () => q };
    const reduce = roundReducer(drill);
    const start = startRound(drill, 1);
    const joker = q.data.rack.findIndex(isJoker);
    expect(reduce(start, { type: 'tap', index: joker })).toBe(start);
    const tile = q.data.rack.findIndex((k) => !isJoker(k));
    expect(reduce(start, { type: 'tap', index: tile }).answers).toHaveLength(1);
  });
});
