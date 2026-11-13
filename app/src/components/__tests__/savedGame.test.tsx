import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';

import { ResumeHero } from '@/components/play/ResumeHero';
import { PlayTab } from '@/components/tabs/PlayTab';
import { chooseSitting } from '@/components/table/GameScreen';
import { RESUMED_NOTE, useTableGame, type TableProgress } from '@/components/table/useTableGame';
import { newGame, step, type GameAction, type GameState } from '@/game/engine';
import { autoAction, replayGame, restoreGame, SAVED_GAME_VERSION, type SavedGame } from '@/game/table';
import { SAVED_GAME_STORAGE_KEY, useSavedGame } from '@/state/savedGame';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: () => ({}),
}));
jest.mock('@/analytics', () => ({ track: jest.fn() }));
jest.mock('@/components/shell/TabScreen', () => ({
  TabScreen: ({ children }: { children: React.ReactNode }) => children,
}));

const track = () => jest.requireMock('@/analytics').track as jest.Mock;
const router = () => jest.requireMock('expo-router').router;

/** Bots play every seat (the player's too) until `stop`, keeping the moves. */
function record(seed: number, stop: (state: GameState) => boolean) {
  let state = newGame(seed);
  const actions: GameAction[] = [];
  while (!stop(state)) {
    const action = autoAction(state, null);
    if (!action) break;
    const result = step(state, action);
    if (!result.ok) throw new Error(result.error);
    state = result.state;
    actions.push(action);
  }
  return { state, actions };
}

const midGame = record(21, (s) => s.discards.length >= 12);
const saveOf = (extra: Partial<SavedGame> = {}): SavedGame => ({
  version: SAVED_GAME_VERSION,
  seed: 21,
  you: 0,
  level: 'shark',
  actions: midGame.actions,
  order: [],
  // The label's clock ticks every 30 s, so it can run up to 30 s behind.
  savedAt: Date.now() - 5.5 * 60_000,
  ...extra,
});

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  useSavedGame.setState({ game: null });
});

describe('useTableGame saving', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('reports every move, and the moves replay to the table on screen', async () => {
    const reports: TableProgress[] = [];
    const { result } = await renderHook(() =>
      useTableGame({ seed: 7, you: 0, pace: 0, onProgress: (p) => reports.push(p) }),
    );
    expect(reports[0]).toEqual({ actions: [], order: expect.any(Array), ended: false });
    // The bots and the player's routine moves play on until the table waits on the player.
    for (let i = 0; i < 40; i++) await act(async () => jest.runOnlyPendingTimers());
    const last = reports[reports.length - 1];
    expect(last.actions.length).toBeGreaterThan(0);
    expect(replayGame(7, last.actions)).toEqual(result.current.state);
    expect(last.order).toEqual(result.current.tiles.map((t) => t.id));
  });

  it('sits back down to a saved game: same table, same rack order, a welcome note', async () => {
    const restored = restoreGame(saveOf())!;
    const order = [...restored.state.players[0].rack].reverse().map((t) => t.id);
    const resume = restoreGame(saveOf({ order }))!;
    const { result } = await renderHook(() => useTableGame({ seed: 0, you: 0, resume, autoplay: true, level: 'shark' }));
    expect(result.current.state).toEqual(midGame.state);
    expect(result.current.tiles.map((t) => t.id)).toEqual(order);
    expect(result.current.freshIds.size).toBe(0);
    expect(result.current.note).toBe(RESUMED_NOTE);
    expect(track()).toHaveBeenCalledWith('game_resumed', { opponents: 'shark' });
    expect(track()).not.toHaveBeenCalledWith('game_started', expect.anything());
  });

  it('keeps logging after the saved moves when play goes on', async () => {
    const reports: TableProgress[] = [];
    const resume = restoreGame(saveOf())!;
    await renderHook(() => useTableGame({ seed: 0, you: 0, resume, pace: 0, onProgress: (p) => reports.push(p) }));
    for (let i = 0; i < 10; i++) await act(async () => jest.runOnlyPendingTimers());
    const last = reports[reports.length - 1].actions;
    expect(last.slice(0, midGame.actions.length)).toEqual(midGame.actions);
    expect(replayGame(21, last)).not.toBeNull();
  });
});

describe('chooseSitting', () => {
  const saved = saveOf();
  it('resumes the saved game for a plain /game, or a link to its own level', () => {
    expect(chooseSitting({}, saved, 'club')).toMatchObject({ kind: 'resume' });
    expect(chooseSitting({ level: 'shark' }, saved, 'club')).toMatchObject({ kind: 'resume' });
  });

  it('deals when asked to, reporting the saved game it replaces', () => {
    const fresh = chooseSitting({ new: '1', level: 'beginner' }, saved, 'club');
    expect(fresh).toMatchObject({ kind: 'deal', level: 'beginner' });
    expect(fresh.kind === 'deal' && fresh.replaces?.saved.seed).toBe(21);
    expect(chooseSitting({ seed: '99' }, saved, 'club')).toMatchObject({ kind: 'deal', seed: 99, level: 'club' });
    expect(chooseSitting({ level: 'club' }, saved, 'club')).toMatchObject({ kind: 'deal', level: 'club' });
  });

  it('deals with nothing to replace when the save is missing or broken', () => {
    expect(chooseSitting({}, null, 'club')).toMatchObject({ kind: 'deal', level: 'club', replaces: undefined });
    expect(chooseSitting({}, { ...saved, seed: 22 }, 'club')).toMatchObject({ kind: 'deal', replaces: undefined });
  });

  it('shows a demo table without touching the save', () => {
    expect(chooseSitting({ demo: 'call' }, saved, 'club')).toEqual({ kind: 'demo', demo: 'call', level: 'club' });
  });
});

describe('useSavedGame', () => {
  it('writes the save to storage', async () => {
    useSavedGame.getState().save(saveOf());
    const stored = JSON.parse((await AsyncStorage.getItem(SAVED_GAME_STORAGE_KEY))!);
    expect(stored.state.game.seed).toBe(21);
    useSavedGame.getState().clear();
    expect(JSON.parse((await AsyncStorage.getItem(SAVED_GAME_STORAGE_KEY))!).state.game).toBeNull();
  });
});

describe('ResumeHero', () => {
  it('shows where the game stands, and resumes', async () => {
    const onResume = jest.fn();
    await render(
      <ResumeHero restored={restoreGame(saveOf())!} newLevel="club" onResume={onResume} onNewGame={jest.fn()} />,
    );
    expect(screen.getByText('Saved 5 min ago')).toBeTruthy();
    expect(screen.getByText(/against Shark opponents\. \d+ tiles left in the wall\./)).toBeTruthy();
    expect(screen.getByLabelText(/Your rack: 1[34] tiles, just as you left them/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Resume game'));
    expect(onResume).toHaveBeenCalled();
  });

  it('asks once more before a new deal ends the saved game', async () => {
    const onNewGame = jest.fn();
    await render(
      <ResumeHero restored={restoreGame(saveOf())!} newLevel="beginner" onResume={jest.fn()} onNewGame={onNewGame} />,
    );
    await fireEvent.press(screen.getByText('Start a new game instead'));
    expect(onNewGame).not.toHaveBeenCalled();
    expect(screen.getByText('A new deal ends this game for good.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Keep my game'));
    expect(screen.queryByText('A new deal ends this game for good.')).toBeNull();
    await fireEvent.press(screen.getByText('Start a new game instead'));
    await fireEvent.press(screen.getByText('Deal a new Beginner game'));
    expect(onNewGame).toHaveBeenCalled();
  });
});

describe('PlayTab', () => {
  it('offers a new game when nothing is saved', async () => {
    await render(<PlayTab />);
    expect(screen.queryByTestId('play-resume')).toBeNull();
    await fireEvent.press(screen.getByText('Start a Club game'));
    expect(router().push).toHaveBeenCalledWith({ pathname: '/game', params: { level: 'club' } });
  });

  it('leads with the saved game, resuming at a plain /game', async () => {
    useSavedGame.setState({ game: saveOf() });
    await render(<PlayTab />);
    expect(screen.getByTestId('play-resume')).toBeTruthy();
    await fireEvent.press(screen.getByText('Resume game'));
    expect(router().push).toHaveBeenCalledWith('/game');
    await fireEvent.press(screen.getByText('Start a new game instead'));
    await fireEvent.press(screen.getByText('Deal a new Club game'));
    expect(router().push).toHaveBeenCalledWith({ pathname: '/game', params: { level: 'club', new: '1' } });
  });

  it('ignores a save that no longer replays', async () => {
    useSavedGame.setState({ game: { ...saveOf(), seed: 22 } });
    await render(<PlayTab />);
    expect(screen.queryByTestId('play-resume')).toBeNull();
  });
});
