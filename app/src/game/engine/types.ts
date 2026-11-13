// The shape of one game of American Mah Jongg, from the deal to the last
// payment. Everything here is plain data (no class instances, no Hand
// objects), so a game can be saved, replayed from its seed, and sent to a bot.

import type { Tile, TileKind, Wind } from '../tiles';

// ---- Seats ------------------------------------------------------------------

/** 0 East, 1 South, 2 West, 3 North: the order play moves around the table. */
export type Seat = 0 | 1 | 2 | 3;

export const SEATS: readonly Seat[] = [0, 1, 2, 3];
export const EAST: Seat = 0;
export const SEAT_WINDS: Readonly<Record<Seat, Wind>> = { 0: 'E', 1: 'S', 2: 'W', 3: 'N' };

/** The player on your right, who also plays after you: East's right is South. */
export const rightOf = (seat: Seat): Seat => ((seat + 1) % 4) as Seat;
export const acrossFrom = (seat: Seat): Seat => ((seat + 2) % 4) as Seat;
export const leftOf = (seat: Seat): Seat => ((seat + 3) % 4) as Seat;

/** How many turns after `from` the seat `to` plays: 1 for the next player, 3 for the last. */
export const turnsAfter = (from: Seat, to: Seat): number => (to - from + 4) % 4;

// ---- The Charleston ---------------------------------------------------------

export type PassDirection = 'right' | 'across' | 'left';

export type CharlestonPassId =
  | 'first-right'
  | 'first-across'
  | 'first-left'
  | 'second-left'
  | 'second-across'
  | 'second-right';

export type CharlestonPass = {
  readonly id: CharlestonPassId;
  readonly direction: PassDirection;
  /** The last pass of each Charleston may be blind. */
  readonly blindAllowed: boolean;
};

/**
 * The first Charleston (required): right, across, left. The second (optional,
 * and only if no one stops it): left, across, right.
 */
export const CHARLESTON_PASSES: readonly CharlestonPass[] = [
  { id: 'first-right', direction: 'right', blindAllowed: false },
  { id: 'first-across', direction: 'across', blindAllowed: false },
  { id: 'first-left', direction: 'left', blindAllowed: true },
  { id: 'second-left', direction: 'left', blindAllowed: false },
  { id: 'second-across', direction: 'across', blindAllowed: false },
  { id: 'second-right', direction: 'right', blindAllowed: true },
];

/** Every Charleston pass is three tiles. */
export const PASS_SIZE = 3;
/** Partners across may trade none, one, two or three tiles in the courtesy pass. */
export const MAX_COURTESY = 3;

/** One player's part in a Charleston pass. */
export type PassSubmission = {
  /** Ids of the tiles passed from the rack: `PASS_SIZE - blind` of them, never a Joker. */
  readonly tiles: readonly number[];
  /** How many of the tiles coming to this player they pass on unseen (blind passes only). */
  readonly blind: number;
};

// ---- The table --------------------------------------------------------------

/** A group laid face up after calling a discard. */
export type ExposedGroup = {
  /** The called tile first, then the tiles from the rack (real tiles and Jokers). */
  readonly tiles: readonly Tile[];
  /** The tile the group is made of; every Joker in it stands for this. */
  readonly kind: TileKind;
  /** Who discarded the called tile. */
  readonly calledFrom: Seat;
};

/** Why a hand is dead: its owner stops playing (no turns, calls, swaps or win) but still pays. */
export type DeadReason =
  /** The player's exposures fit no hand on the card. */
  'exposures-fit-no-hand';

export type PlayerState = {
  readonly seat: Seat;
  /** Concealed tiles, in the order the player keeps them. */
  readonly rack: readonly Tile[];
  readonly exposures: readonly ExposedGroup[];
  readonly dead: DeadReason | null;
};

export type Discard = { readonly tile: Tile; readonly seat: Seat };

/** A player's claim on a discard. */
export type Claim =
  /** To expose a group of 3–6: the discard plus these rack tiles (matching tiles or Jokers). */
  | { readonly type: 'expose'; readonly tiles: readonly number[] }
  | { readonly type: 'mahJongg' };

/** How a turn's player came to hold their 14th tile. */
export type TurnSource =
  /** East's opening turn: East was dealt 14. */
  | 'deal'
  | 'wall'
  /** They called a discard for an exposure. */
  | 'call';

export type Phase =
  | {
      readonly type: 'charleston';
      readonly pass: CharlestonPassId;
      readonly submissions: readonly (PassSubmission | null)[];
    }
  /** After the first Charleston: any player may stop the second. */
  | { readonly type: 'charleston-vote'; readonly votes: readonly (boolean | null)[] }
  /** Each player says how many tiles they'd trade with the player across. */
  | { readonly type: 'courtesy-offer'; readonly offers: readonly (number | null)[] }
  | {
      readonly type: 'courtesy-pass';
      /** What each player agreed to pass: the smaller of the two offers across. */
      readonly counts: readonly number[];
      readonly submissions: readonly (readonly number[] | null)[];
    }
  | {
      readonly type: 'turn';
      readonly seat: Seat;
      /** `draw`: they must take a tile from the wall. `discard`: they hold 14 and must discard (or win). */
      readonly step: 'draw' | 'discard';
      readonly source: TurnSource;
      /** With source `call`, who discarded the called tile. */
      readonly calledFrom: Seat | null;
    }
  /** A tile was just discarded; the other players may claim it. */
  | {
      readonly type: 'calls';
      readonly discarder: Seat;
      readonly tile: Tile;
      /** Null while a player hasn't answered. The discarder, and anyone who can't call, are `pass`. */
      readonly responses: readonly (Claim | 'pass' | null)[];
    }
  | { readonly type: 'ended'; readonly result: GameResult };

export type MahJonggResult = {
  readonly type: 'mahJongg';
  readonly winner: Seat;
  /** The card hand scored (the best-paying one the tiles complete). */
  readonly handId: string;
  readonly value: number;
  readonly selfDrawn: boolean;
  /** Whose discard completed the hand; null when self-drawn. */
  readonly discarder: Seat | null;
  /** Won without a Joker in a hand that allows them: payments double. */
  readonly jokerless: boolean;
  /** Net change for each seat; they sum to zero. */
  readonly payments: readonly number[];
};

export type GameResult =
  | MahJonggResult
  /** The wall ran out with no winner. No one pays. */
  | { readonly type: 'wall' }
  /** Three hands went dead, leaving one player alone. The game ends and no one pays. */
  | { readonly type: 'deadHands' };

export type GameState = {
  /** Replays the same deal. */
  readonly seed: number | string;
  /** Tiles left to draw, next first. American play has no dead wall. */
  readonly wall: readonly Tile[];
  readonly players: readonly PlayerState[];
  /** Discards no one claimed, oldest first. */
  readonly discards: readonly Discard[];
  readonly phase: Phase;
};

// ---- Actions ----------------------------------------------------------------

export type GameAction =
  | { readonly type: 'charlestonPass'; readonly seat: Seat; readonly tiles: readonly number[]; readonly blind?: number }
  | { readonly type: 'charlestonVote'; readonly seat: Seat; readonly continueCharleston: boolean }
  | { readonly type: 'courtesyOffer'; readonly seat: Seat; readonly count: number }
  | { readonly type: 'courtesyPass'; readonly seat: Seat; readonly tiles: readonly number[] }
  | { readonly type: 'draw'; readonly seat: Seat }
  | { readonly type: 'discard'; readonly seat: Seat; readonly tile: number }
  /** Trade a real tile from the rack for a Joker standing in for it in any exposure. */
  | {
      readonly type: 'jokerSwap';
      readonly seat: Seat;
      readonly tile: number;
      readonly owner: Seat;
      readonly exposure: number;
    }
  /** Mah Jongg on the player's own turn, before discarding. */
  | { readonly type: 'declareMahJongg'; readonly seat: Seat }
  | { readonly type: 'call'; readonly seat: Seat; readonly claim: Claim }
  | { readonly type: 'pass'; readonly seat: Seat }
  /** The call window's time is up: anyone who hasn't answered passes. */
  | { readonly type: 'closeCalls' };

/** Why an action was refused. The state is unchanged. */
export type GameError =
  | 'wrong-phase'
  | 'not-your-turn'
  | 'already-acted'
  | 'unknown-tile'
  | 'wrong-tile-count'
  | 'joker-pass'
  | 'blind-not-allowed'
  | 'bad-count'
  | 'dead-hand'
  | 'own-discard'
  | 'joker-discard'
  | 'invalid-exposure'
  | 'swap-mismatch'
  | 'not-mah-jongg';

export type StepResult = { readonly ok: true; readonly state: GameState } | { readonly ok: false; readonly error: GameError };
