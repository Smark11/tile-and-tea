// The players the win-rate simulator seats. "The student" plays exactly what
// the coach recommends: the Shark style, built on the same distance, dead-tile
// and exposure-read engine as the drills and scenarios. Each ablation is the
// student with one principle from docs/STRATEGY.md switched off, so the
// difference in results measures what that principle is worth.

import { BOT_STYLES, type BotStyle } from '../bots';

export type PolicyId =
  | 'student'
  | 'no-dead-tiles'
  | 'no-defense'
  | 'no-backups'
  | 'no-joker-swaps'
  | 'no-visible-tiebreak'
  | 'idle-calls'
  | 'points-first';

export type Policy = {
  readonly id: PolicyId;
  /** The STRATEGY.md row the ablation measures (null for the full student). */
  readonly principle: string | null;
  /** What the policy does, in a few words. */
  readonly label: string;
  readonly style: BotStyle;
};

const student = BOT_STYLES.shark;

/** Points-first values every 10 points over the card's cheapest hand as one tile nearer: a 50 is worth 2.5 tiles over a 25. */
export const POINTS_PER_TILE = 10;

export const STUDENT: Policy = {
  id: 'student',
  principle: null,
  label: 'Follows the coach (the Shark advisor)',
  style: student,
};

/** The student with one principle switched off. */
export const ABLATIONS: readonly Policy[] = [
  {
    id: 'no-dead-tiles',
    principle: 'T1',
    label: 'Ignores dead tiles (counts every copy as still drawable)',
    style: { ...student, deadTiles: false },
  },
  {
    id: 'no-defense',
    principle: 'T2',
    label: 'Ignores exposures (throws tiles other players want)',
    style: { ...student, defends: false },
  },
  {
    id: 'no-visible-tiebreak',
    principle: 'T3',
    label: 'Among equal safe throws, ignores how many copies are visible',
    style: { ...student, visibleTieBreak: false },
  },
  {
    id: 'idle-calls',
    principle: 'T4',
    label: 'Calls any exposure that fits, even when it brings the hand no closer',
    style: { ...student, idleCall: 1 },
  },
  {
    id: 'no-joker-swaps',
    principle: 'T5',
    label: 'Never swaps for an exposed Joker',
    style: { ...student, swapsJokers: false },
  },
  {
    id: 'no-backups',
    principle: 'C3',
    label: 'Keeps no backup hands (ties broken at random, not by doors left open)',
    style: { ...student, backups: false },
  },
  {
    id: 'points-first',
    principle: 'H1',
    label: `Chases points: each ${POINTS_PER_TILE} points over 25 counts as a tile nearer`,
    style: { ...student, pointsPerTile: POINTS_PER_TILE },
  },
];

export const POLICIES: readonly Policy[] = [STUDENT, ...ABLATIONS];

export function policyById(id: string): Policy | undefined {
  return POLICIES.find((p) => p.id === id);
}
