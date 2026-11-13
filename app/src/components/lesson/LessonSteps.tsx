import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { Tile, tileDimensions } from '@/components/tile/Tile';
import type { FeedbackMessage, TapStep, TextStep, TilesStep } from '@/game/lessons';
import type { TileKind } from '@/game/tiles';
import { radii, spacing, tileInks, useTheme } from '@/theme';

// The pieces of a lesson page. They're presentational: the player (and the
// styleguide) pass in exactly what to show, so every state can be rendered
// on its own.

const ENTER_SPRING = { damping: 20, stiffness: 180, mass: 0.9 };
const TILE_GAP = spacing.md;
const MIN_TILE = 44;
const MAX_TILE = 84;

/** Fades and slides its content in on mount; key it by step so each page arrives. */
export function Entrance({ children, distance = 20 }: { children: ReactNode; distance?: number }) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (!reduceMotion) progress.set(withSpring(1, ENTER_SPRING));
  }, [progress, reduceMotion]);
  const style = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: (1 - progress.get()) * distance }],
  }));
  return <Animated.View style={[styles.entrance, style]}>{children}</Animated.View>;
}

function Paragraphs({ body, color }: { body: string; color?: 'text' | 'onFeltMuted' }) {
  return (
    <View style={styles.paragraphs}>
      {body.split(/\n\s*\n/).map((p, i) => (
        <Text key={i} color={color}>
          {p.trim()}
        </Text>
      ))}
    </View>
  );
}

/** Rows that read well: up to four in a row, otherwise two balanced rows. */
export function tilesPerRow(count: number): number {
  return count <= 4 ? count : Math.ceil(count / 2);
}

/** The widest tile that fits `perRow` across `available` points, within limits. */
export function fitTileWidth(available: number, perRow: number): number {
  const width = Math.floor((available - (perRow - 1) * TILE_GAP) / perRow);
  return Math.max(MIN_TILE, Math.min(MAX_TILE, width));
}

type SpreadTile = {
  kind: TileKind;
  selected?: boolean;
  hint?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  testID?: string;
};

/** Tiles laid out on the felt in balanced rows, sized to the space they have. */
function TileSpread({ tiles }: { tiles: readonly SpreadTile[] }) {
  const [available, setAvailable] = useState(0);
  const perRow = tilesPerRow(tiles.length);
  const width = available > 0 ? fitTileWidth(available, perRow) : 64;
  const rows: SpreadTile[][] = [];
  for (let i = 0; i < tiles.length; i += perRow) rows.push(tiles.slice(i, i + perRow));
  const onLayout = (e: LayoutChangeEvent) => setAvailable(e.nativeEvent.layout.width);
  // Selected tiles rise, so leave headroom for them above the first row.
  const headroom = Math.round(tileDimensions(width).height * 0.16);
  return (
    <View onLayout={onLayout} style={[styles.spread, { paddingTop: headroom }]}>
      {rows.map((row, r) => (
        <View key={r} style={styles.spreadRow}>
          {row.map((t, i) => (
            <Tile
              key={i}
              kind={t.kind}
              width={width}
              selected={t.selected}
              hint={t.hint}
              disabled={t.disabled}
              onPress={t.onPress}
              testID={t.testID}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

export function TextStepView({ step }: { step: TextStep }) {
  const { colors } = useTheme();
  return (
    <View style={styles.step}>
      <Text variant="title1">{step.title}</Text>
      <View style={[styles.rule, { backgroundColor: colors.gold }]} />
      <Paragraphs body={step.body} />
    </View>
  );
}

export function TilesStepView({ step }: { step: TilesStep }) {
  return (
    <View style={styles.step}>
      <Text variant="title1">{step.title}</Text>
      <Card tone="felt" elevation="high" style={styles.mat}>
        <View accessible accessibilityRole="image" accessibilityLabel={step.caption}>
          <TileSpread tiles={step.tiles.map((kind) => ({ kind }))} />
        </View>
        <Text variant="callout" color="onFeltMuted" align="center" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {step.caption}
        </Text>
      </Card>
      <Paragraphs body={step.body} />
    </View>
  );
}

export type TapStepViewProps = {
  step: TapStep;
  selected: readonly number[];
  /** Highlight the right tiles with the coach's star (after a reveal). */
  revealAnswer: boolean;
  /** The question is settled; dim the tiles that aren't the answer. */
  settled: boolean;
  onTap: (index: number) => void;
  /** One right answer means a tap answers; otherwise pick them all, then Check. */
  singleAnswer: boolean;
};

export function TapStepView({ step, selected, revealAnswer, settled, onTap, singleAnswer }: TapStepViewProps) {
  return (
    <View style={styles.step}>
      <Text variant="eyebrow">Your turn</Text>
      <Text variant="title1">{step.prompt}</Text>
      <Text color="textMuted">
        {singleAnswer ? 'Tap a tile to answer.' : 'Tap each one you find, then Check.'}
      </Text>
      <Card tone="felt" elevation="high" style={styles.mat}>
        <TileSpread
          tiles={step.choices.map((choice, i) => ({
            kind: choice.tile,
            selected: !revealAnswer && selected.includes(i),
            hint: revealAnswer && choice.correct === true,
            disabled: settled && !choice.correct,
            onPress: () => onTap(i),
            testID: `lesson-choice-${i}`,
          }))}
        />
      </Card>
    </View>
  );
}

function FeedbackIcon({ tone }: { tone: FeedbackMessage['tone'] }) {
  const { colors } = useTheme();
  const fill = tone === 'retry' ? colors.gold : tone === 'revealed' ? tileInks.green : colors.primary;
  return (
    <View style={[styles.icon, { backgroundColor: fill }]}>
      <Svg width={22} height={22} viewBox="0 0 24 24">
        {tone === 'correct' && (
          <Path d="M5 12.5l4.4 4.4L19 7.4" fill="none" stroke="#FFFDF8" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
        )}
        {tone === 'retry' && (
          // A gentle "go around again" arrow.
          <Path
            d="M18.5 12a6.5 6.5 0 1 1-2-4.7M18.6 4.6v3.2h-3.2"
            fill="none"
            stroke="#1B1B1B"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {tone === 'revealed' && (
          // The coach's star, the same one that marks the answer tiles.
          <Path d="M12 2.5 L14.5 9.5 L21.5 12 L14.5 14.5 L12 21.5 L9.5 14.5 L2.5 12 L9.5 9.5 Z" fill="#FFFFFF" />
        )}
      </Svg>
    </View>
  );
}

/** The coach's reply to an answer. Springs up into place and is read aloud. */
export function FeedbackPanel({ message }: { message: FeedbackMessage }) {
  const { colors } = useTheme();
  useEffect(() => {
    // Web reads the live region; iOS needs an explicit announcement.
    if (Platform.OS !== 'web') {
      AccessibilityInfo.announceForAccessibility(`${message.title}. ${message.body}`);
    }
  }, [message.title, message.body]);
  const accent = message.tone === 'retry' ? colors.gold : colors.primaryText;
  return (
    <Entrance distance={16}>
      <Card
        elevation="medium"
        style={[styles.feedback, { borderColor: accent }]}
        accessibilityLiveRegion="polite"
        accessible
        accessibilityLabel={`${message.title}. ${message.body}`}
        testID="lesson-feedback"
      >
        <FeedbackIcon tone={message.tone} />
        <View style={styles.feedbackText}>
          <Text variant="title3">{message.title}</Text>
          <Text>{message.body}</Text>
        </View>
      </Card>
    </Entrance>
  );
}

const styles = StyleSheet.create({
  entrance: { gap: spacing.lg },
  step: { gap: spacing.lg },
  paragraphs: { gap: spacing.md },
  // A short gold inlay under a page title, like the edge of a game table.
  rule: { width: 48, height: 3, borderRadius: radii.pill },
  mat: { paddingVertical: spacing.xl, paddingHorizontal: spacing.lg, gap: spacing.lg },
  spread: { gap: TILE_GAP, alignItems: 'center' },
  spreadRow: { flexDirection: 'row', justifyContent: 'center', gap: TILE_GAP },
  feedback: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackText: { flex: 1, gap: spacing.xxs },
});
