import { Fragment, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { Tile } from '@/components/tile/Tile';
import { scenariosIn, STAGES, type Scenario } from '@/game/scenarios';
import type { ScenarioRecord } from '@/state/scenarioProgress';
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

/** A jade check in a ring: this scenario has been played through to its strategy. */
function Done() {
  const { colors } = useTheme();
  return (
    <View style={[styles.done, { backgroundColor: colors.primary }]} testID="scenario-done">
      <Svg width={14} height={14} viewBox="0 0 24 24">
        <Path d="M5 12.5l4.4 4.4L19 7.4" fill="none" stroke={colors.onPrimary} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

type RowProps = { scenario: Scenario; record?: ScenarioRecord; onOpen: (scenario: Scenario) => void };

function ScenarioRow({ scenario, record, onOpen }: RowProps) {
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
        accessibilityLabel={`${scenario.title}. ${scenario.summary}${record ? '. Finished' : ''}`}
        accessibilityHint={record ? 'Plays the scenario again.' : 'Opens the scenario.'}
        onPress={() => onOpen(scenario)}
        onPressIn={() => press(0.98)}
        onPressOut={() => press(1)}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        testID={`scenario-row-${scenario.id}`}
        style={({ pressed }) => [styles.row, { backgroundColor: pressed || hovered ? colors.surfaceSunken : 'transparent' }]}
      >
        <View style={styles.leading}>
          <Tile kind={scenario.icon} size="S" />
        </View>
        <View style={styles.text}>
          <Text variant="headline">{scenario.title}</Text>
          <Text variant="caption">{scenario.summary}</Text>
        </View>
        {record ? <Done /> : <Chevron />}
      </Pressable>
    </Animated.View>
  );
}

type ScenarioListProps = {
  completed: Readonly<Record<string, ScenarioRecord>>;
  onOpen: (scenario: Scenario) => void;
};

/** Every scenario, grouped by the stage of the game it happens in. */
export function ScenarioList({ completed, onOpen }: ScenarioListProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <Text variant="title3">Scenarios</Text>
        <Text variant="caption">Real moments at the table. Make the move, then learn the principle behind it.</Text>
      </View>
      {STAGES.map((stage) => {
        const scenarios = scenariosIn(stage.id);
        const done = scenarios.filter((s) => completed[s.id]).length;
        return (
          <View key={stage.id} style={styles.stage}>
            <View style={styles.stageHeading} accessible accessibilityRole="header" accessibilityLabel={`${stage.title}. ${stage.blurb} ${done} of ${scenarios.length} finished.`}>
              <View style={styles.stageTitles}>
                <Text variant="headline">{stage.title}</Text>
                <Text variant="caption">{stage.blurb}</Text>
              </View>
              <Text variant="caption" style={styles.tally}>
                {done}/{scenarios.length}
              </Text>
            </View>
            <Card elevation="low" style={styles.list}>
              {scenarios.map((scenario, i) => (
                <Fragment key={scenario.id}>
                  {i > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                  <ScenarioRow scenario={scenario} record={completed[scenario.id]} onOpen={onOpen} />
                </Fragment>
              ))}
            </Card>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.lg, marginTop: spacing.md },
  heading: { gap: spacing.xxs },
  stage: { gap: spacing.sm },
  stageHeading: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md, paddingHorizontal: spacing.xs },
  stageTitles: { flex: 1, gap: spacing.xxs },
  tally: { fontVariant: ['tabular-nums'] },
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
  done: { width: 24, height: 24, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
});
