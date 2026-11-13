import { cardDistances, CURRENT_CARD, handDistance, type HandDistance } from '../../card';
import { isRackSorted } from '../../rack';
import { copiesOf, sameKind, tileKey, type TileKind } from '../../tiles';
import { charleston, dealRound, DRILLS, roundReducer, startRound } from '..';
import {
  analyzeRack,
  evaluateCharleston,
  generateCharleston,
  PASS_SIZE,
  passWords,
  RACK_SIZE,
  tilesItNeeds,
  verdictOf,
  type CharlestonData,
  type PassVerdict,
} from '../content/charleston';
import { countWord, handLabel, list } from '../content/words';
import type { DrillQuestion } from '../types';

const SEEDS = Array.from({ length: 60 }, (_, i) => i * 104729 + 11);
const questions = SEEDS.map((seed) => generateCharleston(seed));
const isJoker = (k: TileKind) => k.type === 'joker';

/** Every 3-index pass with no Jokers, one per distinct set of tiles. */
function allPasses(rack: readonly TileKind[]): number[][] {
  const seen = new Set<string>();
  const out: number[][] = [];
  for (let a = 0; a < rack.length; a++)
    for (let b = a + 1; b < rack.length; b++)
      for (let c = b + 1; c < rack.length; c++) {
        if ([a, b, c].some((i) => isJoker(rack[i]))) continue;
        const key = [a, b, c].map((i) => tileKey(rack[i])).join();
        if (!seen.has(key)) {
          seen.add(key);
          out.push([a, b, c]);
        }
      }
  return out;
}

/**
 * An independent referee: weighs each pass against the whole card (no
 * shortcut on which hands to watch) and applies the verdict rules directly.
 */
function referee(rack: readonly TileKind[]): Map<string, PassVerdict> {
  const passes = allPasses(rack);
  const kept = passes.map((p) =>
    cardDistances({ concealed: rack.filter((_, i) => !p.includes(i)) }, CURRENT_CARD)
      .filter((r): r is HandDistance => r.tilesAway !== null)
      .map((r) => r.tilesAway),
  );
  const closest = kept.map((aways) => aways[0]);
  const bestClosest = Math.min(...closest);
  const near = kept.map((aways) => aways.filter((a) => a <= bestClosest + 1).length);
  const bestNear = Math.max(...near.filter((_, i) => closest[i] === bestClosest));
  const out = new Map<string, PassVerdict>();
  passes.forEach((p, i) => {
    const verdict: PassVerdict = closest[i] > bestClosest ? 'miss' : near[i] === bestNear ? 'best' : 'good';
    out.set(p.map((at) => tileKey(rack[at])).join(), verdict);
  });
  return out;
}

const passKey = (rack: readonly TileKind[], picked: readonly number[]) =>
  [...picked]
    .sort((a, b) => a - b)
    .map((i) => tileKey(rack[i]))
    .join();

describe('generateCharleston', () => {
  it('is deterministic in the seed', () => {
    expect(generateCharleston(4321)).toEqual(generateCharleston(4321));
    expect(charleston.generate(77)).toEqual(generateCharleston(77));
  });

  it('is registered as the Charleston drill', () => {
    expect(DRILLS).toContain(charleston);
    expect(charleston.skill).toBe('charleston');
    expect(new Set(dealRound(charleston, 9).map((q) => q.key)).size).toBe(charleston.questionsPerRound);
  });

  it('aims racks at many different hands across seeds', () => {
    const closest = new Set(questions.map((q) => analyzeRack(q.data.rack).hands[0].hand.id));
    expect(closest.size).toBeGreaterThanOrEqual(15);
  });

  it('deals Jokers into some racks, and locks every one', () => {
    const withJokers = questions.filter((q) => q.data.rack.some(isJoker));
    expect(withJokers.length).toBeGreaterThan(5);
    for (const q of withJokers) {
      q.choices.forEach((c, i) => {
        expect(c.kind).toBe('tile');
        if (c.kind === 'tile') expect(Boolean(c.locked)).toBe(isJoker(q.data.rack[i]));
      });
    }
  });

  it.each(questions.map((q) => [q.seed, q] as const))('seed %i is a fair question', (_seed, q) => {
    const { rack } = q.data;
    expect(rack).toHaveLength(RACK_SIZE);
    for (const t of rack) expect(rack.filter((k) => sameKind(k, t)).length).toBeLessThanOrEqual(copiesOf(t));
    expect(isRackSorted(rack.map((kind, id) => ({ id, kind, copy: 0 })))).toBe(true);
    expect(q.picks).toBe(PASS_SIZE);
    expect(q.choices.map((c) => c.kind === 'tile' && c.tile)).toEqual(rack);
    expect(q.choiceGroups!.reduce((a, b) => a + b, 0)).toBe(RACK_SIZE);
    expect(q.scene.tiles).toHaveLength(0);

    const analysis = analyzeRack(rack);
    const first = analysis.hands[0].tilesAway;
    expect(first).toBeGreaterThanOrEqual(4);
    expect(first).toBeLessThanOrEqual(6);
    // Some pass keeps the closest hand where it is, without breaking up a pung.
    expect(analysis.bestClosest).toBe(first);

    const verdicts = analysis.outcomes.map((o) => verdictOf(o, analysis));
    expect(verdicts.filter((v) => v === 'best').length / verdicts.length).toBeLessThanOrEqual(0.25);
    expect(verdicts.filter((v) => v === 'miss').length / verdicts.length).toBeGreaterThanOrEqual(0.35);
  });
});

describe('analyzeRack', () => {
  it.each(questions.slice(0, 10).map((q) => [q.seed, q] as const))(
    'seed %i agrees with a whole-card referee on every pass',
    (_seed, q) => {
      const analysis = analyzeRack(q.data.rack);
      const truth = referee(q.data.rack);
      expect(analysis.outcomes).toHaveLength(truth.size);
      for (const o of analysis.outcomes) {
        expect(verdictOf(o, analysis)).toBe(truth.get(o.pass.map(tileKey).join()));
      }
    },
  );

  it('never weighs a pass with a Joker in it', () => {
    for (const q of questions) {
      for (const o of analyzeRack(q.data.rack).outcomes) expect(o.pass.some(isJoker)).toBe(false);
    }
  });
});

describe('evaluateCharleston', () => {
  const free = (q: DrillQuestion<CharlestonData>) => q.data.rack.flatMap((k, i) => (isJoker(k) ? [] : [i]));

  /** Every distinct pass for a question, evaluated. */
  const sweep = (q: DrillQuestion<CharlestonData>) =>
    allPasses(q.data.rack).map((picked) => ({ picked, evaluation: evaluateCharleston(q, picked) }));
  const sample = questions.slice(0, 10).map((q) => ({ q, results: sweep(q) }));

  it('scores each verdict and highlights a best pass from the rack', () => {
    for (const { q, results } of sample) {
      const truth = referee(q.data.rack);
      const analysis = analyzeRack(q.data.rack);
      for (const { picked, evaluation } of results) {
        expect(evaluation.verdict).toBe(truth.get(passKey(q.data.rack, picked)));
        expect(evaluation.score).toBe({ best: 1, good: 0.5, miss: 0 }[evaluation.verdict]);
        // The highlighted pass: three different, non-Joker tiles, and itself a best pass.
        expect(new Set(evaluation.best).size).toBe(PASS_SIZE);
        for (const i of evaluation.best) expect(isJoker(q.data.rack[i])).toBe(false);
        expect(truth.get(passKey(q.data.rack, evaluation.best))).toBe('best');
        if (evaluation.verdict === 'best') expect(evaluation.best).toEqual(picked);
        // It aims at a hand that is as close as any after the best pass.
        expect(evaluation.target).toBeDefined();
        const main = CURRENT_CARD.hands.find((h) => handLabel(h) === evaluation.target!.label.replace('Aim for · ', ''))!;
        expect(evaluation.target!.line).toBe(main.line);
        const kept = q.data.rack.filter((_, i) => !evaluation.best.includes(i));
        expect(handDistance(main, { concealed: kept }).tilesAway).toBe(analysis.bestClosest);
      }
    }
  });

  it('reaches every verdict across seeds', () => {
    const seen = new Set(sample.flatMap(({ results }) => results.map((r) => r.evaluation.verdict)));
    expect(seen).toEqual(new Set(['best', 'good', 'miss']));
  });

  it('keeps explanations short, plain and in three paragraphs at most', () => {
    for (const { results } of sample) {
      for (const { evaluation } of results) {
        const paragraphs = evaluation.explanation.split('\n\n');
        expect(paragraphs.length).toBeLessThanOrEqual(3);
        expect(evaluation.explanation.length).toBeLessThanOrEqual(400);
        for (const p of paragraphs) {
          expect(p.length).toBeLessThanOrEqual(190);
          expect(p).toMatch(/^[A-Z0-9].*\.$/);
        }
        expect(evaluation.explanation).not.toMatch(/undefined|NaN|Infinity|\d+ tiles? away/);
        expect(evaluation.title).not.toMatch(/wrong/i);
      }
    }
  });

  it('names as many needed tiles as a missed pass costs, or says how many of them', () => {
    const number = (word: string) => Array.from({ length: 15 }, (_, n) => countWord(n)).indexOf(word);
    let partial = 0;
    for (const { results } of sample) {
      for (const { evaluation } of results.filter((r) => r.evaluation.verdict === 'miss')) {
        const [lead, fix] = evaluation.explanation.split('\n\n');
        // Both passes are measured in the same units: "leaves X N tiles away" vs "keeps X M tiles away".
        const found = lead.match(
          /^Your pass leaves (?<hand>.+) (?<after>\w+) tiles? away: it needs (?:(?<some>\w+) of )?your (?<tiles>.+)\.$/,
        )?.groups;
        expect(found).toBeDefined();
        const kept = fix.match(/^Pass .+ instead: it keeps (?<hand>.+) (?<best>\w+) tiles? away[,.]/)?.groups;
        expect(kept).toBeDefined();
        expect(kept!.hand).toBe(found!.hand);
        const lost = number(found!.after) - number(kept!.best);
        expect(lost).toBeGreaterThan(0);
        const named = found!.tiles
          .split(/, | and /)
          .reduce((n, part) => n + (/^(two|three) /.test(part) ? (part.startsWith('two') ? 2 : 3) : 1), 0);
        if (found!.some) {
          partial++;
          expect(number(found!.some)).toBe(lost);
          expect(named).toBeGreaterThan(lost);
        } else {
          expect(named).toBe(lost);
        }
      }
    }
    expect(partial).toBeGreaterThan(0);
  });

  it('says Jokers stay home exactly when the rack has one', () => {
    for (const { q, results } of sample) {
      const has = q.data.rack.some(isJoker);
      for (const { evaluation } of results) expect(evaluation.explanation.includes('Jokers are never passed')).toBe(has);
    }
  });

  it('refuses picks that are not a legal pass', () => {
    const q = questions.find((x) => x.data.rack.some(isJoker))!;
    const ok = free(q).slice(0, 3);
    const joker = q.data.rack.findIndex(isJoker);
    expect(() => evaluateCharleston(q, ok.slice(0, 2))).toThrow(RangeError);
    expect(() => evaluateCharleston(q, [ok[0], ok[0], ok[1]])).toThrow(RangeError);
    expect(() => evaluateCharleston(q, [ok[0], ok[1], 13])).toThrow(RangeError);
    expect(() => evaluateCharleston(q, [ok[0], ok[1], joker])).toThrow('Jokers are never passed');
    expect(() => evaluateCharleston(q, [ok[2], ok[0], ok[1]])).not.toThrow();
  });

  it('is fast enough to deal a round without a stall', () => {
    const times: number[] = [];
    for (let i = 0; i < 20; i++) {
      const t = performance.now();
      generateCharleston(900 + i);
      times.push(performance.now() - t);
    }
    times.sort((a, b) => a - b);
    expect(times[10]).toBeLessThan(60);
  });
});

describe('tilesItNeeds', () => {
  it('names the fewest passed tiles that cost a hand as much as the whole pass', () => {
    for (const q of questions.slice(0, 10)) {
      const { rack } = q.data;
      const analysis = analyzeRack(rack);
      const hand = analysis.hands[0].hand;
      for (const o of analysis.outcomes) {
        const needs = tilesItNeeds(hand, rack, o.pass);
        const away = (tiles: readonly TileKind[]) => {
          const left = [...rack];
          for (const k of tiles) left.splice(left.findIndex((x) => sameKind(x, k)), 1);
          return handDistance(hand, { concealed: left }).tilesAway!;
        };
        const lost = away(o.pass) - away([]);
        if (lost === 0) expect(needs).toEqual([]);
        else expect(away(needs)).toBe(away(o.pass));
        expect(needs.length).toBeGreaterThanOrEqual(lost);
      }
    }
  });
});

describe('wording', () => {
  it('reads passes the way players say them', () => {
    const bam = (rank: number): TileKind => ({ type: 'suited', suit: 'bam', rank } as TileKind);
    expect(passWords([{ type: 'wind', wind: 'N' }, bam(7), bam(7)])).toBe('the North and two 7 Bams');
    expect(passWords([bam(1), bam(2), { type: 'dragon', dragon: 'red' }], 'or')).toBe(
      'the 1 Bam, the 2 Bam or the Red Dragon',
    );
    expect(list(['a', 'b', 'c'], 'or')).toBe('a, b or c');
  });
});

describe('round play', () => {
  it('ignores taps on a locked Joker and needs exactly three picks', () => {
    const seed = SEEDS.find((s) => generateCharleston(s).data.rack.some(isJoker))!;
    const reduce = roundReducer({ ...charleston, questionsPerRound: 1, generate: () => generateCharleston(seed) });
    let state = startRound({ ...charleston, questionsPerRound: 1, generate: () => generateCharleston(seed) }, 1);
    const rack = (state.questions[0].data as CharlestonData).rack;
    const joker = rack.findIndex(isJoker);
    expect(reduce(state, { type: 'tap', index: joker })).toBe(state);
    const free = rack.flatMap((k, i) => (isJoker(k) ? [] : [i]));
    for (const i of free.slice(0, 3)) state = reduce(state, { type: 'tap', index: i });
    expect(reduce(state, { type: 'tap', index: free[3] })).toBe(state);
    state = reduce(state, { type: 'check' });
    expect(state.answers).toHaveLength(1);
  });
});

// scripts/screenshots.mjs captures this answer for the design review: a miss
// whose pass shares one tile with the coach's, on a rack with a Joker.
describe('screenshot fixture', () => {
  it('round seed 2, picks 0, 1, 2 on the first question, shares exactly one tile with the coach', () => {
    const picks = [0, 1, 2];
    const q = startRound(charleston, 2).questions[0] as DrillQuestion<CharlestonData>;
    expect(q.data.rack.some(isJoker)).toBe(true);
    const e = evaluateCharleston(q, picks);
    expect(e.verdict).toBe('miss');
    expect(e.best!.filter((i) => picks.includes(i))).toHaveLength(1);
  });
});
