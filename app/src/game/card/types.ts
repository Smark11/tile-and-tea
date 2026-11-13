// Types for a practice card: hands written in our notation (./notation.ts),
// grouped into the familiar categories, each with a value and an X/C term.
// Every card we ship is our own; see docs/BUSINESS.md §4.

import type { Rank, TileKind } from '../tiles';

// ---- How a hand is printed -------------------------------------------------

/** Which of a card line's three suit colors a segment is printed in. */
export type CardInk = 1 | 2 | 3;

/** One group on a card line, e.g. "444" printed in the second suit color. */
export type CardSegment = {
  readonly text: string;
  /** Suit color. Leave it off for tiles with no suit (Flowers, Winds, Soap as 0). */
  readonly ink?: CardInk;
};

/**
 * One hand written the way a card prints it. Lessons use these to teach card
 * reading, and the practice card prints every hand this way.
 */
export type CardLine = {
  readonly segments: readonly CardSegment[];
  /** The fine print beside the line, e.g. "Any like number". */
  readonly note?: string;
  /** C: must stay concealed. Otherwise X: exposures allowed. */
  readonly concealed: boolean;
  /** What the hand pays. */
  readonly value: number;
  /** The line said aloud, since colors and spacing can't be heard. */
  readonly spoken: string;
};

// ---- What a hand means -----------------------------------------------------

/**
 * A suit variable. `a`, `b` and `c` are always three *different* suits, and the
 * player chooses which is which, so a hand that uses `a` and `b` can be played
 * in any two suits.
 */
export type SuitVar = 'a' | 'b' | 'c';

export const SUIT_VARS: readonly SuitVar[] = ['a', 'b', 'c'];

/** Suit variables print in the card's three inks, in order. */
export const SUIT_VAR_INK: Record<SuitVar, CardInk> = { a: 1, b: 2, c: 3 };

/** One kind of tile a hand asks for, before the player picks suits and numbers. */
export type TileSpec =
  /** A fixed number in a chosen suit: the 4 in "444". */
  | { readonly type: 'number'; readonly suit: SuitVar; readonly rank: Rank }
  /**
   * A chosen number plus an offset: in "Any 3 consecutive numbers" the run is
   * n, n+1, n+2, and "Any like number" is n everywhere.
   */
  | { readonly type: 'numberVar'; readonly suit: SuitVar; readonly offset: number }
  /** A suit's own Dragon: Green with Bams, Red with Craks, Soap with Dots. */
  | { readonly type: 'dragonOf'; readonly suit: SuitVar }
  /** A tile with no choice in it: a Flower, a Wind, or the Soap as 0. */
  | { readonly type: 'fixed'; readonly kind: TileKind };

/** `count` of one tile: 1 single, 2 pair, 3 pung, 4 kong, 5 quint. */
export type HandUnit = { readonly tile: TileSpec; readonly count: number };

/**
 * One printed group, such as "444" or "2027". Most groups are one unit; a run
 * of singles like "2027" or "NEWS" is several units printed together.
 */
export type HandGroup = {
  /** The notation as written, e.g. "xxx+1:b". */
  readonly source: string;
  readonly suit?: SuitVar;
  readonly units: readonly HandUnit[];
};

export type CategoryId =
  | 'year'
  | 'evens'
  | 'like-numbers'
  | 'addition'
  | 'quints'
  | 'runs'
  | 'odds'
  | 'winds-dragons'
  | 'threes'
  | 'singles-pairs';

/** A hand as the card file writes it. */
export type HandDef = {
  /** Stable within the card: it will key drills, saved games and stats. */
  readonly id: string;
  /** The hand in our notation; see ./notation.ts. */
  readonly notation: string;
  /** Fine print, e.g. "Any 3 consecutive numbers". Say every choice the player has. */
  readonly note?: string;
  readonly concealed: boolean;
  readonly value: number;
};

export type CategoryDef = {
  readonly id: CategoryId;
  readonly title: string;
  /** One sentence on what ties the section together. */
  readonly blurb: string;
  readonly hands: readonly HandDef[];
};

export type CardDef = {
  /** The year printed on the card; year hands use its digits. */
  readonly year: number;
  readonly title: string;
  readonly categories: readonly CategoryDef[];
};

/** A parsed hand, ready to print and to match. */
export type Hand = HandDef & {
  readonly category: CategoryId;
  readonly groups: readonly HandGroup[];
  readonly line: CardLine;
};

export type CardSection = {
  readonly id: CategoryId;
  readonly title: string;
  readonly blurb: string;
  readonly hands: readonly Hand[];
};

export type PracticeCard = {
  readonly year: number;
  readonly title: string;
  readonly sections: readonly CardSection[];
  /** Every hand, in card order. */
  readonly hands: readonly Hand[];
};
