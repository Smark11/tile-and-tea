import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CardLineBody, CardLineView } from '@/components/lesson/CardLineView';
import { FeedbackPanel, TileDisplayView, TileSpread } from '@/components/lesson/LessonSteps';
import { Text } from '@/components/Text';
import type { AnsweredQuestion, DrillChoice, DrillEvaluation, DrillQuestion, RoundScore, Verdict } from '@/game/drills';
import type { FeedbackMessage } from '@/game/lessons';
import { cardInks, fontFamilies, radii, spacing, tileInks, useTheme } from '@/theme';

// The pieces of a drill page. Like the lesson steps they're presentational, so
// the styleguide can show every state on its own.

const PRESS_SPRING = { damping: 18, stiffness: 420, mass: 0.6 };
const PIP_SPRING = { damping: 12, stiffness: 160, mass: 0.7 };
const PIP_STAGGER_MS = 110;

/** The coach's star, the same one that marks a lesson's revealed answer. */
const STAR = 'M12 2.5 L14.5 9.5 L21.5 12 L14.5 14.5 L12 21.5 L9.5 14.5 L2.5 12 L9.5 9.5 Z';
const CHECK = 'M5 12.5l4.4 4.4L19 7.4';

/** The coach's reply to an answer, in the lesson feedback panel's moods. */
export function evaluationMessage(evaluation: DrillEvaluation): FeedbackMessage {
  const tone = evaluation.verdict === 'miss' ? 'revealed' : evaluation.verdict === 'good' ? 'close' : 'correct';
  return { tone, title: evaluation.title, body: evaluation.explanation };
}

/** How a card-line choice looks: waiting, picked before Check, or after the answer. */
export type LineChoiceState = 'open' | 'selected' | 'best' | 'picked' | 'passed';

function choiceState(index: number, selected: readonly number[], answer: AnsweredQuestion | null): LineChoiceState {
  if (!answer) return selected.includes(index) ? 'selected' : 'open';
  if (answer.evaluation.best.includes(index)) return 'best';
  return answer.picked.includes(index) ? 'picked' : 'passed';
}

function Badge({ state }: { state: 'best' | 'picked' }) {
  const best = state === 'best';
  const ink = best ? cardInks.suit1 : cardInks.muted;
  return (
    <View style={[styles.badge, { borderColor: ink, backgroundColor: best ? cardInks.suit1 : 'transparent' }]}>
      {best && (
        <Svg width={14} height={14} viewBox="0 0 24 24">
          <Path d={STAR} fill={cardInks.paper} />
        </Svg>
      )}
      <Text style={[styles.badgeText, { color: best ? cardInks.paper : ink }]} maxFontSizeMultiplier={1.4}>
        {best ? 'The answer' : 'Your pick'}
      </Text>
    </View>
  );
}

type LineChoiceProps = {
  choice: Extract<DrillChoice, { kind: 'line' }>;
  state: LineChoiceState;
  onPress: () => void;
  testID?: string;
};

/** A card line to choose, printed on a paper slip that dips when pressed. */
export function LineChoice({ choice, state, onPress, testID }: LineChoiceProps) {
  const { colors, shadows } = useTheme();
  const reduceMotion = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const answered = state === 'best' || state === 'picked' || state === 'passed';
  const press = (to: number) => {
    if (!reduceMotion && !answered) scale.set(withSpring(to, PRESS_SPRING));
  };

  const edge =
    state === 'best' || state === 'selected' ? cardInks.suit1 : state === 'picked' ? cardInks.rule : 'transparent';
  const spoken =
    state === 'best' ? ', the answer' : state === 'picked' ? ', your pick' : state === 'selected' ? ', picked' : '';

  return (
    <Animated.View style={[pressStyle, state === 'passed' && styles.passed]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${choice.label}${spoken}. ${choice.line.spoken}`}
        accessibilityState={{ disabled: answered, selected: state === 'selected' }}
        disabled={answered}
        onPress={onPress}
        onPressIn={() => press(0.97)}
        onPressOut={() => press(1)}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        testID={testID}
        style={[
          styles.slip,
          {
            borderColor: edge,
            boxShadow: hovered && !answered ? shadows.medium : shadows.low,
            outlineColor: colors.focusRing,
          },
        ]}
      >
        <View style={styles.slipInlay}>
          <View style={styles.slipHeader}>
            <Text style={styles.slipLabel} maxFontSizeMultiplier={1.6}>
              {choice.label}
            </Text>
            {(state === 'best' || state === 'picked') && <Badge state={state} />}
          </View>
          <CardLineBody line={choice.line} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** Why some tiles can't be picked (read per tile by screen readers, shown once on the felt). */
function lockedReason(question: DrillQuestion): string | undefined {
  for (const c of question.choices) if (c.kind === 'tile' && c.locked) return c.locked;
  return undefined;
}

/**
 * What the marks on an answered multi-pick hand mean. Each entry names every
 * cue (color is never the only one) and wraps as a whole, never mid-phrase.
 */
function TileKey() {
  return (
    <View
      style={styles.key}
      testID="drill-tile-key"
      accessible
      accessibilityLabel="Gold ring and raised: your pass. Green star: the coach’s pass."
    >
      <View style={styles.keyItem}>
        <View style={[styles.keySwatch, { borderColor: tileInks.selectRing }]} />
        <Text variant="callout" color="onFeltMuted">
          Gold & raised: your pass
        </Text>
      </View>
      <View style={styles.keyItem}>
        <View style={[styles.keyStar, { backgroundColor: tileInks.green }]}>
          <Svg width={12} height={12} viewBox="0 0 24 24">
            <Path d={STAR} fill="#FFFFFF" />
          </Svg>
        </View>
        <Text variant="callout" color="onFeltMuted">
          Star: the coach’s pass
        </Text>
      </View>
    </View>
  );
}

type DrillQuestionViewProps = {
  question: DrillQuestion;
  selected: readonly number[];
  answer: AnsweredQuestion | null;
  onTap: (index: number) => void;
};

/** The prompt, what's on the felt, and the choices. */
export function DrillQuestionView({ question, selected, answer, onTap }: DrillQuestionViewProps) {
  const lines = question.choices.every((c) => c.kind === 'line');
  let instruction = 'Tap your answer.';
  if (question.picks > 1) instruction = `Pick ${question.picks}, then Check.`;
  else if (lines) instruction = 'Tap the line these tiles make.';
  else instruction = 'Tap a tile to answer.';
  if (question.instruction) instruction = question.instruction;
  const locked = lockedReason(question);

  return (
    <View style={styles.question}>
      <Text variant="title1">{question.prompt}</Text>
      {!answer && <Text color="textMuted">{instruction}</Text>}
      {question.scene.card && <CardLineView line={question.scene.card} testID="drill-card-line" />}
      <Card tone="felt" elevation="high" style={styles.mat}>
        {question.scene.tiles.length > 0 && <TileDisplayView display={question.scene} />}
        {!lines && (
          <TileSpread
            groups={question.choiceGroups}
            tiles={question.choices.map((choice, i) => {
              const state = choiceState(i, selected, answer);
              const lockedTile = choice.kind === 'tile' ? choice.locked : undefined;
              // After a multi-pick answer, the player's own tiles stay raised beside the coach's stars.
              const mine = state === 'selected' || (answer !== null && answer.picked.includes(i));
              return {
                kind: choice.kind === 'tile' ? choice.tile : { type: 'joker' },
                selected: mine,
                hint: state === 'best',
                disabled: state === 'passed' || !!lockedTile,
                accessibilityHint: lockedTile,
                onPress: () => onTap(i),
                testID: `drill-choice-${i}`,
              };
            })}
          />
        )}
        {!lines && !answer && locked && (
          <Text variant="callout" color="onFeltMuted" align="center" accessibilityElementsHidden importantForAccessibility="no">
            {locked}
          </Text>
        )}
        {!lines && answer && question.picks > 1 && (
          <TileKey />
        )}
      </Card>
      {answer?.evaluation.target && (
        <View style={styles.target} testID="drill-target">
          <Text variant="eyebrow">{answer.evaluation.target.label}</Text>
          <CardLineView line={answer.evaluation.target.line} />
        </View>
      )}
      {lines && (
        <View style={styles.lines} accessibilityRole="list">
          {question.choices.map((choice, i) =>
            choice.kind === 'line' ? (
              <LineChoice
                key={i}
                choice={choice}
                state={choiceState(i, selected, answer)}
                onPress={() => onTap(i)}
                testID={`drill-choice-${i}`}
              />
            ) : null,
          )}
        </View>
      )}
      {answer && <FeedbackPanel message={evaluationMessage(answer.evaluation)} />}
    </View>
  );
}

const PIP_FILL: Record<Verdict, 'primary' | 'gold' | 'none'> = { best: 'primary', good: 'gold', miss: 'none' };

/** One question's result: a jade check for the best play, gold for a sound one, an open ring otherwise. */
function Pip({ verdict, index }: { verdict: Verdict; index: number }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (!reduceMotion) t.set(withDelay(200 + index * PIP_STAGGER_MS, withSpring(1, PIP_SPRING)));
  }, [index, reduceMotion, t]);
  const style = useAnimatedStyle(() => ({ opacity: Math.min(1, t.get() * 1.5), transform: [{ scale: 0.4 + 0.6 * t.get() }] }));
  const fill = PIP_FILL[verdict];
  return (
    <Animated.View
      style={[
        styles.pip,
        style,
        fill === 'none'
          ? { borderColor: colors.onFeltMuted, borderWidth: 2 }
          : { backgroundColor: fill === 'primary' ? colors.onFelt : colors.gold },
      ]}
    >
      <Svg width={20} height={20} viewBox="0 0 24 24">
        {verdict === 'miss' ? (
          <Path d={STAR} fill={colors.onFeltMuted} transform="translate(6 6) scale(0.5)" />
        ) : (
          <Path d={CHECK} fill="none" stroke={fill === 'primary' ? colors.felt : '#1B1B1B'} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
        )}
      </Svg>
    </Animated.View>
  );
}

/** Warm, specific words for a round. Never a grade. */
export function roundLine({ best, good, questions }: RoundScore): string {
  if (best === questions) return `All ${questions} spot on. You’re reading the card like a regular.`;
  if (best + good === questions) return 'Every answer was sound, and the notes show where the sharpest play was.';
  if (best === 0) return 'A tough round. Each explanation is a pattern you’ll spot faster next time.';
  return `${best} of ${questions} spot on. The explanations are the best part: each one is a pattern you’ll see again.`;
}

export function roundSummary({ best, good, miss, questions }: RoundScore): string {
  const parts = [`${best} of ${questions} spot on`];
  if (good > 0) parts.push(`${good} sound`);
  if (miss > 0) parts.push(`${miss} to learn from`);
  return parts.join(', ');
}

type DrillCompleteProps = {
  title: string;
  verdicts: readonly Verdict[];
  score: RoundScore;
  onAgain: () => void;
  onLeave: () => void;
};

export function DrillComplete({ title, verdicts, score, onAgain, onLeave }: DrillCompleteProps) {
  return (
    <View style={styles.complete} testID="drill-complete">
      <Card tone="felt" elevation="high" style={styles.hero}>
        <View style={styles.pips} accessible accessibilityRole="image" accessibilityLabel={`Round results: ${roundSummary(score)}`}>
          {verdicts.map((v, i) => (
            <Pip key={i} verdict={v} index={i} />
          ))}
        </View>
        <Text variant="eyebrow" color="onFeltMuted" align="center">
          Round complete
        </Text>
        <Text variant="title1" color="onFelt" align="center">
          {title}
        </Text>
        <Text color="onFeltMuted" align="center">
          {roundLine(score)}
        </Text>
      </Card>
      <View style={styles.actions}>
        <Button title="Another round" block onPress={onAgain} testID="drill-again" />
        <Button title="Back to Train" variant="quiet" block onPress={onLeave} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  question: { gap: spacing.lg },
  mat: { paddingVertical: spacing.xl, paddingHorizontal: spacing.lg, gap: spacing.lg },
  lines: { gap: spacing.md },
  target: { gap: spacing.sm },
  key: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: spacing.lg, rowGap: spacing.xs },
  keyItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  keySwatch: { width: 14, height: 18, borderRadius: 3, borderWidth: 2.5 },
  keyStar: { width: 18, height: 18, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  slip: {
    backgroundColor: cardInks.paper,
    borderRadius: radii.md,
    borderCurve: 'continuous',
    padding: spacing.xs,
    borderWidth: 2,
    borderBottomWidth: 3,
  },
  slipInlay: {
    borderWidth: 1,
    borderColor: cardInks.rule,
    borderRadius: radii.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  slipHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' },
  slipLabel: { fontFamily: fontFamilies.sansSemiBold, fontSize: 15, lineHeight: 20, letterSpacing: 0.4, color: cardInks.muted },
  passed: { opacity: 0.5 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    borderWidth: 1.5,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: { fontFamily: fontFamilies.sansSemiBold, fontSize: 14, lineHeight: 18 },
  complete: { gap: spacing.xl },
  hero: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.xxl, paddingBottom: spacing.xxl },
  pips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.md },
  pip: { width: 40, height: 40, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  actions: { gap: spacing.sm },
});
