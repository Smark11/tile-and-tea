import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { track } from '@/analytics';
import type { PlaybookSource } from '@/analytics/events';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { MASTERY_LEVEL, PRINCIPLES } from '@/game/playbook';
import { STAGES } from '@/game/scenarios';
import { spacing } from '@/theme';

import { MasteryPips } from './MasteryPips';
import { PrincipleCard } from './PrincipleCard';
import { usePlaybook } from './usePlaybook';

/** Where the player opened the playbook from, for `playbook_opened`. */
export function parseSource(raw: string | string[] | undefined): PlaybookSource {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === 'train' || value === 'progress' ? value : 'link';
}

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/train');
}

/** The playbook at /playbook: every principle of winning play, in the order a player meets them. */
export function PlaybookScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const reduceMotion = useReducedMotion();
  const { progress, mastered } = usePlaybook();
  const total = PRINCIPLES.length;

  useEffect(() => {
    track('playbook_opened', { from: parseSource(from) });
    // Once per visit; the query never changes on this screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  let shown = 0;
  return (
    <Screen>
      <View style={styles.titles}>
        <View style={styles.eyebrowRow}>
          <Text variant="eyebrow" style={styles.eyebrow}>
            Playbook
          </Text>
          <Button title="Back" variant="quiet" onPress={goBack} />
        </View>
        <Text variant="title1">Your winning playbook</Text>
      </View>
      <Text color="textMuted">
        Every principle the coach teaches, in the order you’ll meet them at the table. Each one is checked by the
        coach’s engine, and the ones our simulator could switch off were measured over thousands of games.
      </Text>

      <Card
        tone="felt"
        elevation="high"
        style={styles.hero}
        accessible
        accessibilityLabel={`${mastered} of ${total} principles mastered. A principle is mastered when you’ve made the best move in each of its scenarios, finished any lesson for it, and its skill reaches ${MASTERY_LEVEL.name}.`}
        testID="playbook-summary"
      >
        <View style={styles.heroCount}>
          <Text variant="display" color="onFelt" style={styles.tabular}>
            {mastered}
          </Text>
          <Text variant="callout" color="onFeltMuted">{`of ${total} mastered`}</Text>
        </View>
        <MasteryPips progress={progress} />
        <Text color="onFeltMuted">
          {`Master a principle by making the best move in each of its scenarios, finishing any lesson for it, and raising its skill to ${MASTERY_LEVEL.name}.`}
        </Text>
      </Card>

      {STAGES.map((stage) => {
        const items = progress.filter((p) => p.principle.stage === stage.id);
        const done = items.filter((p) => p.mastered).length;
        return (
          <View key={stage.id} style={styles.stage}>
            <View style={styles.stageHeading}>
              <Text variant="title3" style={styles.stageTitle}>
                {stage.title}
              </Text>
              <Text variant="caption" style={styles.tabular} accessibilityLabel={`${done} of ${items.length} mastered`}>
                {`${done}/${items.length}`}
              </Text>
            </View>
            {items.map((item) => {
              const delay = Math.min(shown++, 6) * 60;
              return (
                <Animated.View
                  key={item.principle.id}
                  entering={reduceMotion ? undefined : FadeInDown.delay(delay).springify().damping(18)}
                >
                  <PrincipleCard progress={item} />
                </Animated.View>
              );
            })}
          </View>
        );
      })}

      <Text variant="caption" align="center" style={styles.footnote}>
        Measured means our simulator played 2,000 games at each of our Beginner, Club and Shark bot tables with the
        principle on and off. Real tables may differ, and no principle guarantees a win: it tilts the odds your way.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  titles: { gap: spacing.xs },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: -spacing.sm },
  eyebrow: { flex: 1 },
  hero: { gap: spacing.md, paddingVertical: spacing.xl, marginTop: spacing.xs },
  heroCount: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  tabular: { fontVariant: ['tabular-nums'] },
  stage: { gap: spacing.md, marginTop: spacing.lg },
  stageHeading: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md, paddingHorizontal: spacing.xs },
  stageTitle: { flex: 1 },
  footnote: { marginTop: spacing.lg, paddingHorizontal: spacing.md },
});
