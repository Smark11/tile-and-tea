import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { track } from '@/analytics';
import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import {
  canAdvance,
  currentStep,
  feedbackMessage,
  isSingleAnswer,
  lessonReducer,
  scoreSession,
  startSession,
  type Lesson,
  type SessionAction,
  type SessionState,
} from '@/game/lessons';
import { useLessonProgress } from '@/state/lessonProgress';
import { maxContentWidth, minTouchTarget, radii, spacing, useTheme } from '@/theme';

import { leaveLesson } from './leaveLesson';
import { LessonComplete } from './LessonComplete';
import { Entrance, FeedbackPanel, TapStepView, TextStepView, TilesStepView } from './LessonSteps';

const BAR_SPRING = { damping: 22, stiffness: 160 };

function CloseButton() {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Close lesson"
      accessibilityHint="Your place is saved."
      onPress={leaveLesson}
      hitSlop={spacing.xs}
      style={({ pressed, hovered }) => [
        styles.close,
        {
          backgroundColor: pressed || hovered ? colors.surfaceSunken : 'transparent',
        },
      ]}
    >
      <Svg width={22} height={22} viewBox="0 0 24 24">
        <Path d="M6 6l12 12M18 6L6 18" stroke={colors.text} strokeWidth={2} strokeLinecap="round" />
      </Svg>
    </Pressable>
  );
}

/** A slim jade bar that springs forward as the player moves through the steps. */
function StepProgress({ done, total }: { done: number; total: number }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const fraction = total === 0 ? 0 : done / total;
  const fill = useSharedValue(fraction);
  useEffect(() => {
    fill.set(reduceMotion ? fraction : withSpring(fraction, BAR_SPRING));
  }, [fill, fraction, reduceMotion]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${Math.max(0, Math.min(1, fill.get())) * 100}%` }));
  return (
    <View
      style={[styles.track, { backgroundColor: colors.surfaceSunken, borderColor: colors.border }]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Lesson progress"
      accessibilityValue={{ min: 0, max: total, now: done, text: `Step ${done} of ${total}` }}
    >
      <Animated.View style={[styles.fill, { backgroundColor: colors.primary }, fillStyle]}>
        <View style={[styles.fillShine, { backgroundColor: colors.gold }]} />
      </Animated.View>
    </View>
  );
}

/**
 * Plays one lesson. Each move goes through the pure lesson reducer; the player
 * saves the place after every step (so closing resumes it) and records the
 * finish.
 */
export function LessonPlayer({ lesson }: { lesson: Lesson }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useMemo(() => lessonReducer(lesson), [lesson]);
  const [state, setState] = useState<SessionState>(() =>
    startSession(lesson, useLessonProgress.getState().inProgress[lesson.id]),
  );

  // The latest state, so two taps landing before a re-render both count.
  const latest = useRef(state);

  useEffect(() => {
    track('lesson_started', { lesson_id: lesson.id });
  }, [lesson.id]);

  // Side effects run here, on the transition, rather than in effects that
  // could fire twice: save the place, or record the finish.
  const dispatch = (action: SessionAction) => {
    const next = reduce(latest.current, action);
    if (next === latest.current) return;
    latest.current = next;
    setState(next);
    const progress = useLessonProgress.getState();
    if (next.complete) {
      progress.completeLesson(lesson.id, scoreSession(lesson, next.results));
      track('lesson_completed', { lesson_id: lesson.id });
    } else {
      progress.saveStep(lesson.id, { stepIndex: next.stepIndex, results: next.results });
      if (action.type === 'restart') track('lesson_started', { lesson_id: lesson.id });
    }
  };

  const total = lesson.steps.length;
  const step = currentStep(lesson, state);
  const message = step.kind === 'tap' ? feedbackMessage(step, state) : null;
  const last = state.stepIndex === total - 1;
  const done = state.complete ? total : state.stepIndex + 1;

  let primary: { title: string; action: SessionAction; disabled?: boolean } | null = null;
  if (state.complete) {
    primary = null;
  } else if (canAdvance(lesson, state)) {
    primary = { title: last ? 'Finish' : 'Continue', action: { type: 'next' } };
  } else if (state.feedback === 'retry') {
    primary = { title: 'Try again', action: { type: 'retry' } };
  } else if (step.kind === 'tap' && !isSingleAnswer(step)) {
    primary = { title: 'Check', action: { type: 'check' }, disabled: state.selected.length === 0 };
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + spacing.md, paddingLeft: insets.left + spacing.lg, paddingRight: insets.right + spacing.lg },
        ]}
      >
        <View style={styles.headerRow}>
          <CloseButton />
          <StepProgress done={done} total={total} />
          <Text variant="caption" style={styles.count} accessibilityElementsHidden importantForAccessibility="no">
            {done}/{total}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.root}
        contentContainerStyle={[
          styles.scroll,
          { paddingLeft: insets.left + spacing.xl, paddingRight: insets.right + spacing.xl },
        ]}
      >
        {/* A page of plain text sits in the middle of the screen, not stranded at the top. */}
        <View style={[styles.column, !state.complete && step.kind === 'text' && styles.centered]}>
          {state.complete ? (
            <LessonComplete
              lesson={lesson}
              score={scoreSession(lesson, state.results)}
              onReplay={() => dispatch({ type: 'restart' })}
            />
          ) : (
            <Entrance key={state.stepIndex}>
              <Text variant="eyebrow">{lesson.title}</Text>
              {step.kind === 'text' && <TextStepView step={step} />}
              {step.kind === 'tiles' && <TilesStepView step={step} />}
              {step.kind === 'tap' && (
                <TapStepView
                  step={step}
                  selected={state.selected}
                  revealAnswer={state.feedback === 'revealed'}
                  settled={state.feedback === 'correct' || state.feedback === 'revealed'}
                  singleAnswer={isSingleAnswer(step)}
                  onTap={(index) => dispatch({ type: 'tap', index })}
                />
              )}
            </Entrance>
          )}
        </View>
      </ScrollView>

      {!state.complete && (
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
          <View style={[styles.column, styles.footerColumn]}>
            {message && <FeedbackPanel key={`${state.stepIndex}-${state.feedback}-${state.misses}`} message={message} />}
            <View style={styles.actions}>
              {state.stepIndex > 0 && (
                <Button title="Back" variant="quiet" onPress={() => dispatch({ type: 'back' })} />
              )}
              <View style={styles.primary}>
                {primary && (
                  <Button
                    title={primary.title}
                    block
                    disabled={primary.disabled}
                    onPress={() => primary && dispatch(primary.action)}
                    testID="lesson-primary"
                  />
                )}
              </View>
            </View>
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
  close: {
    width: minTouchTarget,
    height: minTouchTarget,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    flex: 1,
    height: 10,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radii.pill, overflow: 'hidden' },
  // A thin gold highlight along the top, like light catching lacquer.
  fillShine: { position: 'absolute', top: 1, left: 6, right: 6, height: 2, borderRadius: 1, opacity: 0.5 },
  count: { minWidth: 36, textAlign: 'right', fontVariant: ['tabular-nums'] },
  scroll: { flexGrow: 1, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  centered: { flexGrow: 1, justifyContent: 'center', paddingBottom: spacing.xxxl },
  column: { width: '100%', maxWidth: maxContentWidth, alignSelf: 'center', gap: spacing.lg },
  footer: { borderTopWidth: StyleSheet.hairlineWidth * 2, paddingTop: spacing.lg },
  footerColumn: { gap: spacing.md },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: minTouchTarget + spacing.xs },
  primary: { flex: 1 },
});
