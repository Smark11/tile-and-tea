// Stand-in opponents for the table until the real bots (M4.2) arrive. They
// play legal, plain Mah Jongg: each move keeps their closest card hand as
// close as it can be, one tile at a time, with no reading of the table and
// no defense. They never pass or throw a Joker, call a discard only when the
// exposure brings a hand closer, and declare Mah Jongg whenever they can.
//
// `autoAction` also covers the moves the table makes for the human player:
// drawing from the wall, and letting a discard go when they can't win on it.

import { cardDistances, CURRENT_CARD, type PracticeCard } from '../card';
import { awaiting, step } from '../engine/game';
import {
  MAX_COURTESY,
  PASS_SIZE,
  type ExposedGroup,
  type GameAction,
  type GameState,
  type Seat,
} from '../engine/types';
import { sameKind, type Tile } from '../tiles';

const isJoker = (tile: Tile) => tile.kind.type === 'joker';

/** Tiles from the closest card hand, or Infinity when no hand is in reach. */
export function closestDistance(
  rack: readonly Tile[],
  exposures: readonly ExposedGroup[] = [],
  card: PracticeCard = CURRENT_CARD,
): number {
  const [best] = cardDistances(
    { concealed: rack.map((t) => t.kind), exposures: exposures.map((e) => e.tiles.map((t) => t.kind)) },
    card,
  );
  return best?.tilesAway ?? Infinity;
}

/**
 * The non-Joker tile whose loss hurts the closest hand least, or null if the
 * rack holds only Jokers. Ties go to the earliest tile in the rack.
 */
export function leastUseful(
  rack: readonly Tile[],
  exposures: readonly ExposedGroup[] = [],
  card: PracticeCard = CURRENT_CARD,
): { tile: Tile; distance: number } | null {
  let best: { tile: Tile; distance: number } | null = null;
  const tried: Tile[] = [];
  for (const tile of rack) {
    // Copies of one tile all leave the same rack behind.
    if (isJoker(tile) || tried.some((t) => sameKind(t.kind, tile.kind))) continue;
    tried.push(tile);
    const distance = closestDistance(
      rack.filter((t) => t.id !== tile.id),
      exposures,
      card,
    );
    if (!best || distance < best.distance) best = { tile, distance };
  }
  return best;
}

/** Up to `count` tiles to let go of, chosen one at a time. */
function tilesToPass(rack: readonly Tile[], count: number, card: PracticeCard): Tile[] {
  const passed: Tile[] = [];
  let left = rack;
  while (passed.length < count) {
    const pick = leastUseful(left, [], card);
    if (!pick) break;
    passed.push(pick.tile);
    left = left.filter((t) => t.id !== pick.tile.id);
  }
  return passed;
}

/** How many tiles a stand-in can spare without its closest hand slipping: its courtesy offer. */
function spareCount(rack: readonly Tile[], card: PracticeCard): number {
  const now = closestDistance(rack, [], card);
  let left = rack;
  let spare = 0;
  while (spare < MAX_COURTESY) {
    const pick = leastUseful(left, [], card);
    if (!pick || pick.distance > now) break;
    left = left.filter((t) => t.id !== pick.tile.id);
    spare++;
  }
  return spare;
}

/** The stand-in's move for `seat`, or null if the game isn't waiting on it. */
export function standInAction(state: GameState, seat: Seat, card: PracticeCard = CURRENT_CARD): GameAction | null {
  if (!awaiting(state).includes(seat)) return null;
  const { phase } = state;
  const player = state.players[seat];
  switch (phase.type) {
    case 'charleston': {
      // A rack holds at most eight Jokers, so three real tiles are always there. Stand-ins never pass blind.
      return { type: 'charlestonPass', seat, tiles: tilesToPass(player.rack, PASS_SIZE, card).map((t) => t.id) };
    }
    case 'charleston-vote':
      // Stand-ins leave the choice to the human player.
      return { type: 'charlestonVote', seat, continueCharleston: true };
    case 'courtesy-offer':
      return { type: 'courtesyOffer', seat, count: spareCount(player.rack, card) };
    case 'courtesy-pass':
      return {
        type: 'courtesyPass',
        seat,
        tiles: tilesToPass(player.rack, phase.counts[seat], card).map((t) => t.id),
      };
    case 'turn': {
      if (phase.step === 'draw') return { type: 'draw', seat };
      if (step(state, { type: 'declareMahJongg', seat }, card).ok) return { type: 'declareMahJongg', seat };
      const pick = leastUseful(player.rack, player.exposures, card);
      return { type: 'discard', seat, tile: (pick?.tile ?? player.rack[0]).id };
    }
    case 'calls': {
      if (step(state, { type: 'call', seat, claim: { type: 'mahJongg' } }, card).ok) {
        return { type: 'call', seat, claim: { type: 'mahJongg' } };
      }
      const pung = exposureWorthCalling(state, seat, card);
      return pung ? { type: 'call', seat, claim: { type: 'expose', tiles: pung } } : { type: 'pass', seat };
    }
    case 'ended':
      return null;
  }
}

/** Two matching rack tiles to pung the discard with, if that brings a hand closer. */
function exposureWorthCalling(state: GameState, seat: Seat, card: PracticeCard): number[] | null {
  const { phase } = state;
  if (phase.type !== 'calls' || isJoker(phase.tile)) return null;
  const player = state.players[seat];
  const matches = player.rack.filter((t) => sameKind(t.kind, phase.tile.kind));
  if (matches.length < 2) return null;
  const used = matches.slice(0, 2);
  const rest = player.rack.filter((t) => !used.includes(t));
  const exposed: ExposedGroup = { tiles: [phase.tile, ...used], kind: phase.tile.kind, calledFrom: phase.discarder };
  const before = closestDistance(player.rack, player.exposures, card);
  const after = closestDistance(rest, [...player.exposures, exposed], card);
  return after < before ? used.map((t) => t.id) : null;
}

/** Whether `seat` can declare Mah Jongg now, on their own turn. */
export function canDeclareMahJongg(state: GameState, seat: Seat, card: PracticeCard = CURRENT_CARD): boolean {
  return step(state, { type: 'declareMahJongg', seat }, card).ok;
}

/** Whether `seat` can call the discard on the table for Mah Jongg. */
export function canCallMahJongg(state: GameState, seat: Seat, card: PracticeCard = CURRENT_CARD): boolean {
  return step(state, { type: 'call', seat, claim: { type: 'mahJongg' } }, card).ok;
}

/**
 * The next move the table makes by itself: a stand-in's move, or the human
 * player's routine ones (drawing, and passing on a discard they can't win
 * with). Null when the table is waiting on the human, or the game is over.
 * With `you` null, stand-ins play every seat.
 */
export function autoAction(state: GameState, you: Seat | null, card: PracticeCard = CURRENT_CARD): GameAction | null {
  const { phase } = state;
  for (const seat of awaiting(state)) {
    if (seat !== you) return standInAction(state, seat, card);
    if (phase.type === 'turn' && phase.step === 'draw') return { type: 'draw', seat };
    // Calling for an exposure arrives with M4.3; until then only Mah Jongg waits for the player.
    if (phase.type === 'calls' && !canCallMahJongg(state, seat, card)) return { type: 'pass', seat };
  }
  return null;
}

/**
 * Plays a game from `seed` with stand-ins in every seat until `stop` says so
 * or the game ends. Used for the styleguide's mid-game table and for tests.
 */
export function playOut(
  start: GameState,
  stop: (state: GameState) => boolean,
  card: PracticeCard = CURRENT_CARD,
): GameState {
  let state = start;
  while (!stop(state)) {
    const action = autoAction(state, null, card);
    if (!action) break;
    const result = step(state, action, card);
    if (!result.ok) throw new Error(`Stand-in made an illegal move (${result.error}) in game ${String(start.seed)}`);
    state = result.state;
  }
  return state;
}
