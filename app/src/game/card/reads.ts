// Reading an opponent's exposures: which hands they can still be making, and
// which tiles those hands can use, from what the player can see.
//
// American Mah Jongg players expose only groups their hand needs, so a
// player's exposures narrow their hand down. A hand is still possible for
// them when, for some choice of suits and numbers:
//
// - every exposure is one of its groups of 3+ (same tile, same size), and it
//   isn't a concealed hand;
// - its singles and pairs can still be finished with real tiles, and its
//   other groups with real tiles or Jokers, from the copies no one has seen.
//
// A tile is "wanted" when one of those possible hands has an open place for
// it. Offering a wanted tile is a risk: the player can call it to expose a
// group (3+), or for Mah Jongg (any place). What sits on their rack is unknown,
// so this is about possibility, never certainty.

import { ALL_KINDS, copiesOf, sameKind, tileKey, type TileKind } from '../tiles';
import type { Exposure } from './matcher';
import type { Hand, PracticeCard } from './types';
import { JOKERS_IN_SET, MIN_JOKER_GROUP, variantsOf, type ConcreteUnit, type HandVariant } from './variants';

/** A hand (with its suit and number choices) an opponent's exposures fit. */
export type PossibleHand = {
  readonly hand: Hand;
  readonly variant: HandVariant;
  /** The variant's groups no exposure fills yet, in printed order. */
  readonly open: readonly ConcreteUnit[];
};

export type ExposureRead = {
  /** Every possible hand and variant, in card order. */
  readonly possible: readonly PossibleHand[];
  /** The distinct hands among them, in card order. */
  readonly hands: readonly Hand[];
};

/** How many copies of each tile no one has seen, given what's visible. */
function unseenCounts(visible: readonly TileKind[]): Map<string, number> {
  const left = new Map(ALL_KINDS.map((k) => [tileKey(k), copiesOf(k)]));
  for (const k of visible) left.set(tileKey(k), (left.get(tileKey(k)) ?? 0) - 1);
  return left;
}

/** The variant's units with each exposure pinned to an identical unit, or null if one doesn't fit. */
function openUnits(variant: HandVariant, exposures: readonly Exposure[]): ConcreteUnit[] | null {
  const open = [...variant.units];
  for (const exposure of exposures) {
    const natural = exposure.find((k) => k.type !== 'joker');
    if (!natural) return null;
    const at = open.findIndex((u) => u.count === exposure.length && sameKind(u.kind, natural));
    if (at < 0) return null;
    open.splice(at, 1);
  }
  return open;
}

/** Whether the open units can still be finished from the unseen tiles. */
function finishable(open: readonly ConcreteUnit[], unseen: Map<string, number>, jokersLeft: number): boolean {
  const strict = new Map<string, number>();
  const flex = new Map<string, number>();
  for (const u of open) {
    const into = u.count < MIN_JOKER_GROUP ? strict : flex;
    into.set(tileKey(u.kind), (into.get(tileKey(u.kind)) ?? 0) + u.count);
  }
  let jokersNeeded = 0;
  for (const key of new Set([...strict.keys(), ...flex.keys()])) {
    const real = unseen.get(key) ?? 0;
    const s = strict.get(key) ?? 0;
    if (s > real) return false;
    jokersNeeded += Math.max(0, (flex.get(key) ?? 0) - (real - s));
  }
  return jokersNeeded <= jokersLeft;
}

/**
 * The hands an opponent with these exposures can still be making. `seen` is
 * everything else the reader can see: their own rack, the discards, and the
 * other players' exposures (not these).
 */
export function readExposures(
  exposures: readonly Exposure[],
  seen: readonly TileKind[],
  card: PracticeCard,
): ExposureRead {
  const visible = [...seen, ...exposures.flat()];
  const unseen = unseenCounts(visible);
  const jokersLeft = JOKERS_IN_SET - visible.filter((k) => k.type === 'joker').length;
  const possible = fitting(exposures, card).filter((p) => finishable(p.open, unseen, jokersLeft));
  const hands = card.hands.filter((h) => possible.some((p) => p.hand === h));
  return { possible, hands };
}

const fitCache = new WeakMap<PracticeCard, Map<string, readonly PossibleHand[]>>();

/** Every variant the exposures fit, whatever is visible. Cached: an advisor reads the same exposures many times. */
function fitting(exposures: readonly Exposure[], card: PracticeCard): readonly PossibleHand[] {
  let byKey = fitCache.get(card);
  if (!byKey) fitCache.set(card, (byKey = new Map()));
  const key = exposures.map((e) => e.map(tileKey).join(',')).join('|');
  let fits = byKey.get(key);
  if (!fits) {
    const found: PossibleHand[] = [];
    for (const hand of card.hands) {
      if (hand.concealed && exposures.length > 0) continue;
      for (const variant of variantsOf(hand)) {
        const open = openUnits(variant, exposures);
        if (open) found.push({ hand, variant, open });
      }
    }
    // Plenty for any game's exposures; keeps a long session from growing it without end.
    if (byKey.size > 500) byKey.clear();
    byKey.set(key, (fits = found));
  }
  return fits;
}

/** How a possible hand could use a tile: in a group of 3+ (callable now), or only as a single or pair (callable for Mah Jongg). */
export type TileUse = 'group' | 'pair';

/**
 * The possible hands with an open place for `kind`, and the strongest use
 * among them. Jokers are never wanted: a discarded Joker can't be called.
 */
export function wantedBy(read: ExposureRead, kind: TileKind): { hands: Hand[]; use: TileUse } | null {
  if (kind.type === 'joker') return null;
  let group = false;
  const hands: Hand[] = [];
  for (const p of read.possible) {
    const units = p.open.filter((u) => sameKind(u.kind, kind));
    if (units.length === 0) continue;
    if (!hands.includes(p.hand)) hands.push(p.hand);
    if (units.some((u) => u.count >= MIN_JOKER_GROUP)) group = true;
  }
  return hands.length === 0 ? null : { hands, use: group ? 'group' : 'pair' };
}
