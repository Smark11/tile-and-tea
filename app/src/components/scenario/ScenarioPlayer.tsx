import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { track } from '@/analytics';
import { Button } from '@/components/Button';
import { DrillQuestionView } from '@/components/drill/DrillViews';
import { hapticSuccess, hapticTick } from '@/components/haptics';
import { CloseButton, StepProgress } from '@/components/lesson/LessonPlayer';
import { Entrance } from '@/components/lesson/LessonSteps';
import { Text } from '@/components/Text';
import { canCheck, currentQuestion, isSoundAnswer, levelReached } from '@/game/drills';
import {
  nextScenario,
  openScenario,
  SCENARIO_LEVEL,
  SCENARIO_STEPS,
  scenarioAnswer,
  scenarioPath,
  scenarioReducer,
  type Scenario,
  type ScenarioAction,
  type ScenarioState,
  type ScenarioStep,
} from '@/game/scenarios';
import { useDrillProgress } from '@/state/drillProgress';
import { useScenarioProgress } from '@/state/scenarioProgress';
import { maxContentWidth, minTouchTarget, spacing, useTheme } from '@/theme';

import { ScenarioScene, ScenarioStrategy } from './ScenarioViews';

/** Leave a scenario: back where the player came from, or to the Train tab. */
export function leaveScenario() {
  if (router.canGoBack()) router.back();
  else router.replace('/train');
}

type Props = {
  scenario: Scenario;
  /** Open part-way through (a `?step=` link); the strategy comes with the taught move made. */
  step?: ScenarioStep;
};

/**
 * Plays one scenario: the scene, the move, the strategy. Each action goes
 * through the pure reducer; side effects (analytics, ratings, the record,
 * haptics) run here on the transition, so they can't fire twice.
 */
export function ScenarioPlayer({ scenario, step = 'scene' }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const reduce = useMemo(() => scenarioReducer(scenario), [scenario]);
  const [state, setState] = useState<ScenarioState>(() => openScenario(scenario, step));
  const latest = useRef(state);
  const scroll = useRef<ScrollViewInstance>(null);
  const next = nextScenario(scenario.id);

  // A start is an opening on the scene. A `?step=move|strategy` link skips the
  // scene, so it isn't counted (the screenshot harness opens those directly).
  useEffect(() => {
    if (step === 'scene') track('scenario_started', { scenario_id: scenario.id });
  }, [scenario.id, step]);

  const dispatch = (action: ScenarioAction) => {
    const prev = latest.current;
    const nextState = reduce(prev, action);
    if (nextState === prev) return;
    latest.current = nextState;
    setState(nextState);

    const answered = scenarioAnswer(nextState);
    if (answered && !scenarioAnswer(prev)) {
      const { evaluation } = answered;
      track('drill_answered', { skill: scenario.skill, correct: isSoundAnswer(evaluation) });
      const progress = useDrillProgress.getState();
      const { before, after } = progress.rateAnswer(scenario.skill, { score: evaluation.score, level: SCENARIO_LEVEL, startsRound: true });
      const reached = levelReached(before, after);
      if (reached) track('skill_level_reached', { skill: scenario.skill, level: reached.id });
      if (evaluation.verdict === 'best') hapticSuccess();
      else hapticTick();
      // Bring the coach's explanation into view below the choices.
      setTimeout(() => scroll.current?.scrollToEnd({ animated: !reduceMotion }), 60);
      return;
    }
    if (nextState.step === 'strategy' && prev.step !== 'strategy' && answered) {
      useScenarioProgress.getState().complete(scenario.id, answered.evaluation.verdict);
      track('scenario_completed', { scenario_id: scenario.id, verdict: answered.evaluation.verdict });
    }
    if (nextState.step !== prev.step) {
      scroll.current?.scrollTo({ y: 0, animated: false });
      if (action.type === 'restart') track('scenario_started', { scenario_id: scenario.id });
    }
    hapticTick();
  };

  const question = currentQuestion(state.round);
  const answer = scenarioAnswer(state);
  const stepIndex = SCENARIO_STEPS.indexOf(state.step);

  let primary: { title: string; action: () => void; disabled?: boolean; testID: string };
  if (state.step === 'scene') {
    primary = { title: 'Make your move', action: () => dispatch({ type: 'begin' }), testID: 'scenario-begin' };
  } else if (state.step === 'move') {
    primary = answer
      ? { title: 'See the strategy', action: () => dispatch({ type: 'continue' }), testID: 'scenario-continue' }
      : { title: 'Check', action: () => dispatch({ type: 'check' }), disabled: !canCheck(state.round), testID: 'scenario-check' };
  } else {
    primary = next
      ? { title: `Next: ${next.title}`, action: () => router.replace(scenarioPath(next.id)), testID: 'scenario-next' }
      : { title: 'Back to Train', action: leaveScenario, testID: 'scenario-next' };
  }
  // A one-pick move answers on the tap, so the footer has nothing to offer until then.
  const showPrimary = !(state.step === 'move' && !answer && question.picks === 1);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + spacing.md, paddingLeft: insets.left + spacing.lg, paddingRight: insets.right + spacing.lg },
        ]}
      >
        <View style={styles.headerRow}>
          <CloseButton label="Close scenario" hint="Leaves this scenario." onPress={leaveScenario} />
          <StepProgress done={stepIndex + 1} total={SCENARIO_STEPS.length} label="Scenario progress" unit="Part" />
          <Text variant="caption" style={styles.count} accessibilityElementsHidden importantForAccessibility="no">
            {stepIndex + 1}/{SCENARIO_STEPS.length}
          </Text>
        </View>
      </View>

      <ScrollView
        ref={scroll}
        style={styles.root}
        contentContainerStyle={[styles.scroll, { paddingLeft: insets.left + spacing.xl, paddingRight: insets.right + spacing.xl }]}
      >
        <View style={styles.column}>
          {state.step === 'scene' && (
            <Entrance key="scene">
              <ScenarioScene scenario={scenario} question={question} />
            </Entrance>
          )}
          {state.step === 'move' && (
            <Entrance key="move">
              <View style={styles.move} testID="scenario-move">
                <Text variant="eyebrow">Your move</Text>
                <DrillQuestionView
                  question={question}
                  selected={state.round.selected}
                  answer={answer}
                  onTap={(index) => dispatch({ type: 'tap', index })}
                />
              </View>
            </Entrance>
          )}
          {state.step === 'strategy' && answer && (
            <Entrance key="strategy">
              <ScenarioStrategy scenario={scenario} answer={answer} />
              <Button title="Play it again" variant="quiet" block onPress={() => dispatch({ type: 'restart' })} testID="scenario-again" />
            </Entrance>
          )}
        </View>
      </ScrollView>

      {showPrimary && (
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
            <Button title={primary.title} block disabled={primary.disabled} onPress={primary.action} testID={primary.testID} />
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
  move: { gap: spacing.lg },
  footer: { borderTopWidth: StyleSheet.hairlineWidth * 2, paddingTop: spacing.lg },
  actions: { minHeight: minTouchTarget + spacing.xs, justifyContent: 'center' },
});
