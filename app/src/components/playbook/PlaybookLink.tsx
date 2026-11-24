import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import type { PlaybookSource } from '@/analytics/events';
import { hapticTick } from '@/components/haptics';
import { Text } from '@/components/Text';
import { PRINCIPLES } from '@/game/playbook';
import { fontFamilies, minTouchTarget, radii, spacing, useTheme } from '@/theme';

import { usePlaybook } from './usePlaybook';

const PRESS_SPRING = { damping: 18, stiffness: 400, mass: 0.6 };

/** The tab a link to the playbook sits on; sent with `playbook_opened`. */
type LinkSource = Exclude<PlaybookSource, 'link'>;

/** The route that opens the playbook, tagged with where the player came from. */
export function playbookPath(from: LinkSource): `/playbook?from=${LinkSource}` {
  return `/playbook?from=${from}`;
}

function Chevron() {
  const { colors } = useTheme();
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path d="M9 5l7 7-7 7" fill="none" stroke={colors.textMuted} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/**
 * A card that opens the playbook, with the player's mastered count raised on
 * a small felt plinth. On the Train and Progress tabs.
 */
export function PlaybookLink({ from }: { from: LinkSource }) {
  const { colors, shadows } = useTheme();
  const { mastered } = usePlaybook();
  const reduceMotion = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const settle = (to: number) => scale.set(reduceMotion ? 1 : withSpring(to, PRESS_SPRING));
  const total = PRINCIPLES.length;
  const summary =
    mastered === 0
      ? `${total} principles that win games, and what teaches each one.`
      : `${mastered} of ${total} principles mastered. See what’s left to learn.`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Your playbook. ${summary}`}
      accessibilityHint="Opens the playbook."
      testID={`playbook-link-${from}`}
      onPress={() => {
        hapticTick();
        router.push(playbookPath(from));
      }}
      onPressIn={() => settle(0.98)}
      onPressOut={() => settle(hovered ? 1.01 : 1)}
      onHoverIn={() => {
        setHovered(true);
        settle(1.01);
      }}
      onHoverOut={() => {
        setHovered(false);
        settle(1);
      }}
      style={styles.focusShape}
    >
      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: hovered ? colors.gold : colors.border,
            boxShadow: hovered ? shadows.high : shadows.medium,
          },
          animatedStyle,
        ]}
      >
        <View style={[styles.plinth, { backgroundColor: colors.felt, borderColor: colors.feltInlay }]}>
          <Text style={[styles.count, { color: colors.onFelt }]} maxFontSizeMultiplier={1.3}>
            {mastered}
          </Text>
          <Text style={[styles.of, { color: colors.onFeltMuted }]} maxFontSizeMultiplier={1.3}>
            {`of ${total}`}
          </Text>
        </View>
        <View style={styles.text}>
          <Text variant="eyebrow" color="goldText">
            Playbook
          </Text>
          <Text variant="title3">Your winning playbook</Text>
          <Text variant="caption">{summary}</Text>
        </View>
        <Chevron />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  focusShape: { borderRadius: radii.lg },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth * 2,
    minHeight: minTouchTarget,
  },
  plinth: {
    width: 68,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: 'inset 0px 1px 0px rgba(247, 241, 227, 0.08)',
  },
  count: { fontFamily: fontFamilies.serif, fontSize: 30, lineHeight: 34, fontVariant: ['tabular-nums'] },
  of: { fontFamily: fontFamilies.serifItalic, fontSize: 14, lineHeight: 18 },
  text: { flex: 1, gap: spacing.xxs },
});
