import { bestHand } from './content/bestHand';
import { charleston } from './content/charleston';
import { discards } from './content/discards';
import { nameTheHand } from './content/nameTheHand';
import type { AnyDrill } from './types';

export * from './allowance';
export * from './session';
export * from './types';
export { bestHand } from './content/bestHand';
export { charleston } from './content/charleston';
export { discards } from './content/discards';
export { nameTheHand } from './content/nameTheHand';

/** Every playable drill, in the order the Train tab lists them. */
export const DRILLS: readonly AnyDrill[] = [nameTheHand, bestHand, charleston, discards];

export const DRILL_ORDER: readonly string[] = DRILLS.map((d) => d.id);

export function drillById(id: string | undefined): AnyDrill | undefined {
  return DRILLS.find((d) => d.id === id);
}

/** The route that plays a drill. */
export function drillPath(id: string): `/drill/${string}` {
  return `/drill/${id}`;
}
