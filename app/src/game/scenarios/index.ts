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

/** The scenarios of one stage, in list order. */
export function scenariosIn(stage: ScenarioStage): Scenario[] {
  return SCENARIOS.filter((s) => s.stage === stage);
}
