import { cardDistances, CURRENT_CARD } from '../../card';
import { awaiting, newGame, step, type Claim, type GameState, type Seat } from '../../engine';
import { sameKind } from '../../tiles';
import { autoAction, playOut } from '../autoplay';
import {
  CALL_WINDOW_MS,
  callChoices,
  callLabel,
  canCall,
  DEFAULT_CALL_WINDOW,
  isCallWindow,
  lostCallNote,
  swapLabel,
  swapOptions,
} from '../calls';
import { CALL_DEMO_SEED, callableDiscardTable, jokerSwapTable } from '../demo';
import { SEAT_NAMES, tablePrompt } from '../view';

const YOU: Seat = 0;
const name = (s: Seat) => SEAT_NAMES[s];
const isJoker = (t: { kind: { type: string } }) => t.kind.type === 'joker';

function must(state: GameState, action: Parameters<typeof step>[1]): GameState {
  const result = step(state, action);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

/** Every moment East is offered a discard, across a few bot-played games. */
function callMoments(seeds: readonly number[]): GameState[] {
  const out: GameState[] = [];
  for (const seed of seeds) {
    playOut(newGame(seed), (g) => {
      if (canCall(g, YOU)) out.push(g);
      return false;
    });
  }
  return out;
}

describe('callChoices', () => {
  const table = callableDiscardTable();
  const phase = table.phase as Extract<GameState['phase'], { type: 'calls' }>;
  const choices = callChoices(table, YOU);

  it('pins the demo deal: a pung, kong or quint on offer, and no Mah Jongg', () => {
    expect(CALL_DEMO_SEED).toBe(9);
    expect(choices.mahJongg).toBe(false);
    expect(choices.exposures.map((o) => o.name)).toEqual(['pung', 'kong', 'quint']);
    expect(phase.discarder).not.toBe(YOU);
  });

  it('builds each exposure from the discard plus real copies first, then Jokers', () => {
    const rack = table.players[YOU].rack;
    const naturals = rack.filter((t) => sameKind(t.kind, phase.tile.kind)).length;
    for (const option of choices.exposures) {
      expect(option.tiles).toHaveLength(option.size - 1);
      expect(new Set(option.tiles).size).toBe(option.tiles.length);
      expect(option.group[0]).toBe(phase.tile);
      expect(option.jokers).toBe(Math.max(0, option.size - 1 - naturals));
      const used = option.tiles.map((id) => rack.find((t) => t.id === id)!);
      // Real tiles come before Jokers.
      expect(used.findIndex(isJoker) === -1 || used.slice(used.findIndex(isJoker)).every(isJoker)).toBe(true);
      expect(used.every((t) => isJoker(t) || sameKind(t.kind, phase.tile.kind))).toBe(true);
    }
  });

  it('offers only calls the engine accepts, and none that leave a dead hand', () => {
    for (const option of choices.exposures) {
      let state = must(table, { type: 'call', seat: YOU, claim: { type: 'expose', tiles: option.tiles } });
      state = must(state, { type: 'closeCalls' });
      const me = state.players[YOU];
      expect(me.exposures).toHaveLength(table.players[YOU].exposures.length + 1);
      expect(me.dead).toBeNull();
      expect(state.phase).toMatchObject({ type: 'turn', seat: YOU, step: 'discard', source: 'call' });
      const fits = cardDistances(
        { concealed: [], exposures: me.exposures.map((e) => e.tiles.map((t) => t.kind)) },
        CURRENT_CARD,
      ).filter((r) => r.tilesAway !== null);
      expect(fits.length).toBeGreaterThan(0);
    }
  });

  it('asks about an all-Joker call only when it brings the hand closer', () => {
    const moments = callMoments([1, 4, 7, 9, 12]);
    expect(moments.length).toBeGreaterThan(5);
    for (const g of moments) {
      for (const option of callChoices(g, YOU).exposures) {
        expect(option.handsLeft).toBeGreaterThan(0);
        if (option.jokers === option.size - 1) expect(option.closestAfter).toBeLessThan(option.closestBefore);
      }
    }
  }, 120_000);

  it('offers nothing to the discarder, after answering, on a Joker, or once the player has passed', () => {
    const answered = must(table, { type: 'pass', seat: YOU });
    expect(callChoices(answered, YOU).exposures).toEqual([]);
    expect(callChoices(table, phase.discarder).exposures).toEqual([]);
    const jokerOnOffer: GameState = { ...table, phase: { ...phase, tile: { ...phase.tile, kind: { type: 'joker' } } } };
    expect(canCall(jokerOnOffer, YOU)).toBe(false);
    const dead: GameState = {
      ...table,
      players: table.players.map((p) => (p.seat === YOU ? { ...p, dead: 'exposures-fit-no-hand' } : p)),
    };
    expect(canCall(dead, YOU)).toBe(false);
  });

  it('names each call for the screen reader', () => {
    const [pung, kong] = choices.exposures;
    expect(callLabel(pung)).toMatch(/^Call for a pung of /);
    expect(callLabel(kong)).toMatch(/^Call for a kong of /);
    if (kong.jokers > 0) expect(callLabel(kong)).toMatch(/, using (one|two|three) Jokers?$/);
  });
});

describe('the table waits on the player only for a discard they can call', () => {
  it('lets the bots answer, then waits', () => {
    const table = callableDiscardTable();
    let state = table;
    for (let i = 0; i < 4; i++) {
      const action = autoAction(state, YOU);
      if (!action) break;
      expect(action).not.toEqual({ type: 'pass', seat: YOU });
      state = must(state, action);
    }
    // Unless a bot's claim already settled the tile, the table is now waiting on the player.
    if (state.phase.type === 'calls') {
      expect(awaiting(state)).toEqual([YOU]);
      expect(autoAction(state, YOU)).toBeNull();
      expect(tablePrompt(state, YOU)).toMatchObject({ yourMove: true });
    }
  });

  it('passes for the player on a discard they can’t use', () => {
    const quiet = playOut(
      newGame(CALL_DEMO_SEED),
      (g) => g.phase.type === 'calls' && g.phase.discarder !== YOU && !canCall(g, YOU),
    );
    expect(autoAction(quiet, YOU)).toEqual({ type: 'pass', seat: YOU });
  });
});

describe('swapOptions', () => {
  const table = jokerSwapTable();

  it('offers the Joker swap on the player’s turn, and the engine accepts it', () => {
    const options = swapOptions(table, YOU);
    expect(options).toHaveLength(1);
    const [option] = options;
    expect(sameKind(option.tile.kind, option.group.kind)).toBe(true);
    const after = must(table, {
      type: 'jokerSwap',
      seat: YOU,
      tile: option.tile.id,
      owner: option.owner,
      exposure: option.exposure,
    });
    const jokersBefore = table.players[YOU].rack.filter(isJoker).length;
    expect(after.players[YOU].rack.filter(isJoker)).toHaveLength(jokersBefore + 1);
    expect(after.players[option.owner].exposures[option.exposure].tiles).toContain(option.tile);
    expect(swapLabel(option, YOU, name)).toMatch(/^Swap your .+ for the Joker in (your|\w+’s) (pung|kong|quint|sextet)$/);
    expect(tablePrompt(table, YOU).detail).toMatch(/swap for a Joker/);
  });

  it('offers nothing off the player’s turn or with a dead hand', () => {
    const theirs: GameState = { ...table, phase: { type: 'turn', seat: 1, step: 'discard', source: 'wall', calledFrom: null } };
    expect(swapOptions(theirs, YOU)).toEqual([]);
    const dead: GameState = {
      ...table,
      players: table.players.map((p) => (p.seat === YOU ? { ...p, dead: 'exposures-fit-no-hand' } : p)),
    };
    expect(swapOptions(dead, YOU)).toEqual([]);
  });
});

describe('lostCallNote', () => {
  const table = callableDiscardTable();
  const phase = table.phase as Extract<GameState['phase'], { type: 'calls' }>;
  const [pung] = callChoices(table, YOU).exposures;
  const expose: Claim = { type: 'expose', tiles: pung.tiles };
  const other = ([1, 2, 3] as Seat[]).find((s) => s !== phase.discarder)!;
  const calledBy = (seat: Seat): GameState => ({
    ...table,
    phase: { type: 'turn', seat, step: 'discard', source: 'call', calledFrom: phase.discarder },
  });

  it('explains when another caller sits sooner in turn', () => {
    expect(lostCallNote(table, expose, calledBy(other), YOU, name)).toBe(
      `${SEAT_NAMES[other]} called it too, and plays sooner after ${SEAT_NAMES[phase.discarder]}, so the tile went to them.`,
    );
  });

  it('explains that Mah Jongg beats an exposure call', () => {
    const after: GameState = {
      ...table,
      phase: {
        type: 'ended',
        result: { type: 'mahJongg', winner: other, handId: 'x', value: 25, selfDrawn: false, discarder: phase.discarder, jokerless: false, payments: [0, 0, 0, 0] },
      },
    };
    expect(lostCallNote(table, expose, after, YOU, name)).toMatch(/Mah Jongg, which beats a call for an exposure/);
    expect(lostCallNote(table, { type: 'mahJongg' }, after, YOU, name)).toMatch(/called Mah Jongg too/);
  });

  it('says nothing when the player got the tile, or the calls are still open', () => {
    expect(lostCallNote(table, expose, calledBy(YOU), YOU, name)).toBeNull();
    expect(lostCallNote(table, expose, table, YOU, name)).toBeNull();
  });
});

describe('the prompt after a call', () => {
  it('says who called what, from whom', () => {
    const table = callableDiscardTable();
    const phase = table.phase as Extract<GameState['phase'], { type: 'calls' }>;
    const [pung] = callChoices(table, YOU).exposures;
    const state = must(must(table, { type: 'call', seat: YOU, claim: { type: 'expose', tiles: pung.tiles } }), { type: 'closeCalls' });
    const prompt = tablePrompt(state, YOU);
    expect(prompt.title).toBe('Your call');
    expect(prompt.detail).toMatch(new RegExp(`^You called ${SEAT_NAMES[phase.discarder]}’s .+ for a pung\\. Now choose a tile to discard\\.`));
    expect(tablePrompt(state, phase.discarder)).toMatchObject({ title: 'East called', yourMove: false });
  });
});

describe('call windows', () => {
  it('defaults to relaxed, and Off means no limit', () => {
    expect(DEFAULT_CALL_WINDOW).toBe('relaxed');
    expect(CALL_WINDOW_MS.off).toBeNull();
    expect(CALL_WINDOW_MS.relaxed).toBeGreaterThan(CALL_WINDOW_MS.standard!);
    expect(CALL_WINDOW_MS.standard).toBeGreaterThan(CALL_WINDOW_MS.brisk!);
    expect(isCallWindow('brisk')).toBe(true);
    expect(isCallWindow('forever')).toBe(false);
  });
});
