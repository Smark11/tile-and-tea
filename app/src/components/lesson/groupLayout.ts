// Lays out grouped tiles (a pung, a pair, a kong…) across as few rows as read
// well. Tiles in a group nearly touch, like a set on a rack; groups sit apart.
// A group is never split across rows, so a kong always reads as a kong.

/** Space between tiles of the same group. */
export const INNER_GAP = 2;
/** Space between groups in a row. */
export const GROUP_GAP = 12;
/** Narrowest tile we'll accept before adding another row. */
export const COMFORT_TILE = 40;
export const MAX_GROUP_TILE = 84;
/** Never smaller than this, however cramped. */
export const FLOOR_TILE = 28;
const MAX_ROWS = 3;

export type GroupLayout = {
  /** Tile width in points. */
  readonly width: number;
  /** Each row, as indexes into `groups`. */
  readonly rows: readonly (readonly number[])[];
};

/** The widest tile that lets these groups share one row of `available` points. */
export function rowTileWidth(available: number, sizes: readonly number[]): number {
  const tiles = sizes.reduce((a, b) => a + b, 0);
  const gaps = (sizes.length - 1) * GROUP_GAP + (tiles - sizes.length) * INNER_GAP;
  return Math.floor((available - gaps) / tiles);
}

/** Every way to cut `n` groups, in order, into `rows` non-empty rows. */
function cuts(n: number, rows: number): number[][] {
  if (rows === 1) return [[n]];
  const out: number[][] = [];
  for (let first = 1; first <= n - rows + 1; first++) {
    for (const rest of cuts(n - first, rows - 1)) out.push([first, ...rest]);
  }
  return out;
}

/** The best split into exactly `rowCount` rows: biggest tiles, then the most even rows. */
function bestSplit(available: number, groups: readonly number[], rowCount: number) {
  let best: { width: number; spread: number; rows: number[][] } | undefined;
  for (const cut of cuts(groups.length, rowCount)) {
    const rows: number[][] = [];
    let at = 0;
    for (const size of cut) {
      rows.push(Array.from({ length: size }, (_, i) => at + i));
      at += size;
    }
    const widths = rows.map((r) => rowTileWidth(available, r.map((g) => groups[g])));
    const counts = rows.map((r) => r.reduce((n, g) => n + groups[g], 0));
    const width = Math.min(...widths);
    const spread = Math.max(...counts) - Math.min(...counts);
    if (!best || width > best.width || (width === best.width && spread < best.spread)) {
      best = { width, spread, rows };
    }
  }
  return best!;
}

/**
 * Chooses the fewest rows (up to three) whose tiles are at least
 * `COMFORT_TILE` wide, or the roomiest option if none is.
 */
export function layoutGroups(available: number, groups: readonly number[]): GroupLayout {
  if (groups.length === 0) return { width: MAX_GROUP_TILE, rows: [] };
  let roomiest: ReturnType<typeof bestSplit> | undefined;
  for (let rowCount = 1; rowCount <= Math.min(MAX_ROWS, groups.length); rowCount++) {
    const split = bestSplit(available, groups, rowCount);
    if (split.width >= COMFORT_TILE) return finish(split);
    if (!roomiest || split.width > roomiest.width) roomiest = split;
  }
  return finish(roomiest!);
}

function finish({ width, rows }: { width: number; rows: number[][] }): GroupLayout {
  return { width: Math.max(FLOOR_TILE, Math.min(MAX_GROUP_TILE, width)), rows };
}
