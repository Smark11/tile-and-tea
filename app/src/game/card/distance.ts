// Hand distance: how far a rack is from each hand on the card.
//
// A hand's distance ("tiles away") is the fewest tiles the player still has
// to get, by drawing or calling, to complete it:
//
//   tilesAway = 14 − exposed tiles − the most rack tiles the hand can use
//
// so a 13-tile rack waiting on one tile is 1 away, and 14 tiles that make the
// hand are 0 away (exactly when `matchHand` agrees). It works for any rack of
// up to 14 tiles: past 13, every tile you get means one you discard.
//
// Rules (standard American play, as in the matcher):
// - A real tile fills a place of its own kind. A Joker fills any place in a
//   group of 3 or more, never a single or a pair.
// - Exposures are settled. Each must be one of the hand's groups of 3+ (same
//   tile, same size), and a concealed (C) hand allows none at all.
// - A set has 4 of each tile (8 Flowers). Copies on the player's own rack or
//   exposures can't be drawn again, so a single or pair whose last copies sit
//   in the player's exposures is out of reach, and a group short of real
//   copies has to be finished with Jokers (`mustBeJokers`). What the other
//   players have discarded or exposed isn't known here; the advisor weighs it.
//
// It's built for real time: each hand's variants are compiled once to tile
// indexes, and a rack is counted once for the whole card.

import { ALL_KINDS, copiesOf, tileKey, type TileKind } from '../tiles';
import { holdingProblem, type Declaration } from './matcher';
import { HAND_TILE_COUNT } from './notation';
import type { Hand, PracticeCard } from './types';
import { MIN_JOKER_GROUP, variantsOf, type HandVariant } from './variants';

/**
 * A player's tiles mid-game: the rack plus any exposed groups, up to 14 tiles
 * in all. The same shape as a `Declaration`.
 */
export type Holding = Declaration;

/** One of the hand's groups, and how much of it the player already has. */
export type PlannedUnit = {
  readonly kind: TileKind;
  readonly count: number;
  /** Real tiles of `kind` from the rack (or in the exposure) placed here. */
  readonly naturals: number;
  /** Jokers from the rack (or in the exposure) placed here. Always 0 for singles and pairs. */
  readonly jokers: number;
  /** Places still empty: `count − naturals − jokers`. */
  readonly missing: number;
  /** Index into the holding's `exposures` if this group is exposed, otherwise null. */
  readonly exposure: number | null;
};

/** A hand the player can still make, and the closest way to make it. */
export type HandDistance = {
  readonly hand: Hand;
  /** Tiles still needed; 0 means Mah Jongg. */
  readonly tilesAway: number;
  /** The suit and number choices closest to the rack. Ties go to the one needing fewer Jokers. */
  readonly variant: HandVariant;
  /** The hand's groups in printed order, with the rack's tiles laid into them. */
  readonly units: readonly PlannedUnit[];
  /** How many of the missing tiles can only be Jokers, because the player already holds every real copy. */
  readonly mustBeJokers: number;
};

export type UnreachableReason =
  /** A concealed hand, but the player has exposed a group. */
  | 'concealed-hand'
  /** Some exposure isn't one of the hand's groups in any choice of suits and numbers. */
  | 'exposures-dont-fit'
  /** The exposures fit, but a single or pair needs a real tile the player has already used up. */
  | 'tiles-gone';

/** A hand the player can no longer make. */
export type UnreachableHand = { readonly hand: Hand; readonly tilesAway: null; readonly reason: UnreachableReason };

export type HandReach = HandDistance | UnreachableHand;

const TILE_INDEX = new Map(ALL_KINDS.map((kind, i) => [tileKey(kind), i]));
const COPIES = ALL_KINDS.map(copiesOf);

const indexOf = (kind: TileKind): number => TILE_INDEX.get(tileKey(kind)) as number;

/** A variant reduced to tile indexes: per distinct tile, how many single/pair places and group-of-3+ places. */
type Compiled = {
  readonly variant: HandVariant;
  /** Tile index of each unit, in printed order. */
  readonly unitTiles: readonly number[];
  readonly tiles: readonly number[];
  readonly strict: readonly number[];
  readonly flex: readonly number[];
};

function compile(variant: HandVariant): Compiled {
  const unitTiles = variant.units.map((u) => indexOf(u.kind));
  const tiles: number[] = [];
  const strict: number[] = [];
  const flex: number[] = [];
  variant.units.forEach((u, i) => {
    let at = tiles.indexOf(unitTiles[i]);
    if (at < 0) {
      at = tiles.push(unitTiles[i]) - 1;
      strict.push(0);
      flex.push(0);
    }
    if (u.count < MIN_JOKER_GROUP) strict[at] += u.count;
    else flex[at] += u.count;
  });
  return { variant, unitTiles, tiles, strict, flex };
}

const compiledCache = new WeakMap<Hand, readonly Compiled[]>();

function compiledOf(hand: Hand): readonly Compiled[] {
  let compiled = compiledCache.get(hand);
  if (!compiled) {
    compiled = variantsOf(hand).map(compile);
    compiledCache.set(hand, compiled);
  }
  return compiled;
}

type ExposedGroup = { readonly tile: number; readonly size: number; readonly jokers: number };

/** A holding counted up once for the whole card. */
type Tally = {
  /** Real rack tiles, by tile index. */
  readonly rack: readonly number[];
  /** Real tiles anywhere in the holding (rack and exposures), by tile index. */
  readonly held: readonly number[];
  /** Jokers on the rack. */
  readonly jokers: number;
  readonly exposed: readonly ExposedGroup[];
  readonly exposedTiles: number;
};

function tally(holding: Holding): Tally {
  const rack = COPIES.map(() => 0);
  let jokers = 0;
  for (const kind of holding.concealed) {
    if (kind.type === 'joker') jokers += 1;
    else rack[indexOf(kind)] += 1;
  }
  const held = [...rack];
  const exposed = (holding.exposures ?? []).map((tiles) => {
    const naturals = tiles.filter((k) => k.type !== 'joker');
    const tile = indexOf(naturals[0]);
    held[tile] += naturals.length;
    return { tile, size: tiles.length, jokers: tiles.length - naturals.length };
  });
  return { rack, held, jokers, exposed, exposedTiles: exposed.reduce((n, e) => n + e.size, 0) };
}

/**
 * Pins each exposure to a free unit of the same tile and size, or returns
 * null. Such units are identical, so taking the first never loses a fit.
 * Returns each unit's exposure index, or -1.
 */
function fitExposures(c: Compiled, t: Tally): number[] | null {
  const exposureOf = c.unitTiles.map(() => -1);
  for (let e = 0; e < t.exposed.length; e++) {
    const { tile, size } = t.exposed[e];
    const i = c.unitTiles.findIndex((u, j) => exposureOf[j] < 0 && u === tile && c.variant.units[j].count === size);
    if (i < 0) return null;
    exposureOf[i] = e;
  }
  return exposureOf;
}

type Measure = { readonly away: number; readonly mustBeJokers: number };

/**
 * The variant's distance, or null if a single or pair can't be finished.
 * Real tiles take single and pair places first (only they can), then group
 * places; rack Jokers fill what group places are left. Using every real tile
 * that fits never costs a place, so this count is the most the rack can use.
 */
function measure(c: Compiled, t: Tally, exposureOf: readonly number[]): Measure | null {
  const flex = [...c.flex];
  exposureOf.forEach((e, i) => {
    if (e >= 0) flex[c.tiles.indexOf(c.unitTiles[i])] -= c.variant.units[i].count;
  });
  let used = 0;
  let open = 0;
  let forced = 0;
  for (let i = 0; i < c.tiles.length; i++) {
    const tile = c.tiles[i];
    const strict = c.strict[i];
    const have = t.rack[tile];
    const placed = Math.min(have, strict + flex[i]);
    const strictMissing = Math.max(0, strict - have);
    const flexMissing = flex[i] - Math.max(0, placed - strict);
    const drawable = COPIES[tile] - t.held[tile];
    if (strictMissing > drawable) return null;
    used += placed;
    open += flexMissing;
    forced += Math.max(0, flexMissing - (drawable - strictMissing));
  }
  const jokers = Math.min(t.jokers, open);
  // Rack Jokers go to the places only a Joker can fill first.
  return { away: HAND_TILE_COUNT - t.exposedTiles - used - jokers, mustBeJokers: Math.max(0, forced - jokers) };
}

/** Lays the rack's tiles into the variant's groups the way `measure` counts them. */
function plan(c: Compiled, t: Tally, exposureOf: readonly number[]): PlannedUnit[] {
  const { units } = c.variant;
  const spare = [...t.rack];
  const naturals = units.map(() => 0);
  const jokers = units.map(() => 0);
  const isFree = (i: number) => exposureOf[i] < 0;
  const isGroup = (i: number) => units[i].count >= MIN_JOKER_GROUP;

  exposureOf.forEach((e, i) => {
    if (e < 0) return;
    jokers[i] = t.exposed[e].jokers;
    naturals[i] = units[i].count - jokers[i];
  });
  // Real tiles: singles and pairs first, then groups, in printed order.
  for (const pass of [false, true]) {
    units.forEach((u, i) => {
      if (!isFree(i) || isGroup(i) !== pass) return;
      const tile = c.unitTiles[i];
      naturals[i] = Math.min(spare[tile], u.count);
      spare[tile] -= naturals[i];
    });
  }
  // Rack Jokers: first where no real copy is left to draw, then in printed order.
  const drawable = COPIES.map((n, tile) => n - t.held[tile]);
  units.forEach((u, i) => {
    if (isFree(i) && !isGroup(i)) drawable[c.unitTiles[i]] -= u.count - naturals[i];
  });
  let wild = t.jokers;
  units.forEach((u, i) => {
    if (!isFree(i) || !isGroup(i)) return;
    const tile = c.unitTiles[i];
    const missing = u.count - naturals[i];
    const fromWall = Math.min(missing, drawable[tile]);
    drawable[tile] -= fromWall;
    const add = Math.min(wild, missing - fromWall);
    jokers[i] += add;
    wild -= add;
  });
  units.forEach((u, i) => {
    if (!isFree(i) || !isGroup(i)) return;
    const add = Math.min(wild, u.count - naturals[i] - jokers[i]);
    jokers[i] += add;
    wild -= add;
  });

  return units.map((u, i) => ({
    kind: u.kind,
    count: u.count,
    naturals: naturals[i],
    jokers: jokers[i],
    missing: u.count - naturals[i] - jokers[i],
    exposure: isFree(i) ? null : exposureOf[i],
  }));
}

function reach(hand: Hand, t: Tally): HandReach {
  if (hand.concealed && t.exposed.length > 0) return { hand, tilesAway: null, reason: 'concealed-hand' };
  let best: { c: Compiled; exposureOf: number[]; m: Measure } | null = null;
  let exposuresFit = false;
  for (const c of compiledOf(hand)) {
    const exposureOf = fitExposures(c, t);
    if (!exposureOf) continue;
    exposuresFit = true;
    const m = measure(c, t, exposureOf);
    if (!m) continue;
    if (!best || m.away < best.m.away || (m.away === best.m.away && m.mustBeJokers < best.m.mustBeJokers)) {
      best = { c, exposureOf, m };
    }
  }
  if (!best) return { hand, tilesAway: null, reason: exposuresFit ? 'tiles-gone' : 'exposures-dont-fit' };
  const { c, exposureOf, m } = best;
  return { hand, tilesAway: m.away, variant: c.variant, units: plan(c, t, exposureOf), mustBeJokers: m.mustBeJokers };
}

function checked(holding: Holding): Tally {
  const problem = holdingProblem(holding);
  if (problem) throw new RangeError(`Not a possible holding: ${problem}`);
  return tally(holding);
}

/** How far the holding is from one hand. Throws a RangeError if the holding is impossible (see `holdingProblem`). */
export function handDistance(hand: Hand, holding: Holding): HandReach {
  return reach(hand, checked(holding));
}

/**
 * How far the holding is from every hand on the card: the closest first (card
 * order breaks ties), then the hands it can no longer make, in card order.
 * Throws a RangeError if the holding is impossible (see `holdingProblem`).
 */
export function cardDistances(holding: Holding, card: PracticeCard): HandReach[] {
  const t = checked(holding);
  const all = card.hands.map((hand) => reach(hand, t));
  const reachable = all.filter((r): r is HandDistance => r.tilesAway !== null);
  // Array sort is stable, so equal distances keep card order.
  reachable.sort((a, b) => a.tilesAway - b.tilesAway);
  return [...reachable, ...all.filter((r) => r.tilesAway === null)];
}
