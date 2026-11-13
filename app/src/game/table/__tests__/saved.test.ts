import { newGame, step, type GameAction, type GameState } from '../../engine';
import { autoAction } from '../autoplay';
import { replayGame, restoreGame, SAVED_GAME_VERSION, savedAgo, savedGameStage, type SavedGame } from '../saved';

/** Bots play every seat from the deal, keeping the moves, until `stop` (or the game ends). */
function record(seed: number, stop: (state: GameState) => boolean = () => false) {
  let state = newGame(seed);
  const actions: GameAction[] = [];
  while (!stop(state)) {
    const action = autoAction(state, null, 'club');
    if (!action) break;
    const result = step(state, action);
    if (!result.ok) throw new Error(result.error);
    state = result.state;
    actions.push(action);
  }
  return { state, actions };
}

const save = (seed: number, actions: readonly GameAction[], extra: Partial<SavedGame> = {}): SavedGame => ({
  version: SAVED_GAME_VERSION,
  seed,
  you: 0,
  level: 'club',
  actions,
  order: [],
  savedAt: 1_000,
  ...extra,
});

// Mid-game: 20 discards in, so the save holds Charleston passes, calls and swaps alike.
const midGame = record(21, (s) => s.discards.length >= 20);

describe('replayGame', () => {
  it('rebuilds the exact table from the deal and the moves', () => {
    expect(replayGame(21, midGame.actions)).toEqual(midGame.state);
  });

  it('rebuilds a whole game, move for move', () => {
    const whole = record(4);
    expect(whole.state.phase.type).toBe('ended');
    expect(replayGame(4, whole.actions)).toEqual(whole.state);
  });

  it('refuses a move the engine refuses', () => {
    const tampered = [...midGame.actions];
    tampered[5] = { type: 'draw', seat: 2 };
    expect(replayGame(21, tampered)).toBeNull();
  });

  it('refuses moves from a different deal', () => {
    expect(replayGame(22, midGame.actions)).toBeNull();
  });

  it('refuses things that are not moves, without throwing', () => {
    expect(replayGame(21, [null])).toBeNull();
    expect(replayGame(21, ['draw'])).toBeNull();
    expect(replayGame(21, [{ type: 'charlestonPass', seat: 0 }])).toBeNull();
    expect(replayGame(21, [{ type: 'nonsense' }])).toBeNull();
  });

  it('replays a long game quickly enough to resume without a wait', () => {
    const whole = record(4);
    const start = Date.now();
    replayGame(4, whole.actions);
    expect(Date.now() - start).toBeLessThan(500);
  });
});

describe('restoreGame', () => {
  it('restores a game in play, through a JSON round trip', () => {
    const saved = save(21, midGame.actions, { you: 2, level: 'shark', order: [5, 9, 1] });
    const restored = restoreGame(JSON.parse(JSON.stringify(saved)));
    expect(restored?.state).toEqual(midGame.state);
    expect(restored?.saved).toEqual(saved);
  });

  it('restores a fresh deal with no moves yet', () => {
    expect(restoreGame(save(8, []))?.state).toEqual(newGame(8));
  });

  it('drops a game that has already ended', () => {
    const whole = record(4);
    expect(restoreGame(save(4, whole.actions))).toBeNull();
  });

  it('drops damaged or outdated saves', () => {
    expect(restoreGame(null)).toBeNull();
    expect(restoreGame('game')).toBeNull();
    expect(restoreGame([])).toBeNull();
    expect(restoreGame({ ...save(21, midGame.actions), version: 0 })).toBeNull();
    expect(restoreGame({ ...save(21, midGame.actions), seed: 'x' })).toBeNull();
    expect(restoreGame({ ...save(21, midGame.actions), seed: 1.5 })).toBeNull();
    expect(restoreGame({ ...save(21, midGame.actions), you: 4 })).toBeNull();
    expect(restoreGame({ ...save(21, midGame.actions), level: 'grandmaster' })).toBeNull();
    expect(restoreGame({ ...save(21, midGame.actions), actions: 'none' })).toBeNull();
    expect(restoreGame({ ...save(21, midGame.actions), savedAt: 'today' })).toBeNull();
    expect(restoreGame({ ...save(21, midGame.actions.slice(0, -1)), seed: 22 })).toBeNull();
  });

  it('keeps a game whose rack order is damaged, dropping only the order', () => {
    const restored = restoreGame({ ...save(21, midGame.actions), order: [3, 'x', 1.5, 7] });
    expect(restored?.saved.order).toEqual([3, 7]);
    expect(restoreGame({ ...save(21, midGame.actions), order: null })?.saved.order).toEqual([]);
  });
});

describe('the screenshot save (scripts/fixtures/saved-game.json)', () => {
  it('still replays to East’s turn mid-game, with exposures on the table', () => {
    // The harness seeds this into storage to capture the Play tab's resume card
    // and the resumed table. If the engine changes, regenerate it (Club bots, seed 5).
    const fixture = require('../../../../scripts/fixtures/saved-game.json');
    const restored = restoreGame(fixture);
    expect(restored).not.toBeNull();
    const { state } = restored!;
    expect(state.phase).toMatchObject({ type: 'turn', seat: 0, step: 'discard' });
    expect(savedGameStage(state, 0)).toBe('Your turn');
    expect(state.wall.length).toBe(78);
    expect(state.players.map((p) => p.exposures.length)).toEqual([1, 0, 2, 1]);
  });
});

describe('savedGameStage', () => {
  it('names each part of the game', () => {
    const deal = newGame(8);
    expect(savedGameStage(deal, 0)).toBe('In the first Charleston');
    const vote = record(8, (s) => s.phase.type === 'charleston-vote').state;
    expect(savedGameStage(vote, 0)).toBe('Deciding on a second Charleston');
    const second = record(8, (s) => s.phase.type === 'charleston' && s.phase.pass.startsWith('second')).state;
    expect(savedGameStage(second, 0)).toBe('In the second Charleston');
    const courtesy = record(8, (s) => s.phase.type === 'courtesy-offer').state;
    expect(savedGameStage(courtesy, 0)).toBe('At the courtesy pass');
    const eastToDiscard = record(8, (s) => s.phase.type === 'turn').state;
    expect(savedGameStage(eastToDiscard, 0)).toBe('Your turn');
    expect(savedGameStage(eastToDiscard, 1)).toBe('Play under way');
    const offer = record(8, (s) => s.phase.type === 'calls').state;
    expect(savedGameStage(offer, 0)).toBe('Play under way');
    expect(savedGameStage(offer, 1)).toBe('A discard is on offer');
  });
});

describe('savedAgo', () => {
  const now = 10 * 24 * 3_600_000;
  it.each([
    [0, 'just now'],
    [59_000, 'just now'],
    [60_000, '1 min ago'],
    [59 * 60_000, '59 min ago'],
    [3_600_000, 'an hour ago'],
    [5 * 3_600_000, '5 hours ago'],
    [24 * 3_600_000, 'a day ago'],
    [3 * 24 * 3_600_000, '3 days ago'],
    [-5_000, 'just now'],
  ])('%d ms ago reads "%s"', (elapsed, words) => {
    expect(savedAgo(now - elapsed, now)).toBe(words);
  });
});
