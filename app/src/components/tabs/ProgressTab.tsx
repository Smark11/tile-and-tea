import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/Card';
import { SkillMeters, type SkillMeterItem } from '@/components/progress/SkillMeters';
import { FeltHero } from '@/components/shell/Preview';
import { TabScreen } from '@/components/shell/TabScreen';
import { Text } from '@/components/Text';
import { DRILLS, drillForSkill, drillPath, SKILLS, START_RATING, type AnyDrill } from '@/game/drills';
import type { TileKind } from '@/game/tiles';
import { useDrillProgress } from '@/state/drillProgress';
import { spacing } from '@/theme';

// One, two, three: a run that builds, like progress.
const HERO_TILES: readonly TileKind[] = [
  { type: 'suited', suit: 'dot', rank: 1 },
  { type: 'suited', suit: 'dot', rank: 2 },
  { type: 'suited', suit: 'dot', rank: 3 },
];

// Streaks, lessons and games aren't counted yet, so these start at zero.
const STATS = [
  { value: 0, label: 'Day streak' },
  { value: 0, label: 'Lessons' },
  { value: 0, label: 'Games' },
] as const;

const openDrill = (drill: AnyDrill) => router.push(drillPath(drill.id));

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <Card elevation="low" style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text variant="title1" color="primaryText" align="center">
        {value}
      </Text>
      <Text variant="caption" align="center" numberOfLines={2}>
        {label}
      </Text>
    </Card>
  );
}

export function ProgressTab() {
  const ratings = useDrillProgress((s) => s.ratings);
  const items = useMemo<SkillMeterItem[]>(
    () =>
      SKILLS.flatMap((skill) => {
        const drill = drillForSkill(skill.id);
        return drill ? [{ skill, rating: ratings[skill.id], drill }] : [];
      }),
    [ratings],
  );
  const rated = items.some((item) => item.rating);
  const first = DRILLS[0];

  return (
    <TabScreen eyebrow="Progress" title="Your progress">
      <View style={styles.stats}>
        {STATS.map((s) => (
          <Stat key={s.label} value={s.value} label={s.label} />
        ))}
      </View>
      {!rated && (
        <FeltHero
          tiles={HERO_TILES}
          tilesLabel="One, Two, and Three of Dots"
          title="Your story starts here"
          body="Every drill answer moves a skill rating. Play a round and watch your first meter fill."
          action={{ title: `Start: ${first.title}`, onPress: () => openDrill(first) }}
        />
      )}
      <View style={styles.section}>
        <Text variant="title3" accessibilityRole="header">
          Your skills
        </Text>
        <SkillMeters items={items} onOpen={openDrill} />
        <Text variant="caption" style={styles.note}>
          Ratings start at {START_RATING} and move with every drill answer. A strong answer on a harder drill counts for more,
          and once a skill settles, one rough round only nudges it.
        </Text>
      </View>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: spacing.md },
  stat: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.lg,
    gap: spacing.xxs,
    alignItems: 'center',
  },
  section: { gap: spacing.md, marginTop: spacing.md },
  note: { paddingHorizontal: spacing.xs },
});
