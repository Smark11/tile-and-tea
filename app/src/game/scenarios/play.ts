// Playing a scenario's decision through the drill engine: the question it
// lays out, the verdict on a pick, and the move it teaches as choice indexes.

import { bestHandQuestion, evaluateBestHand } from '../drills/content/bestHand';
import { charlestonQuestion, evaluateCharleston, passWords, PASS_SIZE } from '../drills/content/charleston';
import { discardQuestion, evaluateDiscard } from '../drills/content/discards';
import { callQuestion, evaluateCall, evaluateSwap, swapQuestion } from '../drills/content/tableMoves';
import { handById, handLabel, singular } from '../drills/content/words';
import type { AnyDrill, DrillChoice, DrillEvaluation, DrillQuestion } from '../drills/types';
import { sameKind, type TileKind } from '../tiles';

import type { Scenario } from './types';

/** Scenario decisions are explained first, so they count as gentler than a drill's for ratings. */
export const SCENARIO_LEVEL = 950;

/** The decision laid out as a drill question, with the scenario's own prompt. */
export function scenarioQuestion(scenario: Scenario): DrillQuestion {
  const { setup } = scenario;
  const question: DrillQuestion =
    setup.kind === 'charleston'
      ? charlestonQuestion(setup.rack)
      : setup.kind === 'best-hand'
        ? bestHandQuestion({ rack: setup.rack, handIds: setup.handIds })
        : setup.kind === 'call'
          ? callQuestion(setup.data)
          : setup.kind === 'swap'
            ? swapQuestion(setup.data)
            : discardQuestion(setup.data);
  return { ...question, prompt: scenario.prompt };
}

/** The coach's verdict on a pick, from the matching drill's evaluator. */
export function evaluateScenario(scenario: Scenario, question: DrillQuestion, picked: readonly number[]): DrillEvaluation {
  const { setup } = scenario;
  if (setup.kind === 'charleston') return evaluateCharleston(question as Parameters<typeof evaluateCharleston>[0], picked);
  if (setup.kind === 'best-hand') return evaluateBestHand(question as Parameters<typeof evaluateBestHand>[0], picked);
  if (setup.kind === 'call') return evaluateCall(question as Parameters<typeof evaluateCall>[0], picked);
  if (setup.kind === 'swap') return evaluateSwap(question as Parameters<typeof evaluateSwap>[0], picked);
  return evaluateDiscard(question as Parameters<typeof evaluateDiscard>[0], picked);
}

/** The player's tiles in a scenario: 13 before a pass, a hand choice or a call; 14 after a draw. */
export function scenarioRack(scenario: Scenario): readonly TileKind[] {
  const { setup } = scenario;
  return setup.kind === 'charleston' || setup.kind === 'best-hand' ? setup.rack : setup.data.rack;
}

/** How many choices make the move: three tiles in a Charleston, otherwise one. */
export function picksFor(scenario: Scenario): number {
  return scenario.setup.kind === 'charleston' ? PASS_SIZE : 1;
}

/**
 * The choice indexes of the move the scenario teaches: for tiles, the first
 * free copy of each (two copies of one tile take two indexes); for a hand, its line.
 */
export function moveIndexes(scenario: Scenario, question: DrillQuestion = scenarioQuestion(scenario)): number[] {
  const { move, setup } = scenario;
  if ('action' in move) {
    const at = question.choices.findIndex((c) => c.kind === 'action' && c.id === move.action);
    if (at < 0) throw new RangeError(`${scenario.id}: ${move.action} isn't one of the moves`);
    return [at];
  }
  if ('handId' in move) {
    const at = setup.kind === 'best-hand' ? setup.handIds.indexOf(move.handId) : -1;
    if (at < 0) throw new RangeError(`${scenario.id}: ${move.handId} isn't one of the choices`);
    return [at];
  }
  const used = new Set<number>();
  return move.tiles.map((tile) => {
    const at = question.choices.findIndex((c, i) => c.kind === 'tile' && !c.locked && !used.has(i) && sameKind(c.tile, tile));
    if (at < 0) throw new RangeError(`${scenario.id}: the move's tiles aren't all on the rack`);
    used.add(at);
    return at;
  });
}

/** The taught move in words: "Pass the 9 Bam, the 1 Crak and the 9 Dot", "Throw the Soap", "Aim for 2468 #3". */
export function moveWords(scenario: Scenario): string {
  const { move, setup } = scenario;
  if ('action' in move) return moveAction(scenario).label;
  if ('handId' in move) return `Aim for ${handLabel(handById(move.handId))}`;
  if (setup.kind === 'charleston') return `Pass ${passWords(move.tiles)}`;
  return `Throw the ${singular(move.tiles[0])}`;
}

/** The tiles of the taught move, for showing it; a hand's move shows its card line instead. */
export function moveTiles(scenario: Scenario): readonly TileKind[] {
  if ('action' in scenario.move) return moveAction(scenario).tiles;
  return 'tiles' in scenario.move ? scenario.move.tiles : [];
}

/** The table move a call or swap scenario teaches, as its choice. */
export function moveAction(scenario: Scenario): Extract<DrillChoice, { kind: 'action' }> {
  const question = scenarioQuestion(scenario);
  const choice = question.choices[moveIndexes(scenario, question)[0]];
  if (choice.kind !== 'action') throw new RangeError(`${scenario.id} doesn't teach a table move`);
  return choice;
}

const drillCache = new WeakMap<Scenario, AnyDrill>();

/**
 * The scenario as a one-question drill, so the drill round reducer and the
 * question view play its move. Stable per scenario, so reducers can be memoized.
 */
export function scenarioDrill(scenario: Scenario): AnyDrill {
  let drill = drillCache.get(scenario);
  if (!drill) {
    const question = scenarioQuestion(scenario);
    drill = {
      id: `scenario:${scenario.id}`,
      skill: scenario.skill,
      title: scenario.title,
      summary: scenario.summary,
      icon: scenario.icon,
      questionsPerRound: 1,
      level: SCENARIO_LEVEL,
      generate: () => question,
      evaluate: (q, picked) => evaluateScenario(scenario, q, picked),
    };
    drillCache.set(scenario, drill);
  }
  return drill;
}
