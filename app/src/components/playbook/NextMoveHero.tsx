import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion, ZoomIn } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { Tile } from '@/components/tile/Tile';
import type { NextMove } from '@/game/playbook/nextMove';
import { stageInfo } from '@/game/scenarios';
import { fontFamilies, radii, spacing, useTheme } from '@/theme';

/** A gold arrow toward a point: where to go next. */
function ArrowMark() {
  const { colors } = useTheme();
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      <Path
        d="M4 12h13M12 6l6 6-6 6"
        fill="none"
        stroke={colors.gold}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** The move's kind and context, above its title: "New scenario · The Charleston". */
export function nextMoveKicker(move: NextMove): string {
  switch (move.reason) {
    case 'new-scenario':
      return `New scenario · ${stageInfo(move.scenario.stage).title}`;
    case 'replay-scenario':
      return `Replay · ${stageInfo(move.scenario.stage).title}`;
    case 'weakest-drill':
      return `Drill · ${move.drill.questionsPerRound} questions`;
  }
}

/** The button's words. */
export function nextMoveAction(move: NextMove): string {
  switch (move.reason) {
    case 'new-scenario':
      return 'Play this scenario';
    case 'replay-scenario':
      return 'Replay it';
    case 'weakest-drill':
      return 'Start a round';
  }
}

type Props = {
  move: NextMove;
  onOpen: (move: NextMove) => void;
};

/**
 * The top of the Train tab: the single most useful thing to train next, on
 * the felt, with one line on why it was picked. For a scenario, the
 * principle it teaches sits under the reason, so the player knows what
 * they're about to learn.
 */
export function NextMoveHero({ move, onOpen }: Props) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const target = move.kind === 'scenario' ? move.scenario : move.drill;
  const title = target.title;

  return (
    <Card tone="felt" elevation="high" style={styles.hero} testID="next-move">
      <View style={styles.eyebrow}>
        <ArrowMark />
        <Text variant="eyebrow" color="onFelt" accessibilityRole="header">
          Your next move
        </Text>
      </View>

      {/* Keyed by the move, so a new pick lands with a fresh spring. */}
      <View key={`${move.kind}:${target.id}`} style={styles.body}>
        <Animated.View
          entering={reduceMotion ? undefined : ZoomIn.springify().damping(14).stiffness(180)}
          style={[styles.plinth, { borderColor: colors.feltInlay }]}
        >
          <Tile kind={target.icon} size="M" />
        </Animated.View>
        <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(260).delay(80)} style={styles.titles}>
          <Text variant="caption" color="onFeltMuted">
            {nextMoveKicker(move)}
          </Text>
          <Text variant="title3" color="onFelt">
            {title}
          </Text>
        </Animated.View>
      </View>

      <View style={[styles.rule, { backgroundColor: colors.feltInlay }]} />

      <View style={styles.why} accessible accessibilityLabel={`Why: ${move.why}`} testID="next-move-why">
        <Text variant="eyebrow" style={{ color: colors.gold }} maxFontSizeMultiplier={1.6}>
          Why
        </Text>
        <Text variant="bodyEmphasis" color="onFelt">
          {move.why}
        </Text>
      </View>

      {move.kind === 'scenario' ? (
        <View
          style={styles.principle}
          accessible
          accessibilityLabel={`Teaches ${move.principle.id}: ${move.principle.rule}`}
          testID="next-move-principle"
        >
          <View style={[styles.badge, { borderColor: colors.gold }]}>
            <Text variant="caption" color="onFelt" style={styles.badgeText} maxFontSizeMultiplier={1.4}>
              {move.principle.id}
            </Text>
          </View>
          <Text color="onFeltMuted" style={styles.ruleText}>
            {move.principle.rule}
          </Text>
        </View>
      ) : (
        <Text color="onFeltMuted">{move.drill.summary}</Text>
      )}

      <View style={styles.action}>
        <Button
          title={nextMoveAction(move)}
          variant="ivory"
          block
          onPress={() => onOpen(move)}
          accessibilityHint={`Opens “${title}”.`}
          testID="next-move-open"
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  hero: { gap: spacing.md, paddingVertical: spacing.xl },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  body: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  plinth: {
    borderRadius: radii.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.16)',
    boxShadow: 'inset 0px 2px 6px rgba(0, 0, 0, 0.28)',
  },
  titles: { flex: 1, gap: spacing.xxs },
  rule: { height: StyleSheet.hairlineWidth * 2, marginVertical: spacing.xxs },
  why: { gap: spacing.xxs },
  principle: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  badge: {
    minWidth: 36,
    marginTop: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  badgeText: { fontFamily: fontFamilies.sansSemiBold, letterSpacing: 0.6 },
  ruleText: { flex: 1, fontFamily: fontFamilies.serifItalic, fontSize: 17, lineHeight: 24 },
  action: { marginTop: spacing.xs },
});
