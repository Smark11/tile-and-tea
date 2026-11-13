import type { BottomTabBarProps } from 'expo-router/tabs';
import { memo, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { hapticTick } from '@/components/haptics';
import { Text } from '@/components/Text';
import { fontFamilies, minTouchTarget, radii, spacing, useTheme } from '@/theme';

import { NavIcon, type NavIconName } from './icons';

const SPRING = { damping: 16, stiffness: 260, mass: 0.7 };

// Tab labels stop growing here so four labels still fit side by side.
const LABEL_MAX_SCALE = 1.4;

type TabItemProps = {
  label: string;
  icon: NavIconName;
  focused: boolean;
  onPress: () => void;
  onLongPress: () => void;
};

const TabItem = memo(function TabItem({ label, icon, focused, onPress, onLongPress }: TabItemProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const active = useSharedValue(focused ? 1 : 0);
  const hover = useSharedValue(0);

  useEffect(() => {
    active.set(reduceMotion ? (focused ? 1 : 0) : withSpring(focused ? 1 : 0, SPRING));
  }, [focused, reduceMotion, active]);
  const setHover = (on: boolean) =>
    hover.set(reduceMotion ? (on ? 1 : 0) : withSpring(on ? 1 : 0, SPRING));

  // The jade pill swells in behind the active icon, and the icon rises a touch.
  // A resting pointer (web, iPad) brings in a fainter pill as a preview.
  const pillStyle = useAnimatedStyle(() => {
    const shown = Math.max(active.get(), 0.5 * hover.get());
    return { opacity: shown, transform: [{ scaleX: 0.55 + 0.45 * shown }] };
  });
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -1.5 * active.get() }],
  }));

  const tint = focused ? colors.primaryText : colors.textMuted;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      onPress={onPress}
      onLongPress={onLongPress}
      // React Native Web maps Enter to press for every role but Space only for
      // buttons, so a keyboard user's Space on a tab would do nothing.
      // The ARIA tabs pattern expects both keys to work.
      onKeyDown={(e) => {
        const key = (e as unknown as { key?: string }).key ?? e.nativeEvent?.key;
        if (key === ' ') {
          (e as unknown as { preventDefault?: () => void }).preventDefault?.();
          onPress();
        }
      }}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={styles.item}
    >
      <View style={styles.iconWell}>
        <Animated.View
          style={[styles.pill, { backgroundColor: colors.surfaceSunken }, pillStyle]}
        />
        <Animated.View style={iconStyle}>
          <NavIcon name={icon} color={tint} filled={focused} />
        </Animated.View>
      </View>
      <Text
        variant="caption"
        maxFontSizeMultiplier={LABEL_MAX_SCALE}
        numberOfLines={1}
        style={[styles.label, { color: tint }, focused && styles.labelActive]}
      >
        {label}
      </Text>
    </Pressable>
  );
});

/** Maps each tab route to its icon. Kept beside the bar that draws them. */
const ICONS: Record<string, NavIconName> = {
  index: 'learn',
  train: 'train',
  play: 'play',
  progress: 'progress',
};

/**
 * The Jade Parlor tab bar: an ivory (or lacquer) shelf with a gold inlay along
 * its top edge. Every tab has an icon and a text label, so the active state
 * reads by shape and weight as well as color.
 */
export function TabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const { colors, shadows } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.bar,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          boxShadow: shadows.medium,
          paddingBottom: Math.max(insets.bottom, spacing.sm),
          paddingLeft: insets.left + spacing.sm,
          paddingRight: insets.right + spacing.sm,
        },
      ]}
    >
      <View style={[styles.inlay, { backgroundColor: colors.feltInlay }]} />
      <View style={styles.row}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const label = options.title ?? route.name;
          const onPress = () => {
            const event = emitter.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              hapticTick();
              navigateToTab(route.key);
            }
          };
          const onLongPress = () => emitter.emit({ type: 'tabLongPress', target: route.key });
          return (
            <TabItem
              key={route.key}
              label={label}
              icon={ICONS[route.name] ?? 'learn'}
              focused={focused}
              onPress={onPress}
              onLongPress={onLongPress}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
  },
  inlay: {
    position: 'absolute',
    top: 0,
    left: spacing.xl,
    right: spacing.xl,
    height: 1,
  },
  row: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  item: {
    flex: 1,
    minHeight: minTouchTarget + spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
    // Rounds the web keyboard focus ring.
    borderRadius: radii.lg,
  },
  iconWell: {
    width: 64,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    ...StyleSheet.absoluteFill,
    borderRadius: radii.pill,
  },
  label: { fontSize: 13, lineHeight: 17 },
  labelActive: { fontFamily: fontFamilies.sansSemiBold },
});
