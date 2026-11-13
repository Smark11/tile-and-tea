// What the table does by itself: the bots' moves in the other seats, and the
// human player's routine moves (drawing from the wall, and letting a discard
// go when they can't win with it).

import { botAction, DEFAULT_LEVEL, type BotLevel } from '../bots';
import { CURRENT_CARD, type PracticeCard } from '../card';
import { awaiting, step } from '../engine/game';
import type { GameAction, GameState, Seat } from '../engine/types';
import { canCall } from './calls';

/** Whether `seat` can declare Mah Jongg now, on their own turn. */
export function canDeclareMahJongg(state: GameState, seat: Seat, card: PracticeCard = CURRENT_CARD): boolean {
  return step(state, { type: 'declareMahJongg', seat }, card).ok;
}

/** Whether `seat` can call the discard on the table for Mah Jongg. */
export function canCallMahJongg(state: GameState, seat: Seat, card: PracticeCard = CURRENT_CARD): boolean {
  return step(state, { type: 'call', seat, claim: { type: 'mahJongg' } }, card).ok;
}

/**
 * The next move the table makes by itself: a bot's move, or the human
 * player's routine ones (drawing, and passing on a discard they can't call
 * for Mah Jongg or an exposure). Null when the table is waiting on the human, or the game is over.
 * With `you` null, bots play every seat.
 */
export function autoAction(
  state: GameState,
  you: Seat | null,
  level: BotLevel = DEFAULT_LEVEL,
  card: PracticeCard = CURRENT_CARD,
): GameAction | null {
  const { phase } = state;
  for (const seat of awaiting(state)) {
    if (seat !== you) return botAction(state, seat, level, card);
    if (phase.type === 'turn' && phase.step === 'draw') return { type: 'draw', seat };
    // A discard the player can't use goes by without asking them.
    if (phase.type === 'calls' && !canCall(state, seat, card)) return { type: 'pass', seat };
  }
  return null;
}

/**
 * Plays a game with bots in every seat until `stop` says so or the game ends.
 * Used for the styleguide's mid-game table and for tests.
 */
export function playOut(
  start: GameState,
  stop: (state: GameState) => boolean,
  level: BotLevel = DEFAULT_LEVEL,
  card: PracticeCard = CURRENT_CARD,
): GameState {
  let state = start;
  while (!stop(state)) {
    const action = autoAction(state, null, level, card);
    if (!action) break;
    const result = step(state, action, card);
    if (!result.ok) throw new Error(`A ${level} bot made an illegal move (${result.error}) in game ${String(start.seed)}`);
    state = result.state;
  }
  return state;
}
