import { cardDistances, CURRENT_CARD, handDistance, type HandDistance } from '../../card';
import { isRackSorted } from '../../rack';
import { copiesOf, tileKey, type TileKind } from '../../tiles';
import { bestHand, dealRound, DRILLS } from '..';
import {
  cautions,
  evaluateBestHand,
  explainBest,
  feltGroups,
  generateBestHand,
  RACK_SIZE,
  stillNeeded,
  usesSentence,
  type BestHandData,
} from '../content/bestHand';
import { countWord, handLabel } from '../content/words';
import type { DrillQuestion } from '../types';

const SEEDS = Array.from({ length: 300 }, (_, i) => i * 104729 + 7);
const questions = SEEDS.map((seed) => generateBestHand(seed));
const hand = (id: string) => CURRENT_CARD.hands.find((h) => h.id === id)!;
const distance = (id: string, rack: readonly TileKind[]) =>
  handDistance(hand(id), { concealed: rack }) as HandDistance;
/** Card-wide reachable hands for a rack, closest first. */
const ranking = (rack: readonly TileKind[]) =>
  cardDistances({ concealed: rack }, CURRENT_CARD).filter((r): r is HandDistance => r.tilesAway !== null);
/** How many Jokers a "still needed" list ends with: "…and two Jokers" → 2. */
const jokersNamed = (needs: string) => {
  const found = needs.match(/(\w+) Jokers?$/);
  if (!found) return 0;
  return found[1] === 'a' ? 1 : Array.from({ length: 15 }, (_, n) => countWord(n)).indexOf(found[1]);
};
/** The choice index of the closest line. */
const answerOf = (q: DrillQuestion<BestHandData>) => {
  const aways = q.data.handIds.map((id) => distance(id, q.data.rack).tilesAway);
  return aways.indexOf(Math.min(...aways));
};

describe('generateBestHand', () => {
  it('is deterministic in the seed', () => {
    expect(generateBestHand(1234)).toEqual(generateBestHand(1234));
    expect(bestHand.generate(99)).toEqual(generateBestHand(99));
  });

  it('is registered as a hand-choice drill', () => {
    expect(DRILLS).toContain(bestHand);
    expect(bestHand.skill).toBe('hand-choice');
    expect(new Set(dealRound(bestHand, 5).map((q) => q.key)).size).toBe(bestHand.questionsPerRound);
  });

  it('points racks at many different hands across seeds', () => {
    const answers = new Set(questions.map((q) => q.data.handIds[answerOf(q)]));
    expect(answers.size).toBeGreaterThanOrEqual(25);
  });

  it.each(questions.map((q) => [q.seed, q] as const))('seed %i is a fair question', (_seed, q) => {
    const { rack, handIds } = q.data;

    // A real 13-tile rack from one set, sorted, shown in suit groups.
    expect(rack).toHaveLength(RACK_SIZE);
    const counts = new Map<string, number>();
    for (const t of rack) counts.set(tileKey(t), (counts.get(tileKey(t)) ?? 0) + 1);
    for (const t of rack) expect(counts.get(tileKey(t))).toBeLessThanOrEqual(copiesOf(t));
    expect(isRackSorted(rack.map((kind, id) => ({ id, kind, copy: 0 })))).toBe(true);
    expect(q.scene.tiles).toBe(rack);
    expect(q.scene.groups!.reduce((a, b) => a + b, 0)).toBe(RACK_SIZE);
    expect(q.scene.caption).toMatch(/^(Bams|Craks|Dots|Honors): .+\.$/);
    expect(q.instruction).toBe('Tap the line your tiles are closest to.');

    expect(q.picks).toBe(1);
    expect(q.choices).toHaveLength(4);
    expect(new Set(handIds).size).toBe(4);
    q.choices.forEach((c, i) => {
      expect(c).toEqual({ kind: 'line', line: hand(handIds[i]).line, label: handLabel(hand(handIds[i])) });
    });

    // The answer is the one hand on the whole card closer than every other, and it's among the choices.
    const ranked = ranking(rack);
    expect(ranked[0].tilesAway).toBeLessThan(ranked[1].tilesAway);
    expect(ranked[0].tilesAway).toBeGreaterThanOrEqual(2);
    expect(ranked[0].tilesAway).toBeLessThanOrEqual(6);
    expect(handIds).toContain(ranked[0].hand.id);

    // What each line still needs names a Joker exactly where the set has run out of real copies.
    for (const id of handIds) {
      const plan = distance(id, rack);
      expect(jokersNamed(stillNeeded(plan, rack))).toBe(plan.mustBeJokers);
    }

    // The other lines are tempting: within five tiles of the answer, never tied with it.
    for (const id of handIds) {
      if (id === ranked[0].hand.id) continue;
      const gap = distance(id, rack).tilesAway - ranked[0].tilesAway;
      expect(gap).toBeGreaterThanOrEqual(1);
      expect(gap).toBeLessThanOrEqual(5);
    }
  });

  it('includes the runner-up whenever a hand is just one tile further', () => {
    for (const q of questions) {
      const ranked = ranking(q.data.rack);
      const runnerUp = ranked.some((r) => r.tilesAway === ranked[0].tilesAway + 1);
      const shown = q.data.handIds.some((id) => distance(id, q.data.rack).tilesAway === ranked[0].tilesAway + 1);
      expect(shown).toBe(runnerUp);
    }
  });
});

describe('evaluateBestHand', () => {
  it.each(questions.slice(0, 80).map((q) => [q.seed, q] as const))('seed %i grades every pick by distance', (_seed, q) => {
    const answer = answerOf(q);
    const nearest = distance(q.data.handIds[answer], q.data.rack).tilesAway;
    q.data.handIds.forEach((id, i) => {
      const result = evaluateBestHand(q, [i]);
      expect(result.best).toEqual([answer]);
      const gap = distance(id, q.data.rack).tilesAway - nearest;
      expect(result.verdict).toBe(gap === 0 ? 'best' : gap === 1 ? 'good' : 'miss');
      expect(result.score).toBe(gap === 0 ? 1 : gap === 1 ? 0.5 : 0);
      expect(result.title).not.toMatch(/wrong/i);
      // Leads with the comparison in one sentence, naming the answer once, then two short paragraphs.
      const label = handLabel(hand(q.data.handIds[answer]));
      const paragraphs = result.explanation.split('\n\n');
      expect(paragraphs).toHaveLength(3);
      const away = `${label} is ${nearest} ${nearest === 1 ? 'tile' : 'tiles'} away`;
      expect(paragraphs[0]).toBe(
        gap === 0 ? `${away}, the closest on the card.` : `${away}; your pick is ${nearest + gap}.`,
      );
      expect(result.explanation.split(label)).toHaveLength(2);
      expect(paragraphs[1]).toMatch(/^It uses \d+ of your 13 tiles\./);
      expect(paragraphs[2]).toMatch(/^Still to get: /);
    });
  });

  it('keeps every explanation short enough to read at a glance', () => {
    for (const q of questions) {
      q.data.handIds.forEach((_, i) => {
        const { explanation } = evaluateBestHand(q, [i]);
        // About 8 phone lines at ~40 characters each, before the Next button.
        expect(explanation.length).toBeLessThanOrEqual(400);
        for (const p of explanation.split('\n\n')) expect(p.length).toBeLessThanOrEqual(190);
      });
    }
  });

  it('rejects anything but one valid pick', () => {
    const q = questions[0];
    expect(() => evaluateBestHand(q, [])).toThrow(RangeError);
    expect(() => evaluateBestHand(q, [0, 1])).toThrow(RangeError);
    expect(() => evaluateBestHand(q, [4])).toThrow(RangeError);
    expect(() => evaluateBestHand(q, [-1])).toThrow(RangeError);
  });
});

describe('explanations', () => {
  // A hand-built rack: three 2 Bams, two 4 Bams, a 6 Bam, two Jokers, and filler.
  const B = (rank: 2 | 4 | 6 | 8): TileKind => ({ type: 'suited', suit: 'bam', rank });
  const J: TileKind = { type: 'joker' };
  const filler: TileKind[] = [
    { type: 'wind', wind: 'N' },
    { type: 'wind', wind: 'E' },
    { type: 'dragon', dragon: 'red' },
    { type: 'suited', suit: 'crak', rank: 1 },
    { type: 'suited', suit: 'dot', rank: 9 },
  ];
  const rack = [B(2), B(2), B(2), B(4), B(4), B(6), J, J, ...filler];
  const ranked = ranking(rack);

  it('says how much of the rack each hand uses and what it still needs, from the plan', () => {
    for (const plan of ranked) {
      const uses = usesSentence(plan, rack);
      const used = plan.units.reduce((n, u) => n + u.naturals + u.jokers, 0);
      expect(used).toBe(14 - plan.tilesAway);
      expect(uses.startsWith(`It uses ${used} of your 13 tiles.`)).toBe(true);
      // Every real tile is either used or named as a misfit; Jokers are never called misfits.
      const naturalsUsed = plan.units.reduce((n, u) => n + u.naturals, 0);
      expect(uses.includes('Pass: ')).toBe(naturalsUsed < rack.length - 2);
      expect(uses).not.toMatch(/Pass:[^.]*Joker/);
      expect(uses.includes('no place in it')).toBe(plan.units.reduce((n, u) => n + u.jokers, 0) < 2);

      // Jokers are named in what's still needed exactly when the set runs out of real copies.
      expect(jokersNamed(stillNeeded(plan, rack))).toBe(plan.mustBeJokers);
      const text = explainBest(plan, rack, 'Lead.');
      expect(text).toBe(`Lead.\n\n${uses}\n\nStill to get: ${stillNeeded(plan, rack)}. ${cautions(plan)[0]}`);
    }
  });

  it('warns when gaps are singles or pairs, and when the hand is concealed', () => {
    for (const plan of ranked) {
      const exact = plan.units.filter((u) => u.count < 3).reduce((n, u) => n + u.missing, 0);
      const notes = cautions(plan).join(' ');
      if (exact > 0) expect(notes).toMatch(/only the exact tile will do/);
      else expect(notes).toMatch(/any Joker you draw helps/);
      expect(notes.includes('concealed hand')).toBe(plan.hand.concealed);
      expect(notes.includes('A set holds only so many')).toBe(plan.mustBeJokers > 0);
    }
  });

  it('explains Jokers the set forces, counting them right, ahead of any other note', () => {
    // Quints need more copies than a set holds; collect such plans from the generated racks.
    const forced = questions.flatMap((q) => ranking(q.data.rack)).filter((p) => p.mustBeJokers > 0);
    const counts = new Set(forced.map((p) => p.mustBeJokers));
    expect(counts.has(1)).toBe(true);
    expect([...counts].some((n) => n > 1)).toBe(true);
    for (const plan of forced) {
      const n = plan.mustBeJokers;
      expect(cautions(plan)[0]).toBe(
        n === 1
          ? 'A set holds only so many of each tile, so the Joker on that list can’t be a real tile.'
          : `A set holds only so many of each tile, so the ${countWord(n)} Jokers on that list can’t be real tiles.`,
      );
    }
  });

  it('gives Flowers their own caption group, never under Honors, and keeps tiny groups off their own felt row', () => {
    for (const q of questions) {
      expect(q.scene.caption).not.toMatch(/Honors:[^;]*Flower/);
      const flowers = q.data.rack.filter((k) => k.type === 'flower').length;
      if (flowers > 0) expect(q.scene.caption).toContain(flowers === 1 ? 'one Flower' : `${countWord(flowers)} Flowers`);
      if (q.scene.groups!.length > 1) for (const g of q.scene.groups!) expect(g).toBeGreaterThan(2);
    }
    expect(feltGroups([2, 6, 5])).toEqual([8, 5]);
    expect(feltGroups([5, 6, 1, 1])).toEqual([5, 8]);
    expect(feltGroups([1, 1, 1, 10])).toEqual([3, 10]);
    expect(feltGroups([2])).toEqual([2]);
  });

  it('reads a known plan in plain words', () => {
    // 2468, hand 1 (FF 222 444 666 888): the 2 and 4 Bams and both Jokers fit, nothing else does.
    const plan = distance('evens-1', rack);
    expect(plan.tilesAway).toBe(7);
    expect(usesSentence(plan, rack)).toBe(
      'It uses 7 of your 13 tiles. Pass: a 6 Bam, a North, an East, a Red Dragon, a 1 Crak and a 9 Dot.',
    );
    expect(stillNeeded(plan, rack)).toMatch(/^two Flowers, /);
    expect(cautions(plan)[0]).toBe('Two of them fill singles or pairs, so only the exact tile will do: a Joker can’t help there.');
  });

  it('notices when a hand has no place for a Joker', () => {
    // Singles & Pairs hands take no Jokers at all.
    const plan = ranked.find((r) => r.hand.category === 'singles-pairs')!;
    expect(usesSentence(plan, rack)).toContain('Your Jokers have no place in it: it has no pung or bigger.');
  });
});
