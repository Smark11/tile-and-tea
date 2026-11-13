import { Fragment, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Card } from '@/components/Card';
import { hapticTick } from '@/components/haptics';
import { Text } from '@/components/Text';
import { Tile } from '@/components/tile/Tile';
import { BOT_LEVELS, type BotLevel } from '@/game/bots';
import { minTouchTarget, radii, spacing, useTheme } from '@/theme';

import { LEVEL_INFO } from './levels';

const DOT_SPRING = { damping: 14, stiffness: 260, mass: 0.6 };
const PRESS_SPRING = { damping: 18, stiffness: 320 };

/** One to three pips: how strong the level plays. */
function Strength({ level }: { level: BotLevel }) {
  const { colors } = useTheme();
  const filled = BOT_LEVELS.indexOf(level) + 1;
  return (
    <View style={styles.pips} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {BOT_LEVELS.map((l, i) => (
        <View
          key={l}
          style={[
            styles.pip,
            { borderColor: colors.gold, backgroundColor: i < filled ? colors.gold : 'transparent' },
          ]}
        />
      ))}
    </View>
  );
}

function Radio({ checked }: { checked: boolean }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(checked ? 1 : 0);
  useEffect(() => {
    scale.set(reduceMotion ? (checked ? 1 : 0) : withSpring(checked ? 1 : 0, DOT_SPRING));
  }, [checked, reduceMotion, scale]);
  const dot = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }], opacity: scale.get() > 0.01 ? 1 : 0 }));
  return (
    <View style={[styles.radio, { borderColor: checked ? colors.primary : colors.border }]}>
      <Animated.View style={[styles.radioDot, { backgroundColor: colors.primary }, dot]} />
    </View>
  );
}

function OpponentRow({ level, checked, onChoose }: { level: BotLevel; checked: boolean; onChoose: () => void }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const press = (to: number) => {
    if (!reduceMotion) scale.set(withSpring(to, PRESS_SPRING));
  };
  const info = LEVEL_INFO[level];
  const strength = BOT_LEVELS.indexOf(level) + 1;
  return (
    <Animated.View style={pressStyle}>
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ checked }}
        accessibilityLabel={`${info.name} opponents, strength ${strength} of ${BOT_LEVELS.length}. ${info.detail}`}
        onPress={() => {
          if (!checked) hapticTick();
          onChoose();
        }}
        onPressIn={() => press(0.98)}
        onPressOut={() => press(1)}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        testID={`opponent-${level}`}
        style={({ pressed }) => [
          styles.row,
          {
            borderColor: checked ? colors.primary : 'transparent',
            backgroundColor: pressed || (hovered && !checked) ? colors.surfaceSunken : 'transparent',
          },
        ]}
      >
        <View style={styles.leading}>
          <Tile kind={info.tile} size="S" />
        </View>
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text variant="headline" color={checked ? 'primaryText' : 'text'}>
              {info.name}
            </Text>
            <Strength level={level} />
          </View>
          <Text variant="caption">{info.detail}</Text>
        </View>
        <Radio checked={checked} />
      </Pressable>
    </Animated.View>
  );
}

/** The three opponent levels as one radio group. */
export function OpponentPicker({ value, onChange }: { value: BotLevel; onChange: (level: BotLevel) => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text variant="title3">Opponents</Text>
      <Card elevation="low" style={styles.list}>
        <View accessibilityRole="radiogroup" accessibilityLabel="Opponents" style={styles.group}>
          {BOT_LEVELS.map((level, i) => (
            <Fragment key={level}>
              {/* Dividers next to the chosen row step aside for its outline. */}
              {i > 0 && (
                <View
                  style={[
                    styles.divider,
                    {
                      backgroundColor:
                        value === level || value === BOT_LEVELS[i - 1] ? 'transparent' : colors.border,
                    },
                  ]}
                />
              )}
              <OpponentRow level={level} checked={value === level} onChoose={() => onChange(level)} />
            </Fragment>
          ))}
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md, marginTop: spacing.md },
  list: { padding: spacing.xs, gap: 0 },
  group: { gap: 0 },
  divider: { height: StyleSheet.hairlineWidth * 2, marginLeft: minTouchTarget + spacing.md * 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: minTouchTarget,
    borderRadius: radii.md,
    borderWidth: 2,
  },
  leading: { width: minTouchTarget, alignItems: 'center' },
  body: { flex: 1, gap: spacing.xxs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pips: { flexDirection: 'row', gap: 4 },
  pip: { width: 8, height: 8, borderRadius: 2, borderWidth: 1.5, transform: [{ rotate: '45deg' }] },
  radio: {
    width: 24,
    height: 24,
    borderRadius: radii.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 12, height: 12, borderRadius: radii.pill },
});
