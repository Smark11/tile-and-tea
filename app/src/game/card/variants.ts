// Turning a hand into the concrete tiles it can be played with. A hand with
// choices in it ("any 2 suits", "any like number") stands for many concrete
// variants. The matcher (M2.2) and hand distance (M2.3) work on these.

import { copiesOf, SUIT_DRAGON, SUITS, tileKey, type Rank, type Suit, type TileKind } from '../tiles';
import { maxOffsetOf, suitVarsOf } from './notation';
import type { Hand, HandGroup, SuitVar, TileSpec } from './types';

/** A unit with its choices made: e.g. a pung of 4 Craks. */
export type ConcreteUnit = { readonly kind: TileKind; readonly count: number };

export type HandVariant = {
  /** The hand's units in printed order, with suits and numbers filled in. */
  readonly units: readonly ConcreteUnit[];
  /** The choices that made it. `x` is null when the hand has no x. */
  readonly suits: Readonly<Partial<Record<SuitVar, Suit>>>;
  readonly x: Rank | null;
  /** Identifies the variant's tiles and group sizes regardless of choices. */
  readonly key: string;
};

/** A single or a pair must be real tiles; Jokers only fill groups of 3 or more. */
export const MIN_JOKER_GROUP = 3;

export const JOKERS_IN_SET = copiesOf({ type: 'joker' });

/** Every ordered pick of `k` different suits. */
function suitPicks(k: number): Suit[][] {
  if (k === 0) return [[]];
  return suitPicks(k - 1).flatMap((pick) => SUITS.filter((s) => !pick.includes(s)).map((s) => [...pick, s]));
}

function resolve(spec: TileSpec, suits: Partial<Record<SuitVar, Suit>>, x: number): TileKind {
  switch (spec.type) {
    case 'fixed':
      return spec.kind;
    case 'dragonOf':
      return { type: 'dragon', dragon: SUIT_DRAGON[suits[spec.suit] as Suit] };
    case 'number':
      return { type: 'suited', suit: suits[spec.suit] as Suit, rank: spec.rank };
    case 'numberVar':
      return { type: 'suited', suit: suits[spec.suit] as Suit, rank: (x + spec.offset) as Rank };
  }
}

function variantKey(units: readonly ConcreteUnit[]): string {
  return units
    .map((u) => `${tileKey(u.kind)}*${u.count}`)
    .sort()
    .join(' ');
}

/**
 * Every distinct way to play a hand. Swapping two suits that play the same
 * part gives the same tiles, so variants are deduplicated by `key`; the first
 * set of choices found is kept.
 */
export function handVariants(groups: readonly HandGroup[]): HandVariant[] {
  const vars = suitVarsOf(groups);
  const maxOffset = maxOffsetOf(groups);
  const xs: (Rank | null)[] = maxOffset === null ? [null] : ([1, 2, 3, 4, 5, 6, 7, 8, 9] as Rank[]).filter((n) => n + maxOffset <= 9);
  const seen = new Map<string, HandVariant>();
  for (const pick of suitPicks(vars.length)) {
    const suits: Partial<Record<SuitVar, Suit>> = {};
    vars.forEach((v, i) => (suits[v] = pick[i]));
    for (const x of xs) {
      const units = groups.flatMap((g) => g.units.map((u) => ({ kind: resolve(u.tile, suits, x ?? 0), count: u.count })));
      const key = variantKey(units);
      if (!seen.has(key)) seen.set(key, { units, suits, x, key });
    }
  }
  return [...seen.values()];
}

/**
 * How many Jokers a variant needs at the least, since a full set has only 4 of
 * each tile (8 Flowers). Null if no number of Jokers can make it, because its
 * singles and pairs alone need more real tiles than exist.
 */
export function jokersNeeded(units: readonly ConcreteUnit[]): number | null {
  const totals = new Map<string, { kind: TileKind; all: number; natural: number }>();
  for (const { kind, count } of units) {
    const key = tileKey(kind);
    const t = totals.get(key) ?? { kind, all: 0, natural: 0 };
    t.all += count;
    if (count < MIN_JOKER_GROUP) t.natural += count;
    totals.set(key, t);
  }
  let jokers = 0;
  for (const { kind, all, natural } of totals.values()) {
    const copies = copiesOf(kind);
    if (natural > copies) return null;
    jokers += Math.max(0, all - copies);
  }
  return jokers;
}

const variantCache = new WeakMap<Hand, readonly HandVariant[]>();

/** `handVariants` for a card hand, worked out once and then reused. */
export function variantsOf(hand: Hand): readonly HandVariant[] {
  let variants = variantCache.get(hand);
  if (!variants) {
    variants = handVariants(hand.groups);
    variantCache.set(hand, variants);
  }
  return variants;
}

/** True if a full 152-tile set can make this variant. */
export function isBuildable(units: readonly ConcreteUnit[]): boolean {
  const jokers = jokersNeeded(units);
  return jokers !== null && jokers <= JOKERS_IN_SET;
}
