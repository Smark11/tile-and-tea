import { CURRENT_CARD, variantsOf, type HandMatch } from '../../card';
import { allowsJokers, bestSettlement } from '../scoring';

/** A match on a card hand. Settlement only reads the hand and the Joker count. */
const match = (id: string, jokers: number): HandMatch => {
  const hand = CURRENT_CARD.hands.find((h) => h.id === id)!;
  return { hand, variant: variantsOf(hand)[0], units: [], jokers };
};

describe('bestSettlement', () => {
  it('scores the hand that pays the winner most', () => {
    const s = bestSettlement([match('like-1', 1), match('quints-1', 1)], 0, null);
    expect(s.match.hand.id).toBe('quints-1');
    expect(s.payments).toEqual([240, -80, -80, -80]);
  });

  it('counts the jokerless bonus when choosing: a jokerless 30 beats a Singles & Pairs 50', () => {
    const s = bestSettlement([match('pairs-2', 0), match('honors-3', 0)], 2, 1);
    expect(s.match.hand.id).toBe('honors-3');
    expect(s.jokerless).toBe(true);
    // Discarder (South) pays 30 × 2 × 2; East and North pay 30 × 2.
    expect(s.payments).toEqual([-60, -120, 240, -60]);
  });

  it('keeps card order on a tie', () => {
    const s = bestSettlement([match('pairs-2', 0), match('honors-1', 0)], 3, 0);
    expect(s.match.hand.id).toBe('pairs-2');
    expect(s.jokerless).toBe(false);
  });

  it('finds the hands with no group a Joker could fill: Singles & Pairs, and the 2027 year hand of singles', () => {
    const noJokers = CURRENT_CARD.hands.filter((h) => !allowsJokers(h)).map((h) => h.id);
    expect(noJokers).toEqual(['year-4', 'pairs-1', 'pairs-2', 'pairs-3', 'pairs-4']);
  });
});
