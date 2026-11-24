import { awaiting, newGame, step, type GameAction, type GameState, type Seat } from '@/game/engine';
import {
  bam,
  dot,
  E,
  FLOWER,
  HONORS_1,
  idOf,
  JOKER,
  N,
  of,
  play,
  RED,
  S,
  table,
  turn,
  W,
} from '@/game/engine/__fixtures__/table';
import { createRng, shuffle } from '@/game/rng';
import { sameKind, TILE_COUNT, type Tile, type TileKind } from '@/game/tiles';

import { BOT_LEVELS, botAction, isBotLevel, LATE_WALL, seenBy, type BotLevel } from '..';

const isJoker = (t: Tile) => t.kind.type === 'joker';

/** Moves copies of each kind from the wall to the discards, as if `seat` had thrown them. */
function withDiscards(state: GameState, kinds: readonly TileKind[], seat: Seat = 3): GameState {
  const wall = [...state.wall];
  const discards = [...state.discards];
  for (const kind of kinds) {
    const at = wall.findIndex((t) => sameKind(t.kind, kind));
    if (at < 0) throw new Error(`no ${JSON.stringify(kind)} left in the wall`);
    discards.push({ tile: wall[at], seat });
    wall.splice(at, 1);
  }
  return { ...state, wall, discards };
}

/** The tile a discard action throws. */
function thrown(state: GameState, action: GameAction | null): TileKind {
  if (action?.type !== 'discard') throw new Error(`expected a discard, got ${JSON.stringify(action)}`);
  return state.players[action.seat].rack.find((t) => t.id === action.tile)!.kind;
}

/** The tiles a move sends away from the rack: passes and discards. */
function tilesOut(state: GameState, action: GameAction): Tile[] {
  if (!('seat' in action)) return [];
  const rack = state.players[action.seat].rack;
  const ids =
    action.type === 'charlestonPass' || action.type === 'courtesyPass'
      ? action.tiles
      : action.type === 'discard'
        ? [action.tile]
        : [];
  return ids.map((id) => rack.find((t) => t.id === id)!);
}

/** Plays a whole game, each seat at its own level, checking every move with the engine. */
function playGame(seed: number, levels: readonly BotLevel[], onMove?: (state: GameState, action: GameAction) => void) {
  let state = newGame(seed);
  for (let moves = 0; state.phase.type !== 'ended'; moves++) {
    if (moves > 2000) throw new Error(`game ${seed} didn't end`);
    // The first seat the engine waits on: the same order the table uses.
    const [seat] = awaiting(state);
    const action = botAction(state, seat, levels[seat])!;
    onMove?.(state, action);
    const result = step(state, action);
    if (!result.ok) throw new Error(`${levels[seat]} bot: ${JSON.stringify(action)} refused (${result.error})`);
    state = result.state;
  }
  return state;
}

describe('every level', () => {
  const SEEDS = [1, 2, 3];
  const games = new Map<string, GameState>();
  const jokersOut: string[] = [];
  beforeAll(() => {
    for (const level of BOT_LEVELS) {
      for (const seed of SEEDS) {
        const end = playGame(seed, [level, level, level, level], (state, action) => {
          if (tilesOut(state, action).some(isJoker)) jokersOut.push(`${level} ${seed} ${action.type}`);
        });
        games.set(`${level}-${seed}`, end);
      }
    }
  });

  it('plays whole games legally, Charleston to the end, with every tile accounted for', () => {
    for (const end of games.values()) {
      expect(end.phase.type).toBe('ended');
      const held = end.players.flatMap((p) => [...p.rack, ...p.exposures.flatMap((e) => e.tiles)]);
      expect(held.length + end.wall.length + end.discards.length).toBe(TILE_COUNT);
    }
  });

  it('never passes or throws a Joker', () => {
    expect(jokersOut).toEqual([]);
  });

  it('never calls its way into a dead hand', () => {
    for (const end of games.values()) expect(end.players.every((p) => p.dead === null)).toBe(true);
  });

  it('wins games and exposes groups', () => {
    for (const level of BOT_LEVELS) {
      const ends = SEEDS.map((s) => games.get(`${level}-${s}`)!);
      expect(ends.some((g) => g.players.some((p) => p.exposures.length > 0))).toBe(true);
    }
    const wins = [...games.values()].filter((g) => g.phase.type === 'ended' && g.phase.result.type === 'mahJongg');
    expect(wins.length).toBeGreaterThan(0);
  });

  it('replays the same game from the same seed', () => {
    expect(playGame(2, ['club', 'beginner', 'shark', 'club'])).toEqual(playGame(2, ['club', 'beginner', 'shark', 'club']));
  });

  it.each(BOT_LEVELS)('%s declares Mah Jongg when its tiles make a hand', (level) => {
    const state = table({ racks: { 1: HONORS_1 }, phase: turn(1, 'discard') });
    expect(botAction(state, 1, level)).toEqual({ type: 'declareMahJongg', seat: 1 });
  });

  it.each(BOT_LEVELS)('%s calls a discard for Mah Jongg, and waits its turn otherwise', (level) => {
    const before = table({
      racks: { 0: [S], 2: [...of(3, N), ...of(4, E), ...of(4, W), ...of(2, S)] },
      phase: turn(0, 'discard'),
    });
    expect(botAction(before, 2, level)).toBeNull();
    const calls = play(before, { type: 'discard', seat: 0, tile: idOf(before, 0, S) });
    expect(botAction(calls, 2, level)).toEqual({ type: 'call', seat: 2, claim: { type: 'mahJongg' } });
  });

  it.each(BOT_LEVELS)('%s exposes a pung when the call brings its hand closer', (level) => {
    // Two tiles from Honors-1 (NNN EEEE WWWW SSS): the North pung leaves one to go.
    const before = table({
      racks: { 0: [N], 2: [...of(2, N), ...of(4, E), ...of(4, W), ...of(2, S)] },
      phase: turn(0, 'discard'),
    });
    const calls = play(before, { type: 'discard', seat: 0, tile: idOf(before, 0, N) });
    const action = botAction(calls, 2, level)!;
    expect(action).toMatchObject({ type: 'call', claim: { type: 'expose' } });
    const called = play(calls, action, { type: 'pass', seat: 1 }, { type: 'pass', seat: 3 });
    expect(called.players[2].exposures).toHaveLength(1);
    expect(called.players[2].dead).toBeNull();
  });

  it('names its levels', () => {
    expect(isBotLevel('shark')).toBe(true);
    expect(isBotLevel('toString')).toBe(false);
    expect(isBotLevel(undefined)).toBe(false);
  });
});

describe('fair play', () => {
  /** Deals every tile the seat can't see (other racks and the wall) out again at random, keeping each pile's size. */
  function scrambleHidden(state: GameState, seat: Seat, seed: number): GameState {
    const others = state.players.filter((p) => p.seat !== seat);
    const hidden = shuffle([...others.flatMap((p) => p.rack), ...state.wall], createRng(seed));
    let at = 0;
    const take = (n: number) => hidden.slice(at, (at += n));
    const players = state.players.map((p) => (p.seat === seat ? p : { ...p, rack: take(p.rack.length) }));
    return { ...state, players, wall: take(state.wall.length) };
  }

  it.each(BOT_LEVELS)('%s decides only from what its seat can see', (level) => {
    let checked = 0;
    playGame(4, [level, level, level, level], (state, action) => {
      if (!('seat' in action) || state.phase.type === 'charleston-vote') return;
      // East may be dealt Mah Jongg, which depends on nothing hidden either.
      const scrambled = scrambleHidden(state, action.seat, checked + 11);
      expect(botAction(scrambled, action.seat, level)).toEqual(action);
      checked++;
    });
    expect(checked).toBeGreaterThan(40);
  });

  it('sees the discards and the other players’ exposures, not its own tiles', () => {
    const state = withDiscards(
      table({ exposures: [{ seat: 1, kinds: [E, E, E], calledFrom: 0 }, { seat: 0, kinds: [W, W, W], calledFrom: 2 }], phase: turn(0, 'discard') }),
      [RED],
    );
    const seen = seenBy(state, 0);
    expect(seen.filter((k) => sameKind(k, E))).toHaveLength(3);
    expect(seen.filter((k) => sameKind(k, RED))).toHaveLength(1);
    expect(seen.some((k) => sameKind(k, W))).toBe(false);
  });
});

describe('dead tiles', () => {
  // Runs-3 is "11 22 33 NNNN SSSS" in one suit. In Dots the rack is two away,
  // but three 2 Dots are in the discards, so the 22 pair can never be made:
  // the live hand is the Bam one, four away, which needs the 1 and 2 Bam.
  const rack = [...of(4, N), ...of(4, S), dot(1), dot(1), dot(2), dot(3), bam(1), bam(2)];
  const state = withDiscards(table({ racks: { 0: rack }, phase: turn(0, 'discard') }), of(3, dot(2)));

  it.each(['club', 'shark'] as const)('%s plays toward the hand still live and lets the dead one go', (level) => {
    const kind = thrown(state, botAction(state, 0, level));
    expect(kind).toMatchObject({ type: 'suited', suit: 'dot' });
  });

  it('a Beginner doesn’t count them, so it keeps chasing the Dots', () => {
    const kind = thrown(state, botAction(state, 0, 'beginner'));
    expect(kind).toMatchObject({ type: 'suited', suit: 'bam' });
  });
});

describe('Joker swaps', () => {
  // South exposed a Red pung with a Joker in it; East holds a spare Red Dragon.
  const state = table({
    racks: { 0: [...of(3, N), ...of(4, E), ...of(3, W), ...of(2, S), RED] },
    exposures: [{ seat: 1, kinds: [RED, RED, JOKER], calledFrom: 2 }],
    phase: turn(0, 'discard'),
  });

  it.each(['club', 'shark'] as const)('%s trades a spare tile for an exposed Joker', (level) => {
    const action = botAction(state, 0, level);
    expect(action).toEqual({ type: 'jokerSwap', seat: 0, tile: idOf(state, 0, RED), owner: 1, exposure: 0 });
    const after = play(state, action!);
    expect(after.players[0].rack.filter(isJoker)).toHaveLength(1);
    // With the Joker taken, the next move is a discard, not another swap.
    expect(botAction(after, 0, level)).toMatchObject({ type: 'discard' });
  });

  it('a Beginner doesn’t notice the Joker', () => {
    expect(botAction(state, 0, 'beginner')).toMatchObject({ type: 'discard' });
  });

  // Regression: judging the swap, the bot used to add the real tile to what it had seen without taking
  // the Joker back out, so the Joker counted twice (in its rack and still in South's exposure). With
  // all eight Jokers in play that made a ninth, and the distance engine threw on the impossible table.
  it.each(['club', 'shark'] as const)('%s counts the swapped Joker once, even with all eight Jokers in play', (level) => {
    const allJokers = table({
      racks: { 0: [...of(7, JOKER), ...of(3, N), ...of(3, E), RED] },
      exposures: [{ seat: 1, kinds: [RED, RED, JOKER], calledFrom: 2 }],
      phase: turn(0, 'discard'),
    });
    const action = botAction(allJokers, 0, level);
    expect(action).toEqual({ type: 'jokerSwap', seat: 0, tile: idOf(allJokers, 0, RED), owner: 1, exposure: 0 });
    expect(play(allJokers, action!).players[0].rack.filter(isJoker)).toHaveLength(8);
  });
});

describe('Shark defense', () => {
  // East is two tiles from Addition-1 in Bams (FF 3333 4444 7777) and holds two
  // Norths it has no use for. South has exposed Easts and Wests: Honors-1
  // (NNN EEEE WWWW SSS), which wants a North pung.
  const rack = [FLOWER, FLOWER, ...of(3, bam(3)), ...of(3, bam(4)), ...of(3, bam(7)), JOKER, N, N];
  const southExposes = (groups: TileKind[][]) => groups.map((kinds) => ({ seat: 1 as Seat, kinds, calledFrom: 2 as Seat }));
  const kongs = [of(4, E), of(4, W)];

  it('early, with two exposures to read, it keeps its own hand and throws the North', () => {
    const state = table({ racks: { 0: rack }, exposures: southExposes(kongs), phase: turn(0, 'discard') });
    expect(thrown(state, botAction(state, 0, 'shark'))).toEqual(N);
  });

  it('against three exposures it gives up a tile of progress rather than feed them', () => {
    const state = table({ racks: { 0: rack }, exposures: southExposes([...kongs, of(3, S)]), phase: turn(0, 'discard') });
    expect(thrown(state, botAction(state, 0, 'shark'))).not.toEqual(N);
    // A Club player doesn't read the table.
    expect(thrown(state, botAction(state, 0, 'club'))).toEqual(N);
  });

  it('late in the wall it holds the dangerous tile even against two exposures', () => {
    const state = table({
      racks: { 0: rack },
      exposures: southExposes(kongs),
      wallSize: LATE_WALL,
      phase: turn(0, 'discard'),
    });
    expect(thrown(state, botAction(state, 0, 'shark'))).not.toEqual(N);
  });

  it('one tile from Mah Jongg, it plays to win', () => {
    // Swap a North for the fourth 3 Bam: now one away, and the North is its only spare.
    const close = [FLOWER, FLOWER, ...of(4, bam(3)), ...of(3, bam(4)), ...of(3, bam(7)), JOKER, N];
    const state = table({ racks: { 0: close }, exposures: southExposes([...kongs, of(3, S)]), phase: turn(0, 'discard') });
    expect(thrown(state, botAction(state, 0, 'shark'))).toEqual(N);
  });
});

describe('a rack of nothing but Jokers', () => {
  // Bots keep their Jokers, so after three kongs East may hold only Jokers.
  // South has two groups out, so a Shark's defense has someone to read.
  const state = table({
    racks: { 0: [JOKER, JOKER] },
    exposures: [
      { seat: 0, kinds: of(4, dot(1)), calledFrom: 3 },
      { seat: 0, kinds: of(4, dot(5)), calledFrom: 2 },
      { seat: 0, kinds: of(4, bam(9)), calledFrom: 1 },
      { seat: 1, kinds: of(4, E), calledFrom: 2 },
      { seat: 1, kinds: of(4, W), calledFrom: 3 },
    ],
    phase: turn(0, 'discard'),
  });

  it.each(BOT_LEVELS)('%s throws a Joker rather than freeze', (level) => {
    const action = botAction(state, 0, level);
    expect(thrown(state, action)).toEqual(JOKER);
    expect(step(state, action!).ok).toBe(true);
  });
});

describe('levels', () => {
  it('Sharks beat Beginners over a run of games', () => {
    let shark = 0;
    let beginner = 0;
    for (const seed of [11, 12, 13, 14, 15, 16]) {
      const end = playGame(seed, ['shark', 'beginner', 'shark', 'beginner']);
      if (end.phase.type !== 'ended' || end.phase.result.type !== 'mahJongg') continue;
      if (end.phase.result.winner % 2 === 0) shark++;
      else beginner++;
    }
    expect(shark).toBeGreaterThan(beginner);
  });
});
