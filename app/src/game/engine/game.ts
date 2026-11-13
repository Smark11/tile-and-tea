// One game of American Mah Jongg as a pure reducer: deal → Charleston (first,
// optional second, courtesy) → play (draw, discard, call, expose, Joker swaps)
// → Mah Jongg or a wall game. Rules follow standard American play
// (docs/PRODUCT.md, rules scope):
//
// - East is dealt 14 tiles and the others 13. East discards first, without drawing.
// - Charleston passes are 3 tiles, never a Joker. The last pass of each
//   Charleston may be blind. Any player can stop the second Charleston. Then
//   partners across trade 0–3 tiles in the courtesy pass, the smaller offer winning.
// - A discard may be called to expose a group of 3–6 (the discard plus
//   matching tiles or Jokers), or for Mah Jongg, which is the only call that
//   can complete a single or a pair. A discarded Joker can't be called.
//   Mah Jongg beats an exposure call; otherwise the caller next in turn after
//   the discarder gets the tile. Play then continues to the right of the caller.
// - On their own turn, after drawing or calling, a player may trade a real
//   tile for a Joker in any exposure that stands for that tile.
// - A player whose exposures fit no hand on the card has a dead hand. They
//   finish the turn they're in by discarding, then stop playing: their turns
//   are skipped and they can't call, swap Jokers or declare Mah Jongg. Others
//   may still swap for Jokers in their exposures, and they still pay the winner.
//   When only one live hand is left, the game ends and no one pays.
// - If the last tile of the wall is discarded and no one claims it, it's a
//   wall game. (American play draws no replacement tiles, so there's no dead wall.)
//
// `step` returns the next state or the reason an action is illegal, and never
// mutates its input. `gameReducer` wraps it for `useReducer`.

import { cardDistances, CURRENT_CARD, findMahJongg, type PracticeCard } from '../card';
import { createRng } from '../rng';
import { createShuffledTileSet, sameKind, type Tile } from '../tiles';
import { resolvePass } from './charleston';
import { bestSettlement } from './scoring';
import {
  acrossFrom,
  CHARLESTON_PASSES,
  EAST,
  MAX_COURTESY,
  PASS_SIZE,
  rightOf,
  SEATS,
  turnsAfter,
  type Claim,
  type DeadReason,
  type GameAction,
  type GameError,
  type GameState,
  type Phase,
  type PlayerState,
  type Seat,
  type StepResult,
} from './types';

/** Tiles dealt to everyone but East, who gets one more. */
export const DEAL_SIZE = 13;
/** The largest group a call can expose: a sextet. */
export const MAX_EXPOSURE = 6;
const MIN_EXPOSURE = 3;

const isJoker = (tile: Tile) => tile.kind.type === 'joker';
const fail = (error: GameError): StepResult => ({ ok: false, error });
const ok = (state: GameState): StepResult => ({ ok: true, state });
const empty = <T>(): (T | null)[] => SEATS.map(() => null);

/** A shuffled set dealt for a new game, ready for the first Charleston pass. */
export function newGame(seed: number | string): GameState {
  const tiles = createShuffledTileSet(createRng(seed));
  let next = 0;
  const players = SEATS.map((seat): PlayerState => {
    const size = seat === EAST ? DEAL_SIZE + 1 : DEAL_SIZE;
    const rack = tiles.slice(next, next + size);
    next += size;
    return { seat, rack, exposures: [], dead: null };
  });
  return {
    seed,
    wall: tiles.slice(next),
    players,
    discards: [],
    phase: { type: 'charleston', pass: 'first-right', submissions: empty() },
  };
}

/** The seats whose move the game is waiting on. Empty once the game has ended. */
export function awaiting(state: GameState): Seat[] {
  const { phase } = state;
  switch (phase.type) {
    case 'charleston':
      return SEATS.filter((s) => phase.submissions[s] === null);
    case 'charleston-vote':
      return SEATS.filter((s) => phase.votes[s] === null);
    case 'courtesy-offer':
      return SEATS.filter((s) => phase.offers[s] === null);
    case 'courtesy-pass':
      return SEATS.filter((s) => phase.submissions[s] === null);
    case 'calls':
      return SEATS.filter((s) => phase.responses[s] === null);
    case 'turn':
      return [phase.seat];
    case 'ended':
      return [];
  }
}

/** Every tile a player holds: rack plus exposures. */
export function tilesHeld(player: PlayerState): Tile[] {
  return [...player.rack, ...player.exposures.flatMap((e) => e.tiles)];
}

/**
 * Takes distinct tiles from a rack by id. Null if any id is missing or repeated.
 */
function pick(rack: readonly Tile[], ids: readonly number[]): { picked: Tile[]; rest: Tile[] } | null {
  const wanted = new Set(ids);
  if (wanted.size !== ids.length) return null;
  const picked = ids.map((id) => rack.find((t) => t.id === id));
  if (picked.some((t) => t === undefined)) return null;
  return { picked: picked as Tile[], rest: rack.filter((t) => !wanted.has(t.id)) };
}

function withPlayer(state: GameState, seat: Seat, change: Partial<PlayerState>): GameState {
  return { ...state, players: state.players.map((p) => (p.seat === seat ? { ...p, ...change } : p)) };
}

function setAt<T>(items: readonly T[], index: number, value: T): T[] {
  return items.map((item, i) => (i === index ? value : item));
}

/** Whether `player`'s exposures still fit some hand on the card. */
function deadReason(player: PlayerState, card: PracticeCard): DeadReason | null {
  const exposures = player.exposures.map((e) => e.tiles.map((t) => t.kind));
  const reachable = cardDistances({ concealed: [], exposures }, card).some((r) => r.tilesAway !== null);
  return reachable ? null : 'exposures-fit-no-hand';
}

// ---- The Charleston ---------------------------------------------------------

function startPlay(state: GameState): GameState {
  return { ...state, phase: { type: 'turn', seat: EAST, step: 'discard', source: 'deal', calledFrom: null } };
}

function charlestonPass(state: GameState, seat: Seat, ids: readonly number[], blind: number): StepResult {
  const { phase } = state;
  if (phase.type !== 'charleston') return fail('wrong-phase');
  if (phase.submissions[seat]) return fail('already-acted');
  const index = CHARLESTON_PASSES.findIndex((p) => p.id === phase.pass);
  const pass = CHARLESTON_PASSES[index];
  if (!Number.isInteger(blind) || blind < 0 || blind > PASS_SIZE) return fail('bad-count');
  if (blind > 0 && !pass.blindAllowed) return fail('blind-not-allowed');
  if (ids.length !== PASS_SIZE - blind) return fail('wrong-tile-count');
  const taken = pick(state.players[seat].rack, ids);
  if (!taken) return fail('unknown-tile');
  if (taken.picked.some(isJoker)) return fail('joker-pass');

  const submissions = setAt(phase.submissions, seat, { tiles: [...ids], blind });
  if (submissions.some((s) => s === null)) return ok({ ...state, phase: { ...phase, submissions } });

  const racks = resolvePass(
    state.players.map((p) => p.rack),
    state.players.map((p, s) => {
      const sub = submissions[s]!;
      return { tiles: pick(p.rack, sub.tiles)!.picked, blind: sub.blind };
    }),
    pass.direction,
  );
  const passed: GameState = { ...state, players: state.players.map((p, s) => ({ ...p, rack: racks[s] })) };
  const nextPhase: Phase =
    pass.id === 'first-left'
      ? { type: 'charleston-vote', votes: empty() }
      : pass.id === 'second-right'
        ? { type: 'courtesy-offer', offers: empty() }
        : { type: 'charleston', pass: CHARLESTON_PASSES[index + 1].id, submissions: empty() };
  return ok({ ...passed, phase: nextPhase });
}

function charlestonVote(state: GameState, seat: Seat, continueCharleston: boolean): StepResult {
  const { phase } = state;
  if (phase.type !== 'charleston-vote') return fail('wrong-phase');
  if (phase.votes[seat] !== null) return fail('already-acted');
  const votes = setAt(phase.votes, seat, continueCharleston);
  if (votes.some((v) => v === null)) return ok({ ...state, phase: { ...phase, votes } });
  // Any one player can stop the second Charleston.
  const nextPhase: Phase = votes.every((v) => v)
    ? { type: 'charleston', pass: 'second-left', submissions: empty() }
    : { type: 'courtesy-offer', offers: empty() };
  return ok({ ...state, phase: nextPhase });
}

function courtesyOffer(state: GameState, seat: Seat, count: number): StepResult {
  const { phase } = state;
  if (phase.type !== 'courtesy-offer') return fail('wrong-phase');
  if (phase.offers[seat] !== null) return fail('already-acted');
  if (!Number.isInteger(count) || count < 0 || count > MAX_COURTESY) return fail('bad-count');
  const offers = setAt(phase.offers, seat, count);
  if (offers.some((o) => o === null)) return ok({ ...state, phase: { ...phase, offers } });
  // When partners disagree, both pass the smaller number.
  const counts = SEATS.map((s) => Math.min(offers[s]!, offers[acrossFrom(s)]!));
  if (counts.every((c) => c === 0)) return ok(startPlay(state));
  const submissions = counts.map((c) => (c === 0 ? [] : null));
  return ok({ ...state, phase: { type: 'courtesy-pass', counts, submissions } });
}

function courtesyPass(state: GameState, seat: Seat, ids: readonly number[]): StepResult {
  const { phase } = state;
  if (phase.type !== 'courtesy-pass') return fail('wrong-phase');
  if (phase.submissions[seat] !== null) return fail('already-acted');
  if (ids.length !== phase.counts[seat]) return fail('wrong-tile-count');
  const taken = pick(state.players[seat].rack, ids);
  if (!taken) return fail('unknown-tile');
  if (taken.picked.some(isJoker)) return fail('joker-pass');
  const submissions = setAt(phase.submissions, seat, [...ids]);
  if (submissions.some((s) => s === null)) return ok({ ...state, phase: { ...phase, submissions } });

  const racks = resolvePass(
    state.players.map((p) => p.rack),
    state.players.map((p, s) => ({ tiles: pick(p.rack, submissions[s]!)!.picked, blind: 0 })),
    'across',
  );
  return ok(startPlay({ ...state, players: state.players.map((p, s) => ({ ...p, rack: racks[s] })) }));
}

// ---- Play -------------------------------------------------------------------

function ownTurn(state: GameState, seat: Seat, step: 'draw' | 'discard'): GameError | null {
  const { phase } = state;
  if (phase.type !== 'turn' || phase.step !== step) return 'wrong-phase';
  if (phase.seat !== seat) return 'not-your-turn';
  return null;
}

function draw(state: GameState, seat: Seat): StepResult {
  const error = ownTurn(state, seat, 'draw');
  if (error) return fail(error);
  // The wall is never empty here: a game whose last tile goes unclaimed ends at once.
  const [tile, ...wall] = state.wall;
  const drawn = withPlayer({ ...state, wall }, seat, { rack: [...state.players[seat].rack, tile] });
  return ok({ ...drawn, phase: { type: 'turn', seat, step: 'discard', source: 'wall', calledFrom: null } });
}

function discard(state: GameState, seat: Seat, id: number, card: PracticeCard): StepResult {
  const error = ownTurn(state, seat, 'discard');
  if (error) return fail(error);
  const taken = pick(state.players[seat].rack, [id]);
  if (!taken) return fail('unknown-tile');
  const [tile] = taken.picked;
  const discarded = withPlayer(state, seat, { rack: taken.rest });
  // Only live players can call, and no one can call a Joker.
  const responses = SEATS.map((s) => (s === seat || isJoker(tile) || state.players[s].dead ? 'pass' : null));
  return settleCallsIfDone({ ...discarded, phase: { type: 'calls', discarder: seat, tile, responses } }, card);
}

/** Whether `seat` may make this claim on the tile now on the table. */
function claimError(state: GameState, seat: Seat, claim: Claim, card: PracticeCard): GameError | null {
  const { phase } = state;
  if (phase.type !== 'calls') return 'wrong-phase';
  if (seat === phase.discarder) return 'own-discard';
  if (state.players[seat].dead) return 'dead-hand';
  if (phase.responses[seat] !== null) return 'already-acted';
  const player = state.players[seat];
  if (claim.type === 'mahJongg') {
    return completes(player, [...player.rack, phase.tile], card) ? null : 'not-mah-jongg';
  }
  const size = claim.tiles.length + 1;
  if (size < MIN_EXPOSURE || size > MAX_EXPOSURE) return 'invalid-exposure';
  const taken = pick(player.rack, claim.tiles);
  if (!taken) return 'unknown-tile';
  if (!taken.picked.every((t) => isJoker(t) || sameKind(t.kind, phase.tile.kind))) return 'invalid-exposure';
  return null;
}

function call(state: GameState, seat: Seat, claim: Claim, card: PracticeCard): StepResult {
  const error = claimError(state, seat, claim, card);
  if (error) return fail(error);
  const phase = state.phase as Extract<Phase, { type: 'calls' }>;
  const responses = setAt(phase.responses, seat, claim.type === 'mahJongg' ? claim : { ...claim, tiles: [...claim.tiles] });
  return settleCallsIfDone({ ...state, phase: { ...phase, responses } }, card);
}

function passCall(state: GameState, seat: Seat, card: PracticeCard): StepResult {
  const { phase } = state;
  if (phase.type !== 'calls') return fail('wrong-phase');
  if (phase.responses[seat] !== null) return fail('already-acted');
  return settleCallsIfDone({ ...state, phase: { ...phase, responses: setAt(phase.responses, seat, 'pass') } }, card);
}

function closeCalls(state: GameState, card: PracticeCard): StepResult {
  const { phase } = state;
  if (phase.type !== 'calls') return fail('wrong-phase');
  return settleCallsIfDone({ ...state, phase: { ...phase, responses: phase.responses.map((r) => r ?? 'pass') } }, card);
}

/**
 * Once every player has answered, gives the discard to the winning claim
 * (Mah Jongg first, then whoever plays soonest after the discarder) or, if no
 * one wants it, leaves it on the table and moves on.
 */
function settleCallsIfDone(state: GameState, card: PracticeCard): StepResult {
  const phase = state.phase as Extract<Phase, { type: 'calls' }>;
  if (phase.responses.some((r) => r === null)) return ok(state);
  const { discarder, tile } = phase;
  const claims = SEATS.flatMap((seat) => {
    const claim = phase.responses[seat];
    return claim && claim !== 'pass' ? [{ seat, claim }] : [];
  }).sort(
    (a, b) =>
      Number(b.claim.type === 'mahJongg') - Number(a.claim.type === 'mahJongg') ||
      turnsAfter(discarder, a.seat) - turnsAfter(discarder, b.seat),
  );

  if (claims.length === 0) {
    const passed: GameState = { ...state, discards: [...state.discards, { tile, seat: discarder }] };
    if (passed.wall.length === 0) return ok({ ...passed, phase: { type: 'ended', result: { type: 'wall' } } });
    // Dead hands sit out. Someone other than the discarder is always live,
    // since the game ends as soon as only one hand is.
    let next = rightOf(discarder);
    while (passed.players[next].dead) next = rightOf(next);
    return ok({ ...passed, phase: { type: 'turn', seat: next, step: 'draw', source: 'wall', calledFrom: null } });
  }

  const { seat, claim } = claims[0];
  const player = state.players[seat];
  if (claim.type === 'mahJongg') return ok(endWithMahJongg(state, seat, [...player.rack, tile], discarder, card));

  const { picked, rest } = pick(player.rack, claim.tiles)!;
  const exposed: PlayerState = {
    ...player,
    rack: rest,
    exposures: [...player.exposures, { tiles: [tile, ...picked], kind: tile.kind, calledFrom: discarder }],
  };
  const called = withPlayer(state, seat, { ...exposed, dead: deadReason(exposed, card) });
  if (called.players.filter((p) => !p.dead).length <= 1) {
    return ok({ ...called, phase: { type: 'ended', result: { type: 'deadHands' } } });
  }
  return ok({ ...called, phase: { type: 'turn', seat, step: 'discard', source: 'call', calledFrom: discarder } });
}

function completes(player: PlayerState, concealed: readonly Tile[], card: PracticeCard): boolean {
  return findMahJongg(declarationOf(player, concealed), card).length > 0;
}

function declarationOf(player: PlayerState, concealed: readonly Tile[]) {
  return { concealed: concealed.map((t) => t.kind), exposures: player.exposures.map((e) => e.tiles.map((t) => t.kind)) };
}

function endWithMahJongg(
  state: GameState,
  winner: Seat,
  concealed: readonly Tile[],
  discarder: Seat | null,
  card: PracticeCard,
): GameState {
  const player = state.players[winner];
  const matches = findMahJongg(declarationOf(player, concealed), card);
  const { match, jokerless, payments } = bestSettlement(matches, winner, discarder);
  return {
    ...withPlayer(state, winner, { rack: [...concealed] }),
    phase: {
      type: 'ended',
      result: {
        type: 'mahJongg',
        winner,
        handId: match.hand.id,
        value: match.hand.value,
        selfDrawn: discarder === null,
        discarder,
        jokerless,
        payments,
      },
    },
  };
}

function declareMahJongg(state: GameState, seat: Seat, card: PracticeCard): StepResult {
  const error = ownTurn(state, seat, 'discard');
  if (error) return fail(error);
  const player = state.players[seat];
  if (player.dead) return fail('dead-hand');
  if (!completes(player, player.rack, card)) return fail('not-mah-jongg');
  const phase = state.phase as Extract<Phase, { type: 'turn' }>;
  // After calling a discard for an exposure, the winning tile came from that discard.
  const discarder = phase.source === 'call' ? phase.calledFrom : null;
  return ok(endWithMahJongg(state, seat, player.rack, discarder, card));
}

function jokerSwap(state: GameState, seat: Seat, id: number, owner: Seat, index: number): StepResult {
  const error = ownTurn(state, seat, 'discard');
  if (error) return fail(error);
  const player = state.players[seat];
  if (player.dead) return fail('dead-hand');
  const taken = pick(player.rack, [id]);
  if (!taken) return fail('unknown-tile');
  const [tile] = taken.picked;
  const exposure = state.players[owner]?.exposures[index];
  if (!exposure || isJoker(tile) || !sameKind(tile.kind, exposure.kind)) return fail('swap-mismatch');
  const jokerAt = exposure.tiles.findIndex(isJoker);
  if (jokerAt < 0) return fail('swap-mismatch');
  const joker = exposure.tiles[jokerAt];

  const swapped = { ...exposure, tiles: setAt(exposure.tiles, jokerAt, tile) };
  const ownerAfter = state.players[owner];
  const afterGive = withPlayer(state, owner, {
    exposures: ownerAfter.exposures.map((e, i) => (i === index ? swapped : e)),
  });
  const swapper = afterGive.players[seat];
  return ok(withPlayer(afterGive, seat, { rack: [...swapper.rack.filter((t) => t.id !== id), joker] }));
}

/**
 * Applies one action. Returns the next state, or why the action is illegal.
 * `card` is the card Mah Jongg and dead hands are judged against.
 */
export function step(state: GameState, action: GameAction, card: PracticeCard = CURRENT_CARD): StepResult {
  if (state.phase.type === 'ended') return fail('wrong-phase');
  if ('seat' in action && !SEATS.includes(action.seat)) return fail('not-your-turn');
  switch (action.type) {
    case 'charlestonPass':
      return charlestonPass(state, action.seat, action.tiles, action.blind ?? 0);
    case 'charlestonVote':
      return charlestonVote(state, action.seat, action.continueCharleston);
    case 'courtesyOffer':
      return courtesyOffer(state, action.seat, action.count);
    case 'courtesyPass':
      return courtesyPass(state, action.seat, action.tiles);
    case 'draw':
      return draw(state, action.seat);
    case 'discard':
      return discard(state, action.seat, action.tile, card);
    case 'jokerSwap':
      return jokerSwap(state, action.seat, action.tile, action.owner, action.exposure);
    case 'declareMahJongg':
      return declareMahJongg(state, action.seat, card);
    case 'call':
      return call(state, action.seat, action.claim, card);
    case 'pass':
      return passCall(state, action.seat, card);
    case 'closeCalls':
      return closeCalls(state, card);
  }
}

/** `step` for `useReducer`: an illegal action leaves the state as it was. */
export function gameReducer(state: GameState, action: GameAction): GameState {
  const result = step(state, action);
  return result.ok ? result.state : state;
}
