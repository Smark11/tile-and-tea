import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Button } from '@/components/Button';
import { hapticLift, hapticTick } from '@/components/haptics';
import { Tile } from '@/components/tile/Tile';
import { isRackSorted, moveTile, sortRack } from '@/game/rack';
import { type Tile as RackTileModel } from '@/game/tiles';
import { radii, spacing, tileInks } from '@/theme';

import { rackLayout, slotAt, slotOrigin, type RackLayout } from './rackLayout';

export type RackProps = {
  /** The tiles in the order the player has arranged them. */
  tiles: readonly RackTileModel[];
  /**
   * Called with the new order after a drag, a sort, or a screen-reader move.
   * The rack is controlled: pass the new order back in as `tiles`. If you
   * don't, a dragged tile glides back to its place in `tiles` when dropped.
   */
  onReorder: (tiles: RackTileModel[]) => void;
  /** Tap a tile to select it (e.g. to pass or discard). */
  onToggleSelect?: (tile: RackTileModel) => void;
  selectedIds?: ReadonlySet<number>;
  hintIds?: ReadonlySet<number>;
  disabledIds?: ReadonlySet<number>;
  /** Show the "Sort by suit" control above the rack (default true). */
  showSort?: boolean;
  testID?: string;
};

// Inner padding of the tray, around the tile area.
const TRAY_PADDING = spacing.md;
// Leave room above the top tier for a selected tile to rise into.
const TRAY_PADDING_TOP = spacing.lg;
const LEDGE_HEIGHT = 10;

const SLIDE_SPRING = { damping: 20, stiffness: 260, mass: 0.7 };
const LIFT_SPRING = { damping: 15, stiffness: 320, mass: 0.6 };
// How far a dragged tile may wander past the rack's edges.
const DRAG_SLACK = 12;
const NO_TILE = -1;

const EMPTY: ReadonlySet<number> = new Set();

const MOVE_ACTIONS = {
  left: { name: 'moveLeft', label: 'Move left' },
  right: { name: 'moveRight', label: 'Move right' },
} as const;

type RackTileProps = {
  tile: RackTileModel;
  /** Slot this tile starts in; afterwards `order` drives its position. */
  index: number;
  count: number;
  layout: RackLayout;
  order: SharedValue<number[]>;
  draggingId: SharedValue<number>;
  reduceMotion: boolean;
  selected: boolean;
  hint: boolean;
  disabled: boolean;
  onToggleSelect?: (tile: RackTileModel) => void;
  onMove: (id: number, delta: number) => void;
  onDrop: (order: number[]) => void;
  testID?: string;
};

const RackTile = memo(function RackTile({
  tile,
  index,
  count,
  layout,
  order,
  draggingId,
  reduceMotion,
  selected,
  hint,
  disabled,
  onToggleSelect,
  onMove,
  onDrop,
  testID,
}: RackTileProps) {
  const { id } = tile;
  const start = slotOrigin(layout, index);
  const x = useSharedValue(start.x);
  const y = useSharedValue(start.y);
  const lift = useSharedValue(0);
  const dragStart = useSharedValue({ x: 0, y: 0 });

  // Glide to whichever slot `order` gives this tile: after a sort, or when a
  // dragged neighbour pushes it aside. The tile being dragged follows the
  // finger instead. A new layout (rotation, resize) snaps without animating.
  useAnimatedReaction(
    () => order.get().indexOf(id),
    (slot, previous) => {
      if (slot < 0 || draggingId.get() === id) return;
      const target = slotOrigin(layout, slot);
      if (previous === null || reduceMotion) {
        x.set(target.x);
        y.set(target.y);
      } else if (slot !== previous) {
        x.set(withSpring(target.x, SLIDE_SPRING));
        y.set(withSpring(target.y, SLIDE_SPRING));
      }
    },
    [layout, reduceMotion],
  );

  const pan = usePanGesture({
    testID: testID && `${testID}-drag`,
    // A sideways slide starts a drag, so vertical swipes still scroll the page
    // and a plain tap still selects.
    activeOffsetX: [-8, 8],
    failOffsetY: [-16, 16],
    onActivate: () => {
      'worklet';
      // One tile at a time: a second finger can't lift another tile mid-drag.
      if (draggingId.get() !== NO_TILE) return;
      draggingId.set(id);
      dragStart.set({ x: x.get(), y: y.get() });
      lift.set(reduceMotion ? 1 : withSpring(1, LIFT_SPRING));
      scheduleOnRN(hapticLift);
    },
    onUpdate: (event) => {
      'worklet';
      if (draggingId.get() !== id) return;
      const origin = dragStart.get();
      const nx = Math.max(
        -DRAG_SLACK,
        Math.min(layout.width - layout.tileWidth + DRAG_SLACK, origin.x + event.translationX),
      );
      const ny = Math.max(
        -DRAG_SLACK,
        Math.min(layout.height - layout.tileHeight + DRAG_SLACK, origin.y + event.translationY),
      );
      x.set(nx);
      y.set(ny);
      const ids = order.get();
      const from = ids.indexOf(id);
      const to = slotAt(layout, ids.length, nx, ny);
      if (from >= 0 && to !== from) {
        order.set(moveTile(ids, from, to));
        scheduleOnRN(hapticTick);
      }
    },
    onFinalize: () => {
      'worklet';
      // Also runs for taps that never became drags; those have nothing to settle.
      if (draggingId.get() !== id) return;
      draggingId.set(NO_TILE);
      const target = slotOrigin(layout, Math.max(0, order.get().indexOf(id)));
      x.set(reduceMotion ? target.x : withSpring(target.x, SLIDE_SPRING));
      y.set(reduceMotion ? target.y : withSpring(target.y, SLIDE_SPRING));
      lift.set(reduceMotion ? 0 : withSpring(0, LIFT_SPRING));
      scheduleOnRN(hapticTick);
      scheduleOnRN(onDrop, order.get().slice());
    },
  });

  const positionStyle = useAnimatedStyle(() => {
    const l = lift.get();
    return {
      zIndex: draggingId.get() === id ? 2 : 1,
      transform: [
        { translateX: x.get() },
        { translateY: y.get() - l * 6 },
        { scale: 1 + l * 0.08 },
      ],
    };
  });
  // Under a lifted tile, a soft shadow spreads on the tray.
  const liftShadowStyle = useAnimatedStyle(() => ({ opacity: lift.get() }));

  const handlePress = useCallback(() => onToggleSelect?.(tile), [onToggleSelect, tile]);
  const handleAction = useCallback(
    (event: AccessibilityActionEvent) => {
      if (event.nativeEvent.actionName === MOVE_ACTIONS.left.name) onMove(id, -1);
      if (event.nativeEvent.actionName === MOVE_ACTIONS.right.name) onMove(id, 1);
    },
    [onMove, id],
  );
  const actions = useMemo(
    () => [
      ...(index > 0 ? [MOVE_ACTIONS.left] : []),
      ...(index < count - 1 ? [MOVE_ACTIONS.right] : []),
    ],
    [index, count],
  );

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[styles.slot, { width: layout.tileWidth, height: layout.tileHeight }, positionStyle]}
      >
        <Animated.View
          pointerEvents="none"
          style={[styles.liftShadow, { borderRadius: layout.tileWidth * 0.14 }, liftShadowStyle]}
        />
        <Tile
          kind={tile.kind}
          copy={tile.copy}
          width={layout.tileWidth}
          selected={selected}
          hint={hint}
          disabled={disabled}
          onPress={onToggleSelect && handlePress}
          accessibilityActions={actions}
          onAccessibilityAction={handleAction}
          testID={testID}
        />
      </Animated.View>
    </GestureDetector>
  );
});

/**
 * The player's rack. Tiles stand on a lacquered jade tray, one tier when the
 * screen is wide enough and two on a phone so every face stays readable.
 * Tap a tile to select it, slide it sideways to pick it up and drop it in a
 * new spot (its neighbours glide aside), or tap "Sort by suit". Screen-reader
 * users get "Move left" and "Move right" actions on each tile.
 */
export function Rack({
  tiles,
  onReorder,
  onToggleSelect,
  selectedIds = EMPTY,
  hintIds = EMPTY,
  disabledIds = EMPTY,
  showSort = true,
  testID = 'rack',
}: RackProps) {
  const reduceMotion = useReducedMotion();
  const [areaWidth, setAreaWidth] = useState(0);
  const layout = useMemo(() => rackLayout(areaWidth, tiles.length), [areaWidth, tiles.length]);

  // Tile ids in their current visual order. During a drag this runs ahead of
  // `tiles`; the drop hands it back through `onReorder`. Each drop also
  // re-syncs `order` with `tiles`, so if the parent declines the new order the
  // tiles glide back to where `tiles` says they are.
  const order = useSharedValue(tiles.map((t) => t.id));
  const draggingId = useSharedValue(NO_TILE);
  const [drops, setDrops] = useState(0);
  useEffect(() => {
    order.set(tiles.map((t) => t.id));
  }, [tiles, drops, order]);

  // The handlers read the latest props through a ref, so they keep one
  // identity and the memoized tiles don't re-render when only `tiles` changes.
  const latest = useRef({ tiles, onReorder });
  useLayoutEffect(() => {
    latest.current = { tiles, onReorder };
  });

  const sorted = isRackSorted(tiles);

  const handleDrop = useCallback((ids: number[]) => {
    const { tiles: current, onReorder: report } = latest.current;
    const byId = new Map(current.map((t) => [t.id, t]));
    const next = ids.map((id) => byId.get(id)).filter((t) => t !== undefined);
    const changed = next.length === current.length && next.some((t, i) => t !== current[i]);
    if (changed) report(next);
    setDrops((n) => n + 1);
  }, []);
  const handleMove = useCallback((id: number, delta: number) => {
    const { tiles: current, onReorder: report } = latest.current;
    const from = current.findIndex((t) => t.id === id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= current.length) return;
    hapticTick();
    report(moveTile(current, from, to));
  }, []);
  const handleSort = useCallback(() => {
    const { tiles: current, onReorder: report } = latest.current;
    hapticLift();
    report(sortRack(current));
  }, []);

  const onAreaLayout = useCallback((e: LayoutChangeEvent) => {
    setAreaWidth(Math.floor(e.nativeEvent.layout.width));
  }, []);

  const ledges = Array.from({ length: layout.rows }, (_, row) => row);

  return (
    <View style={styles.root} testID={testID}>
      {showSort && (
        <View style={styles.toolbar}>
          <Button
            title={sorted ? 'Sorted by suit' : 'Sort by suit'}
            variant="secondary"
            disabled={sorted}
            onPress={handleSort}
            testID={`${testID}-sort`}
          />
        </View>
      )}
      <View style={styles.tray}>
        <View
          testID={`${testID}-area`}
          onLayout={onAreaLayout}
          style={{ height: areaWidth > 0 ? layout.height : undefined }}
        >
          {areaWidth > 0 &&
            ledges.map((row) => (
              <View
                key={row}
                pointerEvents="none"
                style={[
                  styles.ledge,
                  {
                    top: row * layout.pitchY + layout.tileHeight - LEDGE_HEIGHT / 2,
                  },
                ]}
              />
            ))}
          {areaWidth > 0 && (
            <View style={[styles.tiles, { width: layout.width }]}>
              {tiles.map((tile, i) => (
                <RackTile
                  key={tile.id}
                  tile={tile}
                  index={i}
                  count={tiles.length}
                  layout={layout}
                  order={order}
                  draggingId={draggingId}
                  reduceMotion={reduceMotion}
                  selected={selectedIds.has(tile.id)}
                  hint={hintIds.has(tile.id)}
                  disabled={disabledIds.has(tile.id)}
                  onToggleSelect={onToggleSelect}
                  onMove={handleMove}
                  onDrop={handleDrop}
                  testID={`${testID}-tile-${tile.id}`}
                />
              ))}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  toolbar: { flexDirection: 'row', justifyContent: 'flex-end' },
  tiles: { alignSelf: 'center', height: '100%' },
  tray: {
    paddingTop: TRAY_PADDING_TOP,
    paddingBottom: TRAY_PADDING,
    paddingHorizontal: TRAY_PADDING,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    backgroundColor: tileInks.rackTray,
    borderWidth: 1,
    borderColor: tileInks.rackTrayInlay,
    // Sunken like a carved tray, with a warm drop below so it sits on the table.
    boxShadow:
      'inset 0px 3px 8px rgba(0, 0, 0, 0.45), inset 0px -1px 0px rgba(255, 255, 255, 0.06), 0px 8px 20px rgba(8, 28, 22, 0.35)',
  },
  ledge: {
    position: 'absolute',
    left: -spacing.xs,
    right: -spacing.xs,
    height: LEDGE_HEIGHT,
    borderRadius: LEDGE_HEIGHT / 2,
    backgroundColor: tileInks.rackLedge,
    borderTopWidth: 1,
    borderTopColor: tileInks.rackLedgeLight,
    borderBottomWidth: 1,
    borderBottomColor: tileInks.rackLedgeShade,
    boxShadow: '0px 3px 5px rgba(0, 0, 0, 0.35)',
  },
  slot: { position: 'absolute', left: 0, top: 0 },
  liftShadow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    boxShadow: '0px 14px 22px rgba(0, 0, 0, 0.45)',
  },
});
