import { Fragment, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

import type { PrincipleProgress } from '@/game/playbook';
import { palette, radii, spacing } from '@/theme';

const POP = { damping: 14, stiffness: 260, mass: 0.7 };

/** One principle: a little upright tile, gilded once mastered. */
function Pip({ mastered, index, size }: { mastered: boolean; index: number; size: number }) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(reduceMotion || !mastered ? 1 : 0.4);
  useEffect(() => {
    if (!reduceMotion && mastered) scale.set(withDelay(80 + index * 45, withSpring(1, POP)));
  }, [mastered, index, reduceMotion, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <Animated.View
      style={[
        styles.pip,
        { width: size, height: Math.round(size * 1.36) },
        mastered ? styles.mastered : styles.open,
        style,
      ]}
    />
  );
}

type Props = {
  progress: readonly PrincipleProgress[];
  /** Pip width in points. */
  size?: number;
};

/**
 * Every principle as a pip on the felt, a small gap between stages, gold for
 * each one mastered. Decorative: the count beside it says the same in words.
 */
export function MasteryPips({ progress, size = 14 }: Props) {
  return (
    <View style={styles.row} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {progress.map((p, i) => (
        <Fragment key={p.principle.id}>
          {i > 0 && p.principle.stage !== progress[i - 1].principle.stage && <View style={styles.stageGap} />}
          <Pip mastered={p.mastered} index={i} size={size} />
        </Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  stageGap: { width: spacing.sm },
  pip: { borderRadius: radii.sm / 2, borderCurve: 'continuous' },
  mastered: {
    backgroundColor: palette.gold,
    borderBottomWidth: 2,
    borderBottomColor: '#9C7A2E',
    boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.35)',
  },
  open: { borderWidth: 1.5, borderColor: 'rgba(246, 241, 231, 0.35)', backgroundColor: 'rgba(246, 241, 231, 0.06)' },
});
