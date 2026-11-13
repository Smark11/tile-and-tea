import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { Text } from '@/components/Text';
import { useGradientUid } from '@/components/tile/TileFace';
import type { PathNode } from '@/game/lessons';
import { useTheme } from '@/theme';
import { tileInks } from '@/theme/tileInks';

import { MEDALLION } from './trail';

/** How a medallion joins in a celebration: the one just finished, or the one it opened. */
export type CelebrationRole = 'finished' | 'unlocked' | null;

/** When each beat of the celebration starts, in ms. */
export const CELEBRATION_BEATS = { finished: 0, trail: 320, unlocked: 980 } as const;

const POP_SPRING = { damping: 9, stiffness: 180, mass: 0.7 };
const SIZE = MEDALLION;
const C = SIZE / 2;

// Sparks thrown out by a finish: little tile-colored diamonds.
const SPARKS = Array.from({ length: 10 }, (_, i) => ({
  angle: (i / 10) * Math.PI * 2 + (i % 2 ? 0.18 : -0.1),
  distance: i % 2 ? 46 : 58,
  size: i % 3 === 0 ? 9 : 7,
  tone: (['gold', 'jade', 'red', 'ivory'] as const)[i % 4],
}));

function Spark({ spark, progress }: { spark: (typeof SPARKS)[number]; progress: { get(): number } }) {
  const { colors } = useTheme();
  const fill = { gold: colors.gold, jade: colors.primary, red: colors.danger, ivory: colors.tileFace }[spark.tone];
  const style = useAnimatedStyle(() => {
    const t = progress.get();
    return {
      opacity: t <= 0 || t >= 1 ? 0 : Math.min(1, (1 - t) * 2.2),
      transform: [
        { translateX: Math.cos(spark.angle) * spark.distance * t },
        { translateY: Math.sin(spark.angle) * spark.distance * t },
        { rotate: `${45 + t * 90}deg` },
        { scale: 1 - t * 0.4 },
      ],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.spark,
        { width: spark.size, height: spark.size, marginLeft: -spark.size / 2, marginTop: -spark.size / 2, backgroundColor: fill },
        style,
      ]}
    />
  );
}

function Check({ color }: { color: string }) {
  return <Path d={`M${C - 9} ${C + 0.5} l6.2 6.2 L${C + 10} ${C - 7.5}`} stroke={color} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />;
}

function Lock({ color }: { color: string }) {
  return (
    <>
      <Path d={`M${C - 6} ${C - 2} v-4.5 a6 6 0 0 1 12 0 v4.5`} stroke={color} strokeWidth={2.4} fill="none" strokeLinecap="round" />
      <Rect x={C - 9} y={C - 2.5} width={18} height={13} rx={3} fill={color} />
    </>
  );
}

/** The arc around an unfinished lesson, showing how far the player got. */
function ProgressArc({ fraction, color, track }: { fraction: number; color: string; track: string }) {
  const radius = C - 2.5;
  const circumference = 2 * Math.PI * radius;
  const shown = Math.max(0.04, Math.min(1, fraction));
  return (
    <>
      <Circle cx={C} cy={C} r={radius} stroke={track} strokeWidth={5} fill="none" />
      <Circle
        cx={C}
        cy={C}
        r={radius}
        stroke={color}
        strokeWidth={5}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${circumference * shown} ${circumference}`}
        transform={`rotate(-90 ${C} ${C})`}
      />
    </>
  );
}

type PathMedallionProps = {
  node: PathNode;
  celebration?: CelebrationRole;
  /** Bumped to replay the celebration. */
  celebrationKey?: string | null;
};

/**
 * The round marker on the trail for one lesson: a jade seal with a gold check
 * once finished, an ivory tile-face disc to start, and a muted lock ahead.
 */
export function PathMedallion({ node, celebration = null, celebrationKey = null }: PathMedallionProps) {
  const { colors, shadows } = useTheme();
  const reduceMotion = useReducedMotion();
  const uid = useGradientUid();
  const finished = node.status === 'complete' || (node.status === 'in-progress' && node.completedBefore);
  const open = node.playable && !finished;
  const waiting = node.status === 'locked' || node.status === 'coming-soon';

  // Celebration: the medallion pops in, and a finish throws sparks.
  const pop = useSharedValue(1);
  const sparks = useSharedValue(0);
  useEffect(() => {
    if (!celebration || reduceMotion) return;
    const delay = CELEBRATION_BEATS[celebration];
    pop.set(0.55);
    pop.set(withDelay(delay, withSpring(1, POP_SPRING)));
    if (celebration === 'finished') {
      sparks.set(0);
      sparks.set(withDelay(delay + 60, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) })));
    }
  }, [celebration, celebrationKey, reduceMotion, pop, sparks]);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() }] }));

  // The next lesson breathes with a soft jade halo, so the eye finds it.
  const halo = useSharedValue(0);
  const isCurrent = node.current;
  useEffect(() => {
    if (!isCurrent || reduceMotion) return;
    halo.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      ),
    );
  }, [isCurrent, reduceMotion, halo]);
  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.14 + halo.get() * 0.14,
    transform: [{ scale: 1 + halo.get() * 0.1 }],
  }));

  // Named by look, so ids shared while hydrating still resolve to the right fill.
  const gradientId = `medal-${finished ? 'jade' : 'ivory'}${uid}`;

  return (
    <View style={styles.box} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {node.current && <Animated.View style={[styles.halo, { backgroundColor: colors.primary }, haloStyle]} />}
      {celebration === 'finished' && SPARKS.map((s, i) => <Spark key={i} spark={s} progress={sparks} />)}
      <Animated.View
        style={[
          styles.disc,
          { boxShadow: waiting ? 'none' : node.current ? shadows.high : shadows.medium },
          popStyle,
        ]}
      >
        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={finished ? tileInks.rackLedgeLight : tileInks.faceLight} />
              <Stop offset="1" stopColor={finished ? colors.primaryPressed : tileInks.faceShade} />
            </LinearGradient>
          </Defs>
          {finished && (
            <>
              <Circle cx={C} cy={C} r={C} fill={colors.gold} />
              <Circle cx={C} cy={C} r={C - 3.5} fill={`url(#${gradientId})`} />
              <Circle cx={C} cy={C} r={C - 7} stroke="rgba(247, 241, 227, 0.22)" strokeWidth={1} fill="none" />
              <Check color={tileInks.faceLight} />
            </>
          )}
          {open && (
            <>
              <Circle cx={C} cy={C} r={C} fill={tileInks.edge} />
              <Circle cx={C} cy={C} r={C - 1.5} fill={`url(#${gradientId})`} />
              {node.status === 'in-progress' ? (
                <ProgressArc fraction={node.fraction} color={colors.gold} track="rgba(15, 61, 51, 0.12)" />
              ) : (
                <Circle cx={C} cy={C} r={C - 2.5} stroke={colors.gold} strokeWidth={3} fill="none" />
              )}
            </>
          )}
          {waiting && (
            <>
              <Circle cx={C} cy={C} r={C - 1} fill={colors.surfaceSunken} />
              <Circle
                cx={C}
                cy={C}
                r={C - 1.5}
                stroke={node.status === 'coming-soon' ? colors.gold : colors.border}
                strokeWidth={2}
                strokeDasharray={node.status === 'coming-soon' ? '3 5' : undefined}
                strokeLinecap="round"
                fill="none"
              />
              {node.status === 'locked' && <Lock color={colors.textMuted} />}
            </>
          )}
        </Svg>
        {!finished && node.status !== 'locked' && (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <View style={styles.numeral}>
              <Text variant="title3" maxFontSizeMultiplier={1} color={open ? 'felt' : 'textMuted'}>
                {node.number}
              </Text>
            </View>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  disc: { width: SIZE, height: SIZE, borderRadius: SIZE / 2 },
  halo: { position: 'absolute', width: SIZE + 16, height: SIZE + 16, borderRadius: (SIZE + 16) / 2 },
  numeral: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  spark: { position: 'absolute', left: C, top: C, borderRadius: 2 },
});
