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
import type { FeedbackMessage, TapStep, TextStep, TileDisplay, TilesStep } from '@/game/lessons';
import type { TileKind } from '@/game/tiles';
import { radii, spacing, tileInks, useTheme } from '@/theme';

import { CardLineView } from './CardLineView';
import { GROUP_GAP, INNER_GAP, layoutGroups } from './groupLayout';

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

function Paragraphs({ body, color, gap }: { body: string; color?: 'text' | 'onFeltMuted'; gap?: number }) {
  return (
    <View style={[styles.paragraphs, gap !== undefined && { gap }]}>
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

export type SpreadTile = {
  kind: TileKind;
  selected?: boolean;
  hint?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  testID?: string;
};

/**
 * Which flower print each tile shows: every Flower in a spread gets the next
 * print, so two Flowers side by side look different, as they do in a real set.
 */
export function flowerCopies(kinds: readonly TileKind[]): (number | undefined)[] {
  let next = 0;
  return kinds.map((k) => (k.type === 'flower' ? next++ % 8 : undefined));
}

/**
 * Tiles laid out on the felt, sized to the space they have. Loose tiles sit in
 * balanced rows; grouped tiles sit together, a little apart from the next group.
 */
export function TileSpread({ tiles, groups }: { tiles: readonly SpreadTile[]; groups?: readonly number[] }) {
  const [available, setAvailable] = useState(0);
  const copies = flowerCopies(tiles.map((t) => t.kind));
  const indexed = tiles.map((t, i) => ({ ...t, index: i }));
  let width: number;
  // Each row is a list of clusters; a cluster is tiles that touch.
  let rows: (typeof indexed)[][];
  if (groups) {
    const layout = layoutGroups(available > 0 ? available : 320, groups);
    const starts = groups.map((_, g) => groups.slice(0, g).reduce((a, b) => a + b, 0));
    width = layout.width;
    rows = layout.rows.map((row) => row.map((g) => indexed.slice(starts[g], starts[g] + groups[g])));
  } else {
    const perRow = tilesPerRow(tiles.length);
    width = available > 0 ? fitTileWidth(available, perRow) : 64;
    rows = [];
    for (let i = 0; i < tiles.length; i += perRow) rows.push(indexed.slice(i, i + perRow).map((t) => [t]));
  }
  const onLayout = (e: LayoutChangeEvent) => setAvailable(e.nativeEvent.layout.width);
  // Selected tiles rise, so leave headroom for them above the first row.
  const headroom = Math.round(tileDimensions(width).height * 0.16);
  return (
    <View onLayout={onLayout} style={[styles.spread, { paddingTop: headroom }]}>
      {rows.map((row, r) => (
        <View key={r} style={[styles.spreadRow, groups && styles.groupRow]}>
          {row.map((cluster, c) => (
            <View key={c} style={styles.cluster}>
              {cluster.map((t) => (
                <Tile
                  key={t.index}
                  kind={t.kind}
                  copy={copies[t.index]}
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
      ))}
    </View>
  );
}

/** Tiles to look at (not tap), with their caption read in place of tile names. */
export function TileDisplayView({ display }: { display: TileDisplay }) {
  return (
    <View style={styles.display}>
      <View accessible accessibilityRole="image" accessibilityLabel={display.caption}>
        <TileSpread tiles={display.tiles.map((kind) => ({ kind }))} groups={display.groups} />
      </View>
      <Text
        variant="callout"
        color="onFeltMuted"
        align="center"
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        {display.caption}
      </Text>
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
      {step.card && <CardLineView line={step.card} testID="lesson-card-line" />}
      <Card tone="felt" elevation="high" style={styles.mat}>
        <TileDisplayView display={step} />
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
  const { colors } = useTheme();
  return (
    <View style={styles.step}>
      <Text variant="eyebrow">Your turn</Text>
      <Text variant="title1">{step.prompt}</Text>
      <Text color="textMuted">
        {singleAnswer ? 'Tap a tile to answer.' : 'Tap each one you find, then Check.'}
      </Text>
      {step.card && <CardLineView line={step.card} testID="lesson-card-line" />}
      <Card tone="felt" elevation="high" style={styles.mat}>
        {step.given && (
          <>
            <TileDisplayView display={step.given} />
            <View style={[styles.divider, { backgroundColor: colors.feltInlay }]} />
          </>
        )}
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
  const fill = tone === 'retry' || tone === 'close' ? colors.gold : tone === 'revealed' ? tileInks.green : colors.primary;
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
        {tone === 'close' && (
          // Half the coach's star: nearly the answer, worth half credit.
          <>
            <Path
              d="M12 2.5 L14.5 9.5 L21.5 12 L14.5 14.5 L12 21.5 L9.5 14.5 L2.5 12 L9.5 9.5 Z"
              fill="none"
              stroke="#1B1B1B"
              strokeWidth={1.6}
              strokeLinejoin="round"
            />
            <Path d="M12 2.5 L9.5 9.5 L2.5 12 L9.5 14.5 L12 21.5 Z" fill="#1B1B1B" />
          </>
        )}
      </Svg>
    </View>
  );
}

/** The coach's reply to an answer. Springs up into place and is read aloud. */
export function FeedbackPanel({ message }: { message: FeedbackMessage }) {
  const { colors } = useTheme();
  // Screen readers get the paragraphs as one flowing reply.
  const spoken = message.body.replace(/\s*\n\s*\n\s*/g, ' ');
  useEffect(() => {
    // Web reads the live region; iOS needs an explicit announcement.
    if (Platform.OS !== 'web') {
      AccessibilityInfo.announceForAccessibility(`${message.title}. ${spoken}`);
    }
  }, [message.title, spoken]);
  const accent = message.tone === 'retry' || message.tone === 'close' ? colors.gold : colors.primaryText;
  return (
    <Entrance distance={16}>
      <Card
        elevation="medium"
        style={[styles.feedback, { borderColor: accent }]}
        accessibilityLiveRegion="polite"
        accessible
        accessibilityLabel={`${message.title}. ${spoken}`}
        testID="lesson-feedback"
      >
        <FeedbackIcon tone={message.tone} />
        <View style={styles.feedbackText}>
          <Text variant="title3">{message.title}</Text>
          <Paragraphs body={message.body} gap={spacing.sm} />
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
  groupRow: { gap: GROUP_GAP },
  cluster: { flexDirection: 'row', gap: INNER_GAP },
  display: { gap: spacing.md },
  // Separates the tiles a question is about from the tiles to choose from.
  divider: { height: StyleSheet.hairlineWidth * 2, marginHorizontal: spacing.xl },
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
