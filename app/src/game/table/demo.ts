// Tables partway through a game, for the styleguide and screenshots. The
// bots expose real tiles first, so the demo hands each exposed player's
// spare Joker into their exposure in place of a rack tile: the same group,
// as a player who chose to expose the Joker would have made it.
// table.test.ts pins what these produce.

import { newGame, type GameState, type PlayerState } from '../engine';
import { playOut } from './autoplay';

export const DEMO_TABLE_SEED = 5;

/** Swap a rack Joker into the player's first exposure, in place of its last real tile (never the called one). */
function exposeJoker(player: PlayerState): PlayerState {
  const [group, ...rest] = player.exposures;
  const joker = player.rack.find((t) => t.kind.type === 'joker');
  if (!group || !joker || group.tiles.length < 2) return player;
  const swapIndex = group.tiles.findLastIndex((t, i) => i > 0 && t.kind.type !== 'joker');
  if (swapIndex < 0) return player;
  const real = group.tiles[swapIndex];
  return {
    ...player,
    rack: player.rack.map((t) => (t.id === joker.id ? real : t)),
    exposures: [{ ...group, tiles: group.tiles.map((t, i) => (i === swapIndex ? joker : t)) }, ...rest],
  };
}

/**
 * East (the player's seat) to discard, a few rows of discards, and East and
 * North each with an exposure holding a Joker.
 */
export function midGameTable(seed: number = DEMO_TABLE_SEED): GameState {
  const state = playOut(
    newGame(seed),
    (g) =>
      g.phase.type === 'turn' &&
      g.phase.seat === 0 &&
      g.phase.step === 'discard' &&
      g.discards.length >= 22 &&
      g.players.filter((p) => p.exposures.length > 0).length >= 2,
  );
  return { ...state, players: state.players.map(exposeJoker) };
}

/** The table a moment later: another player's discard lies on the felt, still open to a call. */
export function openDiscardTable(seed: number = DEMO_TABLE_SEED): GameState {
  return playOut(midGameTable(seed), (g) => g.phase.type === 'calls' && g.phase.discarder !== 0);
}

/** Later still: West, across the table, has drawn and is choosing a discard. */
export function theirTurnTable(seed: number = DEMO_TABLE_SEED): GameState {
  return playOut(
    openDiscardTable(seed),
    (g) => g.phase.type === 'turn' && g.phase.seat === 2 && g.phase.step === 'discard',
  );
}

export const DEMO_TABLES = {
  yours: midGameTable,
  open: openDiscardTable,
  theirs: theirTurnTable,
} as const;

export type DemoTable = keyof typeof DEMO_TABLES;

export function isDemoTable(value: unknown): value is DemoTable {
  return typeof value === 'string' && Object.hasOwn(DEMO_TABLES, value);
}
