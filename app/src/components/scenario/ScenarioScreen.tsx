import { router, useLocalSearchParams } from 'expo-router';
import { useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { SCENARIO_STEPS, scenarioById, type ScenarioStep } from '@/game/scenarios';
import { spacing, useTheme } from '@/theme';

import { ScenarioPlayer } from './ScenarioPlayer';

const noopSubscribe = () => () => {};

/** A `?step=` from the URL: open on the move, or on the strategy with the taught move made. */
export function parseStep(raw: string | string[] | undefined): ScenarioStep {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return SCENARIO_STEPS.find((s) => s === value) ?? 'scene';
}

/** The /scenario/[id] screen: finds the scenario, then plays it. */
export function ScenarioScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ id: string; step?: string }>();
  const scenario = scenarioById(params.id);
  const step = parseStep(params.step);
  // The static web page renders the background only; the player's saved
  // ratings and the step query are read once the page is live.
  const live = useSyncExternalStore(noopSubscribe, () => true, () => false);

  if (!scenario) {
    return (
      <Screen>
        <View style={styles.missing}>
          <Text variant="eyebrow">Train</Text>
          <Text variant="title1">We couldn’t find that scenario</Text>
          <Text color="textMuted">It may have moved. The other scenarios are waiting on the Train tab.</Text>
          <Button title="Back to Train" onPress={() => router.replace('/train')} />
        </View>
      </Screen>
    );
  }
  if (!live) return <View style={[styles.fill, { backgroundColor: colors.background }]} />;
  // Keyed so moving to the next scenario starts it fresh.
  return <ScenarioPlayer key={`${scenario.id}-${step}`} scenario={scenario} step={step} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  missing: { gap: spacing.lg, paddingTop: spacing.xxl },
});
