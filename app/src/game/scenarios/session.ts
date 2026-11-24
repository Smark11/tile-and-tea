// One play-through of a scenario, as a pure reducer: the scene, the move, then
// the strategy. The move itself is a one-question drill round, so tapping,
// locked tiles, multi-pick and Check all behave exactly as they do in a drill.

import { currentAnswer, roundReducer, startRound, type AnsweredQuestion, type RoundAction, type RoundState } from '../drills/session';

import { moveIndexes, scenarioDrill } from './play';
import type { Scenario } from './types';

export type ScenarioStep = 'scene' | 'move' | 'strategy';

export const SCENARIO_STEPS: readonly ScenarioStep[] = ['scene', 'move', 'strategy'];

export type ScenarioState = {
  readonly step: ScenarioStep;
  readonly round: RoundState;
};

export type ScenarioAction =
  /** From the scene to the move. */
  | { readonly type: 'begin' }
  /** A tap or Check on the move; see RoundAction. */
  | { readonly type: 'tap'; readonly index: number }
  | { readonly type: 'check' }
  /** From the answered move to the strategy. */
  | { readonly type: 'continue' }
  /** Back to the scene with the move unmade. */
  | { readonly type: 'restart' };

export function startScenario(scenario: Scenario): ScenarioState {
  return { step: 'scene', round: startRound(scenarioDrill(scenario), 0) };
}

/** The player's answer to the move, once made. */
export function scenarioAnswer(state: ScenarioState): AnsweredQuestion | null {
  return currentAnswer(state.round);
}

export function scenarioReducer(scenario: Scenario) {
  const reduceRound = roundReducer(scenarioDrill(scenario));
  return (state: ScenarioState, action: ScenarioAction): ScenarioState => {
    switch (action.type) {
      case 'begin':
        return state.step === 'scene' ? { ...state, step: 'move' } : state;
      case 'tap':
      case 'check': {
        if (state.step !== 'move') return state;
        const round = reduceRound(state.round, action as RoundAction);
        return round === state.round ? state : { ...state, round };
      }
      case 'continue':
        return state.step === 'move' && scenarioAnswer(state) ? { ...state, step: 'strategy' } : state;
      case 'restart':
        return startScenario(scenario);
    }
  };
}

/**
 * A scenario opened part-way through, for links and screenshots: on its move,
 * or on its strategy with the taught move already made.
 */
export function openScenario(scenario: Scenario, step: ScenarioStep): ScenarioState {
  const reduce = scenarioReducer(scenario);
  let state = startScenario(scenario);
  if (step === 'scene') return state;
  state = reduce(state, { type: 'begin' });
  if (step === 'move') return state;
  for (const index of moveIndexes(scenario)) state = reduce(state, { type: 'tap', index });
  state = reduce(state, { type: 'check' });
  return reduce(state, { type: 'continue' });
}
