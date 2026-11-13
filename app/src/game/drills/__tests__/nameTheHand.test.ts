import { CURRENT_CARD, findMahJongg, MIN_JOKER_GROUP } from '../../card';
import { copiesOf, tileKey, type TileKind } from '../../tiles';
import { dealRound, nameTheHand } from '..';
import { evaluateNameTheHand, explainMatch, explainMiss, generateNameTheHand, handLabel } from '../content/nameTheHand';

const SEEDS = Array.from({ length: 600 }, (_, i) => i * 7919 + 13);
const questions = SEEDS.map((seed) => generateNameTheHand(seed));
const hand = (id: string) => CURRENT_CARD.hands.find((h) => h.id === id)!;

/** Splits the felt tiles into their printed groups. */
function groupsOf(tiles: readonly TileKind[], sizes: readonly number[]): TileKind[][] {
  let at = 0;
  return sizes.map((n) => tiles.slice(at, (at += n)));
}

describe('generateNameTheHand', () => {
  it('is deterministic in the seed', () => {
    expect(generateNameTheHand(1234)).toEqual(generateNameTheHand(1234));
    expect(nameTheHand.generate(99)).toEqual(generateNameTheHand(99));
  });

  it('deals every hand on the card over enough seeds', () => {
    const answers = new Set(questions.map((q) => q.data.handIds[q.data.answer]));
    expect(answers.size).toBe(CURRENT_CARD.hands.length);
  });

  it.each(questions.map((q) => [q.seed, q] as const))('seed %i is a fair question', (_seed, q) => {
    const { tiles, handIds, answer } = q.data;
    expect(tiles).toHaveLength(14);
    expect(q.scene.tiles).toBe(tiles);
    expect(q.picks).toBe(1);
    expect(q.choices).toHaveLength(3);
    expect(new Set(handIds).size).toBe(3);

    // No tile is used more often than a set holds.
    const counts = new Map<string, number>();
    for (const t of tiles) counts.set(tileKey(t), (counts.get(tileKey(t)) ?? 0) + 1);
    for (const t of tiles) expect(counts.get(tileKey(t))).toBeLessThanOrEqual(copiesOf(t));

    // The answer is made by these tiles, and no other choice is.
    const made = new Set(findMahJongg({ concealed: tiles }, CURRENT_CARD).map((m) => m.hand.id));
    expect(made.has(handIds[answer])).toBe(true);
    handIds.forEach((id, i) => expect(made.has(id)).toBe(i === answer));

    // Each choice shows its own hand's line.
    q.choices.forEach((c, i) => {
      expect(c).toEqual({ kind: 'line', line: hand(handIds[i]).line, label: handLabel(hand(handIds[i])) });
    });

    // Tiles sit in the hand's printed groups. Jokers only in groups of 3+, and every group keeps a real tile.
    const answerHand = hand(handIds[answer]);
    expect(q.scene.groups).toHaveLength(answerHand.groups.length);
    expect(q.scene.groups!.reduce((a, b) => a + b, 0)).toBe(14);
    for (const group of groupsOf(tiles, q.scene.groups!)) {
      const jokers = group.filter((t) => t.type === 'joker').length;
      if (jokers > 0) {
        expect(group.length).toBeGreaterThanOrEqual(MIN_JOKER_GROUP);
        expect(jokers).toBeLessThan(group.length);
      }
    }
    expect(q.key.startsWith(`${handIds[answer]}|`)).toBe(true);
    expect(q.scene.caption.length).toBeGreaterThan(0);
  });

  it('picks look-alike distractors: from the same section whenever it has a hand to offer', () => {
    let sameSection = 0;
    for (const q of questions) {
      const answer = hand(q.data.handIds[q.data.answer]);
      if (q.data.handIds.some((id, i) => i !== q.data.answer && hand(id).category === answer.category)) sameSection++;
    }
    expect(sameSection / questions.length).toBeGreaterThan(0.9);
  });

  it('puts the answer in every position over a round of seeds', () => {
    expect(new Set(questions.map((q) => q.data.answer))).toEqual(new Set([0, 1, 2]));
  });

  it('deals a round of five different hands', () => {
    for (let seed = 0; seed < 20; seed++) {
      const round = dealRound(nameTheHand, seed);
      expect(round).toHaveLength(5);
      expect(new Set(round.map((q) => q.key)).size).toBe(5);
    }
  });
});

describe('evaluateNameTheHand', () => {
  it('calls the matching line the best answer and every other line a miss', () => {
    for (const q of questions.slice(0, 120)) {
      q.choices.forEach((_, i) => {
        const result = evaluateNameTheHand(q, [i]);
        expect(result.best).toEqual([q.data.answer]);
        expect(result.verdict).toBe(i === q.data.answer ? 'best' : 'miss');
        expect(result.score).toBe(i === q.data.answer ? 1 : 0);
        expect(result.explanation).toContain(handLabel(hand(q.data.handIds[q.data.answer])));
        if (i !== q.data.answer) expect(result.explanation).toContain(handLabel(hand(q.data.handIds[i])));
        expect(`${result.title} ${result.explanation}`).not.toMatch(/wrong|incorrect/i);
      });
    }
  });

  it('refuses a pick that is not exactly one choice', () => {
    const q = questions[0];
    for (const picked of [[], [0, 1], [-1], [3], [0.5]]) {
      expect(() => evaluateNameTheHand(q, picked)).toThrow(RangeError);
    }
  });
});

describe('explanations', () => {
  const B = (rank: number): TileKind => ({ type: 'suited', suit: 'bam', rank: rank as 1 });
  const C = (rank: number): TileKind => ({ type: 'suited', suit: 'crak', rank: rank as 1 });
  const D = (rank: number): TileKind => ({ type: 'suited', suit: 'dot', rank: rank as 1 });
  const J: TileKind = { type: 'joker' };
  const F: TileKind = { type: 'flower' };
  const n = <T,>(count: number, t: T): T[] => Array.from({ length: count }, () => t);

  it('names the suits, the shifted numbers, and where the Jokers stand in', () => {
    const evens1 = [...n(2, F), ...n(3, B(2)), ...n(2, B(4)), J, ...n(3, D(6)), ...n(3, D(8))];
    expect(explainMatch(hand('evens-1'), evens1)).toBe(
      'These tiles make 2468, hand 1: the first suit is Bams and the second suit is Dots. ' +
        'The Joker stands in for real tiles: one in the pung of 4 Bams. A Joker can fill a pung, kong or quint, never a single or a pair.',
    );
  });

  it('ties Dragons to their suits, or says they were chosen freely', () => {
    const R: TileKind = { type: 'dragon', dragon: 'red' };
    const G: TileKind = { type: 'dragon', dragon: 'green' };
    const S: TileKind = { type: 'dragon', dragon: 'white' };
    const N: TileKind = { type: 'wind', wind: 'N' };
    const So: TileKind = { type: 'wind', wind: 'S' };
    // evens-3: 4444 DDD 8888 DDD, each Dragon with its suit.
    const evens3 = [...n(4, C(4)), ...n(3, R), ...n(4, D(8)), ...n(2, S), J];
    expect(explainMatch(hand('evens-3'), evens3)).toBe(
      'These tiles make 2468, hand 3: the first suit is Craks and the second suit is Dots. ' +
        'Each Dragon goes with its own suit: Red Dragons with Craks and Soaps with Dots. ' +
        'The Joker stands in for real tiles: one in the pung of Soaps. A Joker can fill a pung, kong or quint, never a single or a pair.',
    );
    // pairs-2: 11 33 55 77 99 in one suit, then the Dragons of the other two suits.
    const pairs2 = [...[1, 3, 5, 7, 9].flatMap((r) => n(2, B(r))), ...n(2, R), ...n(2, S)];
    expect(explainMatch(hand('pairs-2'), pairs2)).toBe(
      'These tiles make Singles & Pairs, hand 2: its suit is Bams. ' +
        'The Dragons belong to the suits the numbers don’t use: Red Dragons with Craks and Soaps with Dots.',
    );
    // honors-2: NNN SSS DDDD DDDD, any two Dragons.
    const honors2 = [...n(3, N), ...n(3, So), ...n(4, G), ...n(4, R)];
    expect(explainMatch(hand('honors-2'), honors2)).toBe(
      'These tiles make Winds & Dragons, hand 2. With no numbers to match, the Dragons are yours to choose: here, Green Dragons and Red Dragons.',
    );
  });

  it('says how far a missed line is, and what it is short of', () => {
    const evens1 = [...n(2, F), ...n(3, C(2)), ...n(3, C(4)), ...n(3, D(6)), ...n(3, D(8))];
    expect(explainMiss(hand('evens-2'), evens1)).toMatch(
      /^Even at its closest, 2468, hand 2 is \d+ tiles away from these tiles: it’s short of the [^.]+\.$/,
    );
  });
});
