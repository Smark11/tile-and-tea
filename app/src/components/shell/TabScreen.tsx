import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { minTouchTarget, radii, spacing, useTheme } from '@/theme';

import { NavIcon } from './icons';

const PRESS_SPRING = { damping: 18, stiffness: 420, mass: 0.6 };

/** The round button in each tab's header that opens the settings sheet. */
export function SettingsButton() {
  const { colors, shadows } = useTheme();
  const reduceMotion = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const settle = (to: number) => scale.set(reduceMotion ? 1 : withSpring(to, PRESS_SPRING));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Settings"
      onPress={() => router.push('/settings')}
      onPressIn={() => settle(0.92)}
      onPressOut={() => settle(hovered ? 1.05 : 1)}
      onHoverIn={() => {
        setHovered(true);
        settle(1.05);
      }}
      onHoverOut={() => {
        setHovered(false);
        settle(1);
      }}
      hitSlop={spacing.xs}
      style={styles.focusShape}
    >
      {({ pressed }) => (
        <Animated.View
          style={[
            styles.settings,
            {
              backgroundColor: pressed || hovered ? colors.surfaceSunken : colors.surface,
              borderColor: hovered ? colors.primaryText : colors.border,
              boxShadow: hovered ? shadows.medium : shadows.low,
            },
            animatedStyle,
          ]}
        >
          <NavIcon name="settings" color={colors.primaryText} size={24} />
        </Animated.View>
      )}
    </Pressable>
  );
}

type TabScreenProps = {
  eyebrow: string;
  title: string;
  children: ReactNode;
};

/** The frame every tab shares: an eyebrow and serif title, with Settings to the right. */
export function TabScreen({ eyebrow, title, children }: TabScreenProps) {
  return (
    <Screen insetBottom={false}>
      <View style={styles.header}>
        <View style={styles.titles}>
          <Text variant="eyebrow">{eyebrow}</Text>
          <Text variant="title1">{title}</Text>
        </View>
        <SettingsButton />
      </View>
      {children}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
    marginBottom: spacing.xs,
  },
  titles: { flex: 1, gap: spacing.xs },
  focusShape: { borderRadius: radii.pill },
  settings: {
    width: minTouchTarget,
    height: minTouchTarget,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
