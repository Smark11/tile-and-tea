import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { G, Path } from 'react-native-svg';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ComingSoon } from '@/components/shell/Preview';
import { Text } from '@/components/Text';
import {
  bestLine,
  nodeA11yLabel,
  nodeActionTitle,
  nodeStatusLine,
  unlockedBy,
  type PathNode,
} from '@/game/lessons';
import { minTouchTarget, radii, spacing, useTheme } from '@/theme';

import { CELEBRATION_BEATS, PathMedallion, type CelebrationRole } from './PathMedallion';
import { GUTTER, laneX, MEDALLION, MEDALLION_TOP, trailSegments } from './trail';

const PRESS_SPRING = { damping: 18, stiffness: 420, mass: 0.6 };
const RISE_SPRING = { damping: 16, stiffness: 150, mass: 0.9 };
const TRAIL_DRAW_MS = 620;

type TrailProps = {
  nodes: readonly PathNode[];
  rowYs: readonly (number | undefined)[];
  height: number;
  /** Index of the segment to draw in as part of a celebration. */
  drawIndex: number;
  celebrationKey: string | null;
};

/**
 * The trail itself: walked stretches are a jade ribbon with gold stitching,
 * the way ahead is a line of stepping stones.
 */
function Trail({ nodes, rowYs, height, drawIndex, celebrationKey }: TrailProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const segments = trailSegments(rowYs);
  const reveal = useSharedValue(1);
  useEffect(() => {
    if (drawIndex < 0 || reduceMotion) return;
    reveal.set(0);
    reveal.set(
      withDelay(CELEBRATION_BEATS.trail, withTiming(1, { duration: TRAIL_DRAW_MS, easing: Easing.inOut(Easing.cubic) })),
    );
  }, [drawIndex, celebrationKey, reduceMotion, reveal]);

  const drawing = segments[drawIndex];
  const top = drawing ? drawing.from.y : 0;
  const span = drawing ? drawing.to.y - drawing.from.y : 0;
  const revealStyle = useAnimatedStyle(() => ({ height: span * reveal.get() }));

  if (segments.length === 0) return null;
  const walked = (d: string) => (
    <>
      <Path d={d} stroke={colors.primary} strokeWidth={7} strokeLinecap="round" fill="none" />
      <Path d={d} stroke={colors.gold} strokeWidth={2} strokeDasharray="0.1 7" strokeLinecap="round" fill="none" />
    </>
  );
  const ahead = (d: string) => (
    <Path d={d} stroke={colors.border} strokeWidth={6} strokeDasharray="0.1 13" strokeLinecap="round" fill="none" />
  );
  return (
    <View style={[styles.trail, { height }]} pointerEvents="none" testID="lesson-trail">
      <Svg width={GUTTER} height={height}>
        {segments.map(({ d }, i) => (
          // A segment being drawn starts as stepping stones; the ribbon grows over it.
          <G key={i}>{nodes[i].completedBefore && i !== drawIndex ? walked(d) : ahead(d)}</G>
        ))}
      </Svg>
      {drawing && (
        <Animated.View style={[styles.reveal, { top }, revealStyle]}>
          <Svg width={GUTTER} height={height} style={{ marginTop: -top }}>
            {walked(drawing.d)}
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}

type CardProps = {
  node: PathNode;
  onOpen: (id: string) => void;
  celebration: CelebrationRole;
  celebrationKey: string | null;
};

/** The big felt card for the lesson the path points at next. */
function CurrentCard({ node, onOpen }: CardProps) {
  // Kept short so it stays on one line in a phone-width card.
  let eyebrow = `Lesson ${node.number} · Up next`;
  if (node.status === 'in-progress') eyebrow = `Lesson ${node.number} · Under way`;
  else if (node.minutes) eyebrow = `Lesson ${node.number} · ${node.minutes} min`;
  return (
    <Card tone="felt" elevation="high" style={styles.current}>
      <Text variant="eyebrow" color="onFeltMuted">
        {eyebrow}
      </Text>
      <Text variant="title2" color="onFelt">
        {node.title}
      </Text>
      <Text color="onFeltMuted">{node.summary}</Text>
      {node.step && <StepMeter at={node.step.at} of={node.step.of} />}
      <View style={styles.currentAction}>
        <Button
          title={nodeActionTitle(node)}
          variant="ivory"
          block
          accessibilityLabel={`${nodeActionTitle(node)}: ${node.title}`}
          onPress={() => onOpen(node.id)}
          testID={`path-open-${node.id}`}
        />
      </View>
    </Card>
  );
}

/** "Step 4 of 9" with a slim gold bar, for a lesson left partway. */
function StepMeter({ at, of }: { at: number; of: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.meter}>
      <View style={styles.meterTrack}>
        <View style={[styles.meterFill, { width: `${((at - 1) / of) * 100}%`, backgroundColor: colors.gold }]} />
      </View>
      <Text variant="caption" color="onFeltMuted">
        Step {at} of {of}
      </Text>
    </View>
  );
}

/** A finished lesson: the whole card opens it again. */
function FinishedCard({ node, onOpen }: CardProps) {
  const { colors, shadows } = useTheme();
  const reduceMotion = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const settle = (to: number) => scale.set(reduceMotion ? 1 : withSpring(to, PRESS_SPRING));
  const action = nodeActionTitle(node);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${nodeA11yLabel(node)} ${action}.`}
      onPress={() => onOpen(node.id)}
      onPressIn={() => settle(0.98)}
      onPressOut={() => settle(1)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={styles.focusShape}
      testID={`path-open-${node.id}`}
    >
      {({ pressed }) => (
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: pressed ? colors.surfaceSunken : colors.surface,
              borderColor: hovered ? colors.primaryText : colors.border,
              boxShadow: hovered ? shadows.medium : shadows.low,
            },
            pressStyle,
          ]}
        >
          <Text variant="eyebrow" color="primaryText">
            Lesson {node.number} · Finished
          </Text>
          <Text variant="title3">{node.title}</Text>
          <Text color="textMuted">
            {node.status === 'in-progress' && node.step
              ? `Replay under way: step ${node.step.at} of ${node.step.of}.`
              : node.best
                ? `${bestLine(node.best)}.`
                : 'Every step done.'}
          </Text>
          <View style={styles.cardAction}>
            <Text variant="headline" color="primaryText">
              {action}
            </Text>
            <Chevron color={colors.primaryText} />
          </View>
        </Animated.View>
      )}
    </Pressable>
  );
}

function Chevron({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16">
      <Path d="M6 3.5 10.5 8 6 12.5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

/** A lesson further along: locked, or reached but still being written. */
function WaitingCard({ node }: CardProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.card, styles.waiting, { borderColor: colors.border }]}
      accessible
      accessibilityLabel={nodeA11yLabel(node)}
    >
      <View style={styles.waitingHead}>
        <Text variant="eyebrow" color="textMuted">
          Lesson {node.number}
        </Text>
        {node.status === 'coming-soon' && <ComingSoon />}
      </View>
      <Text variant="title3" color="textMuted">
        {node.title}
      </Text>
      <Text color="textMuted">{node.status === 'coming-soon' ? node.summary : nodeStatusLine(node)}</Text>
      {node.status === 'coming-soon' && <Text color="textMuted">We’re still writing this one.</Text>}
    </View>
  );
}

/** Wraps a card so it rises into place when a celebration unlocks it. */
function Rise({ celebration, celebrationKey, children }: { celebration: CelebrationRole; celebrationKey: string | null; children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(1);
  useEffect(() => {
    if (celebration !== 'unlocked' || reduceMotion) return;
    t.set(0);
    t.set(withDelay(CELEBRATION_BEATS.unlocked + 80, withSpring(1, RISE_SPRING)));
  }, [celebration, celebrationKey, reduceMotion, t]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.35 + 0.65 * Math.min(1, t.get()),
    transform: [{ translateY: (1 - t.get()) * 18 }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

export type LessonPathProps = {
  nodes: readonly PathNode[];
  onOpen: (id: string) => void;
  /** A lesson just finished for the first time: play its celebration. */
  celebrating?: string | null;
};

/**
 * The Learn tab's lesson path: a trail winding down the left through a
 * medallion per lesson, with a card beside each. The lesson to do next gets
 * the big felt card; finished lessons open again on tap; the rest wait.
 */
export function LessonPath({ nodes, onOpen, celebrating = null }: LessonPathProps) {
  const [rowYs, setRowYs] = useState<(number | undefined)[]>([]);
  const [height, setHeight] = useState(0);

  const finishedIndex = celebrating ? nodes.findIndex((n) => n.id === celebrating) : -1;
  const next = celebrating ? unlockedBy(nodes, celebrating) : undefined;
  const roleOf = (node: PathNode): CelebrationRole => {
    if (finishedIndex === -1) return null;
    if (node.id === celebrating) return 'finished';
    if (node.id === next?.id) return 'unlocked';
    return null;
  };

  const onRowLayout = (index: number) => (e: LayoutChangeEvent) => {
    const y = e.nativeEvent.layout.y;
    setRowYs((ys) => {
      if (ys[index] === y && ys.length === nodes.length) return ys;
      const copy = Array.from({ length: nodes.length }, (_, i) => ys[i]);
      copy[index] = y;
      return copy;
    });
  };

  return (
    <View style={styles.path} onLayout={(e) => setHeight(e.nativeEvent.layout.height)} accessibilityRole="list">
      <Trail
        nodes={nodes}
        rowYs={rowYs.length === nodes.length ? rowYs : []}
        height={height}
        drawIndex={finishedIndex >= 0 && finishedIndex < nodes.length - 1 ? finishedIndex : -1}
        celebrationKey={celebrating}
      />
      {nodes.map((node, i) => {
        const role = roleOf(node);
        const props = { node, onOpen, celebration: role, celebrationKey: celebrating };
        const finished = node.completedBefore && !node.current;
        return (
          <View key={node.id} style={styles.row} onLayout={onRowLayout(i)} testID={`path-node-${node.id}`}>
            <View style={styles.gutter}>
              <View style={{ marginLeft: laneX(i) - MEDALLION / 2 }}>
                <PathMedallion node={node} celebration={role} celebrationKey={celebrating} />
              </View>
            </View>
            <View style={styles.cardColumn}>
              <Rise celebration={role} celebrationKey={celebrating}>
                {node.current ? (
                  <CurrentCard {...props} />
                ) : finished ? (
                  <FinishedCard {...props} />
                ) : (
                  <WaitingCard {...props} />
                )}
              </Rise>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  path: { marginTop: spacing.lg, gap: spacing.xl },
  trail: { position: 'absolute', left: 0, top: 0, width: GUTTER },
  reveal: { position: 'absolute', left: 0, width: GUTTER, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  gutter: { width: GUTTER, paddingTop: MEDALLION_TOP },
  cardColumn: { flex: 1, minWidth: 0 },
  current: { gap: spacing.sm, padding: spacing.lg, paddingTop: spacing.lg },
  currentAction: { marginTop: spacing.sm },
  card: {
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  focusShape: { borderRadius: radii.lg },
  cardAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
    minHeight: minTouchTarget - spacing.lg,
  },
  waiting: { borderStyle: 'dashed', backgroundColor: 'transparent' },
  waitingHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  meter: { gap: spacing.xs, marginTop: spacing.xs },
  meterTrack: { height: 6, borderRadius: radii.pill, backgroundColor: 'rgba(247, 241, 227, 0.16)', overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: radii.pill },
});
