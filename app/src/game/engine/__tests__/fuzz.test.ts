// Whole games played by a random (but always legal) table, checking the rules'
// invariants after every action: no tile is ever lost or duplicated, everyone
// holds the right number of tiles, dead hands are exactly the ones whose
// exposures fit no card hand, and every game ends with payments that balance.

import { cardDistances, CURRENT_CARD } from '../../card';
import { createRng, shuffle, type Rng } from '../../rng';
import { sameKind, type Tile } from '../../tiles';
import { awaiting, newGame, step, tilesHeld } from '../game';
import { CHARLESTON_PASSES, SEATS, type GameAction, type GameState, type Seat } from '../types';

const isJoker = (t: Tile) => t.kind.type === 'joker';

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

function apply(state: GameState, action: GameAction): GameState | null {
  const result = step(state, action);
  return result.ok ? deepFreeze(result.state) : null;
}

/** A legal move for `seat`, chosen at random but with a taste for calling and winning. */
function move(state: GameState, seat: Seat, rng: Rng): GameAction {
  const { phase } = state;
  const rack = state.players[seat].rack;
  const nonJokers = (n: number) => shuffle(rack.filter((t) => !isJoker(t)), rng).slice(0, n).map((t) => t.id);
  switch (phase.type) {
    case 'charleston': {
      const pass = CHARLESTON_PASSES.find((p) => p.id === phase.pass)!;
      const blind = pass.blindAllowed && rng() < 0.4 ? 1 + Math.floor(rng() * 3) : 0;
      return { type: 'charlestonPass', seat, tiles: nonJokers(3 - blind), blind };
    }
    case 'charleston-vote':
      return { type: 'charlestonVote', seat, continueCharleston: rng() < 0.7 };
    case 'courtesy-offer':
      return { type: 'courtesyOffer', seat, count: Math.floor(rng() * 4) };
    case 'courtesy-pass':
      return { type: 'courtesyPass', seat, tiles: nonJokers(phase.counts[seat]) };
    case 'turn': {
      if (phase.step === 'draw') return { type: 'draw', seat };
      if (apply(state, { type: 'declareMahJongg', seat })) return { type: 'declareMahJongg', seat };
      for (const owner of SEATS) {
        for (const [exposure, group] of state.players[owner].exposures.entries()) {
          const tile = rack.find((t) => sameKind(t.kind, group.kind));
          if (tile && group.tiles.some(isJoker) && rng() < 0.8) {
            const swap: GameAction = { type: 'jokerSwap', seat, tile: tile.id, owner, exposure };
            if (apply(state, swap)) return swap;
          }
        }
      }
      const pool = rng() < 0.9 && rack.some((t) => !isJoker(t)) ? rack.filter((t) => !isJoker(t)) : rack;
      return { type: 'discard', seat, tile: pool[Math.floor(rng() * pool.length)].id };
    }
    case 'calls': {
      const win: GameAction = { type: 'call', seat, claim: { type: 'mahJongg' } };
      if (apply(state, win)) return win;
      const matching = rack.filter((t) => sameKind(t.kind, phase.tile.kind)).map((t) => t.id);
      const jokers = rack.filter(isJoker).map((t) => t.id);
      const tiles = [...matching, ...jokers].slice(0, 2 + Math.floor(rng() * 3));
      if (matching.length > 0 && tiles.length >= 2 && rng() < 0.35) return { type: 'call', seat, claim: { type: 'expose', tiles } };
      return { type: 'pass', seat };
    }
    case 'ended':
      throw new Error('no moves after the end');
  }
}

function checkInvariants(state: GameState) {
  const { phase } = state;
  const inPlay = [
    ...state.wall,
    ...state.players.flatMap(tilesHeld),
    ...state.discards.map((d) => d.tile),
    ...(phase.type === 'calls' ? [phase.tile] : []),
  ];
  expect(inPlay).toHaveLength(152);
  expect(new Set(inPlay.map((t) => t.id)).size).toBe(152);

  const held = state.players.map((p) => tilesHeld(p).length);
  if (phase.type === 'ended') {
    if (phase.result.type === 'mahJongg') {
      expect(phase.result.payments.reduce((a, b) => a + b, 0)).toBe(0);
      expect(held[phase.result.winner]).toBe(14);
    } else if (phase.result.type === 'wall') {
      expect(state.wall).toHaveLength(0);
    } else {
      expect(state.players.filter((p) => p.dead)).toHaveLength(3);
    }
    return;
  }
  // A dead hand only plays out the turn in which it went dead.
  if (phase.type === 'turn' && state.players[phase.seat].dead) {
    expect(phase).toMatchObject({ step: 'discard', source: 'call' });
  }
  const fourteen =
    phase.type === 'turn' && phase.step === 'discard'
      ? phase.seat
      : phase.type === 'turn' || phase.type === 'calls'
        ? null
        : 0;
  SEATS.forEach((s) => expect(held[s]).toBe(s === fourteen ? 14 : 13));
  expect(awaiting(state).length).toBeGreaterThan(0);

  for (const player of state.players) {
    const exposures = player.exposures.map((e) => e.tiles.map((t) => t.kind));
    for (const e of player.exposures) {
      expect(e.tiles.length).toBeGreaterThanOrEqual(3);
      expect(e.tiles.every((t) => isJoker(t) || sameKind(t.kind, e.kind))).toBe(true);
      expect(isJoker(e.tiles[0])).toBe(false);
    }
    if (exposures.length > 0) {
      const fits = cardDistances({ concealed: [], exposures }, CURRENT_CARD).some((r) => r.tilesAway !== null);
      expect(player.dead).toBe(fits ? null : 'exposures-fit-no-hand');
    } else {
      expect(player.dead).toBeNull();
    }
  }
}

describe('random legal games', () => {
  const endings: Record<string, number> = { wall: 0, mahJongg: 0, deadHands: 0 };
  let swaps = 0;
  let exposures = 0;
  let blindPasses = 0;

  it.each(Array.from({ length: 24 }, (_, i) => `fuzz-${i}`))('%s plays to a clean finish', (seed) => {
    const rng = createRng(seed);
    let state = deepFreeze(newGame(seed));
    for (let actions = 0; state.phase.type !== 'ended'; actions++) {
      expect(actions).toBeLessThan(2000);
      const waiting = awaiting(state);
      const seat = waiting[Math.floor(rng() * waiting.length)];
      const action =
        state.phase.type === 'calls' && rng() < 0.05 ? ({ type: 'closeCalls' } as const) : move(state, seat, rng);
      const next = apply(state, action);
      if (!next) throw new Error(`illegal ${JSON.stringify(action)} in ${state.phase.type}`);
      if (action.type === 'jokerSwap') swaps += 1;
      if (action.type === 'charlestonPass' && (action.blind ?? 0) > 0) blindPasses += 1;
      exposures += next.players.reduce((n, p) => n + p.exposures.length, 0) - state.players.reduce((n, p) => n + p.exposures.length, 0);
      state = next;
      checkInvariants(state);
    }
    endings[state.phase.result.type] += 1;
  });

  it('exercised calls, Joker swaps and blind passes along the way', () => {
    expect(exposures).toBeGreaterThan(20);
    expect(swaps).toBeGreaterThan(0);
    expect(blindPasses).toBeGreaterThan(10);
    expect(endings.wall + endings.mahJongg + endings.deadHands).toBe(24);
  });
});
