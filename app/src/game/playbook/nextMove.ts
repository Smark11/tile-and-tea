// "Your next move": the one thing on the Train tab most worth doing next.
//
// It reads only what the app already saves (scenario verdicts and the M3.5
// skill ratings) and picks, in this order:
//   1. An unplayed scenario, from the lowest-rated skill. Scenarios teach a
//      principle the simulator or the engine stands behind, so a player sees
//      every one before practice takes over. Ties go to list order, which is
//      the curriculum's (Charleston, choosing a hand, the table).
//   2. Once every scenario is played: the lowest-rated skill. If the player's
//      last move in one of its scenarios wasn't the coach's best, replay that
//      (the playbook can't mark its principle mastered until it is).
//      Otherwise, a round of the skill's drill, which moves the rating.
// A skill never rated counts as the starting rating, the same number the
// first answer is measured from. Ratings compare by the whole number the
// meters show, so two skills that look level are level.

import { drillForSkill } from '../drills';
import { SKILLS, START_RATING, skillLevel, type SkillLevel } from '../drills/ratings';
import type { AnyDrill, SkillId } from '../drills/types';
import { SCENARIOS } from '../scenarios/content';
import type { Scenario } from '../scenarios/types';

import { principleById, type Principle } from './index';

/** What the next move reads from saved progress, in each store's own shape. */
export type NextMoveInput = {
  readonly scenarios: Readonly<Record<string, { readonly verdict: string }>>;
  readonly ratings: Readonly<Partial<Record<SkillId, { readonly rating: number }>>>;
};

/**
 * Why this move was picked, for the line under it and for analytics.
 * - `new-scenario`: a scenario the player hasn't played, on their lowest-rated skill that still has one.
 * - `replay-scenario`: their lowest-rated skill, where their last move in this scenario wasn't the best.
 * - `weakest-drill`: their lowest-rated skill, with every scenario for it finished with the best move.
 */
export type NextMoveReason = 'new-scenario' | 'replay-scenario' | 'weakest-drill';

/** Where the skill behind the move stands. */
export type SkillStanding = {
  readonly skill: SkillId;
  /** The skill's name, "Discards". */
  readonly title: string;
  /** The whole-number rating, or null while the skill is unrated. */
  readonly rating: number | null;
  /** The band the rating sits in, or null while unrated. */
  readonly level: SkillLevel | null;
};

export type NextMove =
  | {
      readonly kind: 'scenario';
      readonly reason: 'new-scenario' | 'replay-scenario';
      readonly scenario: Scenario;
      /** The STRATEGY.md row the scenario teaches. */
      readonly principle: Principle;
      readonly standing: SkillStanding;
      /** One line on why this, now. */
      readonly why: string;
    }
  | {
      readonly kind: 'drill';
      readonly reason: 'weakest-drill';
      readonly drill: AnyDrill;
      readonly standing: SkillStanding;
      readonly why: string;
    };

function standing(skill: SkillId, input: NextMoveInput): SkillStanding {
  const raw = input.ratings[skill]?.rating;
  const title = SKILLS.find((s) => s.id === skill)!.title;
  if (raw === undefined) return { skill, title, rating: null, level: null };
  return { skill, title, rating: Math.round(raw), level: skillLevel(raw) };
}

/** The number a skill is ranked by: its shown rating, or the starting rating while unrated. */
function rank(s: SkillStanding): number {
  return s.rating ?? START_RATING;
}

/** "Finding your feet, 870". */
function band(s: SkillStanding): string {
  return `${s.level!.name}, ${s.rating}`;
}

/** Every skill, lowest-rated first; ties keep the order the Progress tab lists them in. */
export function skillsByNeed(input: NextMoveInput): SkillStanding[] {
  return SKILLS.map((s) => standing(s.id, input))
    .map((s, i) => ({ s, i }))
    .sort((a, b) => rank(a.s) - rank(b.s) || a.i - b.i)
    .map(({ s }) => s);
}

/** The most useful thing to train next. Deterministic in its input. */
export function nextMove(input: NextMoveInput): NextMove {
  // 1. Scenarios the player hasn't played, lowest-rated skill first, then list order.
  const unplayed = SCENARIOS.map((scenario, i) => ({ scenario, i, standing: standing(scenario.skill, input) }))
    .filter(({ scenario }) => !input.scenarios[scenario.id])
    .sort((a, b) => rank(a.standing) - rank(b.standing) || a.i - b.i);
  if (unplayed.length > 0) {
    const { scenario, standing: s } = unplayed[0];
    const principle = principleById(scenario.principle)!;
    // The list is sorted, so this skill is the lowest-rated one with a scenario left (or tied for it).
    const why =
      s.rating === null
        ? `${s.title} isn’t rated yet, and this scenario is where it starts.`
        : unplayed.some((u) => u.standing.skill !== s.skill)
          ? `${s.title} (${band(s)}) is your lowest-rated skill with a scenario left to play.`
          : `${s.title} (${band(s)}) still has a scenario you haven’t played.`;
    return { kind: 'scenario', reason: 'new-scenario', scenario, principle, standing: s, why };
  }

  // 2. Every scenario played: the lowest-rated skill.
  const weakest = skillsByNeed(input)[0];
  const missed = SCENARIOS.find((sc) => sc.skill === weakest.skill && input.scenarios[sc.id]?.verdict !== 'best');
  const lowest =
    weakest.rating === null ? `${weakest.title} isn’t rated yet` : `${weakest.title} (${band(weakest)}) is your lowest-rated skill`;
  if (missed) {
    return {
      kind: 'scenario',
      reason: 'replay-scenario',
      scenario: missed,
      principle: principleById(missed.principle)!,
      standing: weakest,
      why: `${lowest}, and your last move here wasn’t the coach’s best.`,
    };
  }
  return {
    kind: 'drill',
    reason: 'weakest-drill',
    drill: drillForSkill(weakest.skill)!,
    standing: weakest,
    why: weakest.rating === null ? `${lowest}. A round finds your level.` : `${lowest}. Every answer here moves it.`,
  };
}
