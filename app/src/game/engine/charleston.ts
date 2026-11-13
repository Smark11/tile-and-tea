// Moving tiles in one Charleston pass, blind passes included.
//
// Every player passes three tiles the same way at once. On a blind pass (the
// last pass of each Charleston) a player may instead pass on 1, 2 or 3 of the
// tiles coming to them without looking, and make up the rest from their rack.
// So a tile can travel more than one seat: it moves on until it reaches a
// player who isn't forwarding any more tiles.

import type { Tile } from '../tiles';
import { acrossFrom, leftOf, rightOf, type PassDirection, type Seat } from './types';

export const passTarget: Readonly<Record<PassDirection, (seat: Seat) => Seat>> = {
  right: rightOf,
  across: acrossFrom,
  left: leftOf,
};

/** What one player puts in: the tiles from their rack, and how many incoming tiles they pass on blind. */
export type PassInput = { readonly tiles: readonly Tile[]; readonly blind: number };

/**
 * The racks after a pass. `racks` and `inputs` are indexed by seat, and each
 * player's `tiles` must be on their rack. Tiles move in the order passed, so
 * the incoming tiles a player forwards blind are the first to reach them, and
 * the result is deterministic.
 *
 * Every player still ends with as many tiles as they started with: each gives
 * `3 − blind` from the rack and keeps `3 − blind` of what reaches them. If
 * all four pass all three blind, no tile moves at all.
 */
export function resolvePass(
  racks: readonly (readonly Tile[])[],
  inputs: readonly PassInput[],
  direction: PassDirection,
): Tile[][] {
  const target = passTarget[direction];
  const out = racks.map((rack, seat) => {
    const passed = new Set(inputs[seat].tiles.map((t) => t.id));
    return rack.filter((t) => !passed.has(t.id));
  });
  const forwardLeft = inputs.map((input) => input.blind);
  const queue: { tile: Tile; at: Seat }[] = [];
  inputs.forEach((input, seat) => {
    for (const tile of input.tiles) queue.push({ tile, at: target(seat as Seat) });
  });
  // At most `sum(blind)` forwards, so this ends.
  for (let i = 0; i < queue.length; i++) {
    const { tile, at } = queue[i];
    if (forwardLeft[at] > 0) {
      forwardLeft[at] -= 1;
      queue.push({ tile, at: target(at) });
    } else {
      out[at].push(tile);
    }
  }
  return out;
}
