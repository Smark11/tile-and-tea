// "Charleston": a freshly dealt 13-tile rack is on the felt, and the player
// picks the three tiles to pass right on the first Charleston. It trains the
// first real decision of every game: which tiles your hand can do without.
//
// The advisor tries every pass the rack allows (Jokers are never passed) and
// judges each by the ten tiles it keeps, using hand distance (card/distance.ts):
//
//   1. the closest hand: how near the kept tiles are to their best hand;
//   2. backups: how many other hands stay within one tile of that, because
//      the Charleston can still turn a rack toward another hand.
//
// A pass as good as the strongest on both counts is `best`; one that keeps the
// closest hand as near but drops a backup is `good`; one that moves the
// closest hand further away is a `miss`. The answer never comes from how the
// rack was dealt.

import {
  cardDistances,
  CURRENT_CARD,
  handDistance,
  variantsOf,
  type Hand,
  type HandDistance,
  type PracticeCard,
} from '../../card';
import { sortRack } from '../../rack';
import { createRng, shuffle, type Rng } from '../../rng';
import { createShuffledTileSet, sameKind, tileKey, type Tile, type TileKind } from '../../tiles';
import type { Drill, DrillChoice, DrillEvaluation, DrillQuestion } from '../types';
import { rackGroups } from './bestHand';
import { capitalize, countWord, handLabel, list, plural, singular } from './words';

export type CharlestonData = {
  /** The dealt rack, sorted the way players arrange it. */
  readonly rack: readonly TileKind[];
};

export const RACK_SIZE = 13;
/** Tiles passed in the first Charleston's pass right. */
export const PASS_SIZE = 3;
/** How many of the rack's tiles lean toward one hand, so a sorted rack shows a direction. */
const LEANING_TILES = [5, 6, 6, 7] as const;
/** The closest hand must be at least this near, so three tiles can go without touching it… */
const NEAREST = 4;
/** …and no further than this, so the rack has a direction worth protecting. */
const FURTHEST = 6;
/** At most this share of the possible passes may be best, so the question asks something. */
const MAX_BEST_SHARE = 0.25;
/** At least this share must cost the closest hand a tile, so a careless pick shows. */
const MIN_MISS_SHARE = 0.35;
const MAX_DEALS = 60;

const isJoker = (kind: TileKind) => kind.type === 'joker';

function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)];
}

/**
 * A dealt rack with a direction: part of one random hand, the rest from the
 * wall. A purely random deal is usually 8 or more from everything, with a
 * dozen hands tied, and there's little to teach about passing from that.
 */
function dealRack(rng: Rng, card: PracticeCard): TileKind[] {
  const wall = createShuffledTileSet(rng);
  const hand = pick(card.hands, rng);
  const variant = pick(variantsOf(hand), rng);
  const tiles = variant.units.flatMap((u) => Array.from({ length: u.count }, () => u.kind));
  const wanted = shuffle(tiles, rng).slice(0, pick(LEANING_TILES, rng));
  const rack: Tile[] = [];
  for (const kind of wanted) {
    const at = wall.findIndex((t) => sameKind(t.kind, kind));
    if (at >= 0) rack.push(...wall.splice(at, 1));
  }
  rack.push(...wall.slice(0, RACK_SIZE - rack.length));
  return sortRack(rack).map((t) => t.kind);
}

/** A pass: three tiles, by kind, in rack order. */
type Pass = readonly TileKind[];

/** How one pass leaves the rack. */
export type PassOutcome = {
  readonly pass: Pass;
  /** Rack indexes of the pass (the first copies of each kind). */
  readonly indexes: readonly number[];
  /** Kept distance for each hand the analysis watches, in `Analysis.hands` order. */
  readonly away: readonly number[];
  /**
   * The closest a watched hand is after this pass. Exact whenever it's within
   * a tile of `Analysis.bestClosest`; past that, an unwatched hand may be nearer.
   */
  readonly closest: number;
};

export type Analysis = {
  readonly rack: readonly TileKind[];
  /** The hands that can matter to a pass (see `analyzeRack`), closest to the full rack first. */
  readonly hands: readonly HandDistance[];
  /** Every distinct pass (by tile kinds), in rack order. */
  readonly outcomes: readonly PassOutcome[];
  /** The closest a hand can be after the best pass. */
  readonly bestClosest: number;
  /** The most other hands any best-closest pass keeps within one tile. */
  readonly bestBackups: number;
};

/** Hands other than the closest that are within one tile of `bestClosest` after this pass. */
export function backupsOf(outcome: PassOutcome, bestClosest: number): number {
  const near = outcome.away.filter((a) => a <= bestClosest + 1).length;
  return outcome.closest === bestClosest ? near - 1 : near;
}

/** Rack indexes of every distinct pass: three tiles, no Jokers, copies of a tile counted once. */
function distinctPasses(rack: readonly TileKind[]): number[][] {
  const seen = new Set<string>();
  const out: number[][] = [];
  const n = rack.length;
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++) {
        const idx = [a, b, c];
        if (idx.some((i) => isJoker(rack[i]))) continue;
        const key = idx.map((i) => tileKey(rack[i])).join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(idx);
      }
  return out;
}

function without(rack: readonly TileKind[], indexes: readonly number[]): TileKind[] {
  return rack.filter((_, i) => !indexes.includes(i));
}

function awayFrom(hand: Hand, tiles: readonly TileKind[]): number {
  const reach = handDistance(hand, { concealed: tiles });
  return reach.tilesAway ?? Infinity;
}

/** Reachable hands for a holding, closest first (card order breaking ties). */
function rankedHands(rack: readonly TileKind[], card: PracticeCard): HandDistance[] {
  return cardDistances({ concealed: rack }, card).filter((r): r is HandDistance => r.tilesAway !== null);
}

/**
 * Every pass the rack allows, judged by what it keeps.
 *
 * Passing tiles never brings a hand closer, so a hand R tiles from the full
 * rack is at least R from any kept ten. Only hands within one tile of the best
 * pass's closest can count (as that closest, or as a backup), so the analysis
 * watches hands up to that limit, starting at the rack's closest + 1 and
 * widening only if no pass keeps the closest hand where it was. That keeps it
 * to a handful of hands, which matters: every pass is weighed against each.
 */
export function analyzeRack(rack: readonly TileKind[], card: PracticeCard = CURRENT_CARD): Analysis {
  const ranked = rankedHands(rack, card);
  const passes = distinctPasses(rack);
  const kept = passes.map((indexes) => without(rack, indexes));
  const away: number[][] = passes.map(() => []);
  const hands: HandDistance[] = [];
  let limit = ranked[0].tilesAway + 1;
  let bestClosest = Infinity;
  for (;;) {
    const more = ranked.slice(hands.length).filter((r) => r.tilesAway <= limit);
    for (const h of more) kept.forEach((tiles, i) => away[i].push(awayFrom(h.hand, tiles)));
    hands.push(...more);
    bestClosest = Math.min(...away.map((a) => Math.min(...a)));
    // Hands left out are more than `limit` away whatever is passed.
    if (bestClosest + 1 <= limit) break;
    limit = bestClosest + 1;
  }
  const outcomes = passes.map((indexes, i) => ({
    pass: indexes.map((at) => rack[at]),
    indexes,
    away: away[i],
    closest: Math.min(...away[i]),
  }));
  const bestBackups = Math.max(
    ...outcomes.filter((o) => o.closest === bestClosest).map((o) => backupsOf(o, bestClosest)),
  );
  return { rack, hands, outcomes, bestClosest, bestBackups };
}

export type PassVerdict = 'best' | 'good' | 'miss';

export function verdictOf(outcome: PassOutcome, analysis: Analysis): PassVerdict {
  if (outcome.closest > analysis.bestClosest) return 'miss';
  return backupsOf(outcome, analysis.bestClosest) === analysis.bestBackups ? 'best' : 'good';
}

/** A rack worth asking about: a hand in reach, a clear best pass, and plenty of passes that cost it. */
function isFairQuestion(analysis: Analysis): boolean {
  const first = analysis.hands[0].tilesAway;
  if (first < NEAREST || first > FURTHEST) return false;
  // The best pass keeps the closest hand where it is, so "keep it" is always possible.
  if (analysis.bestClosest !== first) return false;
  const verdicts = analysis.outcomes.map((o) => verdictOf(o, analysis));
  const share = (v: PassVerdict) => verdicts.filter((x) => x === v).length / verdicts.length;
  if (share('best') > MAX_BEST_SHARE || share('miss') < MIN_MISS_SHARE) return false;
  // Breaking up a dealt pung is rarely right on the first pass, even when the
  // count says it's free; skip racks whose only clean passes would.
  return analysis.outcomes.some((o, i) => verdicts[i] === 'best' && splitTiles(analysis.rack, o.pass, 3) === 0);
}

export function generateCharleston(seed: number, card: PracticeCard = CURRENT_CARD): DrillQuestion<CharlestonData> {
  const rng = createRng(seed);
  let rack: TileKind[] | null = null;
  for (let deal = 0; deal < MAX_DEALS && !rack; deal++) {
    const dealt = dealRack(rng, card);
    // The whole-card ranking is cheap; weighing every pass isn't, so check the reach first.
    const first = rankedHands(dealt, card)[0].tilesAway;
    if (first < NEAREST || first > FURTHEST) continue;
    if (isFairQuestion(analyzeRack(dealt, card))) rack = dealt;
  }
  if (!rack) throw new Error(`No fair Charleston rack for seed ${seed}`);

  const { groups } = rackGroups(rack);
  const choices: DrillChoice[] = rack.map((tile) =>
    isJoker(tile) ? { kind: 'tile', tile, locked: 'Jokers are never passed.' } : { kind: 'tile', tile },
  );
  return {
    seed,
    key: rack.map(tileKey).join(','),
    prompt: 'First Charleston: which three do you pass right?',
    instruction: 'Pick 3 tiles to pass, then Check.',
    scene: { tiles: [], caption: '' },
    choices,
    choiceGroups: groups,
    picks: PASS_SIZE,
    data: { rack },
  };
}

/** "the North, the 7 Crak and the 2 Dot" (a repeated tile: "two 5 Dots"); "or" after a negative. */
export function passWords(pass: Pass, joiner: 'and' | 'or' = 'and'): string {
  const parts: string[] = [];
  pass.forEach((kind, i) => {
    if (pass.findIndex((k) => sameKind(k, kind)) !== i) return;
    const n = pass.filter((k) => sameKind(k, kind)).length;
    parts.push(n === 1 ? `the ${singular(kind)}` : `${countWord(n)} ${plural(kind)}`);
  });
  return list(parts, joiner);
}

/** "six tiles away", "one tile away": spelled out, since a hand's label ends in a number. */
function awayWords(n: number): string {
  return `${countWord(n)} ${n === 1 ? 'tile' : 'tiles'} away`;
}

function outcomeOf(analysis: Analysis, picked: readonly number[]): PassOutcome {
  const key = picked
    .map((i) => analysis.rack[i])
    .map(tileKey)
    .join(',');
  const found = analysis.outcomes.find((o) => o.pass.map(tileKey).join(',') === key);
  if (!found) throw new RangeError('Not a pass this rack allows');
  return found;
}

/**
 * The pass to show as the answer, among the best ones: one that keeps the
 * rack's pungs whole; then the closest to the player's pick (so a near miss
 * reads as "swap one tile"); then the one splitting the fewest pairs; then
 * the one keeping every watched hand nearest. Ties keep rack order.
 */
function recommended(analysis: Analysis, picked: Pass): PassOutcome {
  const rank = (o: PassOutcome) => [
    splitTiles(analysis.rack, o.pass, 3),
    -sharedTiles(o.pass, picked),
    splitTiles(analysis.rack, o.pass, 2),
    o.away.reduce((a, b) => a + Math.min(b, 99), 0),
  ];
  const best = analysis.outcomes.filter((o) => verdictOf(o, analysis) === 'best');
  return best.reduce((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    const at = ra.findIndex((x, i) => x !== rb[i]);
    return at >= 0 && rb[at] < ra[at] ? b : a;
  });
}

/** How many tiles two passes have in common, copies matched one to one. */
function sharedTiles(a: Pass, b: Pass): number {
  const left = [...b];
  let n = 0;
  for (const kind of a) {
    const at = left.findIndex((k) => sameKind(k, kind));
    if (at >= 0) {
      left.splice(at, 1);
      n++;
    }
  }
  return n;
}

/** How many passed tiles come from a run of at least `copies` matching tiles on the rack. */
export function splitTiles(rack: readonly TileKind[], pass: Pass, copies: number): number {
  return pass.filter((kind) => rack.filter((k) => sameKind(k, kind)).length >= copies).length;
}

/** Rack indexes for a pass, reusing the player's own picks where the tiles match. */
function indexesFor(rack: readonly TileKind[], pass: Pass, picked: readonly number[]): number[] {
  const used: number[] = [];
  for (const kind of pass) {
    const mine = picked.find((i) => !used.includes(i) && sameKind(rack[i], kind));
    const any = rack.findIndex((k, i) => !used.includes(i) && sameKind(k, kind));
    used.push(mine ?? any);
  }
  return used.sort((a, b) => a - b);
}

/** Removes one copy of each tile in `tiles` from `rack`. */
function minus(rack: readonly TileKind[], tiles: readonly TileKind[]): TileKind[] {
  const out = [...rack];
  for (const kind of tiles) out.splice(out.findIndex((k) => sameKind(k, kind)), 1);
  return out;
}

/** Every sub-pass, smallest first: [a], [b], [c], [a,b] … [a,b,c]. */
function subPasses(pass: Pass): TileKind[][] {
  const out: TileKind[][] = [];
  for (let mask = 1; mask < 1 << pass.length; mask++) out.push(pass.filter((_, i) => mask & (1 << i)));
  return out.sort((a, b) => a.length - b.length);
}

/**
 * The passed tiles the hand misses: the fewest of them that, passed on their
 * own, cost it as much as the whole pass does. So the coach never blames a
 * tile the hand could do without. Usually that's one tile per tile lost.
 */
export function tilesItNeeds(hand: Hand, rack: readonly TileKind[], pass: Pass): TileKind[] {
  const after = awayFrom(hand, minus(rack, pass));
  if (after === awayFrom(hand, rack)) return [];
  return subPasses(pass).find((sub) => awayFrom(hand, minus(rack, sub)) === after) ?? [...pass];
}

/** "your 4 Bam", "your two Green Dragons and East". */
function yourTiles(tiles: readonly TileKind[]): string {
  const words: string[] = [];
  tiles.forEach((kind, i) => {
    if (tiles.findIndex((k) => sameKind(k, kind)) !== i) return;
    const n = tiles.filter((k) => sameKind(k, kind)).length;
    words.push(n === 1 ? singular(kind) : `${countWord(n)} ${plural(kind)}`);
  });
  return `your ${list(words)}`;
}

/**
 * ": it needs your 4 Bam". When the hand could spare some of the named tiles
 * but not all (it loses two tiles, say, only when all three go), it says how
 * many: ": it needs two of your 4 Bam, 6 Bam and 8 Bam".
 */
function becauseItNeeds(hand: Hand, rack: readonly TileKind[], pass: Pass): string {
  const needs = tilesItNeeds(hand, rack, pass);
  if (needs.length === 0) return '';
  const lost = awayFrom(hand, minus(rack, pass)) - awayFrom(hand, rack);
  return needs.length > lost ? `: it needs ${countWord(lost)} of ${yourTiles(needs)}` : `: it needs ${yourTiles(needs)}`;
}

/** The hands a pass keeps within one tile of the closest, other than `main`. */
function backupHands(analysis: Analysis, outcome: PassOutcome, main: Hand): Hand[] {
  return analysis.hands
    .filter((h, i) => h.hand !== main && outcome.away[i] <= analysis.bestClosest + 1)
    .map((h) => h.hand);
}

/** The closest hand after a pass (card order breaking ties, as hand distance does). */
function mainHand(analysis: Analysis, outcome: PassOutcome): Hand {
  return analysis.hands[outcome.away.indexOf(outcome.closest)].hand;
}

export type CharlestonExplanation = {
  readonly verdict: PassVerdict;
  readonly answer: PassOutcome;
  readonly main: Hand;
  readonly text: string;
};

/**
 * The coach's reply, in up to three short paragraphs: what the pick did to
 * the closest hand, the pass to make (when it's a different one) and why it
 * costs nothing, then a word on Jokers when the rack has one.
 */
export function explainPass(
  analysis: Analysis,
  picked: readonly number[],
  card: PracticeCard = CURRENT_CARD,
): CharlestonExplanation {
  const mine = outcomeOf(analysis, picked);
  const verdict = verdictOf(mine, analysis);
  const answer = verdict === 'best' ? mine : recommended(analysis, mine.pass);
  const main = mainHand(analysis, answer);
  const label = handLabel(main, card);
  const away = awayWords(analysis.bestClosest);
  const backups = backupHands(analysis, answer, main);
  const others =
    backups.length === 1 ? handLabel(backups[0], card) : `${countWord(backups.length)} more hands`;
  const paragraphs: string[] = [];

  if (verdict === 'best') {
    const alsoNear =
      backups.length === 0 ? '' : `, and ${others} ${backups.length === 1 ? 'stays' : 'stay'} at most one tile behind it`;
    paragraphs.push(`Your pass keeps ${label} ${away}${alsoNear}.`);
    // Speak for the backups too only when the pass leaves every one exactly where it was.
    const untouched = backups.every((h) => {
      const i = analysis.hands.findIndex((x) => x.hand === h);
      return mine.away[i] === analysis.hands[i].tilesAway;
    });
    const tiles = passWords(mine.pass, 'or');
    if (backups.length === 0 || !untouched) paragraphs.push(`${capitalize(label)} doesn’t need ${tiles}.`);
    else paragraphs.push(`${backups.length === 1 ? 'Neither hand' : 'None of those hands'} needs ${tiles}.`);
  } else {
    if (verdict === 'miss') {
      // Same units as the recommended pass below ("N tiles away"), so the two compare directly.
      const after = mine.away[analysis.hands.findIndex((h) => h.hand === main)];
      paragraphs.push(`Your pass leaves ${label} ${awayWords(after)}${becauseItNeeds(main, analysis.rack, mine.pass)}.`);
    } else {
      // A sound pass keeps the closest hand where it is, but fewer hands near it.
      const near = (o: PassOutcome, i: number) => o.away[i] <= analysis.bestClosest + 1;
      const dropped = analysis.hands.find((_, i) => near(answer, i) && !near(mine, i))!.hand;
      const kept = mainHand(analysis, mine);
      paragraphs.push(
        `Your pass keeps ${handLabel(kept, card)} ${away}, but ${handLabel(dropped, card)} drops back${becauseItNeeds(dropped, analysis.rack, mine.pass)}.`,
      );
    }
    const alsoNear = backups.length === 0 ? '' : `, and ${others} at most one tile behind it`;
    paragraphs.push(`Pass ${passWords(answer.pass)} instead: it keeps ${label} ${away}${alsoNear}.`);
  }
  const jokers = analysis.rack.filter(isJoker).length;
  if (jokers > 0) {
    paragraphs.push(`${jokers === 1 ? 'Your Joker stays' : 'Your Jokers stay'} home: Jokers are never passed.`);
  }
  return { verdict, answer, main, text: paragraphs.join('\n\n') };
}

const TITLES: Record<PassVerdict, string> = {
  best: 'A clean pass',
  good: 'Sound, with a little lost',
  miss: 'A better pass is here',
};
const SCORES: Record<PassVerdict, number> = { best: 1, good: 0.5, miss: 0 };

export function evaluateCharleston(
  question: DrillQuestion<CharlestonData>,
  picked: readonly number[],
  card: PracticeCard = CURRENT_CARD,
): DrillEvaluation {
  const { rack } = question.data;
  const distinct = new Set(picked);
  if (
    picked.length !== PASS_SIZE ||
    distinct.size !== PASS_SIZE ||
    picked.some((i) => !Number.isInteger(i) || i < 0 || i >= rack.length)
  ) {
    throw new RangeError(`Pick exactly ${PASS_SIZE} different tiles`);
  }
  if (picked.some((i) => isJoker(rack[i]))) throw new RangeError('Jokers are never passed');
  const sorted = [...picked].sort((a, b) => a - b);
  const analysis = analyzeRack(rack, card);
  const { verdict, answer, main, text } = explainPass(analysis, sorted, card);
  return {
    verdict,
    score: SCORES[verdict],
    best: indexesFor(rack, answer.pass, sorted),
    title: TITLES[verdict],
    explanation: text,
    target: { label: `Aim for · ${handLabel(main, card)}`, line: main.line },
  };
}

export const charleston: Drill<CharlestonData> = {
  id: 'charleston',
  skill: 'charleston',
  title: 'Charleston',
  summary: 'Choose three tiles to pass, and keep your best hand close.',
  icon: { type: 'wind', wind: 'E' },
  questionsPerRound: 5,
  generate: (seed) => generateCharleston(seed),
  evaluate: (question, picked) => evaluateCharleston(question, picked),
};
