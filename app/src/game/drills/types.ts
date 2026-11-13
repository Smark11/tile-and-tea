// The drill format. A drill is a generator plus an evaluator: from a seed it
// deals one question (a moment from a game, and the choices the player has),
// and given the player's pick it says how good that pick was and why. The
// round reducer (./session.ts) and the drill player UI work with any drill,
// so M3.2–M3.4 only write a generator and an evaluator.

import type { CardLine } from '../card/types';
import type { TileDisplay } from '../lessons/types';
import type { TileKind } from '../tiles';

/**
 * The skill a drill trains. Answers are reported under it (analytics
 * `drill_answered.skill`), and M3.5 keeps one rating per skill.
 */
export type SkillId = 'card-reading' | 'hand-choice' | 'charleston' | 'discards';

/** One thing the player can pick: a tile, or a line from the card. */
export type DrillChoice =
  | {
      readonly kind: 'tile';
      readonly tile: TileKind;
      /** Shown but can't be picked, and why (e.g. a Joker in a pass). */
      readonly locked?: string;
    }
  | {
      readonly kind: 'line';
      readonly line: CardLine;
      /** Where the line sits on the card, e.g. "Like Numbers #2". Read before the line itself. */
      readonly label: string;
    };

/** The other three players, from where the player sits. */
export type TableSeat = 'left' | 'across' | 'right';

/** What the rest of the table shows mid-game: the discards, and other players' exposures. */
export type DrillTable = {
  readonly discards: readonly TileKind[];
  readonly exposures: readonly { readonly seat: TableSeat; readonly groups: readonly (readonly TileKind[])[] }[];
  /** Read aloud in place of the tiles, as for a `TileDisplay`. */
  readonly caption: string;
};

/** What is laid out on the felt for the player to think about. */
export type DrillScene = TileDisplay & {
  /** A card line printed above the tiles, when the question is about one hand. */
  readonly card?: CardLine;
  /** The rest of the table, when the question is a moment mid-game. */
  readonly table?: DrillTable;
};

export type DrillQuestion<Data = unknown> = {
  /** The seed it was dealt from: dealing the same seed again gives the same question. */
  readonly seed: number;
  /**
   * Identifies the question's content, so a round never asks the same thing
   * twice even when two seeds happen to deal it.
   */
  readonly key: string;
  /** The question, e.g. "Which hand do these tiles make?" */
  readonly prompt: string;
  /** How to answer, under the prompt. Leave it out for the player's generic wording. */
  readonly instruction?: string;
  readonly scene: DrillScene;
  readonly choices: readonly DrillChoice[];
  /** Tile choices laid out in groups of these sizes (suit groups on a rack), in order. */
  readonly choiceGroups?: readonly number[];
  /** How many choices make an answer: 1 answers on tap; more need a Check. */
  readonly picks: number;
  /** What a tile answer is called in the answered key ("your pass", "your discard"). Defaults to "pass". */
  readonly pickNoun?: string;
  /** Whatever the evaluator needs. Plain JSON, so a round can be saved. */
  readonly data: Data;
};

/**
 * How good an answer was. Drills ask for judgment, so there can be more than
 * one sensible answer: `best` is the strongest play, `good` a defensible one
 * the coach would still nudge, `miss` one that costs the player.
 */
export type Verdict = 'best' | 'good' | 'miss';

export type DrillEvaluation = {
  readonly verdict: Verdict;
  /** 0–1, for ratings: 1 for the best answer. */
  readonly score: number;
  /** The choice indexes of the strongest answer, highlighted after answering. */
  readonly best: readonly number[];
  /** A short, warm headline. Never "Wrong". */
  readonly title: string;
  /** The coach's reasoning: why the best answer is best, and what the pick missed. */
  readonly explanation: string;
  /** The card line the explanation steers toward, shown with it. */
  readonly target?: { readonly label: string; readonly line: CardLine };
};

export type Drill<Data = unknown> = {
  /** Stable: it keys the route (/drill/<id>), saved progress and stats. */
  readonly id: string;
  readonly skill: SkillId;
  readonly title: string;
  /** One line for the Train tab. */
  readonly summary: string;
  /** A tile for the drill's row on the Train tab. */
  readonly icon: TileKind;
  readonly questionsPerRound: number;
  /**
   * How hard the drill's questions are, on the skill-rating scale
   * (./ratings.ts): a player rated at this level averages a half-right answer.
   */
  readonly level: number;
  /** Deals one question. Must be deterministic in `seed`. */
  readonly generate: (seed: number) => DrillQuestion<Data>;
  /** Judges a pick of exactly `question.picks` distinct choice indexes. */
  readonly evaluate: (question: DrillQuestion<Data>, picked: readonly number[]) => DrillEvaluation;
};

/** A drill with its data type erased, for catalogs and the player UI. */
export type AnyDrill = Drill<any>;
