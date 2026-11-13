import { useState } from 'react';
import { Pressable, StyleSheet, type PressableProps } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { minTouchTarget, radii, spacing, useTheme, type Theme } from '@/theme';

import { Text, type TextColor } from './Text';

/**
 * `ivory`, `outlineOnFelt` and `quietOnFelt` are for jade felt, where jade
 * text wouldn't read. They look the same in both schemes, like the felt:
 * `ivory` is the main action, finished like a tile face.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'ivory' | 'outlineOnFelt' | 'quietOnFelt';

export type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  variant?: ButtonVariant;
  /** Stretch to the width of the container. */
  block?: boolean;
};

/** A pointer resting on the button (web and iPad) sits between idle and pressed. */
export type ButtonState = 'idle' | 'hovered' | 'pressed';

const PRESS_SPRING = { damping: 18, stiffness: 420, mass: 0.6 };
const PRESSED_SCALE = 0.96;
const HOVER_SCALE = 1.02;

// A hovered fill is shaded with an inset wash rather than a new color, so
// every variant keeps its text contrast (the wash only deepens dark fills).
const HOVER_WASH_DARK = 'inset 0px 0px 0px 999px rgba(6, 30, 24, 0.10)';

export function variantStyles(variant: ButtonVariant, { colors, shadows }: Theme, state: ButtonState) {
  const pressed = state === 'pressed';
  const hovered = state === 'hovered';
  switch (variant) {
    case 'primary':
      return {
        container: {
          backgroundColor: pressed ? colors.primaryPressed : colors.primary,
          // Top highlight gives the fill a lacquered, slightly domed feel.
          boxShadow: [
            'inset 0px 1px 0px rgba(255, 255, 255, 0.18)',
            hovered ? HOVER_WASH_DARK : null,
            hovered ? shadows.medium : shadows.low,
          ]
            .filter(Boolean)
            .join(', '),
        },
        label: 'onPrimary' as TextColor,
      };
    case 'secondary':
      return {
        container: {
          backgroundColor: pressed || hovered ? colors.surfaceSunken : colors.surface,
          borderColor: hovered ? colors.primaryText : colors.border,
          borderWidth: StyleSheet.hairlineWidth * 2,
          boxShadow: shadows.low,
        },
        label: 'primaryText' as TextColor,
      };
    case 'quiet':
      return {
        container: {
          backgroundColor: pressed || hovered ? colors.surfaceSunken : 'transparent',
        },
        label: 'primaryText' as TextColor,
      };
    case 'ivory':
      return {
        container: {
          backgroundColor: pressed ? colors.tileEdge : colors.tileFace,
          boxShadow: `inset 0px -2px 0px ${colors.tileEdge}, ${hovered ? shadows.high : shadows.medium}`,
        },
        label: 'felt' as TextColor,
      };
    case 'outlineOnFelt':
      // A secondary action on the felt, the same in both schemes: an ivory
      // hairline on a faint wash, so it reads as a button without competing with `ivory`.
      return {
        container: {
          backgroundColor: pressed
            ? 'rgba(247, 241, 227, 0.16)'
            : hovered
              ? 'rgba(247, 241, 227, 0.10)'
              : 'rgba(247, 241, 227, 0.05)',
          borderColor: hovered ? 'rgba(247, 241, 227, 0.55)' : 'rgba(247, 241, 227, 0.32)',
          borderWidth: StyleSheet.hairlineWidth * 2,
        },
        label: 'onFelt' as TextColor,
      };
    case 'quietOnFelt':
      return {
        container: {
          backgroundColor: pressed
            ? 'rgba(247, 241, 227, 0.14)'
            : hovered
              ? 'rgba(247, 241, 227, 0.08)'
              : 'transparent',
        },
        label: 'onFelt' as TextColor,
      };
  }
}

/**
 * The app's button. Presses sink with a soft spring and a resting pointer
 * swells it slightly; with Reduce Motion on, the fill change carries the
 * feedback on its own. Keyboard focus gets the global ring (webStage.ts),
 * and Enter or Space activates it.
 */
export function Button({
  title,
  variant = 'primary',
  block = false,
  disabled,
  onPressIn,
  onPressOut,
  onHoverIn,
  onHoverOut,
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const scale = useSharedValue(1);
  // get()/set() rather than .value keeps the React Compiler happy.
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const settle = (to: number) => scale.set(reduceMotion ? 1 : withSpring(to, PRESS_SPRING));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={spacing.xs}
      onPressIn={(e) => {
        settle(PRESSED_SCALE);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        settle(hovered ? HOVER_SCALE : 1);
        onPressOut?.(e);
      }}
      onHoverIn={(e) => {
        setHovered(true);
        if (!disabled) settle(HOVER_SCALE);
        onHoverIn?.(e);
      }}
      onHoverOut={(e) => {
        setHovered(false);
        settle(1);
        onHoverOut?.(e);
      }}
      style={[styles.focusShape, block ? styles.block : styles.inline]}
      {...rest}
    >
      {({ pressed }) => {
        const state: ButtonState = pressed ? 'pressed' : hovered && !disabled ? 'hovered' : 'idle';
        const v = variantStyles(variant, theme, state);
        return (
          <Animated.View
            style={[styles.base, v.container, disabled && styles.disabled, animatedStyle]}
          >
            <Text variant="button" color={v.label} numberOfLines={2} align="center">
              {title}
            </Text>
          </Animated.View>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The pressable is what takes keyboard focus; rounding it lets the web
  // focus ring follow the pill instead of drawing a box around it.
  focusShape: { borderRadius: radii.pill },
  inline: { alignSelf: 'flex-start' },
  block: { alignSelf: 'stretch' },
  base: {
    minHeight: minTouchTarget + spacing.xs,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
  },
  disabled: { opacity: 0.45 },
});
