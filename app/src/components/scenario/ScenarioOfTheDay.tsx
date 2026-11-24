import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { Tile } from '@/components/tile/Tile';
import { stageInfo, type Scenario } from '@/game/scenarios';
import type { ScenarioRecord } from '@/state/scenarioProgress';
import { radii, spacing, useTheme } from '@/theme';

type Props = {
  scenario: Scenario;
  /** The player's record on it, if they've ever finished it. */
  record?: ScenarioRecord;
  onOpen: (scenario: Scenario) => void;
};

/** A small sun over the horizon: today's pick. */
function SunMark() {
  const { colors } = useTheme();
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      <Path
        d="M4 17h16M7 17a5 5 0 0 1 10 0M12 4v3M5.6 7.6l2 2M18.4 7.6l-2 2"
        fill="none"
        stroke={colors.gold}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/**
 * The scenario of the day on the Train tab: one moment, the same for everyone
 * on a given date, with its tile raised on a little felt plinth.
 */
export function ScenarioOfTheDay({ scenario, record, onOpen }: Props) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  return (
    <Animated.View entering={reduceMotion ? undefined : FadeInDown.springify().damping(18)}>
      <Card elevation="medium" style={[styles.card, { borderColor: colors.gold }]} testID="scenario-of-the-day">
        <View style={styles.eyebrow}>
          <SunMark />
          <Text variant="eyebrow">Scenario of the day</Text>
        </View>
        <View style={styles.body}>
          <View style={[styles.plinth, { backgroundColor: colors.felt }]}>
            <Tile kind={scenario.icon} size="M" />
          </View>
          <View style={styles.text}>
            <Text variant="caption">{stageInfo(scenario.stage).title}</Text>
            <Text variant="title3">{scenario.title}</Text>
            <Text color="textMuted">{scenario.summary}</Text>
          </View>
        </View>
        <Button
          title={record ? 'Play it again' : 'Play today’s scenario'}
          variant={record ? 'secondary' : 'primary'}
          block
          onPress={() => onOpen(scenario)}
          accessibilityHint={`Opens “${scenario.title}”.${record ? ' You’ve finished this one before.' : ''}`}
          testID="scenario-of-the-day-play"
        />
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md, borderWidth: 1.5 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  body: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  plinth: {
    borderRadius: radii.md,
    borderCurve: 'continuous',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: spacing.xxs },
});
