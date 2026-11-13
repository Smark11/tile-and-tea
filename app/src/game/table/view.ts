// What the table shows the human player: where each seat sits, what to do
// next, and how the game came out. Plain functions of the game state so the
// table component stays a thin view.

import { CURRENT_CARD, type PracticeCard } from '../card';
import { countWord, groupName, handById, handLabel, list, tileCount, tilesWord } from '../drills/content/words';
import { awaiting } from '../engine/game';
import {
  acrossFrom,
  CHARLESTON_PASSES,
  leftOf,
  rightOf,
  turnsAfter,
  type ExposedGroup,
  type GameResult,
  type PlayerState,
  type GameState,
  type PassDirection,
  type Seat,
} from '../engine/types';
import type { Tile } from '../tiles';
import { canCallMahJongg, canDeclareMahJongg } from './autoplay';

/** Where a seat sits as the player looks at the table: they're always at the bottom. */
export type SeatPosition = 'bottom' | 'right' | 'top' | 'left';

const POSITIONS: readonly SeatPosition[] = ['bottom', 'right', 'top', 'left'];

export const SEAT_NAMES: Readonly<Record<Seat, string>> = { 0: 'East', 1: 'South', 2: 'West', 3: 'North' };

/** The next player to play sits on your right; the one before you on your left. */
export function positionOf(seat: Seat, you: Seat): SeatPosition {
  return POSITIONS[turnsAfter(you, seat)];
}

/** "on your right", "across from you", "on your left" or "you". */
export function wherePhrase(position: SeatPosition): string {
  switch (position) {
    case 'bottom':
      return 'you';
    case 'right':
      return 'on your right';
    case 'top':
      return 'across from you';
    case 'left':
      return 'on your left';
  }
}

function passTarget(you: Seat, direction: PassDirection): Seat {
  return direction === 'right' ? rightOf(you) : direction === 'left' ? leftOf(you) : acrossFrom(you);
}

/**
 * The rack in the player's own arrangement: tiles they already had keep their
 * places, and new arrivals (a draw, tiles passed in) go on the right end.
 * `fresh` lists the arrivals so the table can animate them in.
 */
export function arrangeRack(
  order: readonly number[],
  rack: readonly Tile[],
): { tiles: Tile[]; fresh: number[] } {
  const byId = new Map(rack.map((t) => [t.id, t]));
  const kept = order.flatMap((id) => {
    const tile = byId.get(id);
    return tile ? [tile] : [];
  });
  const known = new Set(order);
  const arrivals = rack.filter((t) => !known.has(t.id));
  return { tiles: [...kept, ...arrivals], fresh: arrivals.map((t) => t.id) };
}

/** What the human player needs to do now, as a short title and one sentence. */
export type TablePrompt = {
  title: string;
  detail: string;
  /** The table is waiting on the player. */
  yourMove: boolean;
};

const CHARLESTON_TITLES: Record<string, string> = {
  'first-right': 'First Charleston · pass right',
  'first-across': 'First Charleston · pass across',
  'first-left': 'First Charleston · pass left',
  'second-left': 'Second Charleston · pass left',
  'second-across': 'Second Charleston · pass across',
  'second-right': 'Second Charleston · pass right',
};

export function tablePrompt(state: GameState, you: Seat, card: PracticeCard = CURRENT_CARD): TablePrompt {
  const { phase } = state;
  const waitingOnYou = awaiting(state).includes(you);
  const name = (seat: Seat) => `${SEAT_NAMES[seat]}, ${wherePhrase(positionOf(seat, you))}`;
  switch (phase.type) {
    case 'charleston': {
      const pass = CHARLESTON_PASSES.find((p) => p.id === phase.pass)!;
      const title = CHARLESTON_TITLES[pass.id];
      if (!waitingOnYou) return { title, detail: 'Waiting for the others to pass.', yourMove: false };
      return {
        title,
        detail: `Choose 3 tiles to pass to ${name(passTarget(you, pass.direction))}. Jokers stay with you.`,
        yourMove: true,
      };
    }
    case 'charleston-vote':
      return waitingOnYou
        ? {
            title: 'A second Charleston?',
            detail: 'The first Charleston is done. Anyone at the table may stop here, or all pass three more times.',
            yourMove: true,
          }
        : { title: 'A second Charleston?', detail: 'Waiting for the others to decide.', yourMove: false };
    case 'courtesy-offer':
      return waitingOnYou
        ? {
            title: 'Courtesy pass',
            detail: `Trade up to 3 tiles with ${name(acrossFrom(you))}. If your offers differ, you both pass the smaller number.`,
            yourMove: true,
          }
        : { title: 'Courtesy pass', detail: 'Waiting for the others to offer.', yourMove: false };
    case 'courtesy-pass': {
      const count = phase.counts[you];
      if (!waitingOnYou) return { title: 'Courtesy pass', detail: 'Waiting for the others to pass.', yourMove: false };
      return {
        title: `Courtesy pass · ${count} ${count === 1 ? 'tile' : 'tiles'}`,
        detail: `Choose ${count} to pass across to ${name(acrossFrom(you))}.`,
        yourMove: true,
      };
    }
    case 'turn': {
      if (phase.seat !== you) {
        const doing = phase.step === 'draw' ? 'is drawing from the wall' : 'is choosing a discard';
        return { title: `${SEAT_NAMES[phase.seat]}’s turn`, detail: `${name(phase.seat)}, ${doing}.`, yourMove: false };
      }
      if (phase.step === 'draw') return { title: 'Your turn', detail: 'Drawing from the wall.', yourMove: false };
      if (canDeclareMahJongg(state, you, card)) {
        return { title: 'Mah Jongg!', detail: 'Your tiles make a hand on the card. Declare it to win.', yourMove: true };
      }
      return {
        title: 'Your turn',
        detail:
          phase.source === 'deal'
            ? 'East starts the play: choose one of your 14 tiles to discard.'
            : 'Choose a tile to discard.',
        yourMove: true,
      };
    }
    case 'calls': {
      const thrown = `${SEAT_NAMES[phase.discarder]} threw ${tileCount(phase.tile.kind, 1)}`;
      if (phase.discarder !== you && canCallMahJongg(state, you, card)) {
        return { title: 'Mah Jongg!', detail: `${thrown}, and it completes your hand. Call it to win.`, yourMove: true };
      }
      return { title: thrown, detail: 'Waiting to see if anyone calls it.', yourMove: false };
    }
    case 'ended':
      return { title: 'Game over', detail: resultSummary(phase.result, you, card).detail, yourMove: false };
  }
}

/** "pung of Red Dragons", "kong of 3 Bams, one a Joker", "quint of Norths, two of them Jokers". */
export function exposureLabel(group: ExposedGroup): string {
  const jokers = group.tiles.filter((t) => t.kind.type === 'joker').length;
  const name = groupName(group.kind, group.tiles.length);
  if (jokers === 0) return name;
  return `${name}, ${jokers === 1 ? 'one a Joker' : `${countWord(jokers)} of them Jokers`}`;
}

/** One screen-reader stop per seat: who, where, tiles in hand, exposures, and whether they're playing. */
export function seatLabel(player: PlayerState, you: Seat, active: boolean): string {
  const where = player.seat === you ? 'You' : `${SEAT_NAMES[player.seat]}, ${wherePhrase(positionOf(player.seat, you))}`;
  const parts = [where, `${tilesWord(player.rack.length)} in hand`];
  if (player.exposures.length) parts.push(`Exposed: ${list(player.exposures.map(exposureLabel))}`);
  if (player.dead) parts.push('Dead hand, sitting out');
  if (active) parts.push(player.seat === you ? 'Your turn' : 'Playing now');
  return `${parts.join('. ')}.`;
}

/** How the game ended, from the human player's side, as analytics reports it. */
export function outcomeFor(result: GameResult, you: Seat): 'won' | 'lost' | 'wall_game' | 'dead_hand' {
  switch (result.type) {
    case 'mahJongg':
      return result.winner === you ? 'won' : 'lost';
    case 'wall':
      return 'wall_game';
    case 'deadHands':
      return 'dead_hand';
  }
}

export type ResultSummary = {
  title: string;
  detail: string;
  /** Each seat's net change, you first then around the table to your right. */
  payments: { seat: Seat; amount: number }[];
};

/** The end-of-game panel's words. */
export function resultSummary(result: GameResult, you: Seat, card: PracticeCard = CURRENT_CARD): ResultSummary {
  const order = [0, 1, 2, 3].map((n) => ((you + n) % 4) as Seat);
  switch (result.type) {
    case 'mahJongg': {
      const winner = result.winner === you ? 'You' : SEAT_NAMES[result.winner];
      const how = result.selfDrawn
        ? 'drawing the winning tile'
        : `on ${result.discarder === you ? 'your' : `${SEAT_NAMES[result.discarder!]}’s`} discard`;
      const jokerless = result.jokerless ? ' Jokerless, so every payment doubles.' : '';
      return {
        title: result.winner === you ? 'Mah Jongg! You won' : `${SEAT_NAMES[result.winner]} called Mah Jongg`,
        detail: `${winner} made ${handLabel(handById(result.handId, card), card)} (${result.value}), ${how}.${jokerless}`,
        payments: order.map((seat) => ({ seat, amount: result.payments[seat] })),
      };
    }
    case 'wall':
      return {
        title: 'A wall game',
        detail: 'The wall ran out before anyone made a hand. No one pays.',
        payments: [],
      };
    case 'deadHands':
      return {
        title: 'Three dead hands',
        detail: 'Only one live hand was left at the table, so the game ends. No one pays.',
        payments: [],
      };
  }
}
