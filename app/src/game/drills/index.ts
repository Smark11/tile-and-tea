import { nameTheHand } from './content/nameTheHand';
import type { AnyDrill } from './types';

export * from './allowance';
export * from './session';
export * from './types';
export { nameTheHand } from './content/nameTheHand';

/** Every playable drill, in the order the Train tab lists them. */
export const DRILLS: readonly AnyDrill[] = [nameTheHand];

export const DRILL_ORDER: readonly string[] = DRILLS.map((d) => d.id);

export function drillById(id: string | undefined): AnyDrill | undefined {
  return DRILLS.find((d) => d.id === id);
}

/** The route that plays a drill. */
export function drillPath(id: string): `/drill/${string}` {
  return `/drill/${id}`;
}
