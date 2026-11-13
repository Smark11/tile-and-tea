// The wall as it stands on the table. American players each build a wall of
// 19 stacks, two tiles high, in front of their seat: 4 × 19 × 2 = 152 tiles.
// The deal and every draw take from one end, top tile first, moving
// clockwise around the square (as seen from above): East's wall, then North's,
// West's and South's. Play itself moves the other way, East → South.

import { TILE_COUNT } from '../tiles';
import { acrossFrom, EAST, leftOf, rightOf, type Seat } from '../engine/types';

/** Stacks in each player's wall. */
export const WALL_STACKS = 19;
/** Tiles in each stack. */
export const STACK_HEIGHT = 2;

/** Height (0, 1 or 2) of every stack, per seat's wall, in the order they're drawn. */
export type WallLayout = Readonly<Record<Seat, readonly number[]>>;

/** The order the walls are drawn from: East's first, then clockwise. */
export const DRAW_ORDER: readonly Seat[] = [EAST, leftOf(EAST), acrossFrom(EAST), rightOf(EAST)];

/**
 * How the wall stands with `remaining` tiles still to draw. Tiles already
 * dealt or drawn leave gaps from the start of East's wall onward.
 */
export function wallLayout(remaining: number): WallLayout {
  if (!Number.isInteger(remaining) || remaining < 0 || remaining > TILE_COUNT) {
    throw new RangeError(`A wall can't have ${remaining} tiles left`);
  }
  let taken = TILE_COUNT - remaining;
  const layout = {} as Record<Seat, number[]>;
  for (const seat of DRAW_ORDER) {
    layout[seat] = Array.from({ length: WALL_STACKS }, () => {
      const gone = Math.min(STACK_HEIGHT, taken);
      taken -= gone;
      return STACK_HEIGHT - gone;
    });
  }
  return layout;
}
