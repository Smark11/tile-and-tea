import { memo, useCallback, useEffect, useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type AccessibilityActionInfo,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { hapticLift, hapticTick } from '@/components/haptics';
import { tileA11yLabel, type TileKind } from '@/game/tiles';
import { minTouchTarget, tileInks } from '@/theme';

import { TILE_VIEWBOX, TileFace } from './TileFace';

export type TileSize = 'S' | 'M' | 'L';

/**
 * Tile widths in points. S is for discards and exposures (display only; too
 * small to be a primary tap target), M for the rack, L for lessons.
 */
export const TILE_WIDTHS: Record<TileSize, number> = { S: 30, M: 44, L: 64 };

export function tileDimensions(size: TileSize | number) {
  const width = typeof size === 'number' ? size : TILE_WIDTHS[size];
  return { width, height: Math.round((width * TILE_VIEWBOX.height) / TILE_VIEWBOX.width) };
}

export type TileProps = {
  kind: TileKind;
  /** Which physical copy; varies the art for the eight flowers. */
  copy?: number;
  size?: TileSize;
  /** Exact width in points, overriding `size`; the rack fits tiles to the screen. */
  width?: number;
  /** Raised with a gold ring, as when picked to pass or discard. */
  selected?: boolean;
  /** Suggested by the coach: soft jade glow plus a star badge. */
  hint?: boolean;
  /** Dimmed and not pressable, e.g. a joker you can't pass. */
  disabled?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Extra screen-reader actions, e.g. "Move left" on a rack tile. */
  accessibilityActions?: readonly AccessibilityActionInfo[];
  onAccessibilityAction?: (event: AccessibilityActionEvent) => void;
  /** Read after the name, e.g. why a disabled tile can't be picked. */
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const PRESS_SPRING = { damping: 14, stiffness: 380, mass: 0.6 };
const RAISE_SPRING = { damping: 16, stiffness: 260, mass: 0.8 };
const GLOW_PULSE_MS = 1200;
/** How far toward a full press a hovered tile lifts (0–1). */
const HOVER_LIFT = 0.45;

/** Spoken label: the tile's name, plus its coaching state. */
export function tileAccessibilityLabel(kind: TileKind, hint = false): string {
  return hint ? `${tileA11yLabel(kind)}, suggested` : tileA11yLabel(kind);
}

function HintBadge({ size }: { size: number }) {
  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size / 2 }]}>
      <Svg width={size * 0.62} height={size * 0.62} viewBox="0 0 20 20">
        <Path d="M10 1 L12.4 7.6 L19 10 L12.4 12.4 L10 19 L7.6 12.4 L1 10 L7.6 7.6 Z" fill="#FFFFFF" />
      </Svg>
    </View>
  );
}

/**
 * A mahjong tile. It lifts and tilts under a finger, rises when selected,
 * and ticks with a light haptic on press. With Reduce Motion on, the press
 * tilt and hint pulse are dropped and selection rises without a spring.
 */
export const Tile = memo(function Tile({
  kind,
  copy = 0,
  size = 'M',
  width: widthOverride,
  selected = false,
  hint = false,
  disabled = false,
  onPress,
  onLongPress,
  accessibilityActions,
  onAccessibilityAction,
  accessibilityHint,
  style,
  testID,
}: TileProps) {
  const reduceMotion = useReducedMotion();
  const { width, height } = tileDimensions(widthOverride ?? size);
  const radius = width * 0.14;
  const interactive = !!(onPress || onLongPress);

  const press = useSharedValue(0);
  const raised = useSharedValue(selected ? 1 : 0);
  const glow = useSharedValue(hint ? 1 : 0);

  useEffect(() => {
    const target = selected ? 1 : 0;
    raised.set(reduceMotion ? target : withSpring(target, RAISE_SPRING));
  }, [selected, reduceMotion, raised]);

  useEffect(() => {
    if (!hint) {
      glow.set(0);
      return;
    }
    if (reduceMotion) {
      glow.set(1);
      return;
    }
    const ease = { duration: GLOW_PULSE_MS, easing: Easing.inOut(Easing.sin) };
    glow.set(withRepeat(withSequence(withTiming(1, ease), withTiming(0.45, ease)), -1));
    return () => cancelAnimation(glow);
  }, [hint, reduceMotion, glow]);

  const raiseBy = height * 0.16;
  const pressBy = height * 0.06;
  const bodyStyle = useAnimatedStyle(() => {
    const p = press.get();
    return {
      transform: [
        { translateY: -(raised.get() * raiseBy + p * pressBy) },
        { rotate: `${p * -2.5}deg` },
        { scale: 1 + p * 0.04 },
      ],
    };
  });
  // The ground shadow stays put and spreads as the tile leaves the table.
  const liftShadowStyle = useAnimatedStyle(() => ({
    opacity: Math.max(press.get(), raised.get()),
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.get() }));

  const verticalSlop = Math.max(0, (minTouchTarget - height) / 2);

  // A pointer resting on a tile (web, iPad) lifts it part way, as if a finger
  // were about to take it. Pressing goes the rest of the way.
  const hovered = useRef(false);
  const handlePressIn = useCallback(() => {
    if (!reduceMotion) press.set(withSpring(1, PRESS_SPRING));
  }, [reduceMotion, press]);
  const handlePressOut = useCallback(
    () => press.set(withSpring(hovered.current && !reduceMotion ? HOVER_LIFT : 0, PRESS_SPRING)),
    [reduceMotion, press],
  );
  const handleHoverIn = useCallback(() => {
    hovered.current = true;
    if (!reduceMotion && !disabled) press.set(withSpring(HOVER_LIFT, PRESS_SPRING));
  }, [reduceMotion, disabled, press]);
  const handleHoverOut = useCallback(() => {
    hovered.current = false;
    press.set(withSpring(0, PRESS_SPRING));
  }, [press]);
  const handlePress = useCallback(() => {
    hapticTick();
    onPress?.();
  }, [onPress]);
  // A long press (e.g. "explain this tile") lands a little heavier than a tap.
  const handleLongPress = useCallback(() => {
    hapticLift();
    onLongPress?.();
  }, [onLongPress]);

  return (
    <Pressable
      testID={testID}
      accessible
      accessibilityRole={interactive ? 'button' : 'image'}
      accessibilityLabel={tileAccessibilityLabel(kind, hint)}
      accessibilityHint={accessibilityHint}
      accessibilityState={interactive ? { selected, disabled } : undefined}
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={onAccessibilityAction}
      // Pressable folds any non-null `disabled` into accessibilityState, so a
      // display-only tile must leave it unset or VoiceOver reads it as
      // "dimmed". With no handlers, presses already do nothing.
      disabled={interactive ? disabled : undefined}
      hitSlop={{ top: verticalSlop, bottom: verticalSlop }}
      onPressIn={interactive ? handlePressIn : undefined}
      onPressOut={interactive ? handlePressOut : undefined}
      onHoverIn={interactive ? handleHoverIn : undefined}
      onHoverOut={interactive ? handleHoverOut : undefined}
      onPress={onPress && handlePress}
      onLongPress={onLongPress && handleLongPress}
      // Rounded so the web keyboard focus ring hugs the tile.
      style={[{ width, height, borderRadius: radius }, style]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: radius, boxShadow: '0px 10px 18px rgba(8, 28, 22, 0.32)' },
          liftShadowStyle,
        ]}
      />
      <Animated.View style={[{ width, height }, disabled && styles.disabled, bodyStyle]}>
        <View
          style={{
            borderRadius: radius,
            boxShadow: '0px 1px 1px rgba(8, 28, 22, 0.28), 0px 3px 6px rgba(8, 28, 22, 0.18)',
          }}
        >
          <TileFace kind={kind} copy={copy} width={width} height={height} />
        </View>
        {hint && (
          <Animated.View
            testID={testID && `${testID}-hint-ring`}
            pointerEvents="none"
            style={[
              styles.ring,
              {
                borderRadius: radius,
                borderColor: tileInks.hintGlow,
                boxShadow: `0px 0px 12px ${tileInks.hintGlow}`,
              },
              glowStyle,
            ]}
          />
        )}
        {selected && (
          <View
            testID={testID && `${testID}-select-ring`}
            pointerEvents="none"
            style={[
              styles.selectRing,
              // Inside the coach's ring when a tile carries both.
              hint && styles.selectRingInner,
              {
                borderRadius: hint ? radius - RING_WIDTH : radius,
                borderColor: tileInks.selectRing,
                boxShadow: `inset 0px 0px 6px rgba(201, 162, 75, 0.6), 0px 0px 8px rgba(201, 162, 75, 0.45)`,
              },
            ]}
          />
        )}
        {hint && (
          <View pointerEvents="none" style={[styles.badgeAnchor, { top: -width * 0.16, right: -width * 0.16 }]}>
            <HintBadge size={Math.max(14, width * 0.36)} />
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
});

const RING_WIDTH = 2.5;

// Both rings sit on the tile itself, never past its edge: tiles in a set
// nearly touch, and rings drawn outside would run into their neighbours'.
const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: RING_WIDTH,
    borderCurve: 'continuous',
  },
  selectRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 3,
    borderCurve: 'continuous',
  },
  selectRingInner: { top: RING_WIDTH, left: RING_WIDTH, right: RING_WIDTH, bottom: RING_WIDTH },
  disabled: { opacity: 0.4 },
  badgeAnchor: { position: 'absolute' },
  badge: {
    backgroundColor: tileInks.green,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    boxShadow: '0px 1px 3px rgba(8, 28, 22, 0.35)',
  },
});
