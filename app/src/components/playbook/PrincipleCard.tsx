import { router } from 'expo-router';
import { Fragment, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { Tile } from '@/components/tile/Tile';
import { drillById, drillForSkill, drillPath, type AnyDrill } from '@/game/drills';
import { LESSON_ORDER, lessonById, lessonPath } from '@/game/lessons';
import {
  evidenceWords,
  MASTERY_LEVEL,
  PRINCIPLES,
  type Evidence,
  type PlaybookStep,
  type Principle,
  type PrincipleProgress,
} from '@/game/playbook';
import { scenarioPath } from '@/game/scenarios';
import { fontFamilies, minTouchTarget, radii, spacing, useTheme } from '@/theme';

const PRESS_SPRING = { damping: 18, stiffness: 420, mass: 0.6 };

function Check({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M5 12.5l4.4 4.4L19 7.4" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function Chevron() {
  const { colors } = useTheme();
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path d="M9 5l7 7-7 7" fill="none" stroke={colors.textMuted} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** The jade seal on a mastered principle. */
function MasteredSeal() {
  const { colors } = useTheme();
  return (
    <View style={styles.seal} testID="playbook-mastered">
      <View style={[styles.sealDot, { backgroundColor: colors.primary }]}>
        <Check color={colors.onPrimary} size={13} />
      </View>
      <Text variant="caption" color="primaryText" style={styles.sealText}>
        Mastered
      </Text>
    </View>
  );
}

function EvidenceTag({ evidence }: { evidence: Evidence }) {
  const { colors } = useTheme();
  const { tag } = evidenceWords(evidence);
  const tone = evidence.kind === 'measured' ? colors.primaryText : evidence.kind === 'tie-break' ? colors.goldText : colors.textMuted;
  return (
    <View style={[styles.tag, { borderColor: colors.border, backgroundColor: colors.surfaceSunken }]}>
      <Text variant="caption" style={[styles.tagText, { color: tone }]} maxFontSizeMultiplier={1.4}>
        {tag}
      </Text>
    </View>
  );
}

type RowProps = {
  leading: ReactNode;
  title: string;
  status: string;
  done: boolean;
  onPress: () => void;
  hint: string;
  testID?: string;
};

/** One thing that teaches the principle, with where the player stands on it. */
function StepRow({ leading, title, status, done, onPress, hint, testID }: RowProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const press = (to: number) => {
    if (!reduceMotion) scale.set(withSpring(to, PRESS_SPRING));
  };
  return (
    <Animated.View style={style}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${status}`}
        accessibilityHint={hint}
        onPress={onPress}
        onPressIn={() => press(0.98)}
        onPressOut={() => press(1)}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        testID={testID}
        style={({ pressed }) => [styles.row, { backgroundColor: pressed || hovered ? colors.surfaceSunken : 'transparent' }]}
      >
        <View style={styles.leading}>{leading}</View>
        <View style={styles.rowText}>
          <Text variant="bodyEmphasis">{title}</Text>
          <View style={styles.status}>
            {done && <Check color={colors.primaryText} />}
            <Text variant="caption" color={done ? 'primaryText' : 'textMuted'}>
              {status}
            </Text>
          </View>
        </View>
        <Chevron />
      </Pressable>
    </Animated.View>
  );
}

function Numeral({ value }: { value: number }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.numeral, { backgroundColor: colors.surfaceSunken, borderColor: colors.border }]}>
      <Text variant="headline" color="primaryText" maxFontSizeMultiplier={1.4}>
        {value}
      </Text>
    </View>
  );
}

function scenarioStatus(step: Extract<PlaybookStep, { kind: 'scenario' }>): string {
  if (step.done) return 'Best move made';
  if (step.verdict) return 'Finished. Replay it for the best move';
  return 'Not played yet';
}

/**
 * Where the player stands on a principle's skill. Several principles share a
 * skill, so after the first card that rates it, the row just points back there.
 */
function skillStatus(step: Extract<PlaybookStep, { kind: 'skill' }>, principle: Principle): string {
  const first = PRINCIPLES.find((p) => p.skill === step.skill)!;
  if (first.id !== principle.id) {
    return step.level ? `Skill: ${step.level.name}, shared with ${first.id}` : `Same skill as ${first.id}. Not rated yet`;
  }
  if (!step.level) return `Skill not rated yet. Reach ${MASTERY_LEVEL.name} to master`;
  if (step.done) return `Skill: ${step.level.name}`;
  return `Skill: ${step.level.name}. Reach ${MASTERY_LEVEL.name} to master`;
}

function drillRow(drill: AnyDrill, title: string, status: string, done: boolean, key: string) {
  return (
    <StepRow
      key={key}
      leading={<Tile kind={drill.icon} size="S" />}
      title={title}
      status={status}
      done={done}
      onPress={() => router.push(drillPath(drill.id))}
      hint={`Opens the ${drill.title} drill.`}
      testID={`playbook-${key}`}
    />
  );
}

/** One principle: its rule, the evidence for it, and each thing that teaches it. */
export function PrincipleCard({ progress }: { progress: PrincipleProgress }) {
  const { colors } = useTheme();
  const { principle, steps, mastered } = progress;
  const { detail } = evidenceWords(principle.evidence);
  const done = steps.filter((s) => s.done).length;
  const skillDrill = drillForSkill(principle.skill);
  // Drills named for the principle that aren't already its skill's drill (H4 adds Discards).
  const extraDrills = principle.teachers.flatMap((t) =>
    t.kind === 'drill' && t.id !== skillDrill?.id ? [drillById(t.id)!] : [],
  );

  const rows: ReactNode[] = steps.map((step) => {
    switch (step.kind) {
      case 'scenario':
        return (
          <StepRow
            key={step.scenario.id}
            leading={<Tile kind={step.scenario.icon} size="S" />}
            title={step.scenario.title}
            status={scenarioStatus(step)}
            done={step.done}
            onPress={() => router.push(scenarioPath(step.scenario.id))}
            hint="Opens the scenario."
            testID={`playbook-scenario-${step.scenario.id}`}
          />
        );
      case 'lesson': {
        const lesson = lessonById(step.id)!;
        const number = LESSON_ORDER.indexOf(step.id) + 1;
        return (
          <StepRow
            key={step.id}
            leading={<Numeral value={number} />}
            title={`Lesson ${number}: ${lesson.title}`}
            status={step.done ? 'Finished' : 'Not finished yet'}
            done={step.done}
            onPress={() => router.push(lessonPath(step.id))}
            hint="Opens the lesson."
            testID={`playbook-lesson-${step.id}`}
          />
        );
      }
      case 'skill':
        return skillDrill
          ? drillRow(skillDrill, `${skillDrill.title} drill`, skillStatus(step, principle), step.done, `skill-${step.skill}`)
          : null;
    }
  });
  for (const drill of extraDrills) rows.push(drillRow(drill, `${drill.title} drill`, 'More practice for this principle', false, `drill-${drill.id}`));

  return (
    <Card
      elevation={mastered ? 'medium' : 'low'}
      style={[styles.card, mastered && { borderColor: colors.gold, borderWidth: 1.5 }]}
      testID={`playbook-principle-${principle.id}`}
    >
      <View style={styles.top}>
        <View style={[styles.badge, { borderColor: colors.gold }]}>
          <Text variant="caption" color="goldText" style={styles.badgeText} maxFontSizeMultiplier={1.4}>
            {principle.id}
          </Text>
        </View>
        <EvidenceTag evidence={principle.evidence} />
        <View style={styles.spacer} />
        {mastered ? (
          <MasteredSeal />
        ) : (
          <Text variant="caption" style={styles.tally}>{`${done} of ${steps.length} done`}</Text>
        )}
      </View>
      <Text variant="callout" accessibilityRole="header">
        {principle.rule}
      </Text>
      <Text color="textMuted">{detail}</Text>
      <View style={[styles.rows, { borderTopColor: colors.border }]}>
        {rows.map((row, i) => (
          <Fragment key={i}>
            {i > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
            {row}
          </Fragment>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, padding: spacing.lg, paddingBottom: spacing.sm },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  spacer: { flex: 1 },
  badge: {
    minWidth: 36,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  badgeText: { fontFamily: fontFamilies.sansSemiBold, letterSpacing: 0.6 },
  tag: { paddingHorizontal: spacing.sm, paddingVertical: 1, borderRadius: radii.pill, borderWidth: 1 },
  tagText: { fontFamily: fontFamilies.sansSemiBold },
  tally: { fontVariant: ['tabular-nums'] },
  seal: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  sealDot: { width: 22, height: 22, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  sealText: { fontFamily: fontFamilies.sansSemiBold },
  rows: { borderTopWidth: StyleSheet.hairlineWidth * 2, marginTop: spacing.xs, paddingTop: spacing.xs, marginHorizontal: -spacing.sm },
  divider: { height: StyleSheet.hairlineWidth * 2, marginLeft: minTouchTarget + spacing.md + spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    minHeight: minTouchTarget + spacing.sm,
    borderRadius: radii.md,
  },
  leading: { width: minTouchTarget, alignItems: 'center' },
  rowText: { flex: 1, gap: spacing.xxs },
  status: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  numeral: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
