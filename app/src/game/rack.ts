// A player's rack: the ordered row of tiles in front of them. Order matters
// only to the player (it's how they read their hand), so these helpers never
// add or drop tiles; they only rearrange them.

import { ALL_KINDS, tileKey, type Tile } from './tiles';

const KIND_RANK: ReadonlyMap<string, number> = new Map(ALL_KINDS.map((kind, i) => [tileKey(kind), i]));

function compareTiles(a: Tile, b: Tile): number {
  // Same-kind tiles keep a fixed order (by copy, then id) so sorting is stable
  // and a sorted rack sorts to itself.
  return (
    KIND_RANK.get(tileKey(a.kind))! - KIND_RANK.get(tileKey(b.kind))! || a.copy - b.copy || a.id - b.id
  );
}

/**
 * Sorts by suit the way most players arrange a rack: Bams, Craks, Dots (each
 * 1–9), then Winds (N E W S), Dragons, Flowers, and Jokers at the end.
 * Returns a new array.
 */
export function sortRack(tiles: readonly Tile[]): Tile[] {
  return [...tiles].sort(compareTiles);
}

/** True when the rack is already in `sortRack` order. */
export function isRackSorted(tiles: readonly Tile[]): boolean {
  for (let i = 1; i < tiles.length; i++) {
    if (compareTiles(tiles[i - 1], tiles[i]) > 0) return false;
  }
  return true;
}

/**
 * Moves the tile at `from` to `to`, shifting the tiles in between, and
 * returns a new array. Indexes outside the rack are clamped to its ends.
 */
export function moveTile<T>(tiles: readonly T[], from: number, to: number): T[] {
  'worklet';
  const next = tiles.slice();
  if (next.length === 0 || from < 0 || from >= next.length) return next;
  const target = Math.max(0, Math.min(next.length - 1, to));
  const [moved] = next.splice(from, 1);
  next.splice(target, 0, moved);
  return next;
}
