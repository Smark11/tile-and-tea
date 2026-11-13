import { createTileSet, sameKind, type Tile } from '../../tiles';
import { kinds, play, refusal } from '../__fixtures__/table';
import { resolvePass } from '../charleston';
import { awaiting, newGame, tilesHeld } from '../game';
import { acrossFrom, leftOf, rightOf, SEATS, type GameState, type Seat } from '../types';

/** The first three non-Joker tiles on a seat's rack. */
const three = (state: GameState, seat: Seat, n = 3) =>
  state.players[seat].rack.filter((t) => t.kind.type !== 'joker').slice(0, n);
const ids = (tiles: readonly Tile[]) => tiles.map((t) => t.id);
const rackIds = (state: GameState, seat: Seat) => new Set(ids(state.players[seat].rack));

/** Everyone passes their first three non-Jokers. */
function passAll(state: GameState): GameState {
  return play(state, ...SEATS.map((seat) => ({ type: 'charlestonPass' as const, seat, tiles: ids(three(state, seat)) })));
}

const vote = (state: GameState, ...votes: boolean[]) =>
  play(state, ...SEATS.map((seat) => ({ type: 'charlestonVote' as const, seat, continueCharleston: votes[seat] })));

const offer = (state: GameState, ...counts: number[]) =>
  play(state, ...SEATS.map((seat) => ({ type: 'courtesyOffer' as const, seat, count: counts[seat] })));

describe('newGame', () => {
  const game = newGame('deal-1');

  it('deals East 14 and everyone else 13, leaving 99 in the wall', () => {
    expect(game.players.map((p) => p.rack.length)).toEqual([14, 13, 13, 13]);
    expect(game.wall).toHaveLength(152 - 53);
  });

  it('deals every tile of the set exactly once', () => {
    const all = [...game.wall, ...game.players.flatMap((p) => p.rack)];
    expect(new Set(ids(all)).size).toBe(152);
  });

  it('is the same deal for the same seed and a different one for another', () => {
    expect(newGame('deal-1')).toEqual(game);
    expect(ids(newGame('deal-2').players[0].rack)).not.toEqual(ids(game.players[0].rack));
  });

  it('starts with the first Charleston pass, to the right, waiting on everyone', () => {
    expect(game.phase).toMatchObject({ type: 'charleston', pass: 'first-right' });
    expect(awaiting(game)).toEqual([0, 1, 2, 3]);
  });
});

describe('Charleston passes', () => {
  const game = newGame('charleston');

  it('passes the first three right, across, then left', () => {
    let state = game;
    for (const [pass, target] of [
      ['first-right', rightOf],
      ['first-across', acrossFrom],
      ['first-left', leftOf],
    ] as const) {
      expect(state.phase).toMatchObject({ type: 'charleston', pass });
      const passed = SEATS.map((seat) => ids(three(state, seat)));
      state = passAll(state);
      for (const seat of SEATS) {
        const theirs = rackIds(state, target(seat));
        expect(passed[seat].every((id) => theirs.has(id))).toBe(true);
        expect(passed[seat].some((id) => rackIds(state, seat).has(id))).toBe(false);
      }
    }
    expect(state.phase).toEqual({ type: 'charleston-vote', votes: [null, null, null, null] });
    expect(state.players.map((p) => p.rack.length)).toEqual([14, 13, 13, 13]);
  });

  it('waits for all four players, and takes each player’s pass only once', () => {
    const one = play(game, { type: 'charlestonPass', seat: 2, tiles: ids(three(game, 2)) });
    expect(awaiting(one)).toEqual([0, 1, 3]);
    expect(one.players).toBe(game.players);
    expect(refusal(one, { type: 'charlestonPass', seat: 2, tiles: ids(three(game, 2)) })).toBe('already-acted');
  });

  it('never passes a Joker', () => {
    const seat = SEATS.find((s) => game.players[s].rack.some((t) => t.kind.type === 'joker'))!;
    const joker = game.players[seat].rack.find((t) => t.kind.type === 'joker')!;
    expect(refusal(game, { type: 'charlestonPass', seat, tiles: [joker.id, ...ids(three(game, seat, 2))] })).toBe('joker-pass');
  });

  it('passes exactly three tiles from the player’s own rack', () => {
    const mine = ids(three(game, 0));
    expect(refusal(game, { type: 'charlestonPass', seat: 0, tiles: mine.slice(0, 2) })).toBe('wrong-tile-count');
    expect(refusal(game, { type: 'charlestonPass', seat: 0, tiles: [...mine, game.players[0].rack[5].id] })).toBe(
      'wrong-tile-count',
    );
    expect(refusal(game, { type: 'charlestonPass', seat: 0, tiles: [mine[0], mine[0], mine[1]] })).toBe('unknown-tile');
    expect(refusal(game, { type: 'charlestonPass', seat: 0, tiles: [...mine.slice(0, 2), game.players[1].rack[0].id] })).toBe(
      'unknown-tile',
    );
  });

  it('allows a blind pass only on the last pass of each Charleston', () => {
    const blind = { type: 'charlestonPass' as const, seat: 0 as Seat, tiles: ids(three(game, 0, 2)), blind: 1 };
    expect(refusal(game, blind)).toBe('blind-not-allowed');
    const across = passAll(game);
    expect(refusal(across, { ...blind, tiles: ids(three(across, 0, 2)) })).toBe('blind-not-allowed');
    const left = passAll(across);
    expect(play(left, { ...blind, tiles: ids(three(left, 0, 2)) }).phase).toMatchObject({ pass: 'first-left' });
    expect(refusal(left, { ...blind, tiles: ids(three(left, 0, 2)), blind: 4 })).toBe('bad-count');
    expect(refusal(left, { ...blind, tiles: [], blind: 1.5 })).toBe('bad-count');
  });

  it('on a blind pass, sends the incoming tiles on unseen', () => {
    const left = passAll(passAll(game));
    // East passes all three blind: South's tiles, coming to East, go straight on to North.
    const fromSouth = ids(three(left, 1));
    const after = play(
      left,
      { type: 'charlestonPass', seat: 0, tiles: [], blind: 3 },
      { type: 'charlestonPass', seat: 1, tiles: fromSouth },
      { type: 'charlestonPass', seat: 2, tiles: ids(three(left, 2)) },
      { type: 'charlestonPass', seat: 3, tiles: ids(three(left, 3)) },
    );
    expect(ids(after.players[0].rack).sort()).toEqual(ids(left.players[0].rack).sort());
    expect(fromSouth.every((id) => rackIds(after, 3).has(id))).toBe(true);
    expect(after.players.map((p) => p.rack.length)).toEqual([14, 13, 13, 13]);
  });
});

describe('resolvePass', () => {
  const set = createTileSet().filter((t) => t.kind.type !== 'joker');
  const racks = SEATS.map((s) => set.slice(s * 13, s * 13 + 13));

  it('keeps every rack the same size and every tile in play, for every mix of blind passes', () => {
    for (let code = 0; code < 256; code++) {
      const blinds = SEATS.map((s) => (code >> (2 * s)) & 3);
      for (const direction of ['left', 'right'] as const) {
        const inputs = SEATS.map((s) => ({ tiles: racks[s].slice(0, 3 - blinds[s]), blind: blinds[s] }));
        const out = resolvePass(racks, inputs, direction);
        expect(out.map((r) => r.length)).toEqual([13, 13, 13, 13]);
        expect(new Set(ids(out.flat())).size).toBe(52);
        // Each player keeps every rack tile they didn't pass.
        SEATS.forEach((s) =>
          expect(out[s]).toEqual(expect.arrayContaining(racks[s].filter((t) => !inputs[s].tiles.includes(t)))),
        );
      }
    }
  });

  it('moves nothing when all four pass blind', () => {
    const out = resolvePass(racks, SEATS.map(() => ({ tiles: [], blind: 3 })), 'left');
    expect(out).toEqual(racks);
  });

  it('carries a tile past every player still forwarding', () => {
    // Left pass: South's tiles go to East, who forwards 2, and North forwards 1.
    const inputs = [
      { tiles: racks[0].slice(0, 1), blind: 2 },
      { tiles: racks[1].slice(0, 3), blind: 0 },
      { tiles: racks[2].slice(0, 3), blind: 0 },
      { tiles: racks[3].slice(0, 2), blind: 1 },
    ];
    const out = resolvePass(racks, inputs, 'left');
    // East's own tile reaches North first, so North forwards it to West.
    // East forwards the first two of South's tiles to North and keeps the third.
    expect(out[0]).toContain(racks[1][2]);
    expect(out[3]).toEqual(expect.arrayContaining(racks[1].slice(0, 2)));
    expect(out[2]).toEqual(expect.arrayContaining([racks[0][0], ...racks[3].slice(0, 2)]));
    expect(out[1]).toEqual(expect.arrayContaining(racks[2].slice(0, 3)));
  });
});

describe('the second Charleston and the courtesy pass', () => {
  const afterFirst = passAll(passAll(passAll(newGame('second'))));

  it('stops after the first Charleston if any one player says so', () => {
    for (const stopper of SEATS) {
      const votes = SEATS.map((s) => s !== stopper);
      expect(vote(afterFirst, ...votes).phase).toEqual({ type: 'courtesy-offer', offers: [null, null, null, null] });
    }
  });

  it('passes left, across, then right in the second Charleston when everyone agrees', () => {
    let state = vote(afterFirst, true, true, true, true);
    for (const [pass, target] of [
      ['second-left', leftOf],
      ['second-across', acrossFrom],
      ['second-right', rightOf],
    ] as const) {
      expect(state.phase).toMatchObject({ type: 'charleston', pass });
      const passed = ids(three(state, 0));
      state = passAll(state);
      expect(passed.every((id) => rackIds(state, target(0)).has(id))).toBe(true);
    }
    expect(state.phase.type).toBe('courtesy-offer');
  });

  it('allows a blind pass on the second Charleston’s last pass', () => {
    let state = passAll(passAll(vote(afterFirst, true, true, true, true)));
    state = play(state, { type: 'charlestonPass', seat: 2, tiles: ids(three(state, 2, 1)), blind: 2 });
    expect(awaiting(state)).toEqual([0, 1, 3]);
  });

  it('takes one vote per player, and only between the Charlestons', () => {
    const voted = play(afterFirst, { type: 'charlestonVote', seat: 1, continueCharleston: true });
    expect(refusal(voted, { type: 'charlestonVote', seat: 1, continueCharleston: false })).toBe('already-acted');
    expect(refusal(newGame('x'), { type: 'charlestonVote', seat: 1, continueCharleston: true })).toBe('wrong-phase');
  });

  it('trades the smaller offer across, and skips partners who offer nothing', () => {
    const courtesy = offer(vote(afterFirst, false, true, true, true), 3, 0, 1, 2);
    expect(courtesy.phase).toEqual({ type: 'courtesy-pass', counts: [1, 0, 1, 0], submissions: [null, [], null, []] });
    expect(awaiting(courtesy)).toEqual([0, 2]);
    expect(refusal(courtesy, { type: 'courtesyPass', seat: 0, tiles: ids(three(courtesy, 0, 3)) })).toBe('wrong-tile-count');

    const east = three(courtesy, 0, 1);
    const west = three(courtesy, 2, 1);
    const done = play(
      courtesy,
      { type: 'courtesyPass', seat: 0, tiles: ids(east) },
      { type: 'courtesyPass', seat: 2, tiles: ids(west) },
    );
    expect(rackIds(done, 2).has(east[0].id)).toBe(true);
    expect(rackIds(done, 0).has(west[0].id)).toBe(true);
    expect(done.players[1].rack).toEqual(courtesy.players[1].rack);
    expect(done.phase).toEqual({ type: 'turn', seat: 0, step: 'discard', source: 'deal', calledFrom: null });
  });

  it('refuses a courtesy offer over three, and never passes a Joker in it', () => {
    const offers = vote(afterFirst, false, false, false, false);
    expect(refusal(offers, { type: 'courtesyOffer', seat: 0, count: 4 })).toBe('bad-count');
    expect(refusal(offers, { type: 'courtesyOffer', seat: 0, count: -1 })).toBe('bad-count');
    const courtesy = offer(offers, 3, 3, 3, 3);
    const seat = SEATS.find((s) => courtesy.players[s].rack.some((t) => t.kind.type === 'joker'));
    if (seat !== undefined) {
      const joker = courtesy.players[seat].rack.find((t) => t.kind.type === 'joker')!;
      expect(refusal(courtesy, { type: 'courtesyPass', seat, tiles: [joker.id, ...ids(three(courtesy, seat, 2))] })).toBe(
        'joker-pass',
      );
    }
  });

  it('goes straight to play, East first, when no one wants a courtesy pass', () => {
    const state = offer(vote(afterFirst, false, true, true, true), 0, 2, 2, 0);
    expect(state.phase).toEqual({ type: 'turn', seat: 0, step: 'discard', source: 'deal', calledFrom: null });
    expect(awaiting(state)).toEqual([0]);
  });

  it('never changes what tiles are in play', () => {
    const state = offer(vote(afterFirst, false, true, true, true), 0, 0, 0, 0);
    const all = [...state.wall, ...state.players.flatMap(tilesHeld)];
    expect(new Set(ids(all)).size).toBe(152);
    const jokers = (s: GameState, seat: Seat) => kinds(s.players[seat].rack).filter((k) => sameKind(k, { type: 'joker' }));
    // Jokers never move in the Charleston.
    const start = newGame('second');
    SEATS.forEach((seat) => expect(jokers(state, seat).length).toBe(jokers(start, seat).length));
  });
});
