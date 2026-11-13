// Shorthand for writing lesson content: `bam(3)`, `RED`, `pung(dot(7))`.

import type { Rank, TileKind } from '../../tiles';

export const bam = (rank: Rank): TileKind => ({ type: 'suited', suit: 'bam', rank });
export const crak = (rank: Rank): TileKind => ({ type: 'suited', suit: 'crak', rank });
export const dot = (rank: Rank): TileKind => ({ type: 'suited', suit: 'dot', rank });

export const NORTH: TileKind = { type: 'wind', wind: 'N' };
export const EAST: TileKind = { type: 'wind', wind: 'E' };
export const WEST: TileKind = { type: 'wind', wind: 'W' };
export const SOUTH: TileKind = { type: 'wind', wind: 'S' };

export const RED: TileKind = { type: 'dragon', dragon: 'red' };
export const GREEN: TileKind = { type: 'dragon', dragon: 'green' };
export const SOAP: TileKind = { type: 'dragon', dragon: 'white' };

export const FLOWER: TileKind = { type: 'flower' };
export const JOKER: TileKind = { type: 'joker' };

/** `count` copies of one tile, e.g. `of(3, dot(7))` for a pung of 7 Dots. */
export const of = (count: number, tile: TileKind): TileKind[] => Array.from({ length: count }, () => tile);
