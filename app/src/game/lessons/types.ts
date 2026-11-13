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

/** Explanation with a row of tiles laid out on felt. */
export type TilesStep = {
  readonly kind: 'tiles';
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly tiles: readonly TileKind[];
  /**
   * Shown under the tiles and read aloud in place of their names, which would
   * be a long list of noise. Say what the row shows: "2 Bam, 5 Crak, 8 Dot".
   */
  readonly caption: string;
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
