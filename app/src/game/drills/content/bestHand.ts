// "Best hand": a 13-tile rack is on the felt, and the player picks which of
// four card lines to aim for. It trains the first decision of every game:
// reading a rack against the card and committing to the hand it's closest to.
//
// The answer is never taken from how the rack was dealt. Hand distance
// (card/distance.ts) ranks every hand on the card, and the answer is the one
// hand closer than all the others. Every explanation is built from its plan:
// which of the rack's tiles it uses, and what is still to get.

import { cardDistances, CURRENT_CARD, handDistance, MIN_JOKER_GROUP, variantsOf, type HandDistance, type PracticeCard } from '../../card';
import { sortRack } from '../../rack';
import { createRng, shuffle, type Rng } from '../../rng';
import { copiesOf, createShuffledTileSet, sameKind, tileKey, tileName, type Tile, type TileKind } from '../../tiles';
import type { Drill, DrillEvaluation, DrillQuestion } from '../types';
import { capitalize, countWord, handById, handLabel, list, SUIT_PLURAL, tileCount, tilesWord } from './words';

export type BestHandData = {
  /** The rack, sorted the way players arrange it. */
  readonly rack: readonly TileKind[];
  /** The hand each choice shows, by id. */
  readonly handIds: readonly string[];
};

export const RACK_SIZE = 13;
const CHOICES = 4;
/** How many of the rack's tiles are drawn toward one hand, as if the Charleston had already shaped it. */
const SHAPED_TILES = [5, 6, 6, 7, 7, 8] as const;
/** The closest hand must be at least this near… */
const NEAREST = 2;
/** …and no further than this, so the rack has a real direction. */
const FURTHEST = 6;
/** Tempting lines sit this many tiles further than the answer, at most. */
const TEMPTING_GAP = 5;
const MAX_DEALS = 40;

function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)];
}

/**
 * A rack that looks like it came through the Charleston: part of one random
 * hand, the rest from the wall. Which hand it was drawn toward doesn't matter
 * to the question; the distances decide the answer.
 */
function dealRack(rng: Rng, card: PracticeCard): TileKind[] {
  const wall = createShuffledTileSet(rng);
  const variant = pick(variantsOf(pick(card.hands, rng)), rng);
  const wanted = shuffle(
    variant.units.flatMap((u) => Array.from({ length: u.count }, () => u.kind)),
    rng,
  ).slice(0, pick(SHAPED_TILES, rng));
  const rack: Tile[] = [];
  for (const kind of wanted) {
    const at = wall.findIndex((t) => sameKind(t.kind, kind));
    if (at >= 0) rack.push(...wall.splice(at, 1));
  }
  rack.push(...wall.slice(0, RACK_SIZE - rack.length));
  return sortRack(rack).map((t) => t.kind);
}

/** Reachable hands, closest first. A fresh rack has no exposures, so every hand is. */
function ranked(rack: readonly TileKind[], card: PracticeCard): HandDistance[] {
  return cardDistances({ concealed: rack }, card).filter((r): r is HandDistance => r.tilesAway !== null);
}

/** One clear closest hand, near enough to have a direction, with others behind it to tempt. */
function isDecisive(reach: readonly HandDistance[]): boolean {
  const [first, second] = reach;
  if (!first || !second) return false;
  if (first.tilesAway < NEAREST || first.tilesAway > FURTHEST) return false;
  if (second.tilesAway === first.tilesAway) return false;
  return reach.filter((r) => r.tilesAway - first.tilesAway <= TEMPTING_GAP).length >= CHOICES;
}

/**
 * The other three lines: the runner-up (one tile further, when there is one),
 * then the hands most likely to tempt: close behind, from sections not yet
 * shown, so the four lines don't all read alike.
 */
function otherChoices(reach: readonly HandDistance[], rng: Rng): HandDistance[] {
  const [best, ...rest] = reach;
  const near = rest.filter((r) => r.tilesAway - best.tilesAway <= TEMPTING_GAP);
  const chosen: HandDistance[] = [];
  const runnersUp = near.filter((r) => r.tilesAway === best.tilesAway + 1);
  if (runnersUp.length > 0) chosen.push(pick(runnersUp, rng));
  const pool = shuffle(
    near.filter((r) => !chosen.includes(r)),
    rng,
  ).sort((a, b) => a.tilesAway - b.tilesAway);
  const shown = new Set([best, ...chosen].map((r) => r.hand.category));
  while (chosen.length < CHOICES - 1) {
    const fresh = pool.find((r) => !chosen.includes(r) && !shown.has(r.hand.category));
    const next = fresh ?? pool.find((r) => !chosen.includes(r));
    if (!next) break;
    chosen.push(next);
    shown.add(next.hand.category);
  }
  return chosen;
}

type Family = 'bam' | 'crak' | 'dot' | 'honor' | 'flower' | 'joker';
const FAMILIES: readonly Family[] = ['bam', 'crak', 'dot', 'honor', 'flower', 'joker'];
const FAMILY_NAMES: Record<'bam' | 'crak' | 'dot' | 'honor', string> = { ...SUIT_PLURAL, honor: 'Honors' };
/** A group this small sits beside its neighbour on the felt, the way a real rack is arranged. */
const LONE_GROUP = 2;

function familyOf(kind: TileKind): Family {
  if (kind.type === 'suited') return kind.suit;
  if (kind.type === 'joker' || kind.type === 'flower') return kind.type;
  return 'honor';
}

/** Felt rows: suit groups, with any of two tiles or fewer joined to the next (or, last, the previous). */
export function feltGroups(sizes: readonly number[]): number[] {
  const rows: number[] = [];
  let carry = 0;
  for (const size of sizes) {
    if (size + carry <= LONE_GROUP) carry += size;
    else {
      rows.push(size + carry);
      carry = 0;
    }
  }
  if (carry > 0) {
    if (rows.length > 0) rows[rows.length - 1] += carry;
    else rows.push(carry);
  }
  return rows;
}

/** The rack in suit groups, as a player reads it: the sizes for the felt, and the spoken caption. */
export function rackGroups(rack: readonly TileKind[]): { groups: number[]; caption: string } {
  const present = FAMILIES.map((family) => ({ family, tiles: rack.filter((k) => familyOf(k) === family) })).filter(
    (f) => f.tiles.length > 0,
  );
  const caption = present
    .map(({ family, tiles }) => {
      if (family === 'joker' || family === 'flower') {
        return tileCount(tiles[0], tiles.length).replace(/^an? /, 'one ');
      }
      return `${FAMILY_NAMES[family]}: ${tiles.map((k) => (k.type === 'suited' ? String(k.rank) : tileName(k))).join(', ')}`;
    })
    .join('; ');
  return { groups: feltGroups(present.map((f) => f.tiles.length)), caption: `${capitalize(caption)}.` };
}

export function generateBestHand(seed: number, card: PracticeCard = CURRENT_CARD): DrillQuestion<BestHandData> {
  const rng = createRng(seed);
  let rack = dealRack(rng, card);
  let reach = ranked(rack, card);
  for (let deal = 1; deal < MAX_DEALS && !isDecisive(reach); deal++) {
    rack = dealRack(rng, card);
    reach = ranked(rack, card);
  }
  if (!isDecisive(reach)) throw new Error(`No decisive rack for seed ${seed}`);

  const hands = shuffle([reach[0], ...otherChoices(reach, rng)], rng).map((r) => r.hand);
  const { groups, caption } = rackGroups(rack);
  return {
    seed,
    key: rack.map(tileKey).join(','),
    prompt: 'Which hand should this rack go for?',
    instruction: 'Tap the line your tiles are closest to.',
    scene: { tiles: rack, groups, caption },
    choices: hands.map((h) => ({ kind: 'line', line: h.line, label: handLabel(h, card) })),
    picks: 1,
    data: { rack, handIds: hands.map((h) => h.id) },
  };
}

function distanceOf(handId: string, rack: readonly TileKind[], card: PracticeCard): HandDistance {
  const reach = handDistance(handById(handId, card), { concealed: rack });
  if (reach.tilesAway === null) throw new Error(`${handId} can't be made from the rack`);
  return reach;
}

/** Adds up tile counts by kind, in first-seen order. */
function tally(entries: readonly { kind: TileKind; n: number }[]): { kind: TileKind; n: number }[] {
  const out: { kind: TileKind; n: number }[] = [];
  for (const { kind, n } of entries) {
    if (n <= 0) continue;
    const seen = out.find((e) => sameKind(e.kind, kind));
    if (seen) seen.n += n;
    else out.push({ kind, n });
  }
  return out;
}

/**
 * How much of the rack the hand uses, and which tiles don't fit it (the ones
 * to pass or discard): "It uses 9 of your 13 tiles. Pass: an East, a Red
 * Dragon, a 4 Bam and a 9 Dot."
 */
export function usesSentence(plan: HandDistance, rack: readonly TileKind[]): string {
  const used = plan.units.reduce((n, u) => n + u.naturals + u.jokers, 0);
  const sentences = [`It uses ${used} of your ${rack.length} tiles.`];
  const spare = tally(rack.filter((k) => k.type !== 'joker').map((kind) => ({ kind, n: 1 }))).map(({ kind, n }) => ({
    kind,
    n: n - plan.units.filter((u) => sameKind(u.kind, kind)).reduce((sum, u) => sum + u.naturals, 0),
  }));
  const misfits = spare.filter((s) => s.n > 0);
  if (misfits.length > 0) {
    sentences.push(`Pass: ${list(misfits.map((s) => tileCount(s.kind, s.n)))}.`);
  }
  const idleJokers = rack.filter((k) => k.type === 'joker').length - plan.units.reduce((n, u) => n + u.jokers, 0);
  if (idleJokers > 0) {
    const why = plan.units.some((u) => u.count >= MIN_JOKER_GROUP)
      ? 'every place left is a single or a pair'
      : 'it has no pung or bigger';
    sentences.push(`${idleJokers === 1 ? 'Your Joker has' : 'Your Jokers have'} no place in it: ${why}.`);
  }
  return sentences.join(' ');
}

/**
 * What the hand still needs, by tile: "two Green Dragons, an East and a 6 Dot".
 * Past the real copies left in the set (a quint, say), the rest are Jokers.
 */
export function stillNeeded(plan: HandDistance, rack: readonly TileKind[]): string {
  const gaps = tally(plan.units.map((u) => ({ kind: u.kind, n: u.missing })));
  const parts: string[] = [];
  let jokers = 0;
  for (const { kind, n } of gaps) {
    const left = copiesOf(kind) - rack.filter((k) => sameKind(k, kind)).length;
    if (Math.min(n, left) > 0) parts.push(tileCount(kind, Math.min(n, left)));
    jokers += Math.max(0, n - left);
  }
  if (jokers > 0) parts.push(tileCount({ type: 'joker' }, jokers));
  return list(parts);
}

/**
 * The fine print that makes a hand harder than its distance says, most
 * pressing first: Jokers the set forces, a concealed hand, then whether a
 * Joker can fill the gaps at all. The explanation shows only the first.
 */
export function cautions(plan: HandDistance): string[] {
  const notes: string[] = [];
  if (plan.mustBeJokers > 0) {
    const one = plan.mustBeJokers === 1;
    notes.push(
      `A set holds only so many of each tile, so ${one ? 'the Joker' : `the ${countWord(plan.mustBeJokers)} Jokers`} on that list can’t be ${one ? 'a real tile' : 'real tiles'}.`,
    );
  }
  if (plan.hand.concealed) {
    notes.push('It’s a concealed hand, so you can’t call discards for it, except the tile that wins.');
  }
  const exact = plan.units.filter((u) => u.count < MIN_JOKER_GROUP).reduce((n, u) => n + u.missing, 0);
  if (exact > 0) {
    const which =
      exact === plan.tilesAway
        ? 'Every one of them fills a single or a pair'
        : exact === 1
          ? 'One of them fills a single or a pair'
          : `${capitalize(countWord(exact))} of them fill singles or pairs`;
    notes.push(`${which}, so only the exact tile will do: a Joker can’t help there.`);
  } else {
    notes.push('Every gap is in a pung or bigger, so any Joker you draw helps.');
  }
  return notes;
}

/**
 * Why the answer is the hand to go for, built from its plan, after a one-line
 * lead. Three short paragraphs: the comparison, what the rack uses (and what to
 * pass), then what's still to get with the one note that matters most.
 */
export function explainBest(plan: HandDistance, rack: readonly TileKind[], lead: string): string {
  return [lead, usesSentence(plan, rack), `Still to get: ${stillNeeded(plan, rack)}. ${cautions(plan)[0]}`].join('\n\n');
}

/** The lead: the answer's distance, and the pick's when it's a different line. */
export function leadSentence(best: HandDistance, picked: HandDistance, card: PracticeCard = CURRENT_CARD): string {
  const answer = `${handLabel(best.hand, card)} is ${tilesWord(best.tilesAway)} away`;
  if (picked.tilesAway === best.tilesAway) return `${answer}, the closest on the card.`;
  return `${answer}; your pick is ${picked.tilesAway}.`;
}

export function evaluateBestHand(
  question: DrillQuestion<BestHandData>,
  picked: readonly number[],
  card: PracticeCard = CURRENT_CARD,
): DrillEvaluation {
  const { rack, handIds } = question.data;
  const choice = picked[0];
  if (picked.length !== 1 || !Number.isInteger(choice) || choice < 0 || choice >= handIds.length) {
    throw new RangeError('Pick exactly one line');
  }
  const plans = handIds.map((id) => distanceOf(id, rack, card));
  const nearest = Math.min(...plans.map((p) => p.tilesAway));
  const best = plans.flatMap((p, i) => (p.tilesAway === nearest ? [i] : []));
  const answer = plans[best[0]];
  const explanation = explainBest(answer, rack, leadSentence(answer, plans[choice], card));
  const gap = plans[choice].tilesAway - nearest;
  if (gap === 0) return { verdict: 'best', score: 1, best, title: 'That’s the hand to chase', explanation };
  if (gap === 1) return { verdict: 'good', score: 0.5, best, title: 'Close: just one tile further', explanation };
  return { verdict: 'miss', score: 0, best, title: 'There’s a closer hand', explanation };
}

export const bestHand: Drill<BestHandData> = {
  id: 'best-hand',
  skill: 'hand-choice',
  title: 'Best hand',
  summary: 'Read a rack against the card and pick the hand to go for.',
  icon: { type: 'joker' },
  questionsPerRound: 5,
  generate: (seed) => generateBestHand(seed),
  evaluate: (question, picked) => evaluateBestHand(question, picked),
};
