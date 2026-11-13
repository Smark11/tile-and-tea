// A game in progress, kept so the player can leave the table and come back.
//
// The save is the deal's seed plus every move made since, not a snapshot of
// the table: replaying the moves through the engine rebuilds the exact
// table, and checks every move on the way. A save that doesn't replay (from
// an older engine, or tampered with) is simply dropped, never half-loaded.

import { isBotLevel, type BotLevel } from '../bots';
import { newGame, step, type GameAction, type GameState, type Seat } from '../engine';

/** Bump when a change to the engine or the save's shape means old saves can't replay. */
export const SAVED_GAME_VERSION = 1;

export type SavedGame = {
  readonly version: typeof SAVED_GAME_VERSION;
  /** The deal. */
  readonly seed: number;
  /** The player's seat. */
  readonly you: Seat;
  /** The computer players' level, kept with the game: a resumed game never changes opponents. */
  readonly level: BotLevel;
  /** Every move since the deal, in order, the player's and the bots'. */
  readonly actions: readonly GameAction[];
  /** The player's own rack arrangement, as tile ids, left to right. */
  readonly order: readonly number[];
  /** When the save was last written, in ms since the epoch. */
  readonly savedAt: number;
};

/** A save that replayed cleanly, ready to sit back down to. */
export type RestoredGame = {
  readonly saved: SavedGame;
  readonly state: GameState;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isSeat = (value: unknown): value is Seat => value === 0 || value === 1 || value === 2 || value === 3;

/**
 * Replays the moves from the deal. Null if any move is refused (or isn't a
 * move at all): the engine checks each one exactly as it did at the table.
 */
export function replayGame(seed: number, actions: readonly unknown[]): GameState | null {
  let state = newGame(seed);
  for (const action of actions) {
    if (!isRecord(action) || typeof action.type !== 'string') return null;
    try {
      const result = step(state, action as GameAction);
      if (!result.ok) return null;
      state = result.state;
    } catch {
      // A move with the right type but the wrong shape (from a damaged save).
      return null;
    }
  }
  return state;
}

/**
 * Checks a save read from storage and rebuilds its table. Null for anything
 * that isn't a game still in play: a damaged or outdated save, or one whose
 * game has already ended.
 */
export function restoreGame(value: unknown): RestoredGame | null {
  if (!isRecord(value) || value.version !== SAVED_GAME_VERSION) return null;
  const { seed, you, level, actions, order, savedAt } = value;
  if (!Number.isSafeInteger(seed) || !isSeat(you) || !isBotLevel(level) || !Array.isArray(actions)) return null;
  if (typeof savedAt !== 'number' || !Number.isFinite(savedAt)) return null;
  const state = replayGame(seed as number, actions);
  if (!state || state.phase.type === 'ended') return null;
  const ids = Array.isArray(order) ? order.filter((id): id is number => Number.isInteger(id)) : [];
  return {
    saved: { version: SAVED_GAME_VERSION, seed: seed as number, you, level, actions, order: ids, savedAt },
    state,
  };
}

/** Where a saved game stands, in a few words: "First Charleston", "Your turn", "South’s turn". */
export function savedGameStage(state: GameState, you: Seat): string {
  const { phase } = state;
  switch (phase.type) {
    case 'charleston':
      return phase.pass.startsWith('first') ? 'In the first Charleston' : 'In the second Charleston';
    case 'charleston-vote':
      return 'Deciding on a second Charleston';
    case 'courtesy-offer':
    case 'courtesy-pass':
      return 'At the courtesy pass';
    case 'turn':
      return phase.seat === you ? 'Your turn' : 'Play under way';
    case 'calls':
      return phase.discarder === you ? 'Play under way' : 'A discard is on offer';
    case 'ended':
      return 'Finished';
  }
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** How long ago a save was made: "just now", "5 min ago", "2 hours ago", "a day ago", "3 days ago". */
export function savedAgo(savedAt: number, now: number): string {
  const elapsed = Math.max(0, now - savedAt);
  if (elapsed < MINUTE) return 'just now';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`;
  if (elapsed < DAY) {
    const hours = Math.floor(elapsed / HOUR);
    return hours === 1 ? 'an hour ago' : `${hours} hours ago`;
  }
  const days = Math.floor(elapsed / DAY);
  return days === 1 ? 'a day ago' : `${days} days ago`;
}
