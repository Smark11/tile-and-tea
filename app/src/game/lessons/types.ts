// The lesson format. A lesson is plain data: an ordered list of steps that the
// lesson player shows one at a time. Content lives in ./content/, one file per
// lesson, and validateLesson (./validate.ts) checks every lesson in a test, so
// a typo in a question can't ship.

import type { TileKind } from '../tiles';

/** A page of explanation. Blank lines in `body` split it into paragraphs. */
export type TextStep = {
  readonly kind: 'text';
  readonly id: string;
  readonly title: string;
  readonly body: string;
};

/** Which of a card line's three suit colors a segment is printed in. */
export type CardInk = 1 | 2 | 3;

/** One group on a card line, e.g. "444" printed in the second suit color. */
export type CardSegment = {
  readonly text: string;
  /** Suit color. Leave it off for tiles with no suit (Flowers, Winds). */
  readonly ink?: CardInk;
};

/**
 * One hand written the way a card prints it. Lessons use these to teach card
 * reading. The hands are our own, never taken from any published card.
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

/**
 * Tiles laid out on felt. `groups` splits them into sets that sit together,
 * like a pung and a pair on a rack; the sizes must add up to the tile count.
 */
export type TileDisplay = {
  readonly tiles: readonly TileKind[];
  readonly groups?: readonly number[];
  /**
   * Shown under the tiles and read aloud in place of their names, which would
   * be a long list of noise. Say what the row shows: "2 Bam, 5 Crak, 8 Dot".
   */
  readonly caption: string;
};

/** Explanation with tiles laid out on felt, and optionally a card line above them. */
export type TilesStep = TileDisplay & {
  readonly kind: 'tiles';
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly card?: CardLine;
};

export type TapChoice = {
  readonly tile: TileKind;
  /** This tile is (one of) the answer. */
  readonly correct?: true;
};

/**
 * "Tap the X": the player picks tiles from a row. With one correct tile a tap
 * answers at once; with several, the player taps them all, then Check.
 */
export type TapStep = {
  readonly kind: 'tap';
  readonly id: string;
  /** The question, e.g. "Tap the Dot." Say "every" when there are several. */
  readonly prompt: string;
  /** A card line the question is about, shown above the tiles. */
  readonly card?: CardLine;
  /** Tiles the question is about (a rack, an exposure), shown above the choices. */
  readonly given?: TileDisplay;
  readonly choices: readonly TapChoice[];
  /** A nudge after a wrong try. Point at the idea, don't give the answer away. */
  readonly hint: string;
  /** Why the answer is right, shown once it's found (or revealed). */
  readonly explanation: string;
};

export type LessonStep = TextStep | TilesStep | TapStep;

export type Lesson = {
  /** URL-safe and stable: it keys saved progress and analytics. */
  readonly id: string;
  readonly title: string;
  /** One line for lists. */
  readonly summary: string;
  /** Rough length, shown to the player. */
  readonly minutes: number;
  readonly steps: readonly LessonStep[];
};
