import { act, renderHook } from '@testing-library/react-native';

import { useTableGame } from '@/components/table/useTableGame';
import { awaiting, newGame, step, type GameAction, type GameState } from '@/game/engine';
import { autoAction, canCall } from '@/game/table';

jest.mock('@/analytics', () => ({ track: jest.fn() }));

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

const callable = (g: GameState) => g.phase.type === 'calls' && awaiting(g).includes(0) && canCall(g, 0);
const tileOnOffer = (g: GameState) => (g.phase.type === 'calls' ? g.phase.tile.id : null);

/** The table's next move, with the player always letting a discard go. */
function nextMove(g: GameState): GameAction | null {
  const action = autoAction(g, null);
  return action?.type === 'call' && action.seat === 0 ? { type: 'pass', seat: 0 } : action;
}

/**
 * Seed 3, late in the game: the player could call a tile, lets it go, another
 * player calls it and throws a second tile the player could call. A call adds
 * nothing to the discard pile and draws nothing from the wall, so both moments
 * have the same counts; only the tile itself tells the two windows apart.
 */
function calledThenRethrown(): { first: GameState; moves: GameAction[] } {
  let g = newGame(3);
  let first: GameState | null = null;
  let moves: GameAction[] = [];
  for (let i = 0; i < 2000 && g.phase.type !== 'ended'; i++) {
    if (callable(g)) {
      if (first && tileOnOffer(first) !== tileOnOffer(g) && first.wall.length === g.wall.length) {
        return { first, moves };
      }
      first = g;
      moves = [];
    }
    const action = nextMove(g)!;
    const result = step(g, action);
    if (!result.ok) throw new Error(result.error);
    if (first) moves.push(action);
    g = result.state;
    if (g.phase.type === 'turn' && g.phase.step === 'draw') first = null;
  }
  throw new Error('seed 3 no longer reaches a called-then-rethrown discard');
}

describe('useTableGame call window', () => {
  it('starts a fresh window for each discard, even when the counts repeat', async () => {
    const { first, moves } = calledThenRethrown();
    const { result } = await renderHook(() =>
      useTableGame({ seed: 3, you: 0, initial: first, pace: 1_000_000, callWindowMs: 4_000 }),
    );
    const firstKey = result.current.callTimer?.key;
    expect(firstKey).toBe(String(tileOnOffer(first)));

    // Pause the first tile, then let it go and play on until the second is on offer.
    expect(result.current.callTimer?.paused).toBe(false);
    await act(async () => result.current.hold());
    expect(result.current.callTimer).toMatchObject({ key: firstKey, paused: true, running: false });
    for (const move of moves) await act(async () => result.current.act(move));

    const second = result.current.state;
    expect(callable(second)).toBe(true);
    expect(second.discards.length).toBe(first.discards.length);
    expect(second.wall.length).toBe(first.wall.length);
    expect(result.current.callTimer).not.toBeNull();
    expect(result.current.callTimer?.key).not.toBe(firstKey);
    expect(result.current.callTimer?.paused).toBe(false);

    // And the window runs out on it: the tile is let go for the player.
    await act(async () => jest.advanceTimersByTime(4_100));
    expect(result.current.state.phase.type === 'calls' && result.current.state.phase.responses[0]).toBe('pass');
  });
});
