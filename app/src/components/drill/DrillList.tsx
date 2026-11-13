import { Fragment, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { Tile } from '@/components/tile/Tile';
import type { AnyDrill } from '@/game/drills';
import { minTouchTarget, radii, spacing, useTheme } from '@/theme';

const PRESS_SPRING = { damping: 18, stiffness: 420, mass: 0.6 };

function Chevron() {
  const { colors } = useTheme();
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path d="M9 5l7 7-7 7" fill="none" stroke={colors.textMuted} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function DrillRow({ drill, onOpen }: { drill: AnyDrill; onOpen: (drill: AnyDrill) => void }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const press = (to: number) => {
    if (!reduceMotion) scale.set(withSpring(to, PRESS_SPRING));
  };
  return (
    <Animated.View style={style}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${drill.title}. ${drill.summary}`}
        accessibilityHint={`Starts a round of ${drill.questionsPerRound} questions.`}
        onPress={() => onOpen(drill)}
        onPressIn={() => press(0.98)}
        onPressOut={() => press(1)}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        testID={`drill-row-${drill.id}`}
        style={({ pressed }) => [
          styles.row,
          { backgroundColor: pressed || hovered ? colors.surfaceSunken : 'transparent' },
        ]}
      >
        <View style={styles.leading}>
          <Tile kind={drill.icon} size="S" />
        </View>
        <View style={styles.text}>
          <Text variant="headline">{drill.title}</Text>
          <Text variant="caption">{drill.summary}</Text>
        </View>
        <Chevron />
      </Pressable>
    </Animated.View>
  );
}

/** The drills ready to play, as a grouped list of tappable rows. */
export function DrillList({ drills, onOpen }: { drills: readonly AnyDrill[]; onOpen: (drill: AnyDrill) => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text variant="title3">Drills</Text>
      <Card elevation="low" style={styles.list}>
        {drills.map((drill, i) => (
          <Fragment key={drill.id}>
            {i > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
            <DrillRow drill={drill} onOpen={onOpen} />
          </Fragment>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md, marginTop: spacing.md },
  list: { paddingVertical: spacing.xs, paddingHorizontal: spacing.xs, gap: 0 },
  divider: { height: StyleSheet.hairlineWidth * 2, marginLeft: minTouchTarget + spacing.md + spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: minTouchTarget,
    borderRadius: radii.md,
  },
  leading: { width: minTouchTarget, alignItems: 'center' },
  text: { flex: 1, gap: spacing.xxs },
});
