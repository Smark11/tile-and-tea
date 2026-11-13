import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';

import { hapticTick } from '@/components/haptics';
import { CardLineBody } from '@/components/lesson/CardLineView';
import { Text } from '@/components/Text';
import { CURRENT_CARD } from '@/game/card';
import { cardInks, fontFamilies, radii, spacing, useTheme } from '@/theme';

const PRESS_SPRING = { damping: 18, stiffness: 380, mass: 0.7 };

/** A corner of the practice card peeking out, which opens the whole card. */
export function PracticeCardLink() {
  const { shadows } = useTheme();
  const reduceMotion = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const settle = (to: number) => scale.set(reduceMotion ? 1 : withSpring(to, PRESS_SPRING));
  const card = CURRENT_CARD;
  const sample = card.hands[0];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open the ${card.title}. ${card.hands.length} hands to learn on.`}
      testID="practice-card-link"
      onPress={() => {
        hapticTick();
        router.push('/card');
      }}
      onPressIn={() => settle(0.98)}
      onPressOut={() => settle(hovered ? 1.01 : 1)}
      onHoverIn={() => {
        setHovered(true);
        settle(1.01);
      }}
      onHoverOut={() => {
        setHovered(false);
        settle(1);
      }}
      style={styles.focusShape}
    >
      <Animated.View style={[styles.sheet, { boxShadow: hovered ? shadows.high : shadows.medium }, animatedStyle]}>
        <View style={styles.border}>
          <View style={styles.top}>
            <View style={styles.titles}>
              <Text style={styles.kicker}>Your card</Text>
              <Text style={styles.title}>{card.title}</Text>
            </View>
            <Text style={styles.count}>{`${card.hands.length} hands`}</Text>
          </View>
          <View style={styles.sample}>
            <CardLineBody line={sample.line} />
          </View>
          <View style={styles.footer}>
            <Text style={styles.open}>Open the card</Text>
            <Text style={styles.arrow}>→</Text>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  focusShape: { borderRadius: radii.lg },
  sheet: {
    backgroundColor: cardInks.paper,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    padding: spacing.xs + 2,
    borderBottomWidth: 3,
    borderBottomColor: cardInks.paperShade,
  },
  border: {
    borderWidth: 1,
    borderColor: cardInks.rule,
    borderRadius: radii.md,
    borderCurve: 'continuous',
    padding: spacing.lg,
    gap: spacing.md,
  },
  top: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  titles: { flex: 1, gap: spacing.xxs },
  kicker: {
    fontFamily: fontFamilies.sansSemiBold,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: cardInks.muted,
  },
  title: { fontFamily: fontFamilies.serif, fontSize: 22, lineHeight: 28, color: cardInks.plain },
  count: { fontFamily: fontFamilies.serifItalic, fontSize: 15, lineHeight: 20, color: cardInks.muted },
  sample: { paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: cardInks.paperShade },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.xs },
  open: { fontFamily: fontFamilies.sansSemiBold, fontSize: 17, lineHeight: 22, color: cardInks.suit1 },
  arrow: { fontFamily: fontFamilies.sansSemiBold, fontSize: 17, lineHeight: 22, color: cardInks.suit1 },
});
