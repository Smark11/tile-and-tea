// What the human player may do with a discard on offer (call it for Mah
// Jongg, or for an exposure), and which exposed Jokers they may swap for on
// their own turn. Plain functions of the game state, so the table can offer
// exactly the moves the engine will accept.

import { seenBy } from '../bots';
import { cardDistances, CURRENT_CARD, type PracticeCard } from '../card';
import { countWord, groupName, singular } from '../drills/content/words';
import { MAX_EXPOSURE, step } from '../engine/game';
import type { Claim, ExposedGroup, GameState, Seat } from '../engine/types';
import { sameKind, type Tile, type TileKind } from '../tiles';

const isJoker = (tile: Tile) => tile.kind.type === 'joker';

/** The name of an exposed group by size: pung (3), kong (4), quint (5), sextet (6). */
export const EXPOSURE_NAMES: Readonly<Record<number, string>> = { 3: 'pung', 4: 'kong', 5: 'quint', 6: 'sextet' };

/** One exposure the player could make with the discard on offer. */
export type CallOption = {
  /** 3–6: the discard plus `tiles.length` rack tiles. */
  readonly size: number;
  /** "pung", "kong", "quint" or "sextet". */
  readonly name: string;
  /** Rack tile ids to expose with the discard: real copies first, then Jokers. */
  readonly tiles: readonly number[];
  /** How many of those are Jokers. */
  readonly jokers: number;
  /** The group as it would lie on the table: the discard first. */
  readonly group: readonly Tile[];
  /** How many hands on the card the player could still make after it. Always at least one. */
  readonly handsLeft: number;
  /** Tiles from the closest hand after the call (live tiles only); before, for comparison. */
  readonly closestAfter: number;
  readonly closestBefore: number;
};

/** Everything the player may do with the discard on the table. */
export type CallChoices = {
  readonly mahJongg: boolean;
  /** Exposures that keep at least one hand on the card in reach, smallest first. */
  readonly exposures: readonly CallOption[];
};

const NO_CALLS: CallChoices = { mahJongg: false, exposures: [] };

function closest(
  rack: readonly Tile[],
  exposures: readonly ExposedGroup[],
  seen: readonly TileKind[],
  card: PracticeCard,
) {
  const holding = { concealed: rack.map((t) => t.kind), exposures: exposures.map((e) => e.tiles.map((t) => t.kind)) };
  const ranked = cardDistances(holding, card, seen);
  const live = ranked.find((r) => r.tilesAway !== null)?.tilesAway ?? Infinity;
  // Whether a hand still fits at all is judged as the engine judges a dead
  // hand: by the card alone, not by which tiles happen to be gone.
  const fits = cardDistances(holding, card).filter((r) => r.tilesAway !== null).length;
  return { live, fits };
}

/**
 * What `you` may do with the discard on offer: call it for Mah Jongg, and
 * which exposures they could make. An exposure that fits no hand on the card
 * would leave a dead hand, so it isn't offered. Nothing while the player has
 * already answered, threw the tile themselves, or has a dead hand.
 */
export function callChoices(state: GameState, you: Seat, card: PracticeCard = CURRENT_CARD): CallChoices {
  // The bots, the prompt and the panel all ask about the same (immutable)
  // state; the card search behind the answer runs once per state, seat and card.
  let byCard = CHOICES_MEMO.get(state);
  if (!byCard) CHOICES_MEMO.set(state, (byCard = new Map()));
  let bySeat = byCard.get(card);
  if (!bySeat) byCard.set(card, (bySeat = new Map()));
  const known = bySeat.get(you);
  if (known) return known;
  const choices = computeCallChoices(state, you, card);
  bySeat.set(you, choices);
  return choices;
}

const CHOICES_MEMO = new WeakMap<GameState, Map<PracticeCard, Map<Seat, CallChoices>>>();

function computeCallChoices(state: GameState, you: Seat, card: PracticeCard): CallChoices {
  const { phase } = state;
  if (phase.type !== 'calls' || phase.discarder === you || phase.responses[you] !== null) return NO_CALLS;
  const me = state.players[you];
  if (me.dead || isJoker(phase.tile)) return NO_CALLS;
  const mahJongg = step(state, { type: 'call', seat: you, claim: { type: 'mahJongg' } }, card).ok;

  const naturals = me.rack.filter((t) => sameKind(t.kind, phase.tile.kind));
  const jokers = me.rack.filter(isJoker);
  const seen = seenBy(state, you);
  const before = closest(me.rack, me.exposures, [...seen, phase.tile.kind], card).live;
  const exposures: CallOption[] = [];
  for (let size = 3; size <= MAX_EXPOSURE; size++) {
    const fromRack = size - 1;
    const real = naturals.slice(0, fromRack);
    const used = [...real, ...jokers.slice(0, fromRack - real.length)];
    if (used.length < fromRack) break;
    const tiles = used.map((t) => t.id);
    if (!step(state, { type: 'call', seat: you, claim: { type: 'expose', tiles } }, card).ok) continue;
    const group = [phase.tile, ...used];
    const exposed: ExposedGroup = { tiles: group, kind: phase.tile.kind, calledFrom: phase.discarder };
    const rest = me.rack.filter((t) => !tiles.includes(t.id));
    const after = closest(rest, [...me.exposures, exposed], seen, card);
    if (after.fits === 0) continue;
    // Holding two Jokers makes nearly every discard callable for a pung. Ask
    // only when the call is one a player would weigh: it uses a real tile they
    // kept, or it brings their hand closer.
    if (real.length === 0 && !(after.live < before)) continue;
    exposures.push({
      size,
      name: EXPOSURE_NAMES[size],
      tiles,
      jokers: used.length - real.length,
      group,
      handsLeft: after.fits,
      closestAfter: after.live,
      closestBefore: before,
    });
  }
  return { mahJongg, exposures };
}

/** Whether the table should wait for the player to decide on the discard on offer. */
export function canCall(state: GameState, you: Seat, card: PracticeCard = CURRENT_CARD): boolean {
  const choices = callChoices(state, you, card);
  return choices.mahJongg || choices.exposures.length > 0;
}

/**
 * Why the player's call (`mine`) didn't get the tile, comparing the table as
 * they called (`before`, still taking calls) to how the calls settled
 * (`after`). Null if they got it.
 */
export function lostCallNote(
  before: GameState,
  mine: Claim,
  after: GameState,
  you: Seat,
  seatName: (seat: Seat) => string,
): string | null {
  const { phase } = before;
  if (phase.type !== 'calls' || after.phase.type === 'calls') return null;
  const next = after.phase;
  if (next.type === 'ended' && next.result.type === 'mahJongg' && next.result.winner !== you) {
    const winner = seatName(next.result.winner);
    return mine.type === 'mahJongg'
      ? `${winner} called Mah Jongg too, and plays sooner after ${seatName(phase.discarder)}, so the win is theirs.`
      : `${winner} called it for Mah Jongg, which beats a call for an exposure.`;
  }
  if (next.type === 'turn' && next.source === 'call' && next.seat !== you) {
    return `${seatName(next.seat)} called it too, and plays sooner after ${seatName(phase.discarder)}, so the tile went to them.`;
  }
  return null;
}

/** How long the player has to call a discard before the table lets it go. Null: no limit. */
export type CallWindow = 'off' | 'relaxed' | 'standard' | 'brisk';

export const CALL_WINDOWS: readonly CallWindow[] = ['off', 'relaxed', 'standard', 'brisk'];

export const CALL_WINDOW_MS: Readonly<Record<CallWindow, number | null>> = {
  off: null,
  relaxed: 12_000,
  standard: 7_000,
  brisk: 4_000,
};

/** Relaxed: a beginner has time to look, and an expert isn't kept waiting long. */
export const DEFAULT_CALL_WINDOW: CallWindow = 'relaxed';

export function isCallWindow(value: unknown): value is CallWindow {
  return typeof value === 'string' && (CALL_WINDOWS as readonly string[]).includes(value);
}

/** One exposed Joker the player could take, and the rack tile they'd give for it. */
export type SwapOption = {
  readonly owner: Seat;
  /** Which of the owner's exposures. */
  readonly exposure: number;
  /** The rack tile that replaces the Joker. */
  readonly tile: Tile;
  /** The exposure as it lies now. */
  readonly group: ExposedGroup;
};

/**
 * The Joker swaps open to `you` now: on their own turn with 14 tiles, for each
 * exposure (anyone's, their own included) holding a Joker that stands for a
 * tile they have. One option per exposure; after a swap, ask again.
 */
export function swapOptions(state: GameState, you: Seat, card: PracticeCard = CURRENT_CARD): SwapOption[] {
  const { phase } = state;
  if (phase.type !== 'turn' || phase.seat !== you || phase.step !== 'discard') return [];
  const me = state.players[you];
  if (me.dead) return [];
  const out: SwapOption[] = [];
  for (const owner of state.players) {
    owner.exposures.forEach((group, exposure) => {
      if (!group.tiles.some(isJoker)) return;
      const tile = me.rack.find((t) => !isJoker(t) && sameKind(t.kind, group.kind));
      if (!tile) return;
      if (!step(state, { type: 'jokerSwap', seat: you, tile: tile.id, owner: owner.seat, exposure }, card).ok) return;
      out.push({ owner: owner.seat, exposure, tile, group });
    });
  }
  return out;
}

/** "Call for a pung of 5 Dots", "Call for a kong of Norths, using two Jokers". */
export function callLabel(option: CallOption): string {
  const kind = option.group[0].kind;
  const jokers =
    option.jokers === 0 ? '' : `, using ${countWord(option.jokers)} ${option.jokers === 1 ? 'Joker' : 'Jokers'}`;
  return `Call for a ${groupName(kind, option.size)}${jokers}`;
}

/** "Swap your 5 Dot for the Joker in South’s kong", or "… in your pung". */
export function swapLabel(option: SwapOption, you: Seat, seatName: (seat: Seat) => string): string {
  const whose = option.owner === you ? 'your' : `${seatName(option.owner)}’s`;
  return `Swap your ${singular(option.tile.kind)} for the Joker in ${whose} ${EXPOSURE_NAMES[option.group.tiles.length]}`;
}
