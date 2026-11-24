import { SCENARIOS } from './content';
import type { Scenario, ScenarioStage, StageInfo } from './types';

export * from './play';
export * from './session';
export * from './types';
export { SCENARIOS } from './content';

export const STAGES: readonly StageInfo[] = [
  { id: 'charleston', title: 'The Charleston', blurb: 'Three passes that shape the whole game. Give away the right tiles.' },
  { id: 'hand-choice', title: 'Choosing a hand', blurb: 'Read your rack against the card, and commit to the hand that can win.' },
  { id: 'table', title: 'At the table', blurb: 'Every discard counts twice: for your hand, and for what it hands the others.' },
];

export function stageInfo(id: ScenarioStage): StageInfo {
  return STAGES.find((s) => s.id === id)!;
}

export const SCENARIO_ORDER: readonly string[] = SCENARIOS.map((s) => s.id);

export function scenarioById(id: string | undefined): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

/** The scenario after this one in the list, or undefined after the last. */
export function nextScenario(id: string): Scenario | undefined {
  const at = SCENARIO_ORDER.indexOf(id);
  return at < 0 ? undefined : SCENARIOS[at + 1];
}

/** The route that plays a scenario. */
export function scenarioPath(id: string): `/scenario/${string}` {
  return `/scenario/${id}`;
}

/** A calendar day in the player's own time zone, "2026-11-24". */
export function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * The scenario of the day: the same for everyone on a given local date, and
 * it changes at midnight. Days walk the list in a shuffled order (a stride
 * coprime to its length), so consecutive days never repeat and every
 * scenario comes round once per cycle.
 */
export function scenarioOfTheDay(date: Date): Scenario {
  const n = SCENARIOS.length;
  const days = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
  let stride = 5;
  while (gcd(stride, n) !== 1) stride++;
  return SCENARIOS[(((days * stride) % n) + n) % n];
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** The scenarios of one stage, in list order. */
export function scenariosIn(stage: ScenarioStage): Scenario[] {
  return SCENARIOS.filter((s) => s.stage === stage);
}
