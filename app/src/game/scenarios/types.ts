// The scenario format. A scenario is one moment from a game, written by hand
// to teach one principle of winning play: the story of how the table got
// here, the decision the player faces, and then the strategy behind the
// strongest move, with a short checklist for the next time it comes up.
//
// The decision is judged by the same engine the drills use (game/drills), so
// the coach's verdict and its explanation come from tested hand distance,
// dead-tile and exposure-reading code, never from an author's say-so. A test
// (./__tests__/content.test.ts) checks that the move each scenario teaches is
// the move the engine calls best, so the strategy text can't drift from the
// coach.

import type { DiscardData } from '../drills/content/discards';
import type { SkillId } from '../drills/types';
import type { TileKind } from '../tiles';

/** Where in a game the scenario happens; the Train tab groups scenarios by stage. */
export type ScenarioStage = 'charleston' | 'hand-choice' | 'table';

export type StageInfo = {
  readonly id: ScenarioStage;
  readonly title: string;
  /** One sentence on what the stage's decisions have in common. */
  readonly blurb: string;
};

/** The table as the scenario finds it. Each kind is judged by the matching drill's evaluator. */
export type ScenarioSetup =
  /** A fresh 13-tile rack; the player picks three tiles to pass right. */
  | { readonly kind: 'charleston'; readonly rack: readonly TileKind[] }
  /** A 13-tile rack and the card lines to choose between. */
  | { readonly kind: 'best-hand'; readonly rack: readonly TileKind[]; readonly handIds: readonly string[] }
  /** Fourteen tiles after a draw, with the discards and exposures in view; the player picks a discard. */
  | { readonly kind: 'discard'; readonly data: DiscardData };

/** The move the scenario teaches: tiles to pass or throw, or the hand to aim for. */
export type ScenarioMove = { readonly tiles: readonly TileKind[] } | { readonly handId: string };

export type Strategy = {
  /** The principle, as a short memorable rule: "Count what's gone before you count what's close." */
  readonly principle: string;
  /** Why it wins. Blank lines split paragraphs. */
  readonly body: string;
  /** What to do when this comes up at a real table, in order. Three to four short steps. */
  readonly checklist: readonly string[];
};

export type Scenario = {
  /** URL-safe and stable: it keys the route (/scenario/<id>), saved progress and analytics. */
  readonly id: string;
  readonly title: string;
  /** One line for the list. */
  readonly summary: string;
  readonly stage: ScenarioStage;
  /** The skill the decision trains; answers feed its rating like a drill answer. */
  readonly skill: SkillId;
  /** A tile for the scenario's row. */
  readonly icon: TileKind;
  /** How the table got here, in the second person. Blank lines split paragraphs. */
  readonly story: string;
  /** The question, in place of the drill's generic one. */
  readonly prompt: string;
  readonly setup: ScenarioSetup;
  readonly move: ScenarioMove;
  readonly strategy: Strategy;
};
