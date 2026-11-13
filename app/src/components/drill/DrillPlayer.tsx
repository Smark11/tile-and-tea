import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { track } from '@/analytics';
import { Button } from '@/components/Button';
import { hapticSuccess, hapticTick } from '@/components/haptics';
import { CloseButton, StepProgress } from '@/components/lesson/LessonPlayer';
import { Entrance } from '@/components/lesson/LessonSteps';
import { Text } from '@/components/Text';
import {
  canCheck,
  currentAnswer,
  currentQuestion,
  isSoundAnswer,
  roundReducer,
  scoreRound,
  startRound,
  type AnyDrill,
  type RoundAction,
  type RoundState,
} from '@/game/drills';
import { useDrillProgress } from '@/state/drillProgress';
import { maxContentWidth, minTouchTarget, spacing, useTheme } from '@/theme';

import { DrillComplete, DrillQuestionView } from './DrillViews';

/** A fresh seed for a new round. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32) >>> 0;
}

/** Leave a drill: back where the player came from, or to the Train tab. */
export function leaveDrill() {
  if (router.canGoBack()) router.back();
  else router.replace('/train');
}

/**
 * Plays rounds of one drill. Each move goes through the pure round reducer;
 * side effects (analytics, the daily count, haptics, records) run here, on the
 * transition, so they can't fire twice.
 */
export function DrillPlayer({ drill, seed }: { drill: AnyDrill; seed: number }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const reduce = useMemo(() => roundReducer(drill), [drill]);
  const [state, setState] = useState<RoundState>(() => startRound(drill, seed));
  const latest = useRef(state);
  const scroll = useRef<ScrollViewInstance>(null);

  const dispatch = (action: RoundAction) => {
    const prev = latest.current;
    const next = reduce(prev, action);
    if (next === prev) return;
    latest.current = next;
    setState(next);

    if (next.answers.length > prev.answers.length) {
      const { evaluation } = next.answers[next.answers.length - 1];
      track('drill_answered', { skill: drill.skill, correct: isSoundAnswer(evaluation) });
      // A round counts toward the daily allowance once the player commits to it.
      if (prev.answers.length === 0) useDrillProgress.getState().countRound();
      if (evaluation.verdict === 'best') hapticSuccess();
      else hapticTick();
      // Bring the coach's explanation into view below the choices.
      setTimeout(() => scroll.current?.scrollToEnd({ animated: !reduceMotion }), 60);
    } else if (next.complete && !prev.complete) {
      useDrillProgress.getState().finishRound(drill.id, scoreRound(next));
      scroll.current?.scrollTo({ y: 0, animated: false });
    } else if (next.index !== prev.index || action.type === 'restart') {
      scroll.current?.scrollTo({ y: 0, animated: false });
    } else {
      hapticTick();
    }
  };

  const total = state.questions.length;
  const question = currentQuestion(state);
  const answer = currentAnswer(state);
  const last = state.index === total - 1;
  const done = state.complete ? total : state.answers.length;

  let primary: { title: string; action: RoundAction; disabled?: boolean } | null = null;
  if (answer) primary = { title: last ? 'See how you did' : 'Next question', action: { type: 'next' } };
  else if (question.picks > 1) primary = { title: 'Check', action: { type: 'check' }, disabled: !canCheck(state) };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + spacing.md, paddingLeft: insets.left + spacing.lg, paddingRight: insets.right + spacing.lg },
        ]}
      >
        <View style={styles.headerRow}>
          <CloseButton label="Close drill" hint="Leaves this round." onPress={leaveDrill} />
          <StepProgress done={done} total={total} label="Round progress" unit="Answered" />
          <Text variant="caption" style={styles.count} accessibilityElementsHidden importantForAccessibility="no">
            {done}/{total}
          </Text>
        </View>
      </View>

      <ScrollView
        ref={scroll}
        style={styles.root}
        contentContainerStyle={[styles.scroll, { paddingLeft: insets.left + spacing.xl, paddingRight: insets.right + spacing.xl }]}
      >
        <View style={styles.column}>
          {state.complete ? (
            <Entrance key="complete">
              <DrillComplete
                title={drill.title}
                verdicts={state.answers.map((a) => a.evaluation.verdict)}
                score={scoreRound(state)}
                onAgain={() => dispatch({ type: 'restart', seed: randomSeed() })}
                onLeave={leaveDrill}
              />
            </Entrance>
          ) : (
            <Entrance key={`${state.seed}-${state.index}`}>
              <Text variant="eyebrow">
                {drill.title} · Question {state.index + 1} of {total}
              </Text>
              <DrillQuestionView
                question={question}
                selected={state.selected}
                answer={answer}
                onTap={(index) => dispatch({ type: 'tap', index })}
              />
            </Entrance>
          )}
        </View>
      </ScrollView>

      {primary && !state.complete && (
        <View
          style={[
            styles.footer,
            {
              borderColor: colors.border,
              backgroundColor: colors.background,
              paddingBottom: insets.bottom + spacing.lg,
              paddingLeft: insets.left + spacing.xl,
              paddingRight: insets.right + spacing.xl,
            },
          ]}
        >
          <View style={[styles.column, styles.actions]}>
            <Button
              title={primary.title}
              block
              disabled={primary.disabled}
              onPress={() => primary && dispatch(primary.action)}
              testID="drill-primary"
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingBottom: spacing.sm },
  headerRow: {
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  count: { minWidth: 36, textAlign: 'right', fontVariant: ['tabular-nums'] },
  scroll: { flexGrow: 1, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  column: { width: '100%', maxWidth: maxContentWidth, alignSelf: 'center', gap: spacing.lg },
  footer: { borderTopWidth: StyleSheet.hairlineWidth * 2, paddingTop: spacing.lg },
  actions: { minHeight: minTouchTarget + spacing.xs, justifyContent: 'center' },
});
