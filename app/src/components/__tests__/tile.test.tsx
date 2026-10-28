import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { StyleSheet } from 'react-native';

import { Tile, TILE_WIDTHS, tileAccessibilityLabel, tileDimensions } from '../tile/Tile';
import { ALL_KINDS, tileA11yLabel, type TileKind } from '@/game/tiles';
import { tileInks } from '@/theme';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

// The jest.setup.js stand-in, whose motion hooks are spies.
const Reanimated = jest.requireMock('react-native-reanimated') as Record<string, jest.Mock>;

const threeBam: TileKind = { type: 'suited', suit: 'bam', rank: 3 };

/** The jade hint ring around the tile rendered with testID "tile". */
function hintRings() {
  return screen.queryAllByTestId('tile-hint-ring');
}

afterEach(() => jest.clearAllMocks());

describe('Tile', () => {
  it('draws every kind and every flower print with its spoken name', async () => {
    await render(
      <>
        {ALL_KINDS.map((kind) => (
          <Tile key={JSON.stringify(kind)} kind={kind} />
        ))}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((copy) => (
          <Tile key={`f${copy}`} kind={{ type: 'flower' }} copy={copy} />
        ))}
      </>,
    );
    for (const kind of ALL_KINDS) {
      expect(screen.getAllByRole('image', { name: tileA11yLabel(kind) }).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByRole('image', { name: 'Flower' })).toHaveLength(9);
    expect(screen.getByRole('image', { name: 'White Dragon, Soap' })).toBeOnTheScreen();
  });

  it('is a static image when it has no handlers, not announced as dimmed', async () => {
    await render(<Tile kind={threeBam} />);
    const tile = screen.getByRole('image', { name: 'Three of Bamboo' });
    expect(tile).toBeOnTheScreen();
    expect(tile).not.toBeDisabled();
    expect(tile.props.accessibilityState?.disabled).toBeUndefined();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('presses with a haptic tick and reports selection', async () => {
    const onPress = jest.fn();
    await render(<Tile kind={threeBam} selected onPress={onPress} />);
    const tile = screen.getByRole('button', { name: 'Three of Bamboo' });
    expect(tile).toBeSelected();
    await fireEvent.press(tile);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  });

  it('ignores presses when disabled', async () => {
    const onPress = jest.fn();
    await render(<Tile kind={threeBam} disabled onPress={onPress} />);
    const tile = screen.getByRole('button', { name: 'Three of Bamboo' });
    await fireEvent.press(tile);
    expect(onPress).not.toHaveBeenCalled();
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
    expect(tile).toBeDisabled();
  });

  it('announces a coach hint in words, not just color', async () => {
    await render(<Tile kind={{ type: 'joker' }} hint onPress={() => {}} />);
    expect(screen.getByRole('button', { name: 'Joker, suggested' })).toBeOnTheScreen();
    expect(tileAccessibilityLabel(threeBam)).toBe('Three of Bamboo');
  });

  it('forwards long presses with a light impact', async () => {
    const onLongPress = jest.fn();
    await render(<Tile kind={threeBam} onLongPress={onLongPress} />);
    await fireEvent(screen.getByRole('button'), 'longPress');
    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
  });

  it('pulses the hint ring, and stops the pulse when the hint goes away', async () => {
    const { rerender } = await render(<Tile testID="tile" kind={threeBam} hint onPress={() => {}} />);
    expect(hintRings()).toHaveLength(1);
    expect(StyleSheet.flatten(hintRings()[0].props.style).borderColor).toBe(tileInks.hintGlow);
    expect(Reanimated.withRepeat).toHaveBeenCalled();

    await rerender(<Tile testID="tile" kind={threeBam} onPress={() => {}} />);
    expect(hintRings()).toHaveLength(0);
    expect(Reanimated.cancelAnimation).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Three of Bamboo' })).toBeOnTheScreen();
  });

  it('springs and tilts under a finger when motion is allowed', async () => {
    await render(<Tile kind={threeBam} onPress={() => {}} />);
    Reanimated.withSpring.mockClear();
    await fireEvent(screen.getByRole('button'), 'pressIn');
    expect(Reanimated.withSpring).toHaveBeenCalledWith(1, expect.anything());
  });

  describe('with Reduce Motion on', () => {
    beforeEach(() => Reanimated.useReducedMotion.mockReturnValue(true));
    afterEach(() => Reanimated.useReducedMotion.mockReturnValue(false));

    it('skips the press tilt and snaps the selection raise', async () => {
      await render(<Tile kind={threeBam} selected onPress={() => {}} />);
      await fireEvent(screen.getByRole('button'), 'pressIn');
      expect(Reanimated.withSpring).not.toHaveBeenCalled();
    });

    it('shows a steady hint glow instead of a pulse', async () => {
      await render(<Tile testID="tile" kind={threeBam} hint onPress={() => {}} />);
      expect(hintRings()).toHaveLength(1);
      expect(StyleSheet.flatten(hintRings()[0].props.style).opacity).toBe(1);
      expect(Reanimated.withRepeat).not.toHaveBeenCalled();
    });
  });
});

describe('tileDimensions', () => {
  it('keeps the tile proportions at every size, growing S → L', () => {
    const sizes = (['S', 'M', 'L'] as const).map(tileDimensions);
    for (const { width, height } of sizes) {
      expect(height / width).toBeCloseTo(1.4, 1);
    }
    expect(sizes.map((s) => s.width)).toEqual([TILE_WIDTHS.S, TILE_WIDTHS.M, TILE_WIDTHS.L]);
    expect(TILE_WIDTHS.S).toBeLessThan(TILE_WIDTHS.M);
    expect(TILE_WIDTHS.M).toBeLessThan(TILE_WIDTHS.L);
  });
});
