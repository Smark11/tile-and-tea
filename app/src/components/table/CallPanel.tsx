import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { Tile } from '@/components/tile/Tile';
import type { Seat } from '@/game/engine';
import { singular } from '@/game/drills/content/words';
import {
  callLabel,
  EXPOSURE_NAMES,
  SEAT_NAMES,
  swapLabel,
  type CallChoices,
  type CallOption,
  type SwapOption,
} from '@/game/table';
import { feltTones, minTouchTarget, palette, paletteAlpha, radii, spacing } from '@/theme';

import type { CallTimer } from './useTableGame';

const PRESS_SPRING = { damping: 14, stiffness: 380, mass: 0.6 };

/** A tappable choice laid on the felt: tiles on the left, what it does on the right. */
function FeltChoice({
  tiles,
  title,
  detail,
  label,
  onPress,
  testID,
  compact = false,
}: {
  tiles: React.ReactNode;
  title: string;
  detail: string;
  label: string;
  onPress: () => void;
  testID?: string;
  /** A small chip, tiles above words, so several sit side by side. */
  compact?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const settle = (to: number) => scale.set(reduceMotion ? 1 : withSpring(to, PRESS_SPRING));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={() => settle(0.97)}
      onPressOut={() => settle(hovered ? 1.01 : 1)}
      onHoverIn={() => {
        setHovered(true);
        settle(1.01);
      }}
      onHoverOut={() => {
        setHovered(false);
        settle(1);
      }}
      style={[styles.choicePress, compact && styles.chipPress]}
      testID={testID}
    >
      {({ pressed }) => (
        <Animated.View
          style={[
            styles.choice,
            compact && styles.chip,
            (hovered || pressed) && styles.choiceHot,
            pressed && styles.choicePressed,
            animated,
          ]}
        >
          <View style={styles.choiceTiles} importantForAccessibility="no-hide-descendants">
            {tiles}
          </View>
          <View style={compact ? styles.chipText : styles.choiceText}>
            <Text variant="headline" color="onFelt" align={compact ? 'center' : undefined}>
              {title}
            </Text>
            <Text variant="caption" color="onFeltMuted" align={compact ? 'center' : undefined}>
              {detail}
            </Text>
          </View>
        </Animated.View>
      )}
    </Pressable>
  );
}

/** The last seconds of the window, when the bar warms toward red and the count turns bold. */
const URGENT_SECONDS = 3;

/**
 * The call window draining away: a gold bar, the seconds left, and a button
 * to pause it. With Reduce Motion it steps once a second instead of gliding.
 * Once paused it says so, and waits for the player.
 */
export function CallTimerBar({
  timer,
  onHold,
  children,
}: {
  timer: CallTimer;
  onHold: () => void;
  /** The "Let it go" button, which sits beside the pause button. */
  children: React.ReactNode;
}) {
  if (timer.paused) {
    return (
      <Animated.View entering={FadeIn.duration(180)} style={styles.pausedRow}>
        <View
          style={styles.pausedPill}
          accessible
          accessibilityLabel="Timer paused. Take your time: the tile waits until you choose."
          testID="table-call-paused"
        >
          <Text variant="caption" color="onFelt" style={styles.pausedGlyph} importantForAccessibility="no">
            ❚❚
          </Text>
          <Text variant="caption" color="onFelt">
            Paused · take your time
          </Text>
        </View>
        {children}
      </Animated.View>
    );
  }
  return (
    <RunningTimer timer={timer} onHold={onHold}>
      {children}
    </RunningTimer>
  );
}

function RunningTimer({
  timer,
  onHold,
  children,
}: {
  timer: CallTimer;
  onHold: () => void;
  children: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const seconds = Math.ceil(timer.ms / 1000);
  const [left, setLeft] = useState(seconds);
  const [key, setKey] = useState(timer.key);
  const fill = useSharedValue(1);
  if (key !== timer.key) {
    setKey(timer.key);
    setLeft(seconds);
  }
  useEffect(() => {
    fill.set(1);
    if (!timer.running) {
      // A frozen demo table: show the window part spent, standing still.
      fill.set(0.62);
      return;
    }
    if (!reduceMotion) fill.set(withTiming(0, { duration: timer.ms, easing: Easing.linear }));
    const started = Date.now();
    const tick = setInterval(() => {
      const remaining = Math.max(0, timer.ms - (Date.now() - started));
      setLeft(Math.ceil(remaining / 1000));
      if (reduceMotion) fill.set(remaining / timer.ms);
    }, 250);
    return () => clearInterval(tick);
  }, [timer.key, timer.ms, timer.running, reduceMotion, fill]);
  // Scaled from the left edge rather than resized, so the countdown only composites.
  const bar = useAnimatedStyle(() => ({ transform: [{ scaleX: fill.get() }] }));
  const shown = timer.running ? left : Math.ceil(seconds * 0.62);
  const urgent = timer.running && shown <= URGENT_SECONDS;
  return (
    <View style={styles.stack}>
      <View style={styles.timerRow}>
        <View
          style={styles.timerTrack}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Seconds left to call before the tile is let go"
          accessibilityValue={{
            min: 0,
            max: seconds,
            now: shown,
            text: `${shown} ${shown === 1 ? 'second' : 'seconds'}`,
          }}
          testID="table-call-timer"
        >
          <Animated.View style={[styles.timerFill, urgent && styles.timerFillUrgent, bar]} />
        </View>
        <Text
          variant="caption"
          color="onFelt"
          style={[styles.timerSeconds, urgent && styles.timerSecondsUrgent]}
          importantForAccessibility="no"
          accessibilityElementsHidden
          testID="table-call-seconds"
        >
          {`${shown}s left`}
        </Text>
      </View>
      <View style={styles.passRow}>
        <Button
          title="Pause timer"
          accessibilityLabel="Pause timer: keep this tile on offer until you choose"
          variant="outlineOnFelt"
          onPress={onHold}
          testID="table-call-wait"
        />
        {children}
      </View>
    </View>
  );
}

function jokerDetail(option: CallOption): string {
  return option.jokers === 0 ? 'No Jokers' : option.jokers === 1 ? '1 Joker' : `${option.jokers} Jokers`;
}

function optionDetail(option: CallOption): string {
  const hands =
    option.handsLeft === 1 ? '1 hand on the card still fits' : `${option.handsLeft} hands on the card still fit`;
  return `${jokerDetail(option)} · ${hands}`;
}

const GROUP_TITLES: Record<string, string> = { pung: 'Pung', kong: 'Kong', quint: 'Quint', sextet: 'Sextet' };

export type CallActionsProps = {
  choices: CallChoices;
  timer: CallTimer | null;
  onHold: () => void;
  onMahJongg: () => void;
  onExpose: (option: CallOption) => void;
  onPass: () => void;
};

/** What the player can do with a discard on offer: Mah Jongg, an exposure, or let it go. */
export function CallActions({ choices, timer, onHold, onMahJongg, onExpose, onPass }: CallActionsProps) {
  const letGo = <Button title="Let it go" variant="outlineOnFelt" testID="table-call-pass" onPress={onPass} />;
  return (
    <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.stack} testID="table-call-actions">
      {choices.mahJongg && (
        <Button title="Call Mah Jongg" variant="ivory" block testID="table-call-mahjongg" onPress={onMahJongg} />
      )}
      {choices.exposures.length > 0 && (
        <View style={styles.chips}>
          {choices.exposures.map((option) => (
            <FeltChoice
              key={option.size}
              compact
              title={GROUP_TITLES[option.name]}
              detail={jokerDetail(option)}
              label={`${callLabel(option)}. ${optionDetail(option)}.`}
              onPress={() => onExpose(option)}
              testID={`table-call-${option.name}`}
              tiles={option.group.map((t, i) => (
                <Tile key={t.id} kind={t.kind} copy={t.copy} width={24} style={i === 0 && styles.calledTile} />
              ))}
            />
          ))}
        </View>
      )}
      {timer ? (
        <CallTimerBar timer={timer} onHold={onHold}>
          {letGo}
        </CallTimerBar>
      ) : (
        <View style={styles.passRow}>{letGo}</View>
      )}
    </Animated.View>
  );
}

/** The Joker swaps open on the player's turn. */
export function SwapActions({
  options,
  you,
  onSwap,
}: {
  options: readonly SwapOption[];
  you: Seat;
  onSwap: (option: SwapOption) => void;
}) {
  if (options.length === 0) return null;
  return (
    <View style={styles.choices} testID="table-swaps">
      {options.map((option) => {
        const joker = option.group.tiles.find((t) => t.kind.type === 'joker')!;
        const whose = option.owner === you ? 'your' : `${SEAT_NAMES[option.owner]}’s`;
        return (
          <FeltChoice
            key={`${option.owner}-${option.exposure}`}
            title="Swap for the Joker"
            detail={`Your ${singular(option.tile.kind)} goes into ${whose} ${EXPOSURE_NAMES[option.group.tiles.length]}; the Joker comes to your rack.`}
            label={`${swapLabel(option, you, (s) => SEAT_NAMES[s])}.`}
            onPress={() => onSwap(option)}
            testID={`table-swap-${option.owner}-${option.exposure}`}
            tiles={
              <>
                <Tile kind={option.tile.kind} copy={option.tile.copy} width={26} />
                <Text color="onFelt" style={styles.swapArrow}>
                  ⇄
                </Text>
                <Tile kind={joker.kind} copy={joker.copy} width={26} />
              </>
            }
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
  choices: { gap: spacing.sm },
  choicePress: { borderRadius: radii.md },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: minTouchTarget,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: feltTones.goldHairline,
    backgroundColor: paletteAlpha('ivory', 0.06),
  },
  choiceHot: { backgroundColor: paletteAlpha('ivory', 0.12), borderColor: palette.gold },
  choicePressed: { backgroundColor: paletteAlpha('ivory', 0.16) },
  choiceTiles: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  calledTile: { marginRight: spacing.xxs },
  // Title and detail share a line when there's room, and wrap under each other when not.
  choiceText: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chipPress: { flexGrow: 1 },
  chip: { flexDirection: 'column', gap: spacing.xxs, paddingVertical: spacing.xs, paddingHorizontal: spacing.xs },
  chipText: { alignItems: 'center' },
  passRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.sm },
  swapArrow: { marginHorizontal: spacing.xs, color: palette.gold },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pausedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  timerTrack: {
    flex: 1,
    minWidth: 64,
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: paletteAlpha('ivory', 0.12),
    overflow: 'hidden',
  },
  timerFill: {
    width: '100%',
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: palette.gold,
    transformOrigin: 'left',
  },
  // A warm vermilion between the gold and lacquer red, bright enough to read on jade.
  timerFillUrgent: { backgroundColor: '#E0704F' },
  // Fixed width and tabular figures, so the count never shifts what's beside it.
  timerSeconds: { minWidth: 52, textAlign: 'right', fontVariant: ['tabular-nums'] },
  timerSecondsUrgent: { fontWeight: '700' },
  pausedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: minTouchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: feltTones.goldHairline,
    backgroundColor: paletteAlpha('ivory', 0.08),
  },
  pausedGlyph: { color: palette.gold, letterSpacing: -2 },
});
