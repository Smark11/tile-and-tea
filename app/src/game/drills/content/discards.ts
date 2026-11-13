// "Discards": a moment mid-game. The player has just drawn and holds 14
// tiles; one player has two groups exposed and there's a pile of discards.
// The player picks the tile to throw. It trains the decision made every turn:
// what the hand can do without, and what's safe to hand the table.
//
// The coach judges each discard by two things, in this order:
//
//   1. The closest live hand. Hand distance (card/distance.ts) counts every
//      tile the player can see as gone: the discards and the exposures. A hand
//      whose single or pair needs a tile that's all on the table is dead
//      ("dead tiles"), however close the rack alone makes it look.
//   2. Danger. An opponent's exposures narrow down their hand (card/reads.ts).
//      A tile that one of their possible hands still has a place for can be
//      called: to expose a group, or for Mah Jongg.
//
// A discard that keeps the closest live hand where it is, and isn't wanted by
// an exposed opponent, is `best`. Keeping the hand but feeding the opponent
// when a safe tile would do as well is `good`. Moving the hand a tile further
// is a `miss`. Only a player with two or more exposures is read: one exposure
// fits too many hands to say much.

import {
  cardDistances,
  CURRENT_CARD,
  handDistance,
  MIN_JOKER_GROUP,
  readExposures,
  variantsOf,
  wantedBy,
  type ExposureRead,
  type Hand,
  type HandDistance,
  type PracticeCard,
  type TileUse,
} from '../../card';
import { sortRack } from '../../rack';
import { createRng, shuffle, type Rng } from '../../rng';
import { copiesOf, createShuffledTileSet, sameKind, tileKey, type Tile, type TileKind } from '../../tiles';
import type { Drill, DrillChoice, DrillEvaluation, DrillQuestion, DrillTable, TableSeat } from '../types';
import { rackGroups } from './bestHand';
import { capitalize, countWord, GROUP_NAMES, groupName, handLabel, list, singular, tileCount } from './words';

export type TableExposure = { readonly seat: TableSeat; readonly groups: readonly (readonly TileKind[])[] };

export type DiscardData = {
  /** The player's 14 tiles, just after the draw, sorted the way players arrange them. */
  readonly rack: readonly TileKind[];
  /** Every tile on the table, oldest first. */
  readonly discards: readonly TileKind[];
  readonly exposures: readonly TableExposure[];
};

export const RACK_SIZE = 14;
/** Groups an opponent must have exposed before the coach reads their hand. */
export const READ_EXPOSURES = 2;
/** How many of the rack's tiles lean toward one hand, so the rack has a direction. */
const LEANING_TILES = [9, 10, 10, 11] as const;
/** …and how many toward a second hand. */
const BACKUP_TILES = [2, 3, 4] as const;
/** How many tiles are already on the table. */
const DISCARD_COUNTS = [8, 9, 10, 11, 12] as const;
/** How often the deal kills the hand the rack leans to, by discarding the tile its pair or single needs. */
const DEAD_TILE_CHANCE = 0.5;
/** The closest live hand is at least this near, mid-game… */
const NEAREST = 2;
/** …and no further than this. */
const FURTHEST = 4;
/** At most this share of the distinct discards may be best, so the question asks something. */
const MAX_BEST_SHARE = 0.45;
/** The rack offers at least this many different tiles to throw. */
const MIN_CHOICES = 6;
/** The exposed opponent's tiles fit at most this many hands, so the read is clear. */
const MAX_READ_HANDS = 3;
const MAX_DEALS = 120;
/** Singles or pairs the dead-tile trap tries before giving up on a deal. */
const TRAP_TRIES = 2;

const SEATS: readonly TableSeat[] = ['right', 'across', 'left'];
/** How the coach names each seat. */
export const SEAT_WORDS: Record<TableSeat, string> = {
  left: 'the player on your left',
  across: 'the player across',
  right: 'the player on your right',
};

const isJoker = (kind: TileKind) => kind.type === 'joker';

function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)];
}

function tilesOf(units: readonly { kind: TileKind; count: number }[]): TileKind[] {
  return units.flatMap((u) => Array.from({ length: u.count }, () => u.kind));
}

/**
 * A table mid-game: a rack leaning toward one hand, an opponent with two
 * groups of another hand exposed, and a pile of discards. Sometimes the pile
 * holds the rest of a tile the rack's hand needs for a single or pair, so the
 * hand the rack looks closest to is dead. Every tile comes from one set.
 */
function dealTable(rng: Rng, card: PracticeCard): DiscardData | null {
  const wall = createShuffledTileSet(rng);
  const take = (kind: TileKind): Tile | null => {
    const at = wall.findIndex((t) => sameKind(t.kind, kind));
    return at < 0 ? null : wall.splice(at, 1)[0];
  };

  // Mostly one hand, partly a neighbor from the same section (they share
  // tiles), so the rack has a plan and a fallback.
  const rack: Tile[] = [];
  const lean = (hand: Hand, count: number) => {
    const variant = pick(variantsOf(hand), rng);
    for (const kind of shuffle(tilesOf(variant.units), rng).slice(0, Math.min(count, RACK_SIZE - rack.length))) {
      const tile = take(kind);
      if (tile) rack.push(tile);
    }
  };
  const main = pick(card.hands, rng);
  lean(main, pick(LEANING_TILES, rng));
  lean(pick(card.hands.filter((h) => h.category === main.category), rng), pick(BACKUP_TILES, rng));
  rack.push(...wall.splice(0, RACK_SIZE - rack.length));

  // Two groups of an exposed hand, from tiles the rack left in the wall.
  const open = card.hands.filter((h) => !h.concealed);
  let exposed: TileKind[][] | null = null;
  for (let tries = 0; tries < 10 && !exposed; tries++) {
    const shown = pick(variantsOf(pick(open, rng)), rng);
    const groups = shuffle(
      shown.units.filter((u) => u.count >= MIN_JOKER_GROUP),
      rng,
    ).slice(0, READ_EXPOSURES);
    const tiles = groups.map((u) => tilesOf([u]));
    const need = (kind: TileKind) => tiles.flat().filter((k) => sameKind(k, kind)).length;
    const inWall = (kind: TileKind) => wall.filter((t) => sameKind(t.kind, kind)).length;
    if (groups.length === READ_EXPOSURES && tiles.flat().every((k) => inWall(k) >= need(k))) {
      exposed = tiles.map((g) => g.map((k) => take(k)!.kind));
    }
  }
  if (!exposed) return null;

  const discards: TileKind[] = [];
  if (rng() < DEAD_TILE_CHANCE) {
    const trap = deadTileTrap(rack, wall, exposed.flat(), card, rng);
    if (trap) {
      rack.splice(0, rack.length, ...trap.rack);
      wall.splice(0, wall.length, ...trap.wall);
      discards.push(...trap.discards);
    }
  }
  const count = pick(DISCARD_COUNTS, rng);
  while (discards.length < count) discards.push(wall.shift()!.kind);

  return {
    rack: sortRack(rack).map((t) => t.kind),
    discards: shuffle(discards, rng),
    exposures: [{ seat: pick(SEATS, rng), groups: exposed }],
  };
}

/**
 * Kills the hand the rack looks closest to with dead tiles: for one of its
 * singles or pairs, the rack keeps a copy fewer than the place needs (spares
 * go back for wall tiles) and every other copy lands on the table. Kept only
 * if that kills the hand, or sets it back (its closest choice of suits dies),
 * while the rack still looks closest to it and a live hand is within reach.
 * Null otherwise.
 */
function deadTileTrap(
  rack: readonly Tile[],
  wall: readonly Tile[],
  exposed: readonly TileKind[],
  card: PracticeCard,
  rng: Rng,
): { rack: Tile[]; wall: Tile[]; discards: TileKind[] } | null {
  const looks = closestOf(
    rack.map((t) => t.kind),
    card,
  );
  if (!looks) return null;
  const places = looks.units.filter((u) => u.count < MIN_JOKER_GROUP && u.kind.type !== 'flower');
  for (const unit of shuffle(places, rng).slice(0, TRAP_TRIES)) {
    const isK = (t: Tile) => sameKind(t.kind, unit.kind);
    const spare = rack.filter(isK).slice(unit.count - 1);
    const refill = wall.filter((t) => !isK(t)).slice(0, spare.length);
    const nextRack = [...rack.filter((t) => !spare.includes(t)), ...refill];
    const nextWall = wall.filter((t) => !isK(t) && !refill.includes(t));
    const discards = [...spare, ...wall.filter(isK)].map((t) => t.kind);
    const kinds = nextRack.map((t) => t.kind);
    const looksNow = closestOf(kinds, card);
    if (looksNow?.hand !== looks.hand) continue;
    const live = cardDistances({ concealed: kinds }, card, [...exposed, ...discards]);
    const after = live.find((r) => r.hand === looks.hand)!.tilesAway;
    const hurt = after === null || after > looksNow.tilesAway;
    if (hurt && live[0].tilesAway !== null && live[0].tilesAway <= FURTHEST) {
      return { rack: nextRack, wall: nextWall, discards };
    }
  }
  return null;
}

/** One distinct tile the player could throw, and what throwing it does. */
export type DiscardOutcome = {
  readonly tile: TileKind;
  /** Rack index of its first copy. */
  readonly index: number;
  /** The closest live hand after throwing it (card order breaks ties), or null if every hand is dead. */
  readonly hand: Hand | null;
  /** Its distance; Infinity when `hand` is null. */
  readonly closest: number;
  /** The closest hand counting only the player's own tiles, as if the table weren't there. */
  readonly rackOnly: number;
  /** The exposed opponent who could call it, and why; null when no read opponent has a use for it. */
  readonly danger: Danger | null;
};

export type Danger = {
  readonly seat: TableSeat;
  /** Their possible hands with a place for the tile. */
  readonly hands: readonly Hand[];
  readonly use: TileUse;
};

/** An opponent the coach reads, as seen with the player's whole rack in view. */
export type Read = { readonly seat: TableSeat; readonly groups: readonly (readonly TileKind[])[]; readonly read: ExposureRead };

export type DiscardAnalysis = {
  readonly data: DiscardData;
  /** Every tile on the table: the discards and the exposures. */
  readonly seen: readonly TileKind[];
  /** One per distinct tile on the rack, Jokers left out, in rack order. */
  readonly outcomes: readonly DiscardOutcome[];
  /** The closest a live hand can be after any discard. */
  readonly bestClosest: number;
  /** Some discard keeps `bestClosest` and is wanted by no read opponent. */
  readonly safeKeep: boolean;
  readonly reads: readonly Read[];
  /**
   * The hand the rack alone looks closest to, when dead tiles on the table
   * have killed it (`liveAway` null) or set it back (its closest choice of
   * suits can't be finished, so it's `liveAway` tiles away).
   */
  readonly dead: { readonly hand: HandDistance; readonly reason: string; readonly liveAway: number | null } | null;
};

/** Removes one copy of `kind`. */
function without(rack: readonly TileKind[], kind: TileKind): TileKind[] {
  const out = [...rack];
  out.splice(
    out.findIndex((k) => sameKind(k, kind)),
    1,
  );
  return out;
}

function closestOf(holding: readonly TileKind[], card: PracticeCard, seen: readonly TileKind[] = []): HandDistance | null {
  const first = cardDistances({ concealed: holding }, card, seen)[0];
  return first && first.tilesAway !== null ? first : null;
}

/**
 * The closest hand after throwing a tile, for any tile on the rack. With
 * `seen`, the thrown tile joins it; with null, only the player's own tiles
 * count, as if the table weren't there. Throwing a tile moves a hand at most
 * one tile further and can't revive a dead one, so only hands within one tile
 * of the rack's closest can be closest after a throw. The rest are never
 * weighed, which keeps a whole table's analysis to a few milliseconds.
 */
function closestAfterEach(
  rack: readonly TileKind[],
  card: PracticeCard,
  seen: readonly TileKind[] | null,
): (tile: TileKind) => HandDistance | null {
  const ranked = cardDistances({ concealed: rack }, card, seen ?? []).filter(
    (r): r is HandDistance => r.tilesAway !== null,
  );
  if (ranked.length === 0) return () => null;
  // In card order, so ties go to the earlier hand, as in `cardDistances`.
  const near = card.hands.filter((h) => ranked.some((r) => r.hand === h && r.tilesAway <= ranked[0].tilesAway + 1));
  return (tile) => {
    const holding = { concealed: without(rack, tile) };
    let best: HandDistance | null = null;
    for (const hand of near) {
      const r = handDistance(hand, holding, seen ? [...seen, tile] : []);
      if (r.tilesAway !== null && (!best || r.tilesAway < best.tilesAway)) best = r;
    }
    return best;
  };
}

/** Everything visible except one opponent's exposures (and the player's rack, added by the caller). */
function seenBesides(data: DiscardData, seat: TableSeat | null): TileKind[] {
  return [...data.discards, ...data.exposures.filter((e) => e.seat !== seat).flatMap((e) => e.groups.flat())];
}

/** "the other three are on the table", "only one is still unseen". */
function goneWords(kind: TileKind, onRack: number, onTable: number): string {
  const unseen = copiesOf(kind) - onRack - onTable;
  if (unseen > 0) return `only ${countWord(unseen)} ${unseen === 1 ? 'is' : 'are'} still unseen`;
  return `${onRack > 0 ? 'the other' : 'all'} ${countWord(onTable)} ${onTable === 1 ? 'is' : 'are'} on the table`;
}

/**
 * What dead tiles do to a plan: the first single or pair in it that can't be
 * finished from the tiles still unseen, or null if every one can.
 */
function deadReason(plan: HandDistance, rack: readonly TileKind[], seen: readonly TileKind[]): string | null {
  const count = (tiles: readonly TileKind[], kind: TileKind) => tiles.filter((k) => sameKind(k, kind)).length;
  for (const unit of plan.units) {
    if (unit.count >= MIN_JOKER_GROUP || unit.missing === 0) continue;
    const onRack = count(rack, unit.kind);
    const onTable = count(seen, unit.kind);
    if (copiesOf(unit.kind) - onRack - onTable < unit.missing) {
      const place = unit.count === 1 ? 'single' : GROUP_NAMES[unit.count];
      return `its ${place} needs ${tileCount(unit.kind, unit.missing)}, and ${goneWords(unit.kind, onRack, onTable)}`;
    }
  }
  return null;
}

export function analyzeTable(data: DiscardData, card: PracticeCard = CURRENT_CARD): DiscardAnalysis {
  const { rack } = data;
  const seen = seenBesides(data, null);
  const watched = data.exposures.filter((e) => e.groups.length >= READ_EXPOSURES);
  const liveAfter = closestAfterEach(rack, card, seen);
  const rackOnlyAfter = closestAfterEach(rack, card, null);
  const outcomes: DiscardOutcome[] = [];
  rack.forEach((tile, index) => {
    if (isJoker(tile) || rack.findIndex((k) => sameKind(k, tile)) !== index) return;
    const kept = without(rack, tile);
    const live = liveAfter(tile);
    const rackOnly = rackOnlyAfter(tile)?.tilesAway ?? Infinity;
    let danger: Danger | null = null;
    for (const e of watched) {
      const read = readExposures(e.groups, [...kept, ...seenBesides(data, e.seat)], card);
      const wanted = wantedBy(read, tile);
      if (wanted) {
        danger = { seat: e.seat, ...wanted };
        break;
      }
    }
    outcomes.push({ tile, index, hand: live?.hand ?? null, closest: live?.tilesAway ?? Infinity, rackOnly, danger });
  });
  const bestClosest = Math.min(...outcomes.map((o) => o.closest));
  const safeKeep = outcomes.some((o) => o.closest === bestClosest && !o.danger);
  const reads = watched.map((e) => ({
    seat: e.seat,
    groups: e.groups,
    read: readExposures(e.groups, [...rack, ...seenBesides(data, e.seat)], card),
  }));

  let dead: DiscardAnalysis['dead'] = null;
  const looks = closestOf(rack, card);
  if (looks) {
    const reach = cardDistances({ concealed: rack }, card, seen).find((r) => r.hand === looks.hand)!;
    const reason = deadReason(looks, rack, seen);
    if (reason && (reach.tilesAway === null || reach.tilesAway > looks.tilesAway)) {
      dead = { hand: looks, reason, liveAway: reach.tilesAway };
    }
  }
  return { data, seen, outcomes, bestClosest, safeKeep, reads, dead };
}

export type DiscardVerdict = 'best' | 'good' | 'miss';

export function verdictOf(outcome: DiscardOutcome, analysis: DiscardAnalysis): DiscardVerdict {
  if (outcome.closest > analysis.bestClosest) return 'miss';
  return outcome.danger && analysis.safeKeep ? 'good' : 'best';
}

/**
 * A table worth asking about: a live hand in reach, a few clean discards among
 * plenty of others, an opponent whose exposures say something, and a lesson
 * from the table itself: a risky tile that would keep the hand (so danger
 * decides), or a discard that only looks free because the rack's hand is dead.
 */
function isFairQuestion(a: DiscardAnalysis): boolean {
  if (a.outcomes.length < MIN_CHOICES) return false;
  if (a.bestClosest < NEAREST || a.bestClosest > FURTHEST || !a.safeKeep) return false;
  if (a.reads.some((r) => r.read.hands.length === 0 || r.read.hands.length > MAX_READ_HANDS)) return false;
  const verdicts = a.outcomes.map((o) => verdictOf(o, a));
  const best = verdicts.filter((v) => v === 'best').length;
  if (best / verdicts.length > MAX_BEST_SHARE || !verdicts.includes('miss')) return false;
  const rackBest = Math.min(...a.outcomes.map((o) => o.rackOnly));
  const looksFree = a.outcomes.some((o, i) => verdicts[i] === 'miss' && o.rackOnly === rackBest);
  return verdicts.includes('good') || (a.dead !== null && looksFree);
}

/** "Right: pung of 5 Bams, kong of 5 Dots. On the table: two Norths, a 3 Bam…" */
function tableCaption(data: DiscardData): string {
  const exposed = data.exposures.map(
    (e) => `${capitalize(SEAT_WORDS[e.seat])} has exposed ${exposureWords(e.groups)}.`,
  );
  const counts = new Map<string, { kind: TileKind; n: number }>();
  for (const kind of data.discards) {
    const c = counts.get(tileKey(kind)) ?? { kind, n: 0 };
    counts.set(tileKey(kind), { kind, n: c.n + 1 });
  }
  const pile = [...counts.values()].map(({ kind, n }) => tileCount(kind, n));
  return [...exposed, `Discarded: ${list(pile)}.`].join(' ');
}

/** "a pung of 5 Bams and a kong of 5 Dots" */
export function exposureWords(groups: readonly (readonly TileKind[])[]): string {
  return list(
    groups.map((g) => {
      const natural = g.find((k) => !isJoker(k)) ?? g[0];
      return `a ${groupName(natural, g.length)}`;
    }),
  );
}

export function generateDiscard(seed: number, card: PracticeCard = CURRENT_CARD): DrillQuestion<DiscardData> {
  const rng = createRng(seed);
  let data: DiscardData | null = null;
  for (let deal = 0; deal < MAX_DEALS && !data; deal++) {
    const dealt = dealTable(rng, card);
    if (!dealt) continue;
    // A quick look at the rack's reach before weighing every discard.
    const near = closestOf(dealt.rack, card, seenBesides(dealt, null));
    if (!near || near.tilesAway < NEAREST || near.tilesAway > FURTHEST) continue;
    if (isFairQuestion(analyzeTable(dealt, card))) data = dealt;
  }
  if (!data) throw new Error(`No fair discard table for seed ${seed}`);

  const { groups } = rackGroups(data.rack);
  const choices: DrillChoice[] = data.rack.map((tile) =>
    isJoker(tile) ? { kind: 'tile', tile, locked: 'Keep your Jokers: each can fill any pung, kong or quint.' } : { kind: 'tile', tile },
  );
  const table: DrillTable = {
    discards: data.discards,
    exposures: data.exposures,
    caption: tableCaption(data),
  };
  return {
    seed,
    key: [data.rack, data.discards, ...data.exposures.flatMap((e) => e.groups)]
      .map((tiles) => tiles.map(tileKey).join(','))
      .join('|'),
    prompt: 'Your turn. Which tile do you throw?',
    instruction: 'You’ve just drawn. Tap the tile to discard.',
    scene: { tiles: [], caption: '', table },
    choices,
    choiceGroups: groups,
    picks: 1,
    pickNoun: 'discard',
    data,
  };
}

/** "six tiles away", "one tile away": spelled out, since a hand's label ends in a number. */
function awayWords(n: number): string {
  return `${countWord(n)} ${n === 1 ? 'tile' : 'tiles'} away`;
}

/**
 * The discard to show as the answer, among the best: one that doesn't break up
 * a pair or more on the rack, then the one with the most copies already on the
 * table (fewer players can still be collecting it), then rack order.
 */
function recommended(analysis: DiscardAnalysis): DiscardOutcome {
  const onRack = (o: DiscardOutcome) => analysis.data.rack.filter((k) => sameKind(k, o.tile)).length;
  const onTable = (o: DiscardOutcome) => analysis.seen.filter((k) => sameKind(k, o.tile)).length;
  const best = analysis.outcomes.filter((o) => verdictOf(o, analysis) === 'best');
  return best.reduce((a, b) => {
    if (onRack(b) !== onRack(a)) return onRack(b) < onRack(a) ? b : a;
    return onTable(b) > onTable(a) ? b : a;
  });
}

/** "2027 #1, Like Numbers #1 or #3": a section is named once for its hands in a row. */
export function handsWords(hands: readonly Hand[], card: PracticeCard, joiner: 'and' | 'or' = 'or'): string {
  const labels = hands.map((h) => handLabel(h, card));
  const section = (label: string) => label.slice(0, label.lastIndexOf(' #'));
  return list(
    labels.map((label, i) => (i > 0 && section(labels[i - 1]) === section(label) ? label.slice(section(label).length + 1) : label)),
    joiner,
  );
}

/** Why an exposed opponent could take the tile: their exposures, the hands they fit, and the place it has. */
function dangerWords(danger: Danger, analysis: DiscardAnalysis, tile: TileKind, card: PracticeCard): string {
  const r = analysis.reads.find((x) => x.seat === danger.seat)!;
  const fits = r.read.hands;
  const who = capitalize(SEAT_WORDS[danger.seat]);
  const all = danger.hands.length === fits.length;
  const holders =
    fits.length === 1 ? 'That hand has' : all ? 'Each has' : `${handsWords(danger.hands, card, 'and')} ${danger.hands.length === 1 ? 'has' : 'have'}`;
  const risk = danger.use === 'group' ? 'so it could be called' : 'so it could be called for Mah Jongg';
  return `${who} has exposed ${exposureWords(r.groups)}, which fit only ${handsWords(fits, card)}. ${holders} a place for ${tileCount(tile, 1)}, ${risk}.`;
}

/** "It’s safe from the player across, too: …" for a pick no read opponent can use. */
function safeWords(analysis: DiscardAnalysis, tile: TileKind, card: PracticeCard): string | null {
  const r = analysis.reads[0];
  if (!r) return null;
  const fits = r.read.hands;
  const none = fits.length === 1 ? 'it has no' : fits.length === 2 ? 'neither has a' : 'none has a';
  return `It’s safe from ${SEAT_WORDS[r.seat]}, too: their exposures fit only ${handsWords(fits, card)}, and ${none} place for ${tileCount(tile, 1)}.`;
}

export type DiscardExplanation = {
  readonly verdict: DiscardVerdict;
  readonly answer: DiscardOutcome;
  readonly main: Hand;
  readonly text: string;
};

/**
 * The coach's reply, in short paragraphs: what the pick does to the closest
 * live hand, the danger it carries (or that it's safe), the tile to throw
 * instead when there's a better one, and a word on a hand the table has killed.
 */
export function explainDiscard(
  analysis: DiscardAnalysis,
  picked: number,
  card: PracticeCard = CURRENT_CARD,
): DiscardExplanation {
  const tile = analysis.data.rack[picked];
  const mine = analysis.outcomes.find((o) => sameKind(o.tile, tile));
  if (!mine) throw new RangeError('Not a tile this rack can throw');
  const verdict = verdictOf(mine, analysis);
  const answer = verdict === 'best' ? mine : recommended(analysis);
  const main = answer.hand!;
  const label = handLabel(main, card);
  const away = awayWords(analysis.bestClosest);
  const name = singular(tile);
  const other = singular(answer.tile);
  const paragraphs: string[] = [];
  const rackBest = Math.min(...analysis.outcomes.map((o) => o.rackOnly));

  if (verdict === 'best') {
    paragraphs.push(`Throwing the ${name} keeps ${label} ${away}.`);
    const safe = safeWords(analysis, tile, card);
    if (safe) paragraphs.push(safe);
  } else if (verdict === 'good') {
    paragraphs.push(`Throwing the ${name} keeps ${label} ${away}, but it’s a risk.`);
    paragraphs.push(dangerWords(mine.danger!, analysis, tile, card));
    paragraphs.push(`The ${other} is the safer throw, and it keeps ${label} ${away} too.`);
  } else {
    // Throwing the last unseen copy of a tile a single or pair needs kills the hand outright.
    const kept = without(analysis.data.rack, tile);
    const killed = handDistance(main, { concealed: kept }, [...analysis.seen, tile]).tilesAway === null;
    paragraphs.push(
      killed
        ? `${capitalize(label)} needs your ${name}, and none is left to draw: throw it and the hand is dead.`
        : `${capitalize(label)} needs your ${name}: without it, your closest hand is ${awayWords(mine.closest)}.`,
    );
    const safe = analysis.reads.length > 0 ? `, and ${SEAT_WORDS[analysis.reads[0].seat]} has no use for it` : '';
    paragraphs.push(`Throw the ${other} instead: ${label} stays ${away}${safe}.`);
    if (mine.danger) paragraphs.push(dangerWords(mine.danger, analysis, tile, card));
  }
  // The table's other lesson: a hand that only looks alive. Said when it explains the pick.
  const { dead } = analysis;
  if (dead && (verdict === 'best' || (verdict === 'miss' && mine.rackOnly === rackBest))) {
    const looks = capitalize(handLabel(dead.hand.hand, card));
    paragraphs.push(
      dead.liveAway === null
        ? `${looks} looks like your closest hand, but it’s dead: ${dead.reason}.`
        : `${looks} looks like your closest hand, but dead tiles set it back: ${dead.reason}. Counting the table, it’s ${awayWords(dead.liveAway)}.`,
    );
  }
  return { verdict, answer, main, text: paragraphs.join('\n\n') };
}

const TITLES: Record<DiscardVerdict, string> = {
  best: 'A smart discard',
  good: 'Sound, but risky',
  miss: 'A better discard is here',
};
const SCORES: Record<DiscardVerdict, number> = { best: 1, good: 0.5, miss: 0 };

export function evaluateDiscard(
  question: DrillQuestion<DiscardData>,
  picked: readonly number[],
  card: PracticeCard = CURRENT_CARD,
): DrillEvaluation {
  const { rack } = question.data;
  const [at] = picked;
  if (picked.length !== 1 || !Number.isInteger(at) || at < 0 || at >= rack.length) {
    throw new RangeError('Pick exactly one tile');
  }
  if (isJoker(rack[at])) throw new RangeError('Jokers aren’t offered in this drill');
  const analysis = analyzeTable(question.data, card);
  const { verdict, answer, main, text } = explainDiscard(analysis, at, card);
  return {
    verdict,
    score: SCORES[verdict],
    best: [verdict === 'best' ? at : answer.index],
    title: TITLES[verdict],
    explanation: text,
    target: { label: `Aim for · ${handLabel(main, card)}`, line: main.line },
  };
}

export const discards: Drill<DiscardData> = {
  id: 'discards',
  skill: 'discards',
  title: 'Discards',
  summary: 'Decide what to let go, and what’s safe to throw.',
  icon: { type: 'suited', suit: 'crak', rank: 7 },
  questionsPerRound: 5,
  generate: (seed) => generateDiscard(seed),
  evaluate: (question, picked) => evaluateDiscard(question, picked),
};
