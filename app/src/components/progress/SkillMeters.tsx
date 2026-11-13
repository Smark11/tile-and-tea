import { Fragment, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { Tile } from '@/components/tile/Tile';
import {
  isProvisional,
  meterFill,
  meterTicks,
  roundChange,
  skillLevel,
  type AnyDrill,
  type SkillInfo,
  type SkillRating,
} from '@/game/drills';
import { minTouchTarget, radii, spacing, useTheme } from '@/theme';

const PRESS_SPRING = { damping: 18, stiffness: 420, mass: 0.6 };
// Slow and soft, so the fill reads as earned rather than snapped into place.
const FILL_SPRING = { damping: 22, stiffness: 70, mass: 1 };
const FILL_STAGGER_MS = 110;
const TRACK_HEIGHT = 10;
const TICKS = meterTicks();

export type SkillMeterItem = {
  readonly skill: SkillInfo;
  /** Undefined until the skill has an answer. */
  readonly rating: SkillRating | undefined;
  /** The drill that trains it, opened from the row. */
  readonly drill: AnyDrill;
};

/** "Up 18 in your last round", for the row's spoken label. */
function changeWords(change: number): string {
  if (change > 0) return `Up ${change} in your last round.`;
  if (change < 0) return `Down ${-change} in your last round.`;
  return 'Level in your last round.';
}

export function skillMeterLabel({ skill, rating }: SkillMeterItem): string {
  if (!rating) return `${skill.title}. Not rated yet. ${skill.detail}`;
  const shown = Math.round(rating.rating);
  const answers = `${rating.answers} ${rating.answers === 1 ? 'answer' : 'answers'}`;
  const settling = isProvisional(rating) ? ', still settling' : '';
  return `${skill.title}. Rating ${shown}, ${skillLevel(rating.rating).name}${settling}. ${changeWords(roundChange(rating))} ${answers}.`;
}

/** A small arrow and number for the last round's change. The arrow's shape carries the direction, not just its colour. */
function Change({ change }: { change: number }) {
  const { colors } = useTheme();
  if (change === 0) return null;
  const up = change > 0;
  const color = up ? colors.primaryText : colors.textMuted;
  return (
    <View style={styles.change}>
      <Svg width={12} height={12} viewBox="0 0 12 12">
        <Path d={up ? 'M6 2 L11 9 H1 Z' : 'M6 10 L11 3 H1 Z'} fill={color} />
      </Svg>
      <Text variant="caption" style={{ color }} maxFontSizeMultiplier={1.6}>
        {Math.abs(change)}
      </Text>
    </View>
  );
}

/** The meter: a sunken track with notches at each band, filled in jade with a gold lead edge. */
function Meter({ fill, index }: { fill: number; index: number }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(reduceMotion ? fill : 0);
  useEffect(() => {
    if (reduceMotion) t.set(fill);
    else t.set(withDelay(150 + index * FILL_STAGGER_MS, withSpring(fill, FILL_SPRING)));
  }, [fill, index, reduceMotion, t]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${Math.max(0, Math.min(1, t.get())) * 100}%` }));
  return (
    <View
      style={[styles.track, { backgroundColor: colors.surfaceSunken, borderColor: colors.border }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {TICKS.map((tick) => (
        <View key={tick} style={[styles.tick, { left: `${tick * 100}%`, backgroundColor: colors.border }]} />
      ))}
      <Animated.View style={[styles.fill, { backgroundColor: colors.primary }, fillStyle]}>
        {fill > 0 && <View style={[styles.lead, { backgroundColor: colors.gold }]} />}
      </Animated.View>
    </View>
  );
}

function SkillRow({ item, index, onOpen }: { item: SkillMeterItem; index: number; onOpen: (drill: AnyDrill) => void }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const press = (to: number) => {
    if (!reduceMotion) scale.set(withSpring(to, PRESS_SPRING));
  };
  const { skill, rating, drill } = item;
  const level = rating ? skillLevel(rating.rating) : null;

  return (
    <Animated.View style={pressStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={skillMeterLabel(item)}
        accessibilityHint={`Opens the ${drill.title} drill.`}
        onPress={() => onOpen(drill)}
        onPressIn={() => press(0.98)}
        onPressOut={() => press(1)}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        testID={`skill-meter-${skill.id}`}
        style={({ pressed }) => [styles.row, { backgroundColor: pressed || hovered ? colors.surfaceSunken : 'transparent' }]}
      >
        <View style={styles.leading}>
          <Tile kind={drill.icon} size="S" />
        </View>
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text variant="headline" style={styles.title}>
              {skill.title}
            </Text>
            <Text variant="title3" color={rating ? 'primaryText' : 'textMuted'} maxFontSizeMultiplier={1.6}>
              {rating ? Math.round(rating.rating) : '—'}
            </Text>
          </View>
          <Meter fill={rating ? meterFill(rating.rating) : 0} index={index} />
          <View style={styles.levelRow}>
            <Text variant="caption" color={level ? 'goldText' : 'textMuted'} style={styles.levelText}>
              {level
                ? `${level.name}${rating && isProvisional(rating) ? ' · settling in' : ''}`
                : `Not rated yet · try ${drill.title}`}
            </Text>
            {rating && <Change change={roundChange(rating)} />}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** Every skill's rating as a meter, in a grouped list. Each row opens the drill that trains it. */
export function SkillMeters({ items, onOpen }: { items: readonly SkillMeterItem[]; onOpen: (drill: AnyDrill) => void }) {
  const { colors } = useTheme();
  return (
    <Card elevation="low" style={styles.list}>
      {items.map((item, i) => (
        <Fragment key={item.skill.id}>
          {i > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
          <SkillRow item={item} index={i} onOpen={onOpen} />
        </Fragment>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: spacing.xs, paddingHorizontal: spacing.xs, gap: 0 },
  divider: { height: StyleSheet.hairlineWidth * 2, marginLeft: minTouchTarget + spacing.md + spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: minTouchTarget,
    borderRadius: radii.md,
  },
  leading: { width: minTouchTarget, alignItems: 'center' },
  body: { flex: 1, gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  title: { flex: 1 },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  levelText: { flex: 1 },
  change: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  tick: { position: 'absolute', top: 0, bottom: 0, width: 2, marginLeft: -1 },
  fill: { height: '100%', borderRadius: radii.pill, alignItems: 'flex-end', justifyContent: 'center' },
  lead: { width: 4, height: TRACK_HEIGHT - 4, borderRadius: radii.pill, marginRight: 2 },
});
