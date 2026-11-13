import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { track } from '@/analytics';
import { GameTable } from '@/components/table/GameTable';
import { pileHeightFor, pileTileWidth } from '@/components/table/TableFelt';
import { newGame } from '@/game/engine';
import { midGameTable } from '@/game/table';
import { tileName } from '@/game/tiles';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: () => ({}),
}));
jest.mock('@/analytics', () => ({ track: jest.fn() }));

const disabled = (el: { props: { accessibilityState?: { disabled?: boolean } } }) =>
  !!el.props.accessibilityState?.disabled;

/** Renders the table and gives the rack a width, since Jest runs no layout. */
async function renderTable(ui: React.ReactElement) {
  await render(<GestureHandlerRootView>{ui}</GestureHandlerRootView>);
  await fireEvent(screen.getByTestId('table-rack-area'), 'layout', {
    nativeEvent: { layout: { width: 360, height: 200 } },
  });
}

const tick = () => act(async () => jest.runOnlyPendingTimers());

beforeEach(() => {
  jest.useFakeTimers();
  jest.mocked(track).mockClear();
});
afterEach(() => jest.useRealTimers());

describe('GameTable', () => {
  it('runs the first Charleston pass: pick 3 tiles, pass, and the bots follow', async () => {
    const seed = 1;
    const game = newGame(seed);
    await renderTable(<GameTable seed={seed} pace={0} level="beginner" />);
    expect(track).toHaveBeenCalledWith('game_started', { opponents: 'beginner' });
    expect(screen.getByText('Practice table · Beginner')).toBeTruthy();
    expect(screen.getByText('First Charleston · pass right')).toBeTruthy();
    expect(screen.getByLabelText(/^South, on your right\. 13 tiles in hand\./)).toBeTruthy();
    expect(screen.getByLabelText(/^North, on your left\./)).toBeTruthy();
    expect(screen.getByLabelText(/^West, across from you\./)).toBeTruthy();

    const passable = game.players[0].rack.filter((t) => t.kind.type !== 'joker').slice(0, 3);
    expect(disabled(screen.getByTestId('table-pass'))).toBe(true);
    for (const tile of passable) await fireEvent.press(screen.getByTestId(`table-rack-tile-${tile.id}`));
    await fireEvent.press(screen.getByTestId('table-pass'));
    for (let i = 0; i < 4; i++) await tick();
    expect(screen.getByText('First Charleston · pass across')).toBeTruthy();
    for (const tile of passable) expect(screen.queryByTestId(`table-rack-tile-${tile.id}`)).toBeNull();
  });

  it('locks Jokers during the Charleston', async () => {
    const seed = [...Array(40).keys()].find((s) => newGame(s).players[0].rack.some((t) => t.kind.type === 'joker'))!;
    const joker = newGame(seed).players[0].rack.find((t) => t.kind.type === 'joker')!;
    await renderTable(<GameTable seed={seed} pace={0} />);
    expect(disabled(screen.getByTestId(`table-rack-tile-${joker.id}`))).toBe(true);
  });

  it('discards the picked tile on the player’s turn and puts it on offer', async () => {
    const initial = midGameTable();
    await renderTable(<GameTable seed={5} initial={initial} autoplay={false} />);
    expect(screen.getByText('Your turn')).toBeTruthy();
    // The prompt asks for a tile; the discard button waits until there is one.
    expect(screen.queryByTestId('table-discard')).toBeNull();
    const tile = initial.players[0].rack.find((t) => t.kind.type !== 'joker')!;
    await fireEvent.press(screen.getByTestId(`table-rack-tile-${tile.id}`));
    await fireEvent.press(screen.getByText(`Discard ${tileName(tile.kind)}`));
    expect(screen.queryByTestId(`table-rack-tile-${tile.id}`)).toBeNull();
    expect(screen.getByText(/^East threw/)).toBeTruthy();
    // A frozen table (the styleguide) never reports a game.
    expect(track).not.toHaveBeenCalled();
  });

  it('sizes discards as large as the space between the walls allows', () => {
    // A few discards get big, legible tiles; a full pile shrinks them to fit.
    const few = pileTileWidth(6, 330, 200);
    const many = pileTileWidth(80, 330, 200);
    expect(few).toBeGreaterThanOrEqual(40);
    expect(many).toBeLessThan(few);
    expect(pileHeightFor(80, 330, many)).toBeLessThanOrEqual(200);
    // Past the floor the tile stops shrinking (the table grows instead).
    expect(pileTileWidth(200, 200, 60)).toBe(20);
  });

  it('plays a whole game through to the result and reports it once', async () => {
    await renderTable(<GameTable seed={2} pace={0} level="shark" />);
    for (let i = 0; i < 600 && !screen.queryByTestId('table-result'); i++) {
      const pass = screen.queryByTestId('table-pass');
      if (pass && disabled(pass)) {
        const picks = screen.getAllByTestId(/^table-rack-tile-\d+$/).filter((t) => !disabled(t));
        for (const t of picks.slice(0, 3)) await fireEvent.press(t);
      }
      for (const id of ['table-pass', 'table-vote-stop', 'table-offer-0', 'table-mahjongg', 'table-call-mahjongg']) {
        const button = screen.queryByTestId(id);
        if (button && !disabled(button)) await fireEvent.press(button);
      }
      if (screen.queryByText('Your turn') && !screen.queryByTestId('table-discard')) {
        const tiles = screen.getAllByTestId(/^table-rack-tile-\d+$/).filter((t) => !/Joker/.test(t.props.accessibilityLabel));
        await fireEvent.press(tiles[tiles.length - 1]);
      }
      const discard = screen.queryByTestId('table-discard');
      if (discard) await fireEvent.press(discard);
      await tick();
    }
    expect(screen.getByTestId('table-result')).toBeTruthy();
    const finished = jest.mocked(track).mock.calls.filter(([name]) => name === 'game_finished');
    expect(finished).toHaveLength(1);
    expect(finished[0][1]).toMatchObject({ opponents: 'shark' });
  }, 60_000);
});
