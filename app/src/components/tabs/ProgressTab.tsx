import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/Card';
import { FeltHero, PreviewList, type PreviewItem } from '@/components/shell/Preview';
import { TabScreen } from '@/components/shell/TabScreen';
import { Text } from '@/components/Text';
import type { TileKind } from '@/game/tiles';
import { spacing } from '@/theme';

// One, two, three: a run that builds, like progress.
const HERO_TILES: readonly TileKind[] = [
  { type: 'suited', suit: 'dot', rank: 1 },
  { type: 'suited', suit: 'dot', rank: 2 },
  { type: 'suited', suit: 'dot', rank: 3 },
];

// Nothing is tracked yet, so every count starts at zero.
const STATS = [
  { value: 0, label: 'Day streak' },
  { value: 0, label: 'Lessons' },
  { value: 0, label: 'Games' },
] as const;

const SKILLS: readonly PreviewItem[] = [
  { title: 'Choosing a hand', detail: 'How quickly you spot the hand a rack wants to be.', tile: { type: 'joker' } },
  { title: 'The Charleston', detail: 'How well your passes keep good hands open.', tile: { type: 'wind', wind: 'W' } },
  { title: 'Safe discards', detail: 'How often you avoid feeding an opponent.', tile: { type: 'suited', suit: 'bam', rank: 4 } },
];

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
  return (
    <TabScreen eyebrow="Progress" title="Your progress">
      <View style={styles.stats}>
        {STATS.map((s) => (
          <Stat key={s.label} value={s.value} label={s.label} />
        ))}
      </View>
      <FeltHero
        tiles={HERO_TILES}
        tilesLabel="One, Two, and Three of Dots"
        title="Your story starts here"
        body="Finish a lesson or a drill, and your streak, skills, and game history will gather here."
      />
      <PreviewList heading="Skills we’ll track" items={SKILLS} />
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
});
