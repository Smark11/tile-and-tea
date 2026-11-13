import { CURRENT_CARD, type Hand } from '../../card';
import {
  bam,
  crak,
  dot,
  E,
  FLOWER,
  HONORS_1,
  idOf,
  idsOf,
  JOKER,
  kinds,
  N,
  of,
  play,
  RED,
  refusal,
  S,
  SOAP,
  table,
  turn,
  W,
} from '../__fixtures__/table';
import { awaiting, gameReducer, step } from '../game';
import { allowsJokers } from '../scoring';
import type { GameState, MahJonggResult, Seat } from '../types';

const result = (state: GameState) => {
  if (state.phase.type !== 'ended') throw new Error(`game not over: ${state.phase.type}`);
  return state.phase.result;
};
const win = (state: GameState) => result(state) as MahJonggResult;
const passes = (...seats: Seat[]) => seats.map((seat) => ({ type: 'pass' as const, seat }));
const hand = (id: string): Hand => CURRENT_CARD.hands.find((h) => h.id === id)!;

/** NNN EEEE WWWW SS: one South from Honors-1. */
const HONORS_1_LESS_S = HONORS_1.slice(0, 13);

describe('drawing and discarding', () => {
  const start = table({ phase: turn(0, 'discard', 'deal') });

  it('East discards first without drawing, then play moves to the right', () => {
    expect(refusal(start, { type: 'draw', seat: 0 })).toBe('wrong-phase');
    const tile = start.players[0].rack[0];
    let state = play(start, { type: 'discard', seat: 0, tile: tile.id });
    expect(state.phase).toMatchObject({ type: 'calls', discarder: 0, tile, responses: ['pass', null, null, null] });
    expect(awaiting(state)).toEqual([1, 2, 3]);
    state = play(state, ...passes(1, 2, 3));
    expect(state.discards).toEqual([{ tile, seat: 0 }]);
    expect(state.phase).toEqual(turn(1, 'draw'));

    const top = state.wall[0];
    state = play(state, { type: 'draw', seat: 1 });
    expect(state.players[1].rack).toHaveLength(14);
    expect(state.players[1].rack.at(-1)).toBe(top);
    expect(state.wall).toHaveLength(start.wall.length - 1);
    expect(state.phase).toEqual(turn(1, 'discard'));
  });

  it('only lets the player whose turn it is draw or discard', () => {
    expect(refusal(start, { type: 'discard', seat: 1, tile: start.players[1].rack[0].id })).toBe('not-your-turn');
    expect(refusal(start, { type: 'discard', seat: 0, tile: start.players[1].rack[0].id })).toBe('unknown-tile');
    expect(refusal(start, { type: 'discard', seat: 7 as Seat, tile: 0 })).toBe('not-your-turn');
    expect(refusal(start, { type: 'charlestonPass', seat: 0, tiles: [] })).toBe('wrong-phase');
  });

  it('closes the call window for anyone who hasn’t answered', () => {
    const calls = play(start, { type: 'discard', seat: 0, tile: start.players[0].rack[0].id }, ...passes(2));
    expect(play(calls, { type: 'closeCalls' }).phase).toEqual(turn(1, 'draw'));
    expect(refusal(start, { type: 'closeCalls' })).toBe('wrong-phase');
    expect(refusal(calls, { type: 'pass', seat: 2 })).toBe('already-acted');
  });

  it('never changes the state it is given, and the reducer ignores illegal actions', () => {
    const frozen = JSON.stringify(start);
    play(start, { type: 'discard', seat: 0, tile: start.players[0].rack[0].id }, ...passes(1, 2, 3), { type: 'draw', seat: 1 });
    expect(JSON.stringify(start)).toBe(frozen);
    expect(gameReducer(start, { type: 'draw', seat: 2 })).toBe(start);
    expect(gameReducer(start, { type: 'discard', seat: 0, tile: start.players[0].rack[0].id })).not.toBe(start);
  });
});

describe('calling a discard for an exposure', () => {
  // South holds two Easts and a Joker; East will discard an East.
  const state = table({
    racks: { 0: [E], 1: [E, E, JOKER, ...of(4, W), ...of(3, N), ...of(3, S)] },
    phase: turn(0, 'discard', 'deal'),
  });
  const discarded = play(state, { type: 'discard', seat: 0, tile: idOf(state, 0, E) });

  it('exposes the discard with matching tiles and Jokers, and the caller discards next', () => {
    const rackE = idsOf(discarded, 1, E, 2);
    const joker = idOf(discarded, 1, JOKER);
    const called = play(discarded, { type: 'call', seat: 1, claim: { type: 'expose', tiles: [...rackE, joker] } }, ...passes(2, 3));
    const south = called.players[1];
    expect(south.exposures).toHaveLength(1);
    expect(kinds(south.exposures[0].tiles)).toEqual([E, E, E, JOKER]);
    expect(south.exposures[0]).toMatchObject({ kind: E, calledFrom: 0 });
    expect(south.rack).toHaveLength(10);
    expect(south.dead).toBeNull();
    expect(called.discards).toEqual([]);
    expect(called.phase).toEqual({ type: 'turn', seat: 1, step: 'discard', source: 'call', calledFrom: 0 });
  });

  it('skips the players between the discarder and the caller', () => {
    // North calls East's discard; play then goes to East, skipping South and West.
    const north = table({
      racks: { 0: [E], 3: [E, E, ...of(4, W), ...of(3, N), ...of(4, S)] },
      phase: turn(0, 'discard', 'deal'),
    });
    let s = play(north, { type: 'discard', seat: 0, tile: idOf(north, 0, E) });
    s = play(s, ...passes(1, 2), { type: 'call', seat: 3, claim: { type: 'expose', tiles: idsOf(s, 3, E, 2) } });
    s = play(s, { type: 'discard', seat: 3, tile: idOf(s, 3, S) }, ...passes(0, 1, 2));
    expect(s.phase).toEqual(turn(0, 'draw'));
  });

  it('refuses a pair, a mismatched tile, an over-size group, and the discarder’s own tile', () => {
    const [e1] = idsOf(discarded, 1, E, 1);
    const w = idsOf(discarded, 1, W, 4);
    expect(refusal(discarded, { type: 'call', seat: 1, claim: { type: 'expose', tiles: [e1] } })).toBe('invalid-exposure');
    expect(refusal(discarded, { type: 'call', seat: 1, claim: { type: 'expose', tiles: [e1, w[0]] } })).toBe('invalid-exposure');
    expect(refusal(discarded, { type: 'call', seat: 1, claim: { type: 'expose', tiles: [...w, e1, 999] } })).toBe(
      'invalid-exposure',
    );
    expect(refusal(discarded, { type: 'call', seat: 1, claim: { type: 'expose', tiles: [e1, e1] } })).toBe('unknown-tile');
    expect(refusal(discarded, { type: 'call', seat: 0, claim: { type: 'expose', tiles: [] } })).toBe('own-discard');
    expect(refusal(state, { type: 'call', seat: 1, claim: { type: 'mahJongg' } })).toBe('wrong-phase');
  });

  it('can’t claim a discarded Joker, even for Mah Jongg', () => {
    const jokerHolder = table({
      racks: { 0: [JOKER], 1: HONORS_1_LESS_S },
      phase: turn(0, 'discard', 'deal'),
    });
    const s = play(jokerHolder, { type: 'discard', seat: 0, tile: idOf(jokerHolder, 0, JOKER) });
    expect(s.phase).toEqual(turn(1, 'draw'));
    expect(kinds(s.discards.map((d) => d.tile))).toEqual([JOKER]);
  });

  it('can expose Flowers', () => {
    const flowers = table({
      racks: { 0: [FLOWER], 2: [FLOWER, FLOWER, ...of(4, crak(3)), ...of(4, dot(9)), ...of(3, bam(6))] },
      phase: turn(0, 'discard', 'deal'),
    });
    let s = play(flowers, { type: 'discard', seat: 0, tile: idOf(flowers, 0, FLOWER) });
    s = play(s, ...passes(1, 3), { type: 'call', seat: 2, claim: { type: 'expose', tiles: idsOf(s, 2, FLOWER, 2) } });
    expect(kinds(s.players[2].exposures[0].tiles)).toEqual([FLOWER, FLOWER, FLOWER]);
    expect(s.players[2].dead).toBeNull();
  });
});

describe('who gets a discard more than one player wants', () => {
  // West discards an East. North and East can expose it; South can win with it
  // (Honors-1, a Joker in the kong of Easts).
  const contested = () => {
    const s = table({
      racks: {
        0: [JOKER, JOKER, ...of(4, crak(1)), ...of(4, crak(2)), ...of(3, crak(3))],
        1: [N, N, N, E, E, JOKER, W, W, W, W, S, S, S],
        2: [E, ...of(4, dot(1)), ...of(4, dot(3)), ...of(4, dot(7)), dot(9)],
        3: [E, JOKER, ...of(4, bam(1)), ...of(4, bam(3)), ...of(3, bam(5))],
      },
      phase: turn(2, 'discard'),
    });
    return play(s, { type: 'discard', seat: 2, tile: idOf(s, 2, E) });
  };
  const exposeAll = (s: GameState, seat: Seat) => ({
    type: 'call' as const,
    seat,
    claim: { type: 'expose' as const, tiles: s.players[seat].rack.filter((t) => t.kind.type !== 'suited').map((t) => t.id).slice(0, 2) },
  });

  it('gives an exposure to the caller who plays soonest after the discarder', () => {
    const s = contested();
    const after = play(s, exposeAll(s, 0), exposeAll(s, 3), { type: 'pass', seat: 1 });
    expect(after.phase).toMatchObject({ type: 'turn', seat: 3, source: 'call', calledFrom: 2 });
    expect(kinds(after.players[3].exposures[0].tiles)).toEqual([E, E, JOKER]);
    expect(after.players[0].exposures).toEqual([]);
    expect(after.players[0].rack).toEqual(s.players[0].rack);
  });

  it('gives it to Mah Jongg over any exposure, even from further round the table', () => {
    const s = contested();
    const after = play(s, exposeAll(s, 3), exposeAll(s, 0), { type: 'call', seat: 1, claim: { type: 'mahJongg' } });
    expect(win(after)).toEqual({
      type: 'mahJongg',
      winner: 1,
      handId: 'honors-1',
      value: 25,
      selfDrawn: false,
      discarder: 2,
      jokerless: false,
      // The discarder pays double; the others pay the hand's value.
      payments: [-25, 100, -50, -25],
    });
    expect(after.players[1].rack).toHaveLength(14);
    expect(after.players[3].exposures).toEqual([]);
  });

  it('between two Mah Jongg calls, gives it to the player next in turn', () => {
    // A Flower completes South's Evens-1 and North's Like Numbers-1.
    const racks = {
      1: [FLOWER, ...of(3, bam(2)), ...of(3, bam(4)), ...of(3, crak(6)), ...of(3, crak(8))],
      3: [FLOWER, ...of(4, bam(5)), ...of(4, crak(5)), ...of(4, dot(5))],
    };
    for (const [discarder, winner] of [
      [2, 3],
      [0, 1],
    ] as const) {
      const s0 = table({
        racks: { ...racks, [discarder]: [FLOWER, ...of(4, dot(1)), ...of(4, dot(3)), ...of(4, dot(7)), dot(9)] },
        phase: turn(discarder, 'discard'),
      });
      const s = play(s0, { type: 'discard', seat: discarder, tile: idOf(s0, discarder, FLOWER) });
      const other = (2 - discarder) as Seat;
      const after = play(
        s,
        { type: 'call', seat: 1, claim: { type: 'mahJongg' } },
        { type: 'call', seat: 3, claim: { type: 'mahJongg' } },
        { type: 'pass', seat: other },
      );
      expect(win(after)).toMatchObject({ winner, discarder, handId: winner === 1 ? 'evens-1' : 'like-1' });
    }
  });

  it('refuses a Mah Jongg call the tiles don’t make', () => {
    const s = contested();
    expect(refusal(s, { type: 'call', seat: 3, claim: { type: 'mahJongg' } })).toBe('not-mah-jongg');
    expect(awaiting(s)).toEqual([0, 1, 3]);
  });
});

describe('Mah Jongg and settlement', () => {
  const drawing = (rack: typeof HONORS_1, last = S) =>
    play(table({ racks: { 1: rack }, wallTop: [last], phase: turn(1, 'draw') }), { type: 'draw', seat: 1 });

  it('self-drawn and jokerless: everyone pays four times the value', () => {
    const won = play(drawing(HONORS_1_LESS_S), { type: 'declareMahJongg', seat: 1 });
    expect(win(won)).toEqual({
      type: 'mahJongg',
      winner: 1,
      handId: 'honors-1',
      value: 25,
      selfDrawn: true,
      discarder: null,
      jokerless: true,
      payments: [-100, 300, -100, -100],
    });
    expect(awaiting(won)).toEqual([]);
    expect(refusal(won, { type: 'discard', seat: 1, tile: won.players[1].rack[0].id })).toBe('wrong-phase');
  });

  it('self-drawn with a Joker: everyone pays double', () => {
    const rack = [JOKER, ...HONORS_1_LESS_S.slice(1)];
    expect(win(play(drawing(rack), { type: 'declareMahJongg', seat: 1 })).payments).toEqual([-50, 150, -50, -50]);
  });

  it('won on a jokerless discard: the discarder pays double, doubled again', () => {
    const s0 = table({ racks: { 1: HONORS_1_LESS_S, 3: [S] }, phase: turn(3, 'discard') });
    const s = play(s0, { type: 'discard', seat: 3, tile: idOf(s0, 3, S) });
    const won = play(s, { type: 'call', seat: 1, claim: { type: 'mahJongg' } }, ...passes(0, 2));
    expect(win(won)).toMatchObject({ selfDrawn: false, discarder: 3, jokerless: true, payments: [-50, 200, -50, -100] });
    expect(won.discards).toEqual([]);
    // The winning South joins the two on the winner's rack.
    expect(won.players[1].rack).toHaveLength(14);
    expect(won.players[1].rack.filter((t) => t.kind.type === 'wind' && t.kind.wind === 'S')).toHaveLength(3);
  });

  it('Singles & Pairs hands, which can’t hold a Joker, get no jokerless bonus', () => {
    // Pairs-2: 11 33 55 77 99 in Bams, Red pair, Soap pair.
    const pairs = [bam(1), bam(1), bam(3), bam(3), bam(5), bam(5), bam(7), bam(7), bam(9), bam(9), RED, RED, SOAP];
    const won = play(drawing(pairs, SOAP), { type: 'declareMahJongg', seat: 1 });
    expect(win(won)).toMatchObject({ handId: 'pairs-2', value: 50, jokerless: false, payments: [-100, 300, -100, -100] });
    expect(allowsJokers(hand('pairs-2'))).toBe(false);
    expect(allowsJokers(hand('honors-1'))).toBe(true);
  });

  it('East can win on the dealt 14, before the first discard', () => {
    const s = table({ racks: { 0: HONORS_1 }, phase: turn(0, 'discard', 'deal') });
    expect(win(play(s, { type: 'declareMahJongg', seat: 0 }))).toMatchObject({ winner: 0, selfDrawn: true });
  });

  it('after calling for an exposure, a completed hand is won on that discard', () => {
    const s0 = table({
      racks: { 0: [E], 2: [...of(3, N), ...of(3, E), ...of(4, W), ...of(3, S)] },
      phase: turn(0, 'discard', 'deal'),
    });
    let s = play(s0, { type: 'discard', seat: 0, tile: idOf(s0, 0, E) });
    s = play(s, ...passes(1, 3), { type: 'call', seat: 2, claim: { type: 'expose', tiles: idsOf(s, 2, E, 3) } });
    expect(win(play(s, { type: 'declareMahJongg', seat: 2 }))).toMatchObject({
      selfDrawn: false,
      discarder: 0,
      payments: [-100, -50, 200, -50],
    });
  });

  it('refuses a declaration the tiles don’t make, or out of turn', () => {
    const s = drawing([...HONORS_1_LESS_S.slice(0, 12), bam(1)]);
    expect(refusal(s, { type: 'declareMahJongg', seat: 1 })).toBe('not-mah-jongg');
    expect(refusal(s, { type: 'declareMahJongg', seat: 2 })).toBe('not-your-turn');
    const before = table({ racks: { 1: HONORS_1_LESS_S }, phase: turn(1, 'draw') });
    expect(refusal(before, { type: 'declareMahJongg', seat: 1 })).toBe('wrong-phase');
  });
});

describe('Joker swaps', () => {
  // South has exposed E E Joker; West has an East to trade for it.
  const swapTable = (seat: Seat, stepName: 'draw' | 'discard' = 'discard') =>
    table({
      racks: { 2: [E, W] },
      exposures: [{ seat: 1, kinds: [E, E, JOKER], calledFrom: 0 }],
      phase: turn(seat, stepName),
    });
  const swap = (s: GameState, seat: Seat, tile: number) =>
    ({ type: 'jokerSwap', seat, tile, owner: 1, exposure: 0 }) as const;

  it('trades a real tile from the rack for the Joker standing in for it', () => {
    const s = swapTable(2);
    const after = play(s, swap(s, 2, idOf(s, 2, E)));
    expect(kinds(after.players[1].exposures[0].tiles)).toEqual([E, E, E]);
    expect(kinds(after.players[2].rack).filter((k) => k.type === 'joker')).toHaveLength(1);
    expect(after.players[2].rack).toHaveLength(14);
    expect(after.phase).toEqual(s.phase);
    // No Joker left to take.
    expect(refusal(after, swap(after, 2, idOf(after, 2, W)))).toBe('swap-mismatch');
  });

  it('works on the player’s own exposure too', () => {
    const s = table({
      racks: { 1: [E] },
      exposures: [{ seat: 1, kinds: [E, E, JOKER], calledFrom: 0 }],
      phase: turn(1, 'discard'),
    });
    expect(kinds(play(s, swap(s, 1, idOf(s, 1, E))).players[1].exposures[0].tiles)).toEqual([E, E, E]);
  });

  it('only with the right tile, on the player’s own turn, after drawing', () => {
    const s = swapTable(2);
    expect(refusal(s, swap(s, 2, idOf(s, 2, W)))).toBe('swap-mismatch');
    expect(refusal(s, { ...swap(s, 2, idOf(s, 2, E)), exposure: 1 })).toBe('swap-mismatch');
    expect(refusal(s, { ...swap(s, 2, idOf(s, 2, E)), owner: 3 })).toBe('swap-mismatch');
    expect(refusal(s, swap(s, 2, 999))).toBe('unknown-tile');
    expect(refusal(swapTable(3), swap(s, 3, idOf(s, 2, E)))).toBe('unknown-tile');
    expect(refusal(swapTable(3), swap(s, 2, idOf(s, 2, E)))).toBe('not-your-turn');
    expect(refusal(swapTable(2, 'draw'), swap(s, 2, idOf(s, 2, E)))).toBe('wrong-phase');
  });
});

describe('dead hands', () => {
  // South calls an East into a sextet, which no hand on the card has.
  const deadTable = () => {
    const s0 = table({
      racks: { 0: [E], 1: [E, E, E, JOKER, JOKER, ...of(4, W), ...of(4, N)] },
      wallTop: [S],
      phase: turn(0, 'discard', 'deal'),
    });
    const s = play(s0, { type: 'discard', seat: 0, tile: idOf(s0, 0, E) });
    return play(s, ...passes(2, 3), {
      type: 'call',
      seat: 1,
      claim: { type: 'expose', tiles: s.players[1].rack.filter((t) => t.kind.type !== 'wind' || t.kind.wind === 'E').map((t) => t.id) },
    });
  };

  it('a hand whose exposures fit no card hand is dead', () => {
    const s = deadTable();
    expect(kinds(s.players[1].exposures[0].tiles)).toHaveLength(6);
    expect(s.players[1].dead).toBe('exposures-fit-no-hand');
  });

  it('a dead hand finishes its turn with a discard, then sits out: no turns, calls, swaps or win', () => {
    let s = deadTable();
    expect(refusal(s, { type: 'declareMahJongg', seat: 1 })).toBe('dead-hand');
    expect(refusal(s, { type: 'jokerSwap', seat: 1, tile: idOf(s, 1, W), owner: 1, exposure: 0 })).toBe('dead-hand');
    s = play(s, { type: 'discard', seat: 1, tile: idOf(s, 1, W) }, ...passes(0, 2, 3));
    s = play(s, { type: 'draw', seat: 2 }, { type: 'discard', seat: 2, tile: s.players[2].rack[0].id });
    // South is answered for: they can't call.
    expect(awaiting(s)).toEqual([0, 3]);
    expect(refusal(s, { type: 'call', seat: 1, claim: { type: 'expose', tiles: [] } })).toBe('dead-hand');
    s = play(s, ...passes(0, 3), { type: 'draw', seat: 3 }, { type: 'discard', seat: 3, tile: s.players[3].rack[0].id });
    s = play(s, ...passes(0, 2), { type: 'draw', seat: 0 }, { type: 'discard', seat: 0, tile: s.players[0].rack[0].id });
    // After East, South's turn is skipped.
    s = play(s, ...passes(2, 3));
    expect(s.phase).toEqual(turn(2, 'draw'));
    expect(s.players[1].rack).toHaveLength(7);
  });

  it('still pays the winner', () => {
    const s0 = table({ racks: { 1: HONORS_1_LESS_S }, wallTop: [S], phase: turn(1, 'draw') });
    const s = { ...s0, players: s0.players.map((p) => (p.seat === 3 ? { ...p, dead: 'exposures-fit-no-hand' as const } : p)) };
    expect(win(play(s, { type: 'draw', seat: 1 }, { type: 'declareMahJongg', seat: 1 })).payments).toEqual([-100, 300, -100, -100]);
  });

  it('leaves its exposed Jokers free for others to swap', () => {
    const s0 = table({ racks: { 2: [E] }, exposures: [{ seat: 1, kinds: [E, E, JOKER], calledFrom: 0 }], phase: turn(2, 'discard') });
    const s = { ...s0, players: s0.players.map((p) => (p.seat === 1 ? { ...p, dead: 'exposures-fit-no-hand' as const } : p)) };
    const after = play(s, { type: 'jokerSwap', seat: 2, tile: idOf(s, 2, E), owner: 1, exposure: 0 });
    expect(kinds(after.players[1].exposures[0].tiles)).toEqual([E, E, E]);
  });

  it('ends the game, with no payments, when three hands are dead', () => {
    const s0 = table({
      racks: { 0: [E], 1: [E, E, E, JOKER, JOKER, ...of(4, W), ...of(4, N)] },
      phase: turn(0, 'discard', 'deal'),
    });
    const s1 = { ...s0, players: s0.players.map((p) => (p.seat >= 2 ? { ...p, dead: 'exposures-fit-no-hand' as const } : p)) };
    const s = play(s1, { type: 'discard', seat: 0, tile: idOf(s1, 0, E) });
    // West and North are dead, so only South can answer.
    expect(awaiting(s)).toEqual([1]);
    const sextet = s.players[1].rack.filter((t) => t.kind.type !== 'wind' || t.kind.wind === 'E').map((t) => t.id);
    expect(result(play(s, { type: 'call', seat: 1, claim: { type: 'expose', tiles: sextet } }))).toEqual({ type: 'deadHands' });
  });

  it('a pung of North is live: it fits Honors-1', () => {
    const s0 = table({ racks: { 0: [N], 1: [N, N] }, phase: turn(0, 'discard', 'deal') });
    const s = play(s0, { type: 'discard', seat: 0, tile: idOf(s0, 0, N) });
    const after = play(s, ...passes(2, 3), { type: 'call', seat: 1, claim: { type: 'expose', tiles: idsOf(s, 1, N, 2) } });
    expect(after.players[1].dead).toBeNull();
  });
});

describe('the wall game', () => {
  it('ends the game when the last tile is discarded and no one claims it', () => {
    let s = table({ wallSize: 1, phase: turn(1, 'draw') });
    s = play(s, { type: 'draw', seat: 1 });
    expect(s.wall).toHaveLength(0);
    s = play(s, { type: 'discard', seat: 1, tile: s.players[1].rack[0].id }, ...passes(0, 2, 3));
    expect(result(s)).toEqual({ type: 'wall' });
    expect(s.discards).toHaveLength(1);
  });

  it('plays on if the last discard is called for an exposure', () => {
    let s = table({ racks: { 0: [E, E], 3: [E] }, wallSize: 0, phase: turn(3, 'discard') });
    s = play(s, { type: 'discard', seat: 3, tile: idOf(s, 3, E) });
    s = play(s, ...passes(1, 2), { type: 'call', seat: 0, claim: { type: 'expose', tiles: idsOf(s, 0, E, 2) } });
    expect(s.phase).toMatchObject({ type: 'turn', seat: 0, step: 'discard' });
    s = play(s, { type: 'discard', seat: 0, tile: s.players[0].rack.find((t) => t.kind.type === 'suited')!.id }, ...passes(1, 2, 3));
    expect(result(s)).toEqual({ type: 'wall' });
  });

  it('still lets the last discard win', () => {
    const s0 = table({ racks: { 1: HONORS_1_LESS_S, 3: [S] }, wallSize: 0, phase: turn(3, 'discard') });
    const s = play(s0, { type: 'discard', seat: 3, tile: idOf(s0, 3, S) }, { type: 'call', seat: 1, claim: { type: 'mahJongg' } }, ...passes(0, 2));
    expect(win(s).winner).toBe(1);
  });
});

it('step reports why without throwing for every phase mismatch', () => {
  const s = table({ phase: turn(0, 'discard', 'deal') });
  for (const action of [
    { type: 'charlestonVote', seat: 0, continueCharleston: true },
    { type: 'courtesyOffer', seat: 0, count: 1 },
    { type: 'courtesyPass', seat: 0, tiles: [] },
    { type: 'pass', seat: 1 },
  ] as const) {
    expect(step(s, action)).toEqual({ ok: false, error: 'wrong-phase' });
  }
});

