// Skill ratings: one Elo-style number per skill, moved by every drill answer.
// Each answer is a "game" between the player and the drill: the drill has a
// fixed level (`Drill.level`), the answer's score (1 best, 0.5 sound, 0 miss)
// is the result, and the rating moves by K × (score − expected score), the
// same update chess ratings use. New skills move fast (a high K) so a few
// rounds find the player's level; settled ones move gently so one bad round
// doesn't undo a week of practice.

import type { SkillId } from './types';

/** Everyone starts here, a little below the easiest drill. */
export const START_RATING = 900;
/** Ratings never leave this range, so a long streak can't run away. */
export const MIN_RATING = 100;
export const MAX_RATING = 2400;
/** Answers before a rating counts as settled (and K drops). */
export const PROVISIONAL_ANSWERS = 10;

/** One skill's rating. Plain JSON, kept in drill progress. */
export type SkillRating = {
  readonly rating: number;
  /** Every drill answer under this skill, ever. */
  readonly answers: number;
  /** The rating before the latest round's first answer, to show how that round went. */
  readonly roundStart: number;
};

export type RatedAnswer = {
  /** The evaluation's score, 0–1. */
  readonly score: number;
  /** The drill's level (`Drill.level`). */
  readonly level: number;
  /** The first answer of a round: the round's change is measured from before it. */
  readonly startsRound: boolean;
};

/** The score a player at `rating` is expected to average on a drill at `level`, 0–1. */
export function expectedScore(rating: number, level: number): number {
  return 1 / (1 + 10 ** ((level - rating) / 400));
}

/** How far one answer can move a rating, given how many answers came before it. */
export function kFactor(answersBefore: number): number {
  if (answersBefore < PROVISIONAL_ANSWERS) return 48;
  if (answersBefore < 40) return 28;
  return 18;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** The rating after one more answer. `before` is undefined for a skill never practised. */
export function rateAnswer(before: SkillRating | undefined, answer: RatedAnswer): SkillRating {
  if (!Number.isFinite(answer.score) || !Number.isFinite(answer.level)) {
    throw new RangeError('A rated answer needs a finite score and level.');
  }
  const rating = before?.rating ?? START_RATING;
  const answers = before?.answers ?? 0;
  const score = clamp(answer.score, 0, 1);
  const next = rating + kFactor(answers) * (score - expectedScore(rating, answer.level));
  return {
    rating: clamp(next, MIN_RATING, MAX_RATING),
    answers: answers + 1,
    roundStart: answer.startsRound || !before ? rating : before.roundStart,
  };
}

/** The whole-number change across the latest round (positive is up). */
export function roundChange(rating: SkillRating): number {
  return Math.round(rating.rating) - Math.round(rating.roundStart);
}

/** Whether the rating is still finding its level. */
export function isProvisional(rating: SkillRating): boolean {
  return rating.answers < PROVISIONAL_ANSWERS;
}

export type SkillLevelId = 'getting_started' | 'finding_feet' | 'steady' | 'confident' | 'sharp' | 'expert';

/** A named band of ratings, from its lowest rating up to the next band's. */
export type SkillLevel = { readonly id: SkillLevelId; readonly name: string; readonly from: number };

/** Plain words for how a skill is going, lowest first. Never a grade. */
export const SKILL_LEVELS: readonly SkillLevel[] = [
  { id: 'getting_started', name: 'Getting started', from: MIN_RATING },
  { id: 'finding_feet', name: 'Finding your feet', from: 850 },
  { id: 'steady', name: 'Steady', from: 1000 },
  { id: 'confident', name: 'Confident', from: 1150 },
  { id: 'sharp', name: 'Sharp', from: 1300 },
  { id: 'expert', name: 'Table expert', from: 1450 },
];

/** The band a rating sits in. Bands go by the whole-number rating the player sees. */
export function skillLevel(rating: number): SkillLevel {
  let level = SKILL_LEVELS[0];
  for (const band of SKILL_LEVELS) if (Math.round(rating) >= band.from) level = band;
  return level;
}

/** The band an answer lifted a rating into, or null when it stayed in its band or went down. */
export function levelReached(before: SkillRating | undefined, after: SkillRating): SkillLevel | null {
  if (!before) return null;
  const from = SKILL_LEVELS.indexOf(skillLevel(before.rating));
  const to = SKILL_LEVELS.indexOf(skillLevel(after.rating));
  return to > from ? SKILL_LEVELS[to] : null;
}

/** The meter shows this span of ratings: empty at the low end, full at the high end. */
export const METER_RANGE = { low: 700, high: 1600 } as const;

/** How full a skill's meter is, 0–1. */
export function meterFill(rating: number): number {
  return clamp((rating - METER_RANGE.low) / (METER_RANGE.high - METER_RANGE.low), 0, 1);
}

/** Where each band after the first starts on the meter, 0–1, for tick marks. */
export function meterTicks(): number[] {
  return SKILL_LEVELS.slice(1)
    .map((band) => meterFill(band.from))
    .filter((t) => t > 0 && t < 1);
}

/** What each skill is called, and what its rating says about the player, in display order. */
export type SkillInfo = { readonly id: SkillId; readonly title: string; readonly detail: string };

export const SKILLS: readonly SkillInfo[] = [
  { id: 'card-reading', title: 'Reading the card', detail: 'Spotting which line of the card a set of tiles makes.' },
  { id: 'hand-choice', title: 'Choosing a hand', detail: 'Picking the hand your rack is closest to.' },
  { id: 'charleston', title: 'The Charleston', detail: 'Passing tiles that keep your best hands open.' },
  { id: 'discards', title: 'Discards', detail: 'Throwing tiles that keep your hand and stay safe.' },
];
