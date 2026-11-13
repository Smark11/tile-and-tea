import { router, useLocalSearchParams } from 'expo-router';
import { useState, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { drillById } from '@/game/drills';
import { spacing, useTheme } from '@/theme';

import { DrillPlayer, randomSeed } from './DrillPlayer';

const noopSubscribe = () => () => {};

/** A `?seed=` from the URL, so a round can be replayed or shared exactly. */
export function parseSeed(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !/^\d{1,10}$/.test(value)) return null;
  const n = Number(value);
  return n <= 0xffffffff ? n : null;
}

/** The /drill/[id] screen: finds the drill, picks the round's seed, then plays it. */
export function DrillScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ id: string; seed?: string }>();
  const drill = drillById(params.id);
  const linked = parseSeed(params.seed);
  const [seed] = useState(() => linked ?? randomSeed());
  // The static web page can't know the random deal, so it renders the
  // background only, and the round appears once the page is live.
  const live = useSyncExternalStore(noopSubscribe, () => true, () => false);

  if (!drill) {
    return (
      <Screen>
        <View style={styles.missing}>
          <Text variant="eyebrow">Train</Text>
          <Text variant="title1">We couldn’t find that drill</Text>
          <Text color="textMuted">It may have moved. The other drills are waiting on the Train tab.</Text>
          <Button title="Back to Train" onPress={() => router.replace('/train')} />
        </View>
      </Screen>
    );
  }
  if (!live) return <View style={[styles.fill, { backgroundColor: colors.background }]} />;
  // Keyed so a new drill or a new linked seed starts a fresh round.
  return <DrillPlayer key={`${drill.id}-${seed}`} drill={drill} seed={seed} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  missing: { gap: spacing.lg, paddingTop: spacing.xxl },
});
