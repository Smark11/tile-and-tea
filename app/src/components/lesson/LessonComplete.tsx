import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { Tile } from '@/components/tile/Tile';
import type { Lesson, LessonScore } from '@/game/lessons';
import type { TileKind } from '@/game/tiles';
import { spacing } from '@/theme';

import { leaveLesson } from './leaveLesson';

const FAN: readonly { kind: TileKind; rotate: number; lift: number }[] = [
  { kind: { type: 'suited', suit: 'bam', rank: 1 }, rotate: -16, lift: 22 },
  { kind: { type: 'dragon', dragon: 'red' }, rotate: -6, lift: 4 },
  { kind: { type: 'joker' }, rotate: 6, lift: 4 },
  { kind: { type: 'suited', suit: 'dot', rank: 5 }, rotate: 16, lift: 22 },
];
const FAN_SPRING = { damping: 13, stiffness: 140, mass: 0.8 };
const STAGGER_MS = 90;

/** One tile of the celebration fan, springing up from below into its place. */
function FanTile({ kind, rotate, lift, index }: (typeof FAN)[number] & { index: number }) {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (!reduceMotion) t.set(withDelay(index * STAGGER_MS, withSpring(1, FAN_SPRING)));
  }, [index, reduceMotion, t]);
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, t.get() * 1.4),
    transform: [{ translateY: lift + (1 - t.get()) * 60 }, { rotate: `${rotate * t.get()}deg` }],
  }));
  return (
    <Animated.View style={[styles.fanTile, style]}>
      <Tile kind={kind} width={68} />
    </Animated.View>
  );
}

/** Specific, warm words for the score. Never a grade. */
export function scoreLine({ firstTry, questions }: LessonScore): string {
  if (questions === 0) return 'You worked through every step.';
  if (firstTry === questions) {
    return questions === 1
      ? 'You got the question right on the first try.'
      : `You got all ${questions} questions right on the first try.`;
  }
  return `You got ${firstTry} of ${questions} questions on the first try, and worked out the rest.`;
}

type LessonCompleteProps = {
  lesson: Lesson;
  score: LessonScore;
  onReplay: () => void;
};

export function LessonComplete({ lesson, score, onReplay }: LessonCompleteProps) {
  return (
    <View style={styles.root} testID="lesson-complete">
      <Card tone="felt" elevation="high" style={styles.hero}>
        <View
          style={styles.fan}
          accessible
          accessibilityRole="image"
          accessibilityLabel="A fan of tiles: a bamboo bird, a red dragon, a joker, and a dot"
        >
          {FAN.map((tile, i) => (
            <FanTile key={i} index={i} {...tile} />
          ))}
        </View>
        <Text variant="eyebrow" color="onFeltMuted" align="center">
          Lesson complete
        </Text>
        <Text variant="title1" color="onFelt" align="center">
          {lesson.title}
        </Text>
        <Text color="onFeltMuted" align="center">
          {scoreLine(score)}
        </Text>
      </Card>
      <View style={styles.actions}>
        <Button title="Back to lessons" block onPress={leaveLesson} />
        <Button title="Go through it again" variant="quiet" block onPress={onReplay} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.xl },
  hero: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.xxl, paddingBottom: spacing.xxl },
  fan: { flexDirection: 'row', justifyContent: 'center', marginBottom: spacing.xl, height: 120 },
  fanTile: { marginHorizontal: -spacing.xs },
  actions: { gap: spacing.sm },
});
