// The American Mah Jongg tile set: 152 tiles (docs/PRODUCT.md, rules scope).
//   3 suits (Bams, Craks, Dots), 1–9, 4 of each ........ 108
//   4 Winds (North, East, West, South), 4 of each ....... 16
//   3 Dragons (Red, Green, White/Soap), 4 of each ....... 12
//   Flowers ............................................... 8
//   Jokers ................................................ 8
//
// A TileKind is what a tile *is* for play. Two tiles of the same kind are
// interchangeable. All 8 flowers are one kind, as in American play; the
// physical set prints different flower art, which `copy` lets the UI vary.

import { shuffle, type Rng } from './rng';

export type Suit = 'bam' | 'crak' | 'dot';
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type Wind = 'N' | 'E' | 'W' | 'S';
export type Dragon = 'red' | 'green' | 'white';

export type TileKind =
  | { readonly type: 'suited'; readonly suit: Suit; readonly rank: Rank }
  | { readonly type: 'wind'; readonly wind: Wind }
  | { readonly type: 'dragon'; readonly dragon: Dragon }
  | { readonly type: 'flower' }
  | { readonly type: 'joker' };

export type TileType = TileKind['type'];

/** One physical tile in the set. `id` is unique within a set (0–151). */
export interface Tile {
  readonly id: number;
  readonly kind: TileKind;
  /** Which copy of its kind this tile is: 0–3, or 0–7 for flowers and jokers. */
  readonly copy: number;
}

export const SUITS: readonly Suit[] = ['bam', 'crak', 'dot'];
export const RANKS: readonly Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
/** Conventional listing order (N, E, W, S); not seat or turn order. */
export const WINDS: readonly Wind[] = ['N', 'E', 'W', 'S'];
export const DRAGONS: readonly Dragon[] = ['red', 'green', 'white'];

export const TILE_COUNT = 152;
const COPIES_PER_KIND = 4;
const FLOWER_COUNT = 8;
const JOKER_COUNT = 8;

/** Every distinct kind, in sorted order: Bams, Craks, Dots, Winds, Dragons, Flower, Joker. */
export const ALL_KINDS: readonly TileKind[] = [
  ...SUITS.flatMap((suit) => RANKS.map((rank): TileKind => ({ type: 'suited', suit, rank }))),
  ...WINDS.map((wind): TileKind => ({ type: 'wind', wind })),
  ...DRAGONS.map((dragon): TileKind => ({ type: 'dragon', dragon })),
  { type: 'flower' },
  { type: 'joker' },
];

/** How many tiles of this kind are in a full set. */
export function copiesOf(kind: TileKind): number {
  if (kind.type === 'flower') return FLOWER_COUNT;
  if (kind.type === 'joker') return JOKER_COUNT;
  return COPIES_PER_KIND;
}

/**
 * A stable string identity for a kind, e.g. `bam-3`, `wind-N`, `dragon-white`,
 * `flower`, `joker`. Use it to compare, count, and key tiles.
 */
export function tileKey(kind: TileKind): string {
  switch (kind.type) {
    case 'suited':
      return `${kind.suit}-${kind.rank}`;
    case 'wind':
      return `wind-${kind.wind}`;
    case 'dragon':
      return `dragon-${kind.dragon}`;
    case 'flower':
    case 'joker':
      return kind.type;
  }
}

export function sameKind(a: TileKind, b: TileKind): boolean {
  return tileKey(a) === tileKey(b);
}

/** A full 152-tile set in sorted order, with ids 0–151. */
export function createTileSet(): Tile[] {
  const tiles: Tile[] = [];
  for (const kind of ALL_KINDS) {
    const copies = copiesOf(kind);
    for (let copy = 0; copy < copies; copy++) {
      tiles.push({ id: tiles.length, kind, copy });
    }
  }
  return tiles;
}

/** A full set shuffled with the given RNG. The same seed gives the same wall. */
export function createShuffledTileSet(rng: Rng): Tile[] {
  return shuffle(createTileSet(), rng);
}

const SUIT_SHORT: Record<Suit, string> = { bam: 'Bam', crak: 'Crak', dot: 'Dot' };
const SUIT_LONG: Record<Suit, string> = { bam: 'Bamboo', crak: 'Characters', dot: 'Dots' };
const WIND_NAMES: Record<Wind, string> = { N: 'North', E: 'East', W: 'West', S: 'South' };
const DRAGON_SHORT: Record<Dragon, string> = { red: 'Red', green: 'Green', white: 'Soap' };
const RANK_WORDS: Record<Rank, string> = {
  1: 'One',
  2: 'Two',
  3: 'Three',
  4: 'Four',
  5: 'Five',
  6: 'Six',
  7: 'Seven',
  8: 'Eight',
  9: 'Nine',
};

/** The compact name players use at the table: "3 Bam", "North", "Red", "Soap". */
export function tileName(kind: TileKind): string {
  switch (kind.type) {
    case 'suited':
      return `${kind.rank} ${SUIT_SHORT[kind.suit]}`;
    case 'wind':
      return WIND_NAMES[kind.wind];
    case 'dragon':
      return DRAGON_SHORT[kind.dragon];
    case 'flower':
      return 'Flower';
    case 'joker':
      return 'Joker';
  }
}

/**
 * The spoken VoiceOver/TalkBack label: "Three of Bamboo", "North Wind",
 * "Red Dragon", "White Dragon, Soap". Uses words, not digits, so screen
 * readers never read a rank as a quantity.
 */
export function tileA11yLabel(kind: TileKind): string {
  switch (kind.type) {
    case 'suited':
      return `${RANK_WORDS[kind.rank]} of ${SUIT_LONG[kind.suit]}`;
    case 'wind':
      return `${WIND_NAMES[kind.wind]} Wind`;
    case 'dragon':
      return kind.dragon === 'white' ? 'White Dragon, Soap' : `${DRAGON_SHORT[kind.dragon]} Dragon`;
    case 'flower':
      return 'Flower';
    case 'joker':
      return 'Joker';
  }
}
