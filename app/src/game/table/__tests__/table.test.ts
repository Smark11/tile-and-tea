import { CURRENT_CARD } from '@/game/card';
import { awaiting, newGame, step, type GameAction, type GameState, type Seat } from '@/game/engine';
import { HONORS_1, idOf, N, E, W, S, of, play, table, turn } from '@/game/engine/__fixtures__/table';
import { TILE_COUNT, type Tile } from '@/game/tiles';

import {
  arrangeRack,
  autoAction,
  canCallMahJongg,
  canDeclareMahJongg,
  DRAW_ORDER,
  exposureLabel,
  isDemoTable,
  midGameTable,
  openDiscardTable,
  theirTurnTable,
  outcomeFor,
  seatLabel,
  playOut,
  positionOf,
  resultSummary,
  standInAction,
  tablePrompt,
  wallLayout,
  WALL_STACKS,
} from '..';

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
const isJoker = (t: Tile) => t.kind.type === 'joker';

describe('wallLayout', () => {
  it('stands 4 walls of 19 stacks, two high, before the deal', () => {
    const layout = wallLayout(TILE_COUNT);
    for (const seat of DRAW_ORDER) {
      expect(layout[seat]).toHaveLength(WALL_STACKS);
      expect(layout[seat].every((h) => h === 2)).toBe(true);
    }
  });

  it('draws clockwise from East’s wall: East, North, West, South', () => {
    expect(DRAW_ORDER).toEqual([0, 3, 2, 1]);
  });

  it('after the deal (53 tiles), East’s wall is gone and North’s has a half stack', () => {
    const layout = wallLayout(newGame(1).wall.length);
    expect(newGame(1).wall).toHaveLength(99);
    expect(sum(layout[0])).toBe(0);
    // 53 − 38 = 15 tiles from North's wall: 7 whole stacks and the top of the 8th.
    expect(layout[3].slice(0, 8)).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
    expect(layout[3].slice(8).every((h) => h === 2)).toBe(true);
    expect(sum(layout[2])).toBe(38);
    expect(sum(layout[1])).toBe(38);
  });

  it('always holds exactly the tiles left to draw', () => {
    for (let remaining = 0; remaining <= TILE_COUNT; remaining++) {
      const layout = wallLayout(remaining);
      expect(sum(DRAW_ORDER.flatMap((s) => layout[s]))).toBe(remaining);
    }
    expect(sum(Object.values(wallLayout(0)).flat())).toBe(0);
  });

  it('refuses impossible counts', () => {
    expect(() => wallLayout(-1)).toThrow(RangeError);
    expect(() => wallLayout(153)).toThrow(RangeError);
    expect(() => wallLayout(2.5)).toThrow(RangeError);
  });
});

describe('positionOf', () => {
  it('puts you at the bottom, the next player on your right', () => {
    expect([0, 1, 2, 3].map((s) => positionOf(s as Seat, 0))).toEqual(['bottom', 'right', 'top', 'left']);
    // Seen from South: West plays next (right), North across, East before (left).
    expect([0, 1, 2, 3].map((s) => positionOf(s as Seat, 1))).toEqual(['left', 'bottom', 'right', 'top']);
  });
});

describe('arrangeRack', () => {
  const rack = newGame(3).players[1].rack;

  it('keeps the player’s order and adds arrivals on the right', () => {
    const order = rack.slice(0, 5).map((t) => t.id).reverse();
    const { tiles, fresh } = arrangeRack(order, rack);
    expect(tiles.slice(0, 5).map((t) => t.id)).toEqual(order);
    expect(tiles.slice(5)).toEqual(rack.slice(5));
    expect(fresh).toEqual(rack.slice(5).map((t) => t.id));
  });

  it('drops tiles that left the rack', () => {
    const order = rack.map((t) => t.id);
    const { tiles, fresh } = arrangeRack(order, rack.slice(2));
    expect(tiles).toEqual(rack.slice(2));
    expect(fresh).toEqual([]);
  });
});

describe('stand-ins', () => {
  // Full games of stand-ins, Charleston to the end, with every move checked by the engine.
  const SEEDS = [1, 2, 3, 5];
  const finals = new Map<number, GameState>();
  beforeAll(() => {
    for (const seed of SEEDS) finals.set(seed, playOut(newGame(seed), () => false));
  });

  it('play whole games legally to an end', () => {
    for (const seed of SEEDS) {
      const end = finals.get(seed)!;
      expect(end.phase.type).toBe('ended');
      const held = end.players.flatMap((p) => [...p.rack, ...p.exposures.flatMap((e) => e.tiles)]);
      expect(held.length + end.wall.length + end.discards.length).toBe(TILE_COUNT);
    }
  });

  it('win some games and expose some groups', () => {
    const results = SEEDS.map((s) => finals.get(s)!.phase);
    expect(results.some((p) => p.type === 'ended' && p.result.type === 'mahJongg')).toBe(true);
    expect(SEEDS.some((s) => finals.get(s)!.players.some((p) => p.exposures.length > 0))).toBe(true);
  });

  it('never pass or throw a Joker', () => {
    let state = newGame(4);
    for (let moves = 0; moves < 400 && state.phase.type !== 'ended'; moves++) {
      const action = autoAction(state, null)!;
      const player = 'seat' in action ? state.players[action.seat] : null;
      const tilesOut =
        action.type === 'charlestonPass' || action.type === 'courtesyPass'
          ? action.tiles
          : action.type === 'discard'
            ? [action.tile]
            : [];
      for (const id of tilesOut) expect(isJoker(player!.rack.find((t) => t.id === id)!)).toBe(false);
      const result = step(state, action);
      expect(result.ok).toBe(true);
      if (result.ok) state = result.state;
    }
  });

  it('declare Mah Jongg when their tiles make a hand', () => {
    const state = table({ racks: { 1: HONORS_1 }, phase: turn(1, 'discard') });
    expect(standInAction(state, 1)).toEqual({ type: 'declareMahJongg', seat: 1 });
  });

  it('call a discard for Mah Jongg, and wait their turn otherwise', () => {
    const before = table({
      racks: { 0: [S], 2: [...of(3, N), ...of(4, E), ...of(4, W), ...of(2, S)] },
      phase: turn(0, 'discard'),
    });
    expect(standInAction(before, 2)).toBeNull();
    const calls = play(before, { type: 'discard', seat: 0, tile: idOf(before, 0, S) });
    expect(standInAction(calls, 2)).toEqual({ type: 'call', seat: 2, claim: { type: 'mahJongg' } });
  });

  it('expose a pung when the call brings a hand closer', () => {
    // Two tiles from Honors-1 (NNN EEEE WWWW SSS): the North pung leaves one to go.
    const before = table({
      racks: { 0: [N], 2: [...of(2, N), ...of(4, E), ...of(4, W), ...of(2, S)] },
      phase: turn(0, 'discard'),
    });
    const calls = play(before, { type: 'discard', seat: 0, tile: idOf(before, 0, N) });
    const action = standInAction(calls, 2)!;
    expect(action).toMatchObject({ type: 'call', claim: { type: 'expose' } });
    const called = play(calls, action, { type: 'pass', seat: 1 }, { type: 'pass', seat: 3 });
    expect(called.players[2].exposures).toHaveLength(1);
    expect(called.players[2].dead).toBeNull();
  });

  it('never call their way into a dead hand', () => {
    for (const seed of SEEDS) expect(finals.get(seed)!.players.every((p) => p.dead === null)).toBe(true);
  });
});

describe('autoAction for the human seat', () => {
  it('waits for the player’s Charleston pass but moves the stand-ins', () => {
    let state = newGame(7);
    for (let i = 0; i < 3; i++) {
      const action = autoAction(state, 0)!;
      expect(action).toMatchObject({ type: 'charlestonPass' });
      expect((action as Extract<GameAction, { seat: Seat }>).seat).not.toBe(0);
      state = play(state, action);
    }
    expect(autoAction(state, 0)).toBeNull();
    expect(awaiting(state)).toEqual([0]);
  });

  it('draws for the player and lets an unwanted discard go', () => {
    const drawing = table({ phase: turn(0, 'draw') });
    expect(autoAction(drawing, 0)).toEqual({ type: 'draw', seat: 0 });

    const before = table({ racks: { 1: [S] }, phase: turn(1, 'discard') });
    const calls = play(before, { type: 'discard', seat: 1, tile: idOf(before, 1, S) });
    let state = calls;
    while (state.phase.type === 'calls') state = play(state, autoAction(state, 0)!);
    expect(state.phase).toMatchObject({ type: 'turn', seat: 2, step: 'draw' });
  });

  it('holds a discard that would give the player Mah Jongg', () => {
    const before = table({
      racks: { 1: [S], 0: [...of(3, N), ...of(4, E), ...of(4, W), ...of(2, S)] },
      phase: turn(1, 'discard'),
    });
    let state = play(before, { type: 'discard', seat: 1, tile: idOf(before, 1, S) });
    expect(canCallMahJongg(state, 0)).toBe(true);
    for (let action = autoAction(state, 0); action; action = autoAction(state, 0)) state = play(state, action);
    expect(state.phase.type).toBe('calls');
    expect(awaiting(state)).toEqual([0]);
    expect(tablePrompt(state, 0).title).toBe('Mah Jongg!');
  });
});

describe('tablePrompt', () => {
  it('names the pass and who it goes to', () => {
    const prompt = tablePrompt(newGame(1), 0);
    expect(prompt).toEqual({
      title: 'First Charleston · pass right',
      detail: 'Choose 3 tiles to pass to South, on your right. Jokers stay with you.',
      yourMove: true,
    });
    expect(tablePrompt(newGame(1), 2).detail).toContain('North, on your right');
  });

  it('says when the table is waiting on others', () => {
    const state = play(newGame(1), standInAction(newGame(1), 0)!);
    expect(tablePrompt(state, 0)).toMatchObject({ detail: 'Waiting for the others to pass.', yourMove: false });
  });

  it('tells East to open the play by discarding', () => {
    const state = table({ phase: turn(0, 'discard', 'deal') });
    expect(tablePrompt(state, 0).detail).toBe('East starts the play: choose one of your 14 tiles to discard.');
    expect(tablePrompt(state, 1)).toEqual({
      title: 'East’s turn',
      detail: 'East, on your left, is choosing a discard.',
      yourMove: false,
    });
  });

  it('offers Mah Jongg on the player’s own turn', () => {
    const state = table({ racks: { 0: HONORS_1 }, phase: turn(0, 'discard') });
    expect(canDeclareMahJongg(state, 0)).toBe(true);
    expect(tablePrompt(state, 0)).toMatchObject({ title: 'Mah Jongg!', yourMove: true });
  });

  it('explains the second Charleston and the courtesy pass', () => {
    const afterFirst = playOut(newGame(2), (g) => g.phase.type === 'charleston-vote');
    expect(tablePrompt(afterFirst, 0).detail).toMatch(/Anyone at the table may stop here/);
    const courtesy = step(afterFirst, { type: 'charlestonVote', seat: 0, continueCharleston: false });
    const offered = [1, 2, 3].reduce(
      (s, seat) => play(s, { type: 'charlestonVote', seat: seat as Seat, continueCharleston: true }),
      courtesy.ok ? courtesy.state : afterFirst,
    );
    expect(offered.phase.type).toBe('courtesy-offer');
    expect(tablePrompt(offered, 0).detail).toBe(
      'Trade up to 3 tiles with West, across from you. If your offers differ, you both pass the smaller number.',
    );
  });
});

describe('demo tables', () => {
  const allIds = (state: GameState) =>
    [
      ...state.wall,
      ...state.discards.map((d) => d.tile),
      ...(state.phase.type === 'calls' ? [state.phase.tile] : []),
      ...state.players.flatMap((p) => [...p.rack, ...p.exposures.flatMap((e) => e.tiles)]),
    ].map((t) => t.id);
  const jokersExposed = (state: GameState) =>
    state.players.map((p) => p.exposures.flatMap((e) => e.tiles).filter(isJoker).length);

  it('midGameTable stops at East’s discard with a few rows of discards and Jokers in two exposures', () => {
    const state = midGameTable();
    expect(state.phase).toMatchObject({ type: 'turn', seat: 0, step: 'discard' });
    expect(state.discards).toHaveLength(22);
    expect(state.players.map((p) => p.exposures.length)).toEqual([1, 0, 0, 1]);
    expect(jokersExposed(state)).toEqual([1, 0, 0, 1]);
    for (const p of state.players) {
      for (const e of p.exposures) {
        // The called tile stays first and real; every tile is the group's kind or a Joker.
        expect(isJoker(e.tiles[0])).toBe(false);
        for (const t of e.tiles) expect(isJoker(t) || JSON.stringify(t.kind) === JSON.stringify(e.kind)).toBe(true);
      }
    }
    expect(new Set(allIds(state)).size).toBe(TILE_COUNT);
    expect(allIds(state)).toHaveLength(TILE_COUNT);
  });

  it('openDiscardTable leaves another player’s discard open to a call', () => {
    const state = openDiscardTable();
    expect(state.phase.type).toBe('calls');
    if (state.phase.type !== 'calls') return;
    expect(state.phase.discarder).not.toBe(0);
    expect(state.discards.length).toBeGreaterThanOrEqual(12);
    expect(jokersExposed(state)).toEqual([1, 0, 0, 1]);
    expect(new Set(allIds(state)).size).toBe(TILE_COUNT);
  });

  it('theirTurnTable is West’s turn to discard, with the exposures still on the table', () => {
    const state = theirTurnTable();
    expect(state.phase).toMatchObject({ type: 'turn', seat: 2, step: 'discard' });
    expect(jokersExposed(state)[0]).toBe(1);
    expect(jokersExposed(state).some((n, seat) => seat !== 0 && n > 0)).toBe(true);
    expect(new Set(allIds(state)).size).toBe(TILE_COUNT);
  });

  it('names the demos for the /game?demo= screenshots', () => {
    expect(isDemoTable('open')).toBe(true);
    expect(isDemoTable('toString')).toBe(false);
    expect(isDemoTable(undefined)).toBe(false);
  });
});

describe('screen-reader labels', () => {
  it('names exposures with their Jokers, and each seat in one stop', () => {
    const state = table({
      exposures: [
        { seat: 1, kinds: [S, S, S], calledFrom: 0 },
        { seat: 1, kinds: [W, W, { type: 'joker' }, { type: 'joker' }], calledFrom: 2 },
      ],
      phase: turn(1, 'discard'),
    });
    const [pung, kong] = state.players[1].exposures;
    expect(exposureLabel(pung)).toBe('pung of Souths');
    expect(exposureLabel(kong)).toBe('kong of Wests, two of them Jokers');
    expect(seatLabel(state.players[1], 0, true)).toBe(
      `South, on your right. ${state.players[1].rack.length} tiles in hand. Exposed: pung of Souths and kong of Wests, two of them Jokers. Playing now.`,
    );
    expect(seatLabel(state.players[0], 0, false)).toBe('You. 13 tiles in hand.');
  });
});

describe('results', () => {
  it('summarizes a win with the hand and payments, you first', () => {
    const state = table({ racks: { 2: HONORS_1 }, phase: turn(2, 'discard') });
    const ended = play(state, { type: 'declareMahJongg', seat: 2 });
    if (ended.phase.type !== 'ended') throw new Error('expected the game to end');
    const { result } = ended.phase;
    expect(outcomeFor(result, 0)).toBe('lost');
    expect(outcomeFor(result, 2)).toBe('won');
    const summary = resultSummary(result, 0, CURRENT_CARD);
    expect(summary.title).toBe('West called Mah Jongg');
    expect(summary.detail).toMatch(/^West made Winds & Dragons #\d \(\d+\), drawing the winning tile\./);
    expect(summary.payments.map((p) => p.seat)).toEqual([0, 1, 2, 3]);
    expect(sum(summary.payments.map((p) => p.amount))).toBe(0);
    expect(resultSummary(result, 2).title).toBe('Mah Jongg! You won');
  });

  it('reports wall games and dead-hand endings', () => {
    expect(outcomeFor({ type: 'wall' }, 0)).toBe('wall_game');
    expect(outcomeFor({ type: 'deadHands' }, 0)).toBe('dead_hand');
    expect(resultSummary({ type: 'wall' }, 0)).toMatchObject({ title: 'A wall game', payments: [] });
  });
});
