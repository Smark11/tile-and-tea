import { isRackSorted, moveTile, sortRack } from '../rack';
import { createRng } from '../rng';
import { ALL_KINDS, createShuffledTileSet, createTileSet, tileKey, type Tile } from '../tiles';

const kindOrder = new Map(ALL_KINDS.map((kind, i) => [tileKey(kind), i]));

/** The first 14 tiles of a seeded deal: a realistic, unsorted rack. */
function dealtRack(seed: number | string = 7): Tile[] {
  return createShuffledTileSet(createRng(seed)).slice(0, 14);
}

describe('sortRack', () => {
  it('orders Bams, Craks, Dots by rank, then Winds, Dragons, Flowers, Jokers', () => {
    const sorted = sortRack(createShuffledTileSet(createRng('sort-all')));
    const keys = sorted.map((t) => tileKey(t.kind));
    expect(keys[0]).toBe('bam-1');
    expect(keys.slice(32, 40)).toEqual([...Array(4).fill('bam-9'), ...Array(4).fill('crak-1')]);
    expect(keys.slice(-16)).toEqual([...Array(8).fill('flower'), ...Array(8).fill('joker')]);
    const ranks = sorted.map((t) => kindOrder.get(tileKey(t.kind))!);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it('orders winds N, E, W, S and dragons Red, Green, Soap', () => {
    const honors = createTileSet().filter((t) => t.kind.type === 'wind' || t.kind.type === 'dragon');
    const keys = [...new Set(sortRack([...honors].reverse()).map((t) => tileKey(t.kind)))];
    expect(keys).toEqual([
      'wind-N',
      'wind-E',
      'wind-W',
      'wind-S',
      'dragon-red',
      'dragon-green',
      'dragon-white',
    ]);
  });

  it('keeps every tile, returns a new array, and leaves the input alone', () => {
    const rack = dealtRack();
    const before = [...rack];
    const sorted = sortRack(rack);
    expect(sorted).not.toBe(rack);
    expect(rack).toEqual(before);
    expect(sorted.map((t) => t.id).sort((a, b) => a - b)).toEqual(
      rack.map((t) => t.id).sort((a, b) => a - b),
    );
  });

  it('is deterministic for same-kind tiles, so a sorted rack sorts to itself', () => {
    const rack = dealtRack('pairs');
    const once = sortRack(rack);
    expect(sortRack(once)).toEqual(once);
    expect(sortRack([...rack].reverse())).toEqual(once);
  });

  it('handles empty and single-tile racks', () => {
    expect(sortRack([])).toEqual([]);
    const [one] = createTileSet();
    expect(sortRack([one])).toEqual([one]);
  });
});

describe('isRackSorted', () => {
  it('is true exactly when sortRack would change nothing', () => {
    for (const seed of [1, 2, 3, 'a', 'b']) {
      const rack = dealtRack(seed);
      expect(isRackSorted(sortRack(rack))).toBe(true);
      const unchanged = sortRack(rack).every((t, i) => t === rack[i]);
      expect(isRackSorted(rack)).toBe(unchanged);
    }
  });

  it('notices two copies of the same kind out of order', () => {
    const fours = createTileSet().filter((t) => tileKey(t.kind) === 'dot-4');
    expect(isRackSorted(fours)).toBe(true);
    expect(isRackSorted([fours[1], fours[0]])).toBe(false);
  });

  it('treats empty and single-tile racks as sorted', () => {
    expect(isRackSorted([])).toBe(true);
    expect(isRackSorted(createTileSet().slice(0, 1))).toBe(true);
  });
});

describe('moveTile', () => {
  const abc = ['a', 'b', 'c', 'd', 'e'];

  it('moves right, shifting the tiles in between left', () => {
    expect(moveTile(abc, 1, 3)).toEqual(['a', 'c', 'd', 'b', 'e']);
  });

  it('moves left, shifting the tiles in between right', () => {
    expect(moveTile(abc, 4, 0)).toEqual(['e', 'a', 'b', 'c', 'd']);
  });

  it('returns an equal copy when nothing moves', () => {
    const same = moveTile(abc, 2, 2);
    expect(same).toEqual(abc);
    expect(same).not.toBe(abc);
  });

  it('clamps targets past either end', () => {
    expect(moveTile(abc, 0, 99)).toEqual(['b', 'c', 'd', 'e', 'a']);
    expect(moveTile(abc, 3, -5)).toEqual(['d', 'a', 'b', 'c', 'e']);
  });

  it('ignores a source index outside the rack', () => {
    expect(moveTile(abc, -1, 2)).toEqual(abc);
    expect(moveTile(abc, 5, 0)).toEqual(abc);
    expect(moveTile([], 0, 0)).toEqual([]);
  });

  it('never mutates its input', () => {
    const input = [...abc];
    moveTile(input, 0, 4);
    expect(input).toEqual(abc);
  });
});
