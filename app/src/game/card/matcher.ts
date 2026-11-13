// Deciding Mah Jongg. A player declares with 14 tiles: the ones still on
// their rack (including the tile that completes the hand) plus any groups they
// exposed by calling discards. The hand is a win if some card hand, in some
// choice of suits and numbers, accounts for every tile under these rules
// (standard American play):
//
// - A Joker stands in for any tile in a group of 3 or more (pung, kong, quint).
//   Singles and pairs must be real tiles.
// - Every exposure is exactly one of the hand's groups of 3+: same tile, same
//   size. A pung can't be exposed toward a kong, and a single or pair is never
//   exposed before Mah Jongg (the tile that completes a pair counts as part of
//   the concealed 14 here).
// - A concealed (C) hand can have no exposures at all. It may still be won on
//   a discard, since that tile is part of the concealed 14.

import { copiesOf, tileKey, type TileKind } from '../tiles';
import { HAND_TILE_COUNT } from './notation';
import type { Hand, PracticeCard } from './types';
import { handVariants, MIN_JOKER_GROUP, type HandVariant } from './variants';

/** A group the player called and laid face up: e.g. two 4 Craks and a Joker. */
export type Exposure = readonly TileKind[];

/** Everything a player shows when declaring Mah Jongg. */
export type Declaration = {
  /** The tiles still on the rack, plus the winning tile. Order doesn't matter. */
  readonly concealed: readonly TileKind[];
  /** Groups exposed during play, in any order. */
  readonly exposures?: readonly Exposure[];
};

/** How one of the hand's groups was filled. */
export type MatchedUnit = {
  readonly kind: TileKind;
  readonly count: number;
  /** Real tiles of `kind` in the group. */
  readonly naturals: number;
  /** Jokers standing in; `naturals + jokers === count`. Always 0 for singles and pairs. */
  readonly jokers: number;
  /** Index into `exposures` if this group was exposed, otherwise null. */
  readonly exposure: number | null;
};

/** A card hand that the declared tiles complete. */
export type HandMatch = {
  readonly hand: Hand;
  /** The suit and number choices the tiles make. */
  readonly variant: HandVariant;
  /** The hand's groups in printed order, each with how it was filled. */
  readonly units: readonly MatchedUnit[];
  /** Jokers in the whole hand, exposed or concealed. */
  readonly jokers: number;
};

/** Why a declaration isn't a set of tiles that could be on the table at all. */
export type DeclarationProblem =
  /** Not exactly 14 tiles, counting exposures. */
  | 'tile-count'
  /** More of one tile than a 152-tile set holds (4 of each, 8 Flowers, 8 Jokers). */
  | 'too-many-copies'
  /** An exposure smaller than a pung. */
  | 'exposure-too-small'
  /** An exposure mixing two different tiles. */
  | 'exposure-mixed'
  /** An exposure of only Jokers. Every exposure starts with a called discard, and a discarded Joker can't be called. */
  | 'exposure-all-jokers';

const isJoker = (kind: TileKind) => kind.type === 'joker';

/** Null if the declaration could be on the table; otherwise what's wrong with it. */
export function declarationProblem(declaration: Declaration): DeclarationProblem | null {
  const exposures = declaration.exposures ?? [];
  const all = [...declaration.concealed, ...exposures.flat()];
  if (all.length !== HAND_TILE_COUNT) return 'tile-count';

  const copies = new Map<string, number>();
  for (const kind of all) {
    const key = tileKey(kind);
    const n = (copies.get(key) ?? 0) + 1;
    if (n > copiesOf(kind)) return 'too-many-copies';
    copies.set(key, n);
  }

  for (const exposure of exposures) {
    if (exposure.length < MIN_JOKER_GROUP) return 'exposure-too-small';
    const naturals = new Set(exposure.filter((k) => !isJoker(k)).map(tileKey));
    if (naturals.size === 0) return 'exposure-all-jokers';
    if (naturals.size > 1) return 'exposure-mixed';
  }
  return null;
}

/** An exposure reduced to what matters for matching. */
type ExposedGroup = { readonly key: string; readonly size: number; readonly jokers: number };

/** A declaration counted up once, so every variant can be checked against it quickly. */
type Tally = {
  /** Real concealed tiles, by tile key. */
  readonly naturals: ReadonlyMap<string, number>;
  readonly jokers: number;
  readonly exposed: readonly ExposedGroup[];
};

function tally(declaration: Declaration): Tally {
  const naturals = new Map<string, number>();
  let jokers = 0;
  for (const kind of declaration.concealed) {
    if (isJoker(kind)) jokers += 1;
    else naturals.set(tileKey(kind), (naturals.get(tileKey(kind)) ?? 0) + 1);
  }
  const exposed = (declaration.exposures ?? []).map((tiles) => {
    const natural = tiles.find((k) => !isJoker(k)) as TileKind;
    return { key: tileKey(natural), size: tiles.length, jokers: tiles.filter(isJoker).length };
  });
  return { naturals, jokers, exposed };
}

/**
 * Fits a tally to one concrete variant, or returns null. Exposures each claim
 * a unit of the same tile and size; groups that match on both are identical,
 * so taking the first free one never loses a solution. What's left must come
 * from the rack: per tile, singles and pairs need real tiles, and groups of
 * 3+ take real tiles or Jokers. The counts always total 14, so if every tile
 * fits within those bounds the Jokers fill the remaining places exactly.
 */
function fitVariant(variant: HandVariant, t: Tally): MatchedUnit[] | null {
  const { units } = variant;
  const keys = units.map((u) => tileKey(u.kind));
  const exposureOf: (number | null)[] = units.map(() => null);

  for (let e = 0; e < t.exposed.length; e++) {
    const { key, size } = t.exposed[e];
    const i = units.findIndex((u, j) => exposureOf[j] === null && u.count === size && keys[j] === key);
    if (i < 0) return null;
    exposureOf[i] = e;
  }

  // What the rack has to supply, per tile.
  const need = new Map<string, { strict: number; flexible: number }>();
  units.forEach((u, i) => {
    if (exposureOf[i] !== null) return;
    const n = need.get(keys[i]) ?? { strict: 0, flexible: 0 };
    if (u.count < MIN_JOKER_GROUP) n.strict += u.count;
    else n.flexible += u.count;
    need.set(keys[i], n);
  });
  for (const [key, have] of t.naturals) {
    const n = need.get(key);
    if (!n || have > n.strict + n.flexible) return null;
  }
  for (const [key, n] of need) {
    if ((t.naturals.get(key) ?? 0) < n.strict) return null;
  }

  // A fit exists. Lay the rack's real tiles into groups in printed order:
  // singles and pairs first, then the bigger groups, with Jokers in the gaps.
  const spare = new Map<string, number>();
  for (const [key, n] of need) spare.set(key, (t.naturals.get(key) ?? 0) - n.strict);
  return units.map((u, i) => {
    const e = exposureOf[i];
    if (e !== null) {
      const { jokers } = t.exposed[e];
      return { kind: u.kind, count: u.count, naturals: u.count - jokers, jokers, exposure: e };
    }
    if (u.count < MIN_JOKER_GROUP) return { kind: u.kind, count: u.count, naturals: u.count, jokers: 0, exposure: null };
    const left = spare.get(keys[i]) ?? 0;
    const naturals = Math.min(left, u.count);
    spare.set(keys[i], left - naturals);
    return { kind: u.kind, count: u.count, naturals, jokers: u.count - naturals, exposure: null };
  });
}

const variantCache = new WeakMap<Hand, readonly HandVariant[]>();

function variantsOf(hand: Hand): readonly HandVariant[] {
  let variants = variantCache.get(hand);
  if (!variants) {
    variants = handVariants(hand.groups);
    variantCache.set(hand, variants);
  }
  return variants;
}

function matchTally(hand: Hand, t: Tally): HandMatch | null {
  if (hand.concealed && t.exposed.length > 0) return null;
  for (const variant of variantsOf(hand)) {
    const units = fitVariant(variant, t);
    if (units) return { hand, variant, units, jokers: units.reduce((sum, u) => sum + u.jokers, 0) };
  }
  return null;
}

/**
 * Whether the declared tiles complete this one hand. Null if they don't, or
 * if the declaration has a problem (see `declarationProblem`).
 */
export function matchHand(hand: Hand, declaration: Declaration): HandMatch | null {
  if (declarationProblem(declaration)) return null;
  return matchTally(hand, tally(declaration));
}

/**
 * Every card hand the declared tiles complete, highest value first (card order
 * breaks ties). Empty means no Mah Jongg: the tiles fit no hand, or the
 * declaration has a problem (see `declarationProblem`). Real tiles pin a
 * hand down, but Jokers can leave more than one hand complete; the player
 * scores whichever pays most.
 */
export function findMahJongg(declaration: Declaration, card: PracticeCard): HandMatch[] {
  if (declarationProblem(declaration)) return [];
  const t = tally(declaration);
  const matches: HandMatch[] = [];
  for (const hand of card.hands) {
    const match = matchTally(hand, t);
    if (match) matches.push(match);
  }
  // Array sort is stable, so equal values keep card order.
  return matches.sort((a, b) => b.hand.value - a.hand.value);
}
