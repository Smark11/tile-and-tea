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
 * `ivory` and `quietOnFelt` are for jade felt, where jade text wouldn't read:
 * `ivory` is the main action, finished like a tile face in both schemes.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'ivory' | 'quietOnFelt';

export type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  variant?: ButtonVariant;
  /** Stretch to the width of the container. */
  block?: boolean;
};

const PRESS_SPRING = { damping: 18, stiffness: 420, mass: 0.6 };

function variantStyles(variant: ButtonVariant, { colors, shadows }: Theme, pressed: boolean) {
  switch (variant) {
    case 'primary':
      return {
        container: {
          backgroundColor: pressed ? colors.primaryPressed : colors.primary,
          // Top highlight gives the fill a lacquered, slightly domed feel.
          boxShadow: `inset 0px 1px 0px rgba(255, 255, 255, 0.18), ${shadows.low}`,
        },
        label: 'onPrimary' as TextColor,
      };
    case 'secondary':
      return {
        container: {
          backgroundColor: pressed ? colors.surfaceSunken : colors.surface,
          borderColor: colors.border,
          borderWidth: StyleSheet.hairlineWidth * 2,
          boxShadow: shadows.low,
        },
        label: 'primaryText' as TextColor,
      };
    case 'quiet':
      return {
        container: { backgroundColor: pressed ? colors.surfaceSunken : 'transparent' },
        label: 'primaryText' as TextColor,
      };
    case 'ivory':
      return {
        container: {
          backgroundColor: pressed ? colors.tileEdge : colors.tileFace,
          boxShadow: `inset 0px -2px 0px ${colors.tileEdge}, ${shadows.medium}`,
        },
        label: 'felt' as TextColor,
      };
    case 'quietOnFelt':
      return {
        container: { backgroundColor: pressed ? 'rgba(247, 241, 227, 0.10)' : 'transparent' },
        label: 'onFelt' as TextColor,
      };
  }
}

/**
 * The app's button. Presses sink with a soft spring; with Reduce Motion on,
 * the fill color change carries the feedback on its own.
 */
export function Button({
  title,
  variant = 'primary',
  block = false,
  disabled,
  onPressIn,
  onPressOut,
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  // get()/set() rather than .value keeps the React Compiler happy.
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={spacing.xs}
      onPressIn={(e) => {
        if (!reduceMotion) scale.set(withSpring(0.96, PRESS_SPRING));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withSpring(1, PRESS_SPRING));
        onPressOut?.(e);
      }}
      style={block ? styles.block : styles.inline}
      {...rest}
    >
      {({ pressed }) => {
        const v = variantStyles(variant, theme, pressed);
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
