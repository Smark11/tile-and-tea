// Paying for a Mah Jongg (standard American settlement):
//
// - Won on a discard: the discarder pays twice the hand's value, and the other
//   two players pay its value.
// - Self-drawn (picked from the wall): all three pay twice the value.
// - Jokerless: a hand made with no Jokers doubles every payment, so a
//   self-drawn jokerless hand pays four times. Hands that can't hold a Joker at
//   all (Singles & Pairs) don't get this bonus; their value already allows
//   for it.
//
// Dead hands pay like everyone else. A wall game pays nothing.

import { MIN_JOKER_GROUP, type Hand, type HandMatch } from '../card';
import { SEATS, type Seat } from './types';

/** Whether a hand has a group of 3+, where a Joker could have stood in. */
export function allowsJokers(hand: Hand): boolean {
  return hand.groups.some((g) => g.units.some((u) => u.count >= MIN_JOKER_GROUP));
}

export type Settlement = {
  readonly match: HandMatch;
  readonly jokerless: boolean;
  /** Net change for each seat, summing to zero. */
  readonly payments: number[];
};

/** What each loser pays the winner for one hand. */
function settle(match: HandMatch, winner: Seat, discarder: Seat | null): Settlement {
  const jokerless = match.jokers === 0 && allowsJokers(match.hand);
  const payments = SEATS.map(() => 0);
  for (const seat of SEATS) {
    if (seat === winner) continue;
    const doubled = discarder === null || seat === discarder;
    const owed = match.hand.value * (doubled ? 2 : 1) * (jokerless ? 2 : 1);
    payments[seat] -= owed;
    payments[winner] += owed;
  }
  return { match, jokerless, payments };
}

/**
 * The settlement for a winning player. Jokers can leave more than one hand
 * complete; the winner takes whichever pays them most (card order breaks ties).
 * `matches` must not be empty.
 */
export function bestSettlement(matches: readonly HandMatch[], winner: Seat, discarder: Seat | null): Settlement {
  let best = settle(matches[0], winner, discarder);
  for (const match of matches.slice(1)) {
    const s = settle(match, winner, discarder);
    if (s.payments[winner] > best.payments[winner]) best = s;
  }
  return best;
}
