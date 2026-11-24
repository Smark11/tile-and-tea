import { CURRENT_CARD, handDistance } from '../../card';
import { analyzeTable, verdictOf as throwVerdict } from '../../drills/content/discards';
import { isRackSorted } from '../../rack';
import { copiesOf, sameKind, tileKey, type TileKind } from '../../tiles';
import {
  evaluateScenario,
  moveIndexes,
  moveWords,
  nextScenario,
  picksFor,
  scenarioById,
  scenarioDrill,
  scenarioQuestion,
  SCENARIOS,
  scenariosIn,
  STAGES,
  stageInfo,
} from '..';
import type { Scenario } from '../types';

const asTiles = (kinds: readonly TileKind[]) => kinds.map((kind, id) => ({ id, kind, copy: 0 }));

/** Every tile the scenario puts in view. */
function tilesInView(s: Scenario): TileKind[] {
  const { setup } = s;
  if (setup.kind !== 'discard') return [...setup.rack];
  return [...setup.data.rack, ...setup.data.discards, ...setup.data.exposures.flatMap((e) => e.groups.flat())];
}

/** Every combination of `k` distinct choice indexes among the free tile choices. */
function combos(indexes: number[], k: number): number[][] {
  if (k === 0) return [[]];
  return indexes.flatMap((i, at) => combos(indexes.slice(at + 1), k - 1).map((rest) => [i, ...rest]));
}

describe('the scenario catalog', () => {
  it('has unique, URL-safe ids in stage order, each stage listed', () => {
    const ids = SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
    const order = SCENARIOS.map((s) => STAGES.findIndex((st) => st.id === s.stage));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    for (const stage of STAGES) {
      expect(scenariosIn(stage.id).length).toBeGreaterThan(0);
      expect(stageInfo(stage.id)).toBe(stage);
    }
  });

  it('links each scenario to the next and finds them by id', () => {
    SCENARIOS.forEach((s, i) => {
      expect(scenarioById(s.id)).toBe(s);
      expect(nextScenario(s.id)).toBe(SCENARIOS[i + 1]);
    });
    expect(scenarioById('nope')).toBeUndefined();
    expect(nextScenario('nope')).toBeUndefined();
  });

  it.each(SCENARIOS.map((s) => [s.id, s] as const))('%s is a possible table with readable text', (_id, s) => {
    const rack = s.setup.kind === 'discard' ? s.setup.data.rack : s.setup.rack;
    expect(rack).toHaveLength(s.setup.kind === 'discard' ? 14 : 13);
    expect(isRackSorted(asTiles(rack))).toBe(true);
    const all = tilesInView(s);
    for (const kind of all) expect(all.filter((k) => sameKind(k, kind)).length).toBeLessThanOrEqual(copiesOf(kind));
    if (s.setup.kind === 'best-hand') {
      expect(new Set(s.setup.handIds).size).toBe(s.setup.handIds.length);
      for (const id of s.setup.handIds) expect(CURRENT_CARD.hands.some((h) => h.id === id)).toBe(true);
    }
    expect(s.story.trim().length).toBeGreaterThan(80);
    expect(s.strategy.body.split(/\n\s*\n/).length).toBeGreaterThanOrEqual(2);
    expect(s.strategy.checklist.length).toBeGreaterThanOrEqual(3);
    expect(s.strategy.checklist.length).toBeLessThanOrEqual(4);
    // Never "wrong": the coach's tone is encouraging.
    expect(`${s.story} ${s.strategy.body} ${s.strategy.checklist.join(' ')}`).not.toMatch(/\bwrong\b/i);
  });

  it.each(SCENARIOS.map((s) => [s.id, s] as const))('%s teaches the move the coach calls best, and some pick is a miss', (_id, s) => {
    const question = scenarioQuestion(s);
    expect(question.prompt).toBe(s.prompt);
    expect(question.picks).toBe(picksFor(s));
    const move = moveIndexes(s, question);
    expect(move).toHaveLength(question.picks);
    const taught = evaluateScenario(s, question, move);
    expect(taught.verdict).toBe('best');
    expect(taught.score).toBe(1);
    // The coach's highlighted answer is the taught move itself.
    expect([...taught.best].sort()).toEqual([...move].sort());

    const free = question.choices.flatMap((c, i) => (c.kind === 'tile' && c.locked ? [] : [i]));
    const verdicts = combos(free, question.picks).map((picked) => evaluateScenario(s, question, picked).verdict);
    expect(verdicts).toContain('miss');
    // Every other pick's explanation points back at the taught move.
    for (const picked of combos(free, question.picks)) {
      const e = evaluateScenario(s, question, picked);
      if (e.verdict !== 'best') expect([...e.best].sort()).toEqual([...move].sort());
    }
  });

  it('says each move in words', () => {
    expect(moveWords(scenarioById('pass-what-touches-nothing')!)).toBe('Pass the 9 Bam, the 1 Crak and the 9 Dot');
    expect(moveWords(scenarioById('count-whats-gone')!)).toBe('Throw the Soap');
    expect(moveWords(scenarioById('dragons-have-suits')!)).toBe('Aim for 2468 #3');
  });

  it('wraps each scenario as a stable one-question drill', () => {
    for (const s of SCENARIOS) {
      const drill = scenarioDrill(s);
      expect(scenarioDrill(s)).toBe(drill);
      expect(drill.questionsPerRound).toBe(1);
      expect(drill.skill).toBe(s.skill);
      expect(drill.generate(123)).toEqual(scenarioQuestion(s));
    }
  });
});

describe('what the stories claim', () => {
  it('"Sixteen of the forty hands" use Flowers', () => {
    expect(CURRENT_CARD.hands).toHaveLength(40);
    expect(CURRENT_CARD.hands.filter((h) => h.notation.includes('F'))).toHaveLength(16);
  });

  it('Count what’s gone: the hand the rack looks closest to is dead, and the Soap is the free tile', () => {
    const s = scenarioById('count-whats-gone')!;
    if (s.setup.kind !== 'discard') throw new Error('expected a discard scenario');
    const a = analyzeTable(s.setup.data);
    expect(a.dead?.hand.hand.id).toBe('evens-2');
    expect(a.dead?.reason).toMatch(/needs a Soap, and the other three are on the table/);
    expect(a.outcomes.find((o) => o.hand?.id)!.hand?.id).toBe('evens-4');
    const soap = a.outcomes.find((o) => tileKey(o.tile) === 'dragon-white')!;
    expect(throwVerdict(soap, a)).toBe('best');
    // The text says three Soaps are in the pile and the player holds one.
    expect(s.setup.data.discards.filter((k) => tileKey(k) === 'dragon-white')).toHaveLength(3);
    expect(s.setup.data.rack.filter((k) => tileKey(k) === 'dragon-white')).toHaveLength(1);
  });

  it('Two exposures tell a story: the 3 Dot is wanted by exactly Like Numbers #2 and #3', () => {
    const s = scenarioById('two-exposures-tell-a-story')!;
    if (s.setup.kind !== 'discard') throw new Error('expected a discard scenario');
    const a = analyzeTable(s.setup.data);
    expect(a.reads).toHaveLength(1);
    expect(a.reads[0].read.hands.map((h) => h.id)).toEqual(['like-2', 'like-3']);
    const hot = a.outcomes.find((o) => tileKey(o.tile) === 'dot-3')!;
    expect(hot.danger?.use).toBe('group');
    expect(throwVerdict(hot, a)).toBe('good');
    expect(a.bestClosest).toBe(2);
  });

  /** Tiles away from card hand `id` for a best-hand scenario's rack. */
  const away = (scenarioId: string, id: string) => {
    const s = scenarioById(scenarioId)!;
    if (s.setup.kind !== 'best-hand') throw new Error('expected a best-hand scenario');
    return handDistance(CURRENT_CARD.hands.find((h) => h.id === id)!, { concealed: s.setup.rack }).tilesAway;
  };

  it('Dragons have suits: 2468 #3 is four away, and Winds & Dragons #2 uses only five tiles (nine away)', () => {
    expect(away('dragons-have-suits', 'evens-3')).toBe(4);
    expect(away('dragons-have-suits', 'honors-2')).toBe(9);
  });

  it('Jokers want big groups: Like Numbers #2 is two away, #1 four and #4 five, despite #1 having more Joker seats', () => {
    expect(away('jokers-want-big-groups', 'like-2')).toBe(2);
    expect(away('jokers-want-big-groups', 'like-1')).toBe(4);
    expect(away('jokers-want-big-groups', 'like-4')).toBe(5);
  });

  it('Closest beats richest: the pairs hand is far further than the answer', () => {
    const s = scenarioById('closest-beats-richest')!;
    const q = scenarioQuestion(s);
    if (s.setup.kind !== 'best-hand') throw new Error('expected a best-hand scenario');
    const pairs = s.setup.handIds.indexOf('pairs-2');
    expect(evaluateScenario(s, q, [pairs]).explanation).toMatch(/13579 #3 is 3 tiles away; your pick is 10/);
  });
});
