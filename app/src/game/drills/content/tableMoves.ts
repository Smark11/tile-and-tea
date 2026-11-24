// The two table decisions that aren't a discard: whether to call a tile
// someone just threw (and for what), and whether to give a real tile for a
// Joker in someone's exposure. Both are judged the way the coach judges a
// discard: by the closest live hand each move leaves (card/distance.ts, with
// every tile on the table counted as gone).
//
//   Calls (docs/STRATEGY.md T4): call only when the exposure brings the hand
//   closer. A call that leaves the hand no closer is a miss, even when it
//   fits: it shows the table your hand, kills every concealed line, and the
//   simulator measures it costing games at every table. Staying put when a
//   call would bring the hand closer is a miss too.
//
//   Joker swaps (T5): take an exposed Joker whenever you hold the real tile
//   and the swap costs your hand nothing. A swap that brings the hand closer
//   is best; one that costs a tile (the real tile was holding up a single or
//   pair, which a Joker can never fill) is a miss.
//
// Each decision is a scene (the table, the offered tile, the rack) and a
// short list of moves as `action` choices. The question's data is plain JSON.

import { cardDistances, CURRENT_CARD, type Hand, type HandDistance, type PracticeCard } from '../../card';
import { tileKey, sameKind, type TileKind } from '../../tiles';
import type { DrillChoice, DrillEvaluation, DrillQuestion, DrillTable, TableSeat, Verdict } from '../types';
import { rackGroups } from './bestHand';
import { SEAT_WORDS, tableCaption, type TableExposure } from './discards';
import { capitalize, countWord, GROUP_NAMES, handLabel, singular, tileCount } from './words';

const JOKER: TileKind = { type: 'joker' };
const isJoker = (kind: TileKind) => kind.type === 'joker';
/** The biggest group American Mah Jongg exposes. */
const MAX_GROUP = 6;

export type CallData = {
  /** The player's 13 tiles, in rack order. Nothing of theirs is exposed yet. */
  readonly rack: readonly TileKind[];
  /** The tile just thrown, waiting to be called. */
  readonly offered: TileKind;
  readonly from: TableSeat;
  /** Every other tile on the table, oldest first. */
  readonly discards: readonly TileKind[];
  readonly exposures: readonly TableExposure[];
};

export type SwapData = {
  /** The player's 14 tiles, just after the draw, in rack order. */
  readonly rack: readonly TileKind[];
  readonly discards: readonly TileKind[];
  /** Other players' exposures; a Joker in one stands for the group's real tile. */
  readonly exposures: readonly TableExposure[];
};

/** One move, and the closest live hand it leaves. */
export type MoveOutcome = {
  /** The action choice's id. */
  readonly id: string;
  /** 'pass' / 'keep' do nothing; 'call' exposes; 'swap' trades a tile for a Joker. */
  readonly type: 'pass' | 'call' | 'keep' | 'swap';
  /** Call: the group's size. Swap: unused (0). */
  readonly size: number;
  /** Call: the exposed group. Swap: the tile given for the Joker. */
  readonly tiles: readonly TileKind[];
  /** Swap: whose exposure, and which group. */
  readonly owner?: { readonly seat: TableSeat; readonly group: number };
  readonly plan: HandDistance | null;
  /** `plan.tilesAway`, or Infinity when every hand is dead. */
  readonly closest: number;
};

export type MoveAnalysis = {
  /** In choice order. */
  readonly outcomes: readonly MoveOutcome[];
  /** The strongest move: the closest hand, then (on a tie) staying concealed, or taking a free Joker. */
  readonly best: MoveOutcome;
};

function without(rack: readonly TileKind[], kind: TileKind, n = 1): TileKind[] {
  const out = [...rack];
  for (let i = 0; i < n; i++) {
    const at = out.findIndex((k) => sameKind(k, kind));
    if (at < 0) throw new RangeError(`No ${tileKey(kind)} left to take`);
    out.splice(at, 1);
  }
  return out;
}

function closestLive(
  concealed: readonly TileKind[],
  exposures: readonly (readonly TileKind[])[],
  seen: readonly TileKind[],
  card: PracticeCard,
): HandDistance | null {
  const first = cardDistances({ concealed, exposures }, card, seen).find((r) => r.tilesAway !== null);
  return (first as HandDistance | undefined) ?? null;
}

const tableTiles = (exposures: readonly TableExposure[]) => exposures.flatMap((e) => e.groups.flat());

/** The real tile an exposed group is made of. */
function groupKind(group: readonly TileKind[]): TileKind {
  return group.find((k) => !isJoker(k)) ?? JOKER;
}

/**
 * Letting the tile go, and each exposure the player could make with it: real
 * copies first, then Jokers. An exposure no card hand fits isn't offered (it
 * would make the hand dead), nor is one made only of Jokers that brings the
 * hand no closer, as at the table (table/calls.ts).
 */
export function analyzeCall(data: CallData, card: PracticeCard = CURRENT_CARD): MoveAnalysis {
  const others = tableTiles(data.exposures);
  const passPlan = closestLive(data.rack, [], [...data.discards, data.offered, ...others], card);
  const outcomes: MoveOutcome[] = [
    { id: 'pass', type: 'pass', size: 0, tiles: [], plan: passPlan, closest: passPlan?.tilesAway ?? Infinity },
  ];
  const naturals = data.rack.filter((k) => sameKind(k, data.offered)).length;
  const jokers = data.rack.filter(isJoker).length;
  for (let size = 3; size <= MAX_GROUP; size++) {
    const real = Math.min(naturals, size - 1);
    const wild = size - 1 - real;
    if (wild > jokers) break;
    const group = [data.offered, ...Array<TileKind>(real).fill(data.offered), ...Array<TileKind>(wild).fill(JOKER)];
    const rest = without(without(data.rack, data.offered, real), JOKER, wild);
    if (!cardDistances({ concealed: rest, exposures: [group] }, card).some((r) => r.tilesAway !== null)) continue;
    const plan = closestLive(rest, [group], [...data.discards, ...others], card);
    const closest = plan?.tilesAway ?? Infinity;
    if (real === 0 && !(closest < outcomes[0].closest)) continue;
    outcomes.push({ id: GROUP_NAMES[size], type: 'call', size, tiles: group, plan, closest });
  }
  // Ties go to letting it go (a call that brings you no closer only costs),
  // then to the smaller exposure.
  const best = outcomes.reduce((a, b) => (b.closest < a.closest ? b : a));
  return { outcomes, best };
}

/**
 * Keeping your tiles, and each Joker swap open to the player: one per exposed
 * group holding a Joker whose real tile is on the rack.
 */
export function analyzeSwap(data: SwapData, card: PracticeCard = CURRENT_CARD): MoveAnalysis {
  const seen = [...data.discards, ...tableTiles(data.exposures)];
  const keepPlan = closestLive(data.rack, [], seen, card);
  const keep: MoveOutcome = { id: 'keep', type: 'keep', size: 0, tiles: [], plan: keepPlan, closest: keepPlan?.tilesAway ?? Infinity };
  const swaps: MoveOutcome[] = [];
  for (const e of data.exposures) {
    e.groups.forEach((group, g) => {
      const kind = groupKind(group);
      if (!group.some(isJoker) || isJoker(kind) || !data.rack.some((k) => sameKind(k, kind))) return;
      const rack = [...without(data.rack, kind), JOKER];
      // The real tile goes onto the table in the Joker's place.
      const plan = closestLive(rack, [], [...without(seen, JOKER), kind], card);
      swaps.push({
        id: `swap-${e.seat}-${g}`,
        type: 'swap',
        size: 0,
        tiles: [kind],
        owner: { seat: e.seat, group: g },
        plan,
        closest: plan?.tilesAway ?? Infinity,
      });
    });
  }
  // A swap that costs nothing beats keeping your tiles: a Joker fits more places than the tile it replaced.
  const best = [...swaps, keep].reduce((a, b) => (b.closest < a.closest ? b : a));
  return { outcomes: [...swaps, keep], best };
}

export function moveVerdict(outcome: MoveOutcome, analysis: MoveAnalysis): Verdict {
  if (outcome === analysis.best) return 'best';
  if (outcome.closest > analysis.best.closest) return 'miss';
  // Equally close: a call that brings you no closer still costs (T4).
  if (outcome.type === 'call') return 'miss';
  return 'good';
}

function awayWords(n: number): string {
  return Number.isFinite(n) ? `${countWord(n)} ${n === 1 ? 'tile' : 'tiles'} away` : 'out of reach';
}

/** "2468 #1, two tiles away" */
function planWords(o: MoveOutcome, card: PracticeCard): string {
  return o.plan ? `${handLabel(o.plan.hand, card)}, ${awayWords(o.closest)}` : 'no live hand';
}

const SEAT_OWNER: Record<TableSeat, string> = { left: 'the left player’s', across: 'the player across’s', right: 'the right player’s' };

function actionChoice(o: MoveOutcome, data: CallData | null): Extract<DrillChoice, { kind: 'action' }> {
  switch (o.type) {
    case 'pass':
      return { kind: 'action', id: o.id, label: 'Let it go', detail: 'Stay concealed and draw from the wall.', tiles: [data!.offered] };
    case 'keep':
      return { kind: 'action', id: o.id, label: 'Keep your tiles', detail: 'No swap: just choose your discard.', tiles: [] };
    case 'call': {
      const jokers = o.tiles.filter(isJoker).length;
      const name = GROUP_NAMES[o.size];
      const real = o.size - jokers;
      const what = `${tileCount(data!.offered, real)}${jokers > 0 ? ` and ${jokers === 1 ? 'a Joker' : `${countWord(jokers)} Jokers`}` : ''}`;
      return { kind: 'action', id: o.id, label: `Call it for a ${name}`, detail: `Expose ${what}.`, tiles: o.tiles };
    }
    case 'swap':
      return {
        kind: 'action',
        id: o.id,
        label: `Swap your ${singular(o.tiles[0])} for the Joker`,
        detail: `Take the Joker from ${SEAT_OWNER[o.owner!.seat]} exposure.`,
        tiles: [o.tiles[0], JOKER],
      };
  }
}

function moveQuestion<D>(
  data: D,
  rack: readonly TileKind[],
  table: DrillTable,
  outcomes: readonly MoveOutcome[],
  prompt: string,
  instruction: string,
  callData: CallData | null,
): DrillQuestion<D> {
  const { groups, caption } = rackGroups(rack);
  return {
    seed: 0,
    key: [rack, table.discards, table.offered ? [table.offered.tile] : [], ...table.exposures.flatMap((e) => e.groups)]
      .map((tiles) => tiles.map(tileKey).join(','))
      .join('|'),
    prompt,
    instruction,
    scene: { tiles: rack, groups, caption, table },
    choices: outcomes.map((o) => actionChoice(o, callData)),
    picks: 1,
    pickNoun: 'move',
    data,
  };
}

export function callQuestion(data: CallData, card: PracticeCard = CURRENT_CARD): DrillQuestion<CallData> {
  const table: DrillTable = {
    discards: data.discards,
    exposures: data.exposures,
    caption: `${tableCaption(data)} ${capitalize(SEAT_WORDS[data.from])} has just thrown ${tileCount(data.offered, 1)}.`,
    offered: { tile: data.offered, from: data.from },
    rackNote: 'Your rack · 13 tiles, nothing exposed yet',
  };
  const { outcomes } = analyzeCall(data, card);
  return moveQuestion(data, data.rack, table, outcomes, `Do you call the ${singular(data.offered)}?`, 'Tap your move.', data);
}

export function swapQuestion(data: SwapData, card: PracticeCard = CURRENT_CARD): DrillQuestion<SwapData> {
  const table: DrillTable = { discards: data.discards, exposures: data.exposures, caption: tableCaption(data) };
  const { outcomes } = analyzeSwap(data, card);
  return moveQuestion(data, data.rack, table, outcomes, 'Your turn. Do you swap for a Joker?', 'Tap your move.', null);
}

const TITLES: Record<Verdict, string> = {
  best: 'A strong move',
  good: 'Sound, with a little left on the table',
  miss: 'A stronger move is here',
};
const SCORES: Record<Verdict, number> = { best: 1, good: 0.5, miss: 0 };

/** Whether the outcome's plan left behind a concealed hand that `before` was building. */
function killsConcealed(before: MoveOutcome, after: MoveOutcome): Hand | null {
  const hand = before.plan?.hand;
  return hand?.concealed && after.type === 'call' ? hand : null;
}

/** Why the best move is best, and what the pick gave up. Every number comes from the analysis. */
function explainMove(analysis: MoveAnalysis, picked: MoveOutcome, card: PracticeCard): string {
  const { best } = analysis;
  const parts: string[] = [];
  const pass = analysis.outcomes.find((o) => o.type === 'pass' || o.type === 'keep')!;
  if (best.type === 'call') {
    parts.push(
      `Calling it for a ${GROUP_NAMES[best.size]} brings ${handLabel(best.plan!.hand, card)} to ${awayWords(best.closest)}; letting it go leaves your closest hand ${awayWords(pass.closest)}. A tile that brings you closer is worth showing your hand for.`,
    );
  } else if (best.type === 'pass') {
    parts.push(`Letting it go keeps ${planWords(best, card)}.`);
  } else if (best.type === 'swap') {
    const gain = pass.closest - best.closest;
    parts.push(
      gain > 0
        ? `Swapping your ${singular(best.tiles[0])} for the Joker brings ${handLabel(best.plan!.hand, card)} to ${awayWords(best.closest)}, from ${awayWords(pass.closest)}: the Joker fills a seat in a pung or bigger that the ${singular(best.tiles[0])} never could.`
        : `Swapping your ${singular(best.tiles[0])} for the Joker costs your hand nothing (${planWords(best, card)}), and a Joker fits any pung, kong or quint later on.`,
    );
  } else {
    parts.push(`Keeping your tiles leaves ${planWords(best, card)}, the closest any move gets you.`);
  }
  if (picked !== best) {
    if (picked.type === 'call') {
      const lost = killsConcealed(pass, picked);
      parts.push(
        picked.closest > best.closest
          ? `Calling it for a ${GROUP_NAMES[picked.size]} leaves ${planWords(picked, card)}: further, not closer.`
          : `Calling it for a ${GROUP_NAMES[picked.size]} leaves ${planWords(picked, card)}: no closer, and the table now knows your hand.`,
      );
      if (lost) parts.push(`${handLabel(lost, card)} is a concealed hand, so any exposure ends it.`);
    } else if (picked.type === 'swap') {
      const unit = pass.plan?.units.find((u) => sameKind(u.kind, picked.tiles[0]) && u.naturals > 0);
      const holds = unit && unit.count < 3 ? ` That ${singular(picked.tiles[0])} is part of a ${GROUP_NAMES[unit.count]} in ${handLabel(pass.plan!.hand, card)}, and a Joker can never fill a single or pair.` : '';
      parts.push(`Swapping your ${singular(picked.tiles[0])} leaves ${planWords(picked, card)}.${holds}`);
    } else {
      const staying = picked.type === 'pass' ? 'Letting it go' : 'Keeping your tiles';
      parts.push(
        picked.closest > best.closest
          ? `${staying} leaves ${planWords(picked, card)}.`
          : `${staying} keeps you just as close, but a free Joker is worth taking: it fits more places than the tile it replaces.`,
      );
    }
  }
  return parts.join(' ');
}

function evaluateMove(
  analysis: MoveAnalysis,
  picked: readonly number[],
  card: PracticeCard,
): DrillEvaluation {
  const [at] = picked;
  if (picked.length !== 1 || !Number.isInteger(at) || at < 0 || at >= analysis.outcomes.length) {
    throw new RangeError('Pick exactly one move');
  }
  const outcome = analysis.outcomes[at];
  const verdict = moveVerdict(outcome, analysis);
  const aim = analysis.best.plan;
  return {
    verdict,
    score: SCORES[verdict],
    best: [analysis.outcomes.indexOf(analysis.best)],
    title: TITLES[verdict],
    explanation: explainMove(analysis, outcome, card),
    target: aim ? { label: `Aim for · ${handLabel(aim.hand, card)}`, line: aim.hand.line } : undefined,
  };
}

export function evaluateCall(question: DrillQuestion<CallData>, picked: readonly number[], card: PracticeCard = CURRENT_CARD): DrillEvaluation {
  return evaluateMove(analyzeCall(question.data, card), picked, card);
}

export function evaluateSwap(question: DrillQuestion<SwapData>, picked: readonly number[], card: PracticeCard = CURRENT_CARD): DrillEvaluation {
  return evaluateMove(analyzeSwap(question.data, card), picked, card);
}
