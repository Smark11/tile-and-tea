// The playbook: every principle of winning play in docs/STRATEGY.md, in the
// curriculum's order, with what teaches it and how the player is doing on it.
//
// The rows here mirror the doc's curriculum tables. A test
// (./__tests__/playbook.test.ts) reads docs/STRATEGY.md and checks the ids,
// their order and stage, and every evidence claim against the simulator
// results, so the screen can't say more than the measurements do. The
// scenarios that teach a principle aren't listed here: they come from each
// scenario's own `principle` field.

import { SKILL_LEVELS, skillLevel, type SkillLevel } from '../drills/ratings';
import type { SkillId } from '../drills/types';
import { SCENARIOS } from '../scenarios/content';
import type { Scenario, ScenarioStage } from '../scenarios/types';

export type PrincipleId = 'C1' | 'C2' | 'C3' | 'C4' | 'H1' | 'H2' | 'H3' | 'H4' | 'T1' | 'T2' | 'T3' | 'T4' | 'T5';

/** A bot table the simulator measures against. */
export type SimTable = 'beginner' | 'club' | 'shark';

/**
 * Why the coach believes a principle, in STRATEGY.md's terms.
 * - `measured`: switching it off in the simulator costs Mah Jonggs at these
 *   tables (the 95% interval clears zero). `perHundred` is the rounded range
 *   of point estimates there: extra Mah Jonggs per 100 games.
 * - `tie-break`: measured, and no table shows a difference. It costs nothing
 *   to follow, so it stays as a tie-break.
 * - `engine`: the coach's verdicts are built on it; the simulator has no switch for it yet.
 * - `rule`: a rule of the game, not a choice.
 */
export type Evidence =
  | { readonly kind: 'measured'; readonly perHundred: readonly [number, number]; readonly tables: readonly SimTable[] }
  | { readonly kind: 'tie-break' }
  | { readonly kind: 'engine' }
  | { readonly kind: 'rule' };

/** Something besides a scenario that teaches a principle. */
export type Teacher = { readonly kind: 'drill'; readonly id: string } | { readonly kind: 'lesson'; readonly id: string };

export type Principle = {
  /** The STRATEGY.md row, "T4". */
  readonly id: PrincipleId;
  readonly stage: ScenarioStage;
  /** The principle as one line a player can remember. */
  readonly rule: string;
  /** The skill rating that says whether the player applies it. */
  readonly skill: SkillId;
  /** Drills and lessons that teach it, beside its scenarios. */
  readonly teachers: readonly Teacher[];
  readonly evidence: Evidence;
};

const ALL_TABLES: readonly SimTable[] = ['beginner', 'club', 'shark'];

/** Every principle, in curriculum order. */
export const PRINCIPLES: readonly Principle[] = [
  {
    id: 'C1',
    stage: 'charleston',
    rule: 'Pairs are gold. Pass the tiles that touch nothing.',
    skill: 'charleston',
    teachers: [{ kind: 'drill', id: 'charleston' }],
    evidence: { kind: 'engine' },
  },
  {
    id: 'C2',
    stage: 'charleston',
    rule: 'A lone Flower is worth more than a lone number. Check your closest hand before passing one.',
    skill: 'charleston',
    teachers: [],
    evidence: { kind: 'engine' },
  },
  {
    id: 'C3',
    stage: 'charleston',
    rule: 'On the early passes, keep the tiles that hold your backup hands.',
    skill: 'charleston',
    teachers: [{ kind: 'drill', id: 'charleston' }],
    evidence: { kind: 'measured', perHundred: [5, 5], tables: ['club'] },
  },
  {
    id: 'C4',
    stage: 'charleston',
    rule: 'Jokers never travel in the Charleston.',
    skill: 'charleston',
    teachers: [{ kind: 'lesson', id: 'charleston' }],
    evidence: { kind: 'rule' },
  },
  {
    id: 'H1',
    stage: 'hand-choice',
    rule: 'Count tiles, not points. A finished 25 beats an unfinished 50.',
    skill: 'hand-choice',
    teachers: [{ kind: 'drill', id: 'best-hand' }],
    evidence: { kind: 'measured', perHundred: [11, 25], tables: ALL_TABLES },
  },
  {
    id: 'H2',
    stage: 'hand-choice',
    rule: 'Count your Jokers into the distance, then take the closest hand.',
    skill: 'hand-choice',
    teachers: [],
    evidence: { kind: 'engine' },
  },
  {
    id: 'H3',
    stage: 'hand-choice',
    rule: 'Dragons have suits: Green goes with Bams, Red with Craks, Soap with Dots.',
    skill: 'hand-choice',
    teachers: [{ kind: 'lesson', id: 'reading-a-card' }],
    evidence: { kind: 'engine' },
  },
  {
    id: 'H4',
    stage: 'hand-choice',
    rule: 'Switch hands only when another line is now closer, counting the table.',
    skill: 'hand-choice',
    teachers: [
      { kind: 'drill', id: 'best-hand' },
      { kind: 'drill', id: 'discards' },
    ],
    evidence: { kind: 'engine' },
  },
  {
    id: 'T1',
    stage: 'table',
    rule: 'Count what’s gone before you count what’s close.',
    skill: 'discards',
    teachers: [{ kind: 'drill', id: 'discards' }],
    evidence: { kind: 'measured', perHundred: [2, 4], tables: ['beginner', 'club'] },
  },
  {
    id: 'T2',
    stage: 'table',
    rule: 'Read the exposures. Don’t throw a tile they can use while another throw keeps your hand as close.',
    skill: 'discards',
    teachers: [{ kind: 'drill', id: 'discards' }],
    evidence: { kind: 'tie-break' },
  },
  {
    id: 'T3',
    stage: 'table',
    rule: 'Among equal throws, let go of the tile with the most copies already showing.',
    skill: 'discards',
    teachers: [{ kind: 'drill', id: 'discards' }],
    evidence: { kind: 'tie-break' },
  },
  {
    id: 'T4',
    stage: 'table',
    rule: 'Call a tile only when the exposure brings your hand closer.',
    skill: 'discards',
    teachers: [],
    evidence: { kind: 'measured', perHundred: [2, 4], tables: ALL_TABLES },
  },
  {
    id: 'T5',
    stage: 'table',
    rule: 'Swap for an exposed Joker whenever you hold the real tile and it costs your hand nothing.',
    skill: 'discards',
    teachers: [],
    evidence: { kind: 'measured', perHundred: [2, 12], tables: ALL_TABLES },
  },
];

export function principleById(id: string): Principle | undefined {
  return PRINCIPLES.find((p) => p.id === id);
}

/** The scenarios that teach a principle, in list order. */
export function scenariosFor(principle: Principle): Scenario[] {
  return SCENARIOS.filter((s) => s.principle === principle.id);
}

/** The principles of one stage, in curriculum order. */
export function principlesIn(stage: ScenarioStage): Principle[] {
  return PRINCIPLES.filter((p) => p.stage === stage);
}

const TABLE_NAMES: Record<SimTable, string> = { beginner: 'Beginner', club: 'Club', shark: 'Shark' };

/** A list in plain English: "Beginner and Club". */
function joinWords(words: readonly string[]): string {
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

/** A short tag for the evidence, and one honest sentence on what it means. */
export function evidenceWords(evidence: Evidence): { tag: string; detail: string } {
  switch (evidence.kind) {
    case 'measured': {
      const [low, high] = evidence.perHundred;
      const wins = low === high ? `${low}` : `${low} to ${high}`;
      const where =
        evidence.tables.length === ALL_TABLES.length
          ? 'at every bot table we tested'
          : `against ${joinWords(evidence.tables.map((t) => TABLE_NAMES[t]))} bots`;
      return { tag: 'Measured', detail: `In our simulator, following it won ${wins} more hands per 100 games ${where}.` };
    }
    case 'tie-break':
      return {
        tag: 'Tie-break',
        detail: 'No edge we could measure, but it costs nothing. Use it to choose between equal moves, never to break your hand.',
      };
    case 'engine':
      return { tag: 'Coach-checked', detail: 'The coach’s verdicts are built on it. The simulator can’t switch it off to measure it yet.' };
    case 'rule':
      return { tag: 'Rule', detail: 'A rule of the game, not a choice.' };
  }
}

/** Master a principle by reaching this band in its skill. */
export const MASTERY_LEVEL: SkillLevel = SKILL_LEVELS.find((l) => l.id === 'steady')!;

/** What the playbook reads from saved progress. Each field is the matching store's own shape. */
export type PlaybookInput = {
  readonly scenarios: Readonly<Record<string, { readonly verdict: string }>>;
  readonly ratings: Readonly<Partial<Record<SkillId, { readonly rating: number }>>>;
  readonly lessons: Readonly<Record<string, unknown>>;
};

/** One thing standing between the player and a mastered principle. */
export type PlaybookStep =
  | { readonly kind: 'scenario'; readonly scenario: Scenario; readonly done: boolean; readonly verdict?: string }
  | { readonly kind: 'lesson'; readonly id: string; readonly done: boolean }
  | {
      readonly kind: 'skill';
      readonly skill: SkillId;
      /** The band the player is in, or null while the skill is unrated. */
      readonly level: SkillLevel | null;
      readonly done: boolean;
    };

export type PrincipleProgress = {
  readonly principle: Principle;
  /** In order: each scenario (finished with the best move), each lesson (finished), then the skill rating. */
  readonly steps: readonly PlaybookStep[];
  readonly mastered: boolean;
};

/**
 * How the player stands on a principle. It's mastered once every scenario
 * that teaches it was last finished with the coach's best move, every lesson
 * that teaches it is finished, and its skill rating is at least Steady.
 * Drills count through the rating, which every drill answer moves.
 */
export function principleProgress(principle: Principle, input: PlaybookInput): PrincipleProgress {
  const scenarioSteps: PlaybookStep[] = scenariosFor(principle).map((scenario) => {
    const verdict = input.scenarios[scenario.id]?.verdict;
    return { kind: 'scenario', scenario, verdict, done: verdict === 'best' };
  });
  const lessonSteps: PlaybookStep[] = principle.teachers
    .filter((t) => t.kind === 'lesson')
    .map((t) => ({ kind: 'lesson', id: t.id, done: Boolean(input.lessons[t.id]) }));
  const rating = input.ratings[principle.skill]?.rating;
  const level = rating === undefined ? null : skillLevel(rating);
  const steady = level !== null && SKILL_LEVELS.indexOf(level) >= SKILL_LEVELS.indexOf(MASTERY_LEVEL);
  const steps = [...scenarioSteps, ...lessonSteps, { kind: 'skill', skill: principle.skill, level, done: steady } as const];
  return { principle, steps, mastered: steps.every((s) => s.done) };
}

/** The whole playbook, in curriculum order. */
export function playbookProgress(input: PlaybookInput): PrincipleProgress[] {
  return PRINCIPLES.map((p) => principleProgress(p, input));
}
