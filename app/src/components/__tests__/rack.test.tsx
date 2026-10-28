import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { GestureHandlerRootView, State } from 'react-native-gesture-handler';
import {
  createGestureController,
  fireGestureHandler,
  getByGestureTestId,
} from 'react-native-gesture-handler/jest-utils';

import { Rack, type RackProps } from '../rack/Rack';
import { rackLayout, slotOrigin } from '../rack/rackLayout';
import { moveTile, sortRack } from '@/game/rack';
import { createTileSet, tileA11yLabel, tileKey, type Tile } from '@/game/tiles';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

const SET = createTileSet();
const byKey = (key: string, copy = 0) => SET.find((t) => tileKey(t.kind) === key && t.copy === copy)!;

// The jest.setup.js stand-in, whose motion hooks are spies.
const Reanimated = jest.requireMock('react-native-reanimated') as Record<string, jest.Mock>;

// An unsorted 14-tile hand: Dots, a joker, Bams, a flower, Craks.
const HAND: Tile[] = [
  byKey('dot-5'),
  byKey('joker'),
  byKey('bam-3'),
  byKey('bam-3', 1),
  byKey('crak-7'),
  byKey('flower'),
  byKey('bam-1'),
  byKey('dot-2'),
  byKey('crak-1'),
  byKey('bam-9'),
  byKey('dot-5', 1),
  byKey('crak-7', 1),
  byKey('bam-4'),
  byKey('dot-8'),
];

const AREA_WIDTH = 321; // iPhone 15 content column minus the tray padding.

/** A parent that owns the order, as a real screen would. */
function Harness(props: Partial<RackProps> & { onOrder?: (tiles: Tile[]) => void }) {
  const [tiles, setTiles] = useState<readonly Tile[]>(props.tiles ?? HAND);
  return (
    <GestureHandlerRootView>
      <Rack
        {...props}
        tiles={tiles}
        onReorder={(next) => {
          props.onOrder?.(next);
          setTiles(next);
        }}
      />
    </GestureHandlerRootView>
  );
}

async function renderRack(props: Parameters<typeof Harness>[0] = {}) {
  await render(<Harness {...props} />);
  await fireEvent(screen.getByTestId('rack-area'), 'layout', {
    nativeEvent: { layout: { width: AREA_WIDTH, height: 0, x: 0, y: 0 } },
  });
}

/** Picks up `tile` with a sideways slide, carries it to [x, y] from where it started, and lets go. */
async function drag(tile: Tile, [x, y]: [number, number]) {
  await act(async () => {
    fireGestureHandler(getByGestureTestId(`rack-tile-${tile.id}-drag`), [
      { state: State.BEGAN, translationX: 0, translationY: 0 },
      { state: State.ACTIVE, translationX: 10, translationY: 0 },
      { translationX: x, translationY: y },
      { state: State.END, translationX: x, translationY: y },
    ]);
  });
}

/** The rendered tile for each of `tiles`, in the same order. */
function shownOrder(tiles: readonly Tile[]) {
  return tiles.map((t) => screen.getByTestId(`rack-tile-${t.id}`));
}

afterEach(() => jest.clearAllMocks());

describe('Rack', () => {
  it('waits for its width, then lays out every tile with its spoken name', async () => {
    await render(<Harness />);
    expect(screen.queryByTestId(`rack-tile-${HAND[0].id}`)).toBeNull();
    await fireEvent(screen.getByTestId('rack-area'), 'layout', {
      nativeEvent: { layout: { width: AREA_WIDTH, height: 0, x: 0, y: 0 } },
    });
    for (const tile of HAND) {
      expect(screen.getByTestId(`rack-tile-${tile.id}`)).toHaveAccessibleName(tileA11yLabel(tile.kind));
    }
    expect(screen.getAllByRole('image')).toHaveLength(HAND.length);
  });

  it('becomes tappable when it has a select handler, and reports the tapped tile', async () => {
    const onToggleSelect = jest.fn();
    await renderRack({ onToggleSelect, selectedIds: new Set([HAND[2].id]) });
    const buttons = screen.getAllByRole('button', { name: 'Three of Bamboo' });
    expect(buttons[0]).toBeSelected();
    expect(buttons[1]).not.toBeSelected();
    await fireEvent.press(screen.getByTestId(`rack-tile-${HAND[4].id}`));
    expect(onToggleSelect).toHaveBeenCalledWith(HAND[4]);
    expect(Haptics.selectionAsync).toHaveBeenCalled();
  });

  it('passes hint and disabled states through to the tiles', async () => {
    await renderRack({
      onToggleSelect: jest.fn(),
      hintIds: new Set([HAND[0].id]),
      disabledIds: new Set([HAND[1].id]),
    });
    expect(screen.getByRole('button', { name: 'Five of Dots, suggested' })).toBeOnTheScreen();
    expect(screen.getByTestId(`rack-tile-${HAND[1].id}`)).toBeDisabled();
  });

  it('sorts by suit, then shows that it is sorted', async () => {
    const onOrder = jest.fn();
    await renderRack({ onOrder });
    await fireEvent.press(screen.getByRole('button', { name: 'Sort by suit' }));
    expect(onOrder).toHaveBeenCalledWith(sortRack(HAND));
    expect(screen.getByRole('button', { name: 'Sorted by suit' })).toBeDisabled();
  });

  it('can hide the sort control', async () => {
    await renderRack({ showSort: false });
    expect(screen.queryByRole('button', { name: /sort/i })).toBeNull();
  });

  it('offers screen-reader Move left/right actions, only where a move is possible', async () => {
    await renderRack();
    const [first, second] = shownOrder(HAND);
    const last = shownOrder(HAND)[HAND.length - 1];
    const names = (el: ReturnType<typeof screen.getByTestId>) =>
      (el.props.accessibilityActions as { name: string }[]).map((a) => a.name);
    expect(names(first)).toEqual(['moveRight']);
    expect(names(second)).toEqual(['moveLeft', 'moveRight']);
    expect(names(last)).toEqual(['moveLeft']);
  });

  it('moves a tile one place when a screen-reader action asks', async () => {
    const onOrder = jest.fn();
    await renderRack({ onOrder });
    await fireEvent(screen.getByTestId(`rack-tile-${HAND[0].id}`), 'accessibilityAction', {
      nativeEvent: { actionName: 'moveRight' },
    });
    expect(onOrder).toHaveBeenLastCalledWith(moveTile(HAND, 0, 1));
    // The moved tile can now go back.
    await fireEvent(screen.getByTestId(`rack-tile-${HAND[0].id}`), 'accessibilityAction', {
      nativeEvent: { actionName: 'moveLeft' },
    });
    expect(onOrder).toHaveBeenLastCalledWith(HAND);
  });

  it('drops a dragged tile into the slot under it and reports the new order', async () => {
    const onOrder = jest.fn();
    await renderRack({ onOrder });
    const { pitchX, pitchY } = rackLayout(AREA_WIDTH, HAND.length);
    // Drag the first tile three slots right and down a tier: slot 10.
    await drag(HAND[0], [3 * pitchX, pitchY]);
    expect(onOrder).toHaveBeenCalledTimes(1);
    expect(onOrder).toHaveBeenCalledWith(moveTile(HAND, 0, 10));
    expect(Haptics.impactAsync).toHaveBeenCalled();
    expect(Haptics.selectionAsync).toHaveBeenCalled();
  });

  it('reports nothing when a drag ends where it started', async () => {
    const onOrder = jest.fn();
    await renderRack({ onOrder });
    await drag(HAND[3], [4, 0]);
    expect(onOrder).not.toHaveBeenCalled();
  });

  it('lets the next drag start from the new order', async () => {
    const onOrder = jest.fn();
    await renderRack({ onOrder });
    const { pitchX } = rackLayout(AREA_WIDTH, HAND.length);
    await drag(HAND[0], [2 * pitchX, 0]);
    const afterFirst = moveTile(HAND, 0, 2);
    expect(onOrder).toHaveBeenLastCalledWith(afterFirst);
    // HAND[0] now sits in slot 2; carry it back to the start.
    await drag(HAND[0], [-2 * pitchX, 0]);
    expect(onOrder).toHaveBeenLastCalledWith(HAND);
  });

  it('ignores a second finger mid-drag, and the first tile still drops', async () => {
    const onOrder = jest.fn();
    await renderRack({ onOrder });
    const { pitchX } = rackLayout(AREA_WIDTH, HAND.length);
    const first = createGestureController(getByGestureTestId(`rack-tile-${HAND[0].id}-drag`));
    const second = createGestureController(getByGestureTestId(`rack-tile-${HAND[5].id}-drag`));
    await act(async () => {
      first.begin({ translationX: 0, translationY: 0 });
      first.activate({ translationX: 10, translationY: 0 });
      // A stray touch lands on another tile and slides it too.
      second.begin({ translationX: 0, translationY: 0 });
      second.activate({ translationX: 10, translationY: 0 });
      second.update({ translationX: 3 * pitchX, translationY: 0 });
      first.update({ translationX: 2 * pitchX, translationY: 0 });
      first.end({ translationX: 2 * pitchX, translationY: 0 });
      second.end({ translationX: 3 * pitchX, translationY: 0 });
    });
    expect(onOrder).toHaveBeenCalledTimes(1);
    expect(onOrder).toHaveBeenCalledWith(moveTile(HAND, 0, 2));
    // Nothing is left lifted: the next drag works normally.
    await drag(HAND[5], [pitchX, 0]);
    expect(onOrder).toHaveBeenLastCalledWith(moveTile(moveTile(HAND, 0, 2), 5, 6));
  });

  it('glides a dropped tile back when the parent keeps the old order', async () => {
    const onReorder = jest.fn();
    await render(
      <GestureHandlerRootView>
        <Rack tiles={HAND} onReorder={onReorder} />
      </GestureHandlerRootView>,
    );
    await fireEvent(screen.getByTestId('rack-area'), 'layout', {
      nativeEvent: { layout: { width: AREA_WIDTH, height: 0, x: 0, y: 0 } },
    });
    const { pitchX } = rackLayout(AREA_WIDTH, HAND.length);
    await drag(HAND[0], [2 * pitchX, 0]);
    expect(onReorder).toHaveBeenLastCalledWith(moveTile(HAND, 0, 2));
    // Declined, so the tile is back in slot 0 and the same drag lands in slot 2 again.
    await drag(HAND[0], [2 * pitchX, 0]);
    expect(onReorder).toHaveBeenLastCalledWith(moveTile(HAND, 0, 2));
  });

  it('springs tiles to their new slots after a sort', async () => {
    await renderRack();
    Reanimated.withSpring.mockClear();
    await fireEvent.press(screen.getByRole('button', { name: 'Sort by suit' }));
    const layout = rackLayout(AREA_WIDTH, HAND.length);
    // Whichever tile sorts first glides into slot 0 from somewhere else.
    expect(HAND.indexOf(sortRack(HAND)[0])).toBeGreaterThan(0);
    expect(Reanimated.withSpring).toHaveBeenCalledWith(slotOrigin(layout, 0).x, expect.anything());
    expect(Reanimated.withSpring).toHaveBeenCalledWith(slotOrigin(layout, 0).y, expect.anything());
  });

  it('moves tiles without springs under Reduce Motion', async () => {
    Reanimated.useReducedMotion.mockReturnValue(true);
    try {
      const onOrder = jest.fn();
      await renderRack({ onOrder });
      const { pitchX } = rackLayout(AREA_WIDTH, HAND.length);
      await drag(HAND[1], [pitchX, 0]);
      expect(onOrder).toHaveBeenCalledWith(moveTile(HAND, 1, 2));
      expect(Reanimated.withSpring).not.toHaveBeenCalled();
    } finally {
      Reanimated.useReducedMotion.mockReturnValue(false);
    }
  });
});
