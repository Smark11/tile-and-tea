import {
  handVariants,
  HandNotationError,
  isBuildable,
  jokersNeeded,
  parseHand,
  parseNotation,
  printSegment,
  speakHand,
  type ConcreteUnit,
} from '..';
import { tileKey, type TileKind } from '../../tiles';

const bam = (rank: number): TileKind => ({ type: 'suited', suit: 'bam', rank: rank as 1 });
const unitKeys = (units: readonly ConcreteUnit[]) => units.map((u) => `${tileKey(u.kind)}*${u.count}`);

describe('parseNotation', () => {
  it('reads each run of one character as a unit, with its suit', () => {
    const groups = parseNotation('FF 222:a 444:a 666:b 888:b');
    expect(groups.map((g) => g.source)).toEqual(['FF', '222:a', '444:a', '666:b', '888:b']);
    expect(groups[0]).toEqual({ source: 'FF', suit: undefined, units: [{ tile: { type: 'fixed', kind: { type: 'flower' } }, count: 2 }] });
    expect(groups[3].units).toEqual([{ tile: { type: 'number', suit: 'b', rank: 6 }, count: 3 }]);
  });

  it('splits a run of singles like the year into units, with the Soap as 0', () => {
    const [year] = parseNotation('2027:a 2027:b 2027:c FF');
    expect(year.units).toEqual([
      { tile: { type: 'number', suit: 'a', rank: 2 }, count: 1 },
      { tile: { type: 'fixed', kind: { type: 'dragon', dragon: 'white' } }, count: 1 },
      { tile: { type: 'number', suit: 'a', rank: 2 }, count: 1 },
      { tile: { type: 'number', suit: 'a', rank: 7 }, count: 1 },
    ]);
  });

  it('reads winds, suit Dragons and chosen numbers with offsets', () => {
    const groups = parseNotation('NEWS xxx:a DDD:a xxxx+2:b');
    expect(groups[0].units.map((u) => u.tile)).toEqual(
      (['N', 'E', 'W', 'S'] as const).map((wind) => ({ type: 'fixed', kind: { type: 'wind', wind } })),
    );
    expect(groups[1].units).toEqual([{ tile: { type: 'numberVar', suit: 'a', offset: 0 }, count: 3 }]);
    expect(groups[2].units).toEqual([{ tile: { type: 'dragonOf', suit: 'a' }, count: 3 }]);
    expect(groups[3].units).toEqual([{ tile: { type: 'numberVar', suit: 'b', offset: 2 }, count: 4 }]);
  });

  it.each([
    ['FF 222 444:a 666:b 888:b', 'needs a suit'],
    ['FF:a 222:a 444:a 666:b 888:b', 'no suited tile'],
    ['NNNN:b EEEE SSSS WW', 'no suited tile'],
    ['FF 222+1:a 444:a 666:b 888:b', 'needs an x'],
    ['FF x2x:a 444:a 666:b 8888:b', 'mix x'],
    ['FF 222:a 444:a 666:b 88:b', '13 tiles'],
    ['FF 222:a 444:a 666:b 8888:b', '15 tiles'],
    ['FF  222:a 444:a 666:b 888:b', 'single spaces'],
    [' FF 222:a 444:a 666:b 888:b', 'single spaces'],
    ['', 'single spaces'],
    ['FF 222:b 444:b 666:c 888:c', 'used before :a'],
    ['FF 222:a 444:a 666:c 888:c', 'used before :b'],
    ['FF xxxx+1:a xxxx+2:b xxxx+3:c', 'use x itself'],
    ['FFFFFF 2222:a 4444:a', 'bigger than a quint'],
    ['FF 222:a 444:a 666:b 888:B', "Can't read"],
    ['JJ 222:a 444:a 666:b 888:b', "Can't read"],
    ['FF 222:a 444:a 666:b 888:b+1', "Can't read"],
  ])('rejects %j (%s)', (notation, problem) => {
    expect(() => parseNotation(notation)).toThrow(HandNotationError);
    expect(() => parseNotation(notation)).toThrow(problem);
  });
});

describe('printing', () => {
  it('prints each group in its suit ink, with x shown as 1', () => {
    const groups = parseNotation('FF xxxx:a xxxx+1:b xxxx+2:c');
    expect(groups.map(printSegment)).toEqual([
      { text: 'FF' },
      { text: '1111', ink: 1 },
      { text: '2222', ink: 2 },
      { text: '3333', ink: 3 },
    ]);
  });

  it('prints suit Dragons as D and the Soap as 0', () => {
    expect(parseNotation('222:a 0000 DDD:a 7777:b').map(printSegment)).toEqual([
      { text: '222', ink: 1 },
      { text: '0000' },
      { text: 'DDD', ink: 1 },
      { text: '7777', ink: 2 },
    ]);
  });

  it('builds a card line from a hand definition', () => {
    const hand = parseHand({ id: 'h', notation: 'FFFF 2027:a 222:b 777:b', note: 'Any 2 suits', concealed: false, value: 25 }, 'year');
    expect(hand.category).toBe('year');
    expect(hand.line.segments.map((s) => s.text).join('')).toHaveLength(14);
    expect(hand.line).toMatchObject({ note: 'Any 2 suits', concealed: false, value: 25 });
    expect(parseHand({ id: 'h', notation: 'NNN EEEE WWWW SSS', concealed: false, value: 25 }, 'winds-dragons').line).not.toHaveProperty('note');
  });
});

describe('speakHand', () => {
  const say = (notation: string, note?: string, concealed = false, value = 25) =>
    speakHand(parseNotation(notation), { note, concealed, value });

  it('names each group and the suit it sits in', () => {
    expect(say('FF 222:a 444:a 666:b 888:b', 'Any 2 suits')).toBe(
      'Pair of Flowers. Pung of 2s in the first suit. Pung of 4s in the first suit. Pung of 6s in the second suit. Pung of 8s in the second suit. Any 2 suits. Exposed hand allowed, worth 25.',
    );
  });

  it('reads runs of singles tile by tile, with the Soap by name', () => {
    expect(say('FF 2027:a 2027:b 2027:c', undefined, true, 50)).toBe(
      'Pair of Flowers. 2, Soap, 2, 7 in the first suit. 2, Soap, 2, 7 in the second suit. 2, Soap, 2, 7 in the third suit. Concealed, worth 50.',
    );
    expect(say('NEWS xxx:a xxx:b xxxx:c', 'Any like number')).toMatch(/^North, East, West, South\. Pung of 1s in the first suit\./);
  });

  it('says "all numbers in one suit" instead of repeating it, and names the matching Dragon', () => {
    expect(say('222:a 666:a 8888:a DDDD:a', '2 + 6 = 8', false, 30)).toBe(
      'Pung of 2s. Pung of 6s. Kong of 8s. Kong of the matching Dragon. All numbers in one suit. 2 + 6 = 8. Exposed hand allowed, worth 30.',
    );
  });

  it('ties a Dragon to its suit when the suit has numbers', () => {
    expect(say('2468:a 2222:b 4444:b DD:b')).toContain('Pair of the second suit’s Dragon.');
  });

  it('counts Dragons whose suit has no numbers as different Dragons', () => {
    expect(say('NNN SSS DDDD:a DDDD:b', 'Any 2 Dragons')).toBe(
      'Pung of North. Pung of South. Kong of one Dragon. Kong of a second Dragon. Any 2 Dragons. Exposed hand allowed, worth 25.',
    );
    expect(say('xxxx:a DDD:b xxxx+1:a DDD:c')).toBe(
      'Kong of 1s. Pung of one Dragon. Kong of 2s. Pung of a second Dragon. All numbers in one suit. Exposed hand allowed, worth 25.',
    );
  });

  it('says quints and Soaps', () => {
    expect(say('22222:a 0000 77777:b')).toBe(
      'Quint of 2s in the first suit. Kong of Soaps. Quint of 7s in the second suit. Exposed hand allowed, worth 25.',
    );
  });
});

describe('handVariants', () => {
  it('plays a two-suit hand in all 6 ordered pairs of suits', () => {
    const variants = handVariants(parseNotation('FF 222:a 444:a 666:b 888:b'));
    expect(variants).toHaveLength(6);
    expect(variants[0].suits).toEqual({ a: 'bam', b: 'crak' });
    expect(unitKeys(variants[0].units)).toEqual(['flower*2', 'bam-2*3', 'bam-4*3', 'crak-6*3', 'crak-8*3']);
  });

  it('collapses suit swaps that give the same tiles', () => {
    // Every suit plays the same part, so only the number matters.
    expect(handVariants(parseNotation('FF xxxx:a xxxx:b xxxx:c'))).toHaveLength(9);
    // Two kongs of different Dragons: Red+Green, Red+Soap, Green+Soap.
    const dragons = handVariants(parseNotation('NNN SSS DDDD:a DDDD:b'));
    expect(dragons.map((v) => v.key)).toEqual([
      'dragon-green*4 dragon-red*4 wind-N*3 wind-S*3',
      'dragon-green*4 dragon-white*4 wind-N*3 wind-S*3',
      'dragon-red*4 dragon-white*4 wind-N*3 wind-S*3',
    ]);
  });

  it('runs x only as far as the highest offset allows', () => {
    const runs = handVariants(parseNotation('xxx:a xxxx+1:a xxx+2:a xxxx+3:a'));
    expect(runs).toHaveLength(6 * 3);
    expect(new Set(runs.map((v) => v.x))).toEqual(new Set([1, 2, 3, 4, 5, 6]));
    const top = runs.find((v) => v.x === 6 && v.suits.a === 'dot');
    expect(top && unitKeys(top.units)).toEqual(['dot-6*3', 'dot-7*4', 'dot-8*3', 'dot-9*4']);
  });

  it('gives each suit its own Dragon partner', () => {
    const variants = handVariants(parseNotation('4444:a DDD:a 8888:b DDD:b'));
    const bamCrak = variants.find((v) => v.suits.a === 'bam' && v.suits.b === 'crak');
    expect(bamCrak && unitKeys(bamCrak.units)).toEqual(['bam-4*4', 'dragon-green*3', 'crak-8*4', 'dragon-red*3']);
    const dot = variants.find((v) => v.suits.a === 'dot');
    expect(dot && unitKeys(dot.units)).toContain('dragon-white*3');
  });

  it('has exactly one variant for a hand with no choices', () => {
    const [only] = handVariants(parseNotation('NNN EEEE WWWW SSS'));
    expect(handVariants(parseNotation('NNN EEEE WWWW SSS'))).toHaveLength(1);
    expect(only).toMatchObject({ suits: {}, x: null });
  });
});

describe('jokersNeeded', () => {
  const units = (...list: [TileKind, number][]) => list.map(([kind, count]) => ({ kind, count }));

  it('needs none when real tiles cover every group', () => {
    expect(jokersNeeded(units([bam(2), 4], [bam(3), 4], [{ type: 'flower' }, 5]))).toBe(0);
  });

  it('needs one Joker per tile a quint has beyond the 4 in the set', () => {
    expect(jokersNeeded(units([bam(5), 5], [{ type: 'flower' }, 4], [bam(6), 5]))).toBe(2);
  });

  it('counts a pair and a pung of the same tile together', () => {
    // 2 + 3 = 5 five-Bams: 4 real tiles (the pair must be real), 1 Joker.
    expect(jokersNeeded(units([bam(5), 2], [bam(5), 3]))).toBe(1);
  });

  it('refuses singles and pairs that need more real tiles than exist', () => {
    expect(jokersNeeded(units([bam(5), 2], [bam(5), 2], [bam(5), 1]))).toBeNull();
    expect(isBuildable(units([bam(5), 2], [bam(5), 2], [bam(5), 1]))).toBe(false);
  });

  it('allows at most the 8 Jokers in a set', () => {
    const quints = (n: number) => Array.from({ length: n }, (_, i): [TileKind, number] => [bam(i + 1), 5]);
    expect(isBuildable(units(...quints(8)))).toBe(true);
    expect(isBuildable(units(...quints(9)))).toBe(false);
  });
});
