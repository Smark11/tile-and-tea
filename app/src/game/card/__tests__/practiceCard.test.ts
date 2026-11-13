import { buildCard, CURRENT_CARD, handVariants, HandNotationError, isBuildable, jokersNeeded, type CategoryId, type Hand, type HandVariant } from '..';
import { PRACTICE_CARD_2027 } from '../practice-card-2027';
import type { Rank } from '../../tiles';

const card = CURRENT_CARD;
const variantsOf = new Map(card.hands.map((h) => [h.id, handVariants(h.groups)]));
const variants = (hand: Hand): HandVariant[] => variantsOf.get(hand.id) ?? [];
const inCategory = (id: CategoryId) => card.hands.filter((h) => h.category === id);

const ranksOf = (v: HandVariant): Rank[] => v.units.flatMap((u) => (u.kind.type === 'suited' ? Array(u.count).fill(u.kind.rank) : []));
const distinctRanks = (v: HandVariant) => [...new Set(ranksOf(v))].sort((a, b) => a - b);
const suitsOf = (v: HandVariant) => new Set(v.units.flatMap((u) => (u.kind.type === 'suited' ? [u.kind.suit] : [])));

describe('the 2027 practice card', () => {
  it('is the current card, for 2027', () => {
    expect(card.year).toBe(2027);
    expect(card.title).toBe('2027 Practice Card');
  });

  it('has the ten familiar categories, in order, with four hands each', () => {
    expect(card.sections.map((s) => s.id)).toEqual([
      'year',
      'evens',
      'like-numbers',
      'addition',
      'quints',
      'runs',
      'odds',
      'winds-dragons',
      'threes',
      'singles-pairs',
    ]);
    expect(card.sections.map((s) => s.hands.length)).toEqual(Array(10).fill(4));
    expect(card.hands).toHaveLength(40);
    expect(card.sections.every((s) => s.title.length > 0 && s.blurb.endsWith('.'))).toBe(true);
  });

  it('gives every hand a unique, stable id', () => {
    const ids = card.hands.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(id).toMatch(/^[a-z]+-[1-9]$/));
  });

  it('prints every hand as 14 characters', () => {
    for (const hand of card.hands) {
      expect(hand.line.segments.map((s) => s.text).join('')).toHaveLength(14);
    }
  });

  it('can build every way of playing every hand from one 152-tile set', () => {
    for (const hand of card.hands) {
      const vs = variants(hand);
      expect(vs.length).toBeGreaterThan(0);
      for (const v of vs) {
        expect(v.units.reduce((n, u) => n + u.count, 0)).toBe(14);
        if (!isBuildable(v.units)) throw new Error(`${hand.id} can't be built as ${v.key}`);
      }
    }
  });

  it('never has two hands that can be played with the same tiles', () => {
    const owner = new Map<string, string>();
    for (const hand of card.hands) {
      for (const v of variants(hand)) {
        const other = owner.get(v.key);
        if (other && other !== hand.id) throw new Error(`${hand.id} and ${other} share ${v.key}`);
        owner.set(v.key, hand.id);
      }
    }
  });

  it('pays sensible values: multiples of 5, more for concealed hands', () => {
    for (const hand of card.hands) {
      expect(hand.value % 5).toBe(0);
      expect(hand.value).toBeGreaterThanOrEqual(25);
      expect(hand.value).toBeLessThanOrEqual(50);
    }
    const concealed = card.hands.filter((h) => h.concealed).map((h) => h.value);
    const exposed = card.hands.filter((h) => !h.concealed).map((h) => h.value);
    expect(Math.min(...concealed)).toBeGreaterThan(Math.max(...exposed));
  });

  it('marks a hand with no group of 3 or more concealed, since nothing in it can be exposed', () => {
    for (const hand of card.hands) {
      const hasSet = hand.groups.some((g) => g.units.some((u) => u.count >= 3));
      if (!hasSet) expect(hand.concealed).toBe(true);
    }
  });

  it('reads every line aloud with its note, term and value', () => {
    for (const hand of card.hands) {
      const { spoken } = hand.line;
      if (hand.note) expect(spoken).toContain(`${hand.note}.`);
      expect(spoken).toMatch(hand.concealed ? new RegExp(`Concealed, worth ${hand.value}\\.$`) : new RegExp(`Exposed hand allowed, worth ${hand.value}\\.$`));
      expect(spoken).not.toMatch(/undefined|NaN/);
    }
  });

  it('says when a hand lets the player choose a number', () => {
    for (const hand of card.hands) {
      const chooses = hand.groups.some((g) => g.units.some((u) => u.tile.type === 'numberVar'));
      if (chooses) expect(hand.note).toMatch(/Any (like number|\d consecutive numbers)/);
    }
  });

  it('makes no claim to be, or to come from, an official card', () => {
    const text = JSON.stringify(PRACTICE_CARD_2027);
    expect(text).not.toMatch(/NMJL|National Mah Jongg League|official/i);
  });
});

describe('each category keeps its promise', () => {
  it('2027: only the digits of the year, 2s and 7s with the Soap as 0', () => {
    for (const hand of inCategory('year')) {
      for (const v of variants(hand)) {
        expect(distinctRanks(v)).toEqual([2, 7]);
        expect(v.units.some((u) => u.kind.type === 'dragon' && u.kind.dragon === 'white')).toBe(true);
      }
    }
  });

  it('2468: even numbers only', () => {
    for (const hand of inCategory('evens')) {
      for (const v of variants(hand)) expect(ranksOf(v).every((r) => r % 2 === 0)).toBe(true);
    }
  });

  it('13579: odd numbers only', () => {
    for (const hand of inCategory('odds')) {
      for (const v of variants(hand)) expect(ranksOf(v).every((r) => r % 2 === 1)).toBe(true);
    }
  });

  it('369: only 3s, 6s and 9s', () => {
    for (const hand of inCategory('threes')) {
      for (const v of variants(hand)) expect(ranksOf(v).every((r) => r % 3 === 0)).toBe(true);
    }
  });

  it('Like Numbers: one number across at least two suits', () => {
    for (const hand of inCategory('like-numbers')) {
      for (const v of variants(hand)) {
        expect(distinctRanks(v)).toHaveLength(1);
        expect(suitsOf(v).size).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('Consecutive Run: the numbers form an unbroken run', () => {
    for (const hand of inCategory('runs')) {
      for (const v of variants(hand)) {
        const ranks = distinctRanks(v);
        expect(ranks.length).toBeGreaterThanOrEqual(2);
        expect(ranks[ranks.length - 1] - ranks[0]).toBe(ranks.length - 1);
      }
    }
  });

  it('Quints: every hand has a quint, and suited quints need a Joker', () => {
    for (const hand of inCategory('quints')) {
      for (const v of variants(hand)) {
        expect(v.units.some((u) => u.count === 5)).toBe(true);
        const suitedQuints = v.units.filter((u) => u.count === 5 && u.kind.type !== 'flower').length;
        expect(jokersNeeded(v.units)).toBeGreaterThanOrEqual(suitedQuints);
      }
    }
  });

  it('Winds & Dragons: no numbers at all', () => {
    for (const hand of inCategory('winds-dragons')) {
      for (const v of variants(hand)) expect(ranksOf(v)).toEqual([]);
    }
  });

  it('Singles & Pairs: nothing bigger than a pair, so no Jokers, and always concealed', () => {
    for (const hand of inCategory('singles-pairs')) {
      expect(hand.concealed).toBe(true);
      for (const v of variants(hand)) {
        expect(v.units.every((u) => u.count <= 2)).toBe(true);
        expect(jokersNeeded(v.units)).toBe(0);
      }
    }
  });

  it('Addition: the note is a true sum, and the tiles spell it out in order', () => {
    for (const hand of inCategory('addition')) {
      const match = /^(\d+) \+ (\d+) = (\d+)/.exec(hand.note ?? '');
      expect(match).not.toBeNull();
      const [, a, b, c] = match as RegExpExecArray;
      expect(Number(a) + Number(b)).toBe(Number(c));
      for (const v of variants(hand)) {
        const spelled = v.units.filter((u) => u.kind.type === 'suited').map((u) => (u.kind.type === 'suited' ? u.kind.rank : 0));
        expect(spelled.join('')).toBe(`${a}${b}${c}`);
      }
    }
  });
});

describe('buildCard', () => {
  it('stops a card with a miswritten hand from loading', () => {
    const broken = {
      ...PRACTICE_CARD_2027,
      categories: [{ ...PRACTICE_CARD_2027.categories[0], hands: [{ id: 'year-1', notation: '222:a 0000 222:b', concealed: false, value: 25 }] }],
    };
    expect(() => buildCard(broken)).toThrow(HandNotationError);
  });
});
