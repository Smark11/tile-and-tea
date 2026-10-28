import { createRng } from '../rng';
import {
  ALL_KINDS,
  TILE_COUNT,
  copiesOf,
  createShuffledTileSet,
  createTileSet,
  sameKind,
  tileA11yLabel,
  tileKey,
  tileName,
  type Tile,
  type TileKind,
  type TileType,
} from '../tiles';

function countBy<T>(items: readonly T[], key: (item: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  return counts;
}

const ofType = (tiles: Tile[], type: TileType) => tiles.filter((t) => t.kind.type === type);

describe('createTileSet', () => {
  const set = createTileSet();

  it('has 152 tiles', () => {
    expect(set).toHaveLength(152);
    expect(TILE_COUNT).toBe(152);
  });

  it('has 108 suited tiles: 3 suits × 9 ranks × 4', () => {
    const suited = ofType(set, 'suited');
    expect(suited).toHaveLength(108);
    for (const suit of ['bam', 'crak', 'dot']) {
      const ofSuit = suited.filter((t) => t.kind.type === 'suited' && t.kind.suit === suit);
      expect(ofSuit).toHaveLength(36);
      for (let rank = 1; rank <= 9; rank++) {
        expect(ofSuit.filter((t) => t.kind.type === 'suited' && t.kind.rank === rank)).toHaveLength(4);
      }
    }
  });

  it('has 16 Winds, 4 each of North, East, West, South', () => {
    const winds = ofType(set, 'wind');
    expect(winds).toHaveLength(16);
    expect(Object.fromEntries(countBy(winds, (t) => tileKey(t.kind)))).toEqual({
      'wind-N': 4,
      'wind-E': 4,
      'wind-W': 4,
      'wind-S': 4,
    });
  });

  it('has 12 Dragons, 4 each of Red, Green, and White (Soap)', () => {
    const dragons = ofType(set, 'dragon');
    expect(dragons).toHaveLength(12);
    expect(Object.fromEntries(countBy(dragons, (t) => tileKey(t.kind)))).toEqual({
      'dragon-red': 4,
      'dragon-green': 4,
      'dragon-white': 4,
    });
  });

  it('has exactly 8 Flowers and 8 Jokers', () => {
    expect(ofType(set, 'flower')).toHaveLength(8);
    expect(ofType(set, 'joker')).toHaveLength(8);
  });

  it('has 36 distinct kinds, each appearing copiesOf(kind) times', () => {
    const counts = countBy(set, (t) => tileKey(t.kind));
    expect(counts.size).toBe(36);
    expect(ALL_KINDS).toHaveLength(36);
    for (const kind of ALL_KINDS) {
      expect(counts.get(tileKey(kind))).toBe(copiesOf(kind));
    }
  });

  it('gives every tile a unique id 0–151 in order', () => {
    expect(set.map((t) => t.id)).toEqual([...Array(152).keys()]);
  });

  it('numbers copies 0..n-1 within each kind', () => {
    for (const kind of ALL_KINDS) {
      const copies = set.filter((t) => sameKind(t.kind, kind)).map((t) => t.copy);
      expect(copies).toEqual([...Array(copiesOf(kind)).keys()]);
    }
  });

  it('returns a fresh array each call', () => {
    expect(createTileSet()).not.toBe(createTileSet());
    expect(createTileSet()).toEqual(createTileSet());
  });
});

describe('tileKey and sameKind', () => {
  it('gives every kind a unique key', () => {
    const keys = ALL_KINDS.map(tileKey);
    expect(new Set(keys).size).toBe(ALL_KINDS.length);
  });

  it('formats keys stably', () => {
    expect(tileKey({ type: 'suited', suit: 'bam', rank: 3 })).toBe('bam-3');
    expect(tileKey({ type: 'wind', wind: 'N' })).toBe('wind-N');
    expect(tileKey({ type: 'dragon', dragon: 'white' })).toBe('dragon-white');
    expect(tileKey({ type: 'flower' })).toBe('flower');
    expect(tileKey({ type: 'joker' })).toBe('joker');
  });

  it('compares by value, not identity', () => {
    expect(sameKind({ type: 'suited', suit: 'dot', rank: 5 }, { type: 'suited', suit: 'dot', rank: 5 })).toBe(true);
    expect(sameKind({ type: 'suited', suit: 'dot', rank: 5 }, { type: 'suited', suit: 'crak', rank: 5 })).toBe(false);
    expect(sameKind({ type: 'flower' }, { type: 'joker' })).toBe(false);
  });

  it('treats all 8 flowers as the same kind', () => {
    const flowers = ofType(createTileSet(), 'flower');
    expect(flowers.every((f) => sameKind(f.kind, flowers[0].kind))).toBe(true);
  });
});

describe('names', () => {
  const cases: [TileKind, string, string][] = [
    [{ type: 'suited', suit: 'bam', rank: 3 }, '3 Bam', 'Three of Bamboo'],
    [{ type: 'suited', suit: 'crak', rank: 1 }, '1 Crak', 'One of Characters'],
    [{ type: 'suited', suit: 'dot', rank: 9 }, '9 Dot', 'Nine of Dots'],
    [{ type: 'wind', wind: 'N' }, 'North', 'North Wind'],
    [{ type: 'wind', wind: 'E' }, 'East', 'East Wind'],
    [{ type: 'wind', wind: 'W' }, 'West', 'West Wind'],
    [{ type: 'wind', wind: 'S' }, 'South', 'South Wind'],
    [{ type: 'dragon', dragon: 'red' }, 'Red', 'Red Dragon'],
    [{ type: 'dragon', dragon: 'green' }, 'Green', 'Green Dragon'],
    [{ type: 'dragon', dragon: 'white' }, 'Soap', 'White Dragon, Soap'],
    [{ type: 'flower' }, 'Flower', 'Flower'],
    [{ type: 'joker' }, 'Joker', 'Joker'],
  ];

  it.each(cases)('%j is "%s" / "%s"', (kind, name, label) => {
    expect(tileName(kind)).toBe(name);
    expect(tileA11yLabel(kind)).toBe(label);
  });

  it('gives every distinct kind a unique name and label', () => {
    expect(new Set(ALL_KINDS.map(tileName)).size).toBe(36);
    expect(new Set(ALL_KINDS.map(tileA11yLabel)).size).toBe(36);
  });

  it('never puts digits in a11y labels', () => {
    for (const kind of ALL_KINDS) expect(tileA11yLabel(kind)).not.toMatch(/\d/);
  });
});

describe('createShuffledTileSet', () => {
  const ids = (tiles: Tile[]) => tiles.map((t) => t.id);

  it('is deterministic for the same seed', () => {
    expect(createShuffledTileSet(createRng(42))).toEqual(createShuffledTileSet(createRng(42)));
    expect(createShuffledTileSet(createRng('table-7'))).toEqual(createShuffledTileSet(createRng('table-7')));
  });

  it('replays the same wall for a saved seed (golden deal)', () => {
    // Pinned so reordering ALL_KINDS or the build loop in createTileSet can't silently change saved deals.
    const deal = createShuffledTileSet(createRng(42)).slice(0, 8);
    expect(deal.map((t) => [t.id, tileKey(t.kind)])).toEqual([
      [16, 'bam-5'],
      [129, 'dragon-green'],
      [134, 'dragon-white'],
      [83, 'dot-3'],
      [132, 'dragon-white'],
      [13, 'bam-4'],
      [43, 'crak-2'],
      [139, 'flower'],
    ]);
  });

  it('differs across seeds', () => {
    expect(ids(createShuffledTileSet(createRng(1)))).not.toEqual(ids(createShuffledTileSet(createRng(2))));
  });

  it('actually reorders the set', () => {
    expect(ids(createShuffledTileSet(createRng(1)))).not.toEqual(ids(createTileSet()));
  });

  it('is a permutation of the full set (nothing lost or duplicated)', () => {
    const shuffled = createShuffledTileSet(createRng(99));
    expect(shuffled).toHaveLength(152);
    expect([...ids(shuffled)].sort((a, b) => a - b)).toEqual([...Array(152).keys()]);
    expect(ofType(shuffled, 'joker')).toHaveLength(8);
    expect(ofType(shuffled, 'flower')).toHaveLength(8);
  });
});
