import { StatusBar } from 'expo-status-bar';
import { useRef, useState, type ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type ScrollViewInstance,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Button } from '@/components/Button';
import { hapticTick } from '@/components/haptics';
import { Text } from '@/components/Text';
import { Tile } from '@/components/tile/Tile';
import { usePreferences } from '@/state/preferences';
import { spacing, useTheme } from '@/theme';

type Page = {
  title: string;
  body: string;
  art: ReactNode;
  /** What the illustration shows, for screen readers. */
  artLabel: string;
};

const HERO_TILE = 76;

function TileFan() {
  // Three tiles fanned like a hand held at the table.
  const fan = [
    { kind: { type: 'dragon', dragon: 'red' } as const, rotate: '-12deg', y: 14 },
    { kind: { type: 'joker' } as const, rotate: '0deg', y: 0 },
    { kind: { type: 'suited', suit: 'bam', rank: 1 } as const, rotate: '12deg', y: 14 },
  ];
  return (
    <View style={styles.artRow}>
      {fan.map(({ kind, rotate, y }, i) => (
        <View
          key={i}
          style={{ transform: [{ translateY: y }, { rotate }], marginHorizontal: -spacing.xs }}
        >
          <Tile kind={kind} width={HERO_TILE} />
        </View>
      ))}
    </View>
  );
}

function TileRun() {
  // An even run in one suit, with the coach's star on the tile worth keeping.
  const ranks = [2, 4, 6, 8] as const;
  return (
    <View style={[styles.artRow, { gap: spacing.sm }]}>
      {ranks.map((rank) => (
        <Tile key={rank} kind={{ type: 'suited', suit: 'bam', rank }} width={64} hint={rank === 8} />
      ))}
    </View>
  );
}

function TilePung() {
  return (
    <View style={[styles.artRow, { gap: spacing.xs }]}>
      <Tile kind={{ type: 'suited', suit: 'crak', rank: 5 }} width={HERO_TILE} />
      <Tile kind={{ type: 'suited', suit: 'crak', rank: 5 }} width={HERO_TILE} />
      <Tile kind={{ type: 'joker' }} width={HERO_TILE} />
    </View>
  );
}

const PAGES: readonly Page[] = [
  {
    title: 'Welcome to the parlor',
    body: 'Learn American Mah Jongg at your own pace, with a patient coach beside you.',
    art: <TileFan />,
    artLabel: 'Three tiles fanned in a hand: a Red Dragon, a joker, and a One of Bamboo',
  },
  {
    title: 'Learn by doing',
    body: 'Short lessons and quick drills teach the tiles, the Charleston, and how to choose a hand.',
    art: <TileRun />,
    artLabel: 'Two, Four, Six, and Eight of Bamboo, with the Eight marked as suggested',
  },
  {
    title: 'Play with a coach',
    body: 'Play friendly computer opponents, then look back at your game to see what to try next.',
    art: <TilePung />,
    artLabel: 'A pung of Five Characters: two Five Characters and a joker',
  },
];

/** Gold rule with a lozenge, like an inlay on a game-table edge. */
function Ornament() {
  const { colors } = useTheme();
  return (
    <View style={styles.ornament}>
      <View style={[styles.ornamentLine, { backgroundColor: colors.gold }]} />
      <View style={[styles.ornamentDiamond, { borderColor: colors.gold }]} />
      <View style={[styles.ornamentLine, { backgroundColor: colors.gold }]} />
    </View>
  );
}

type WelcomePageProps = {
  page: Page;
  index: number;
  width: number;
  height: number | undefined;
  current: boolean;
  scrollX: SharedValue<number>;
  parallax: boolean;
};

function WelcomePage({ page, index, width, height, current, scrollX, parallax }: WelcomePageProps) {
  // The art drifts slower than the page and fades at the edges, so swiping
  // feels like looking across a table rather than flipping a card.
  const artStyle = useAnimatedStyle(() => {
    if (!parallax) return {};
    const offset = scrollX.get() - index * width;
    return {
      opacity: interpolate(Math.abs(offset), [0, width], [1, 0.15], Extrapolation.CLAMP),
      transform: [{ translateX: offset * 0.4 }],
    };
  });
  return (
    <View
      style={{ width, height }}
      // Only the visible page is read aloud; Next and Skip move between pages.
      accessibilityElementsHidden={!current}
      importantForAccessibility={current ? 'auto' : 'no-hide-descendants'}
    >
      <ScrollView
        contentContainerStyle={styles.pageContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[styles.art, artStyle]}
          accessible
          accessibilityRole="image"
          accessibilityLabel={page.artLabel}
        >
          {page.art}
        </Animated.View>
        <View style={styles.copy}>
          <Text variant="display" color="onFelt" align="center">
            {page.title}
          </Text>
          <Ornament />
          <Text color="onFeltMuted" align="center" style={styles.body}>
            {page.body}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Dot({ index, width, scrollX }: { index: number; width: number; scrollX: SharedValue<number> }) {
  const { colors } = useTheme();
  const style = useAnimatedStyle(() => {
    const at = width > 0 ? scrollX.get() / width : 0;
    const distance = Math.min(1, Math.abs(at - index));
    return { width: 8 + 18 * (1 - distance), opacity: 0.35 + 0.65 * (1 - distance) };
  });
  return <Animated.View style={[styles.dot, { backgroundColor: colors.gold }, style]} />;
}

/**
 * Three welcome pages on the jade felt, shown once. Swipe or tap Next; Skip
 * and Get started both finish, and the root layout then opens the tabs.
 */
export function Welcome() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const completeOnboarding = usePreferences((s) => s.completeOnboarding);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const scrollX = useSharedValue(0);
  const [index, setIndex] = useState(0);
  const [pagerHeight, setPagerHeight] = useState<number>();
  const last = index === PAGES.length - 1;

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => scrollX.set(event.contentOffset.x),
  });
  useAnimatedReaction(
    () => (width > 0 ? Math.round(scrollX.get() / width) : 0),
    (page, previous) => {
      if (previous !== null && page !== previous) scheduleOnRN(setIndex, page);
    },
    [width],
  );

  const finish = () => {
    hapticTick();
    completeOnboarding();
  };
  const next = () => {
    if (last) return finish();
    const page = index + 1;
    hapticTick();
    setIndex(page);
    scrollRef.current?.scrollTo({ x: page * width, animated: !reduceMotion });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.felt, paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <View style={[styles.topBar, { paddingRight: insets.right + spacing.md }]}>
        {/* Kept in the layout on the last page so nothing shifts; hidden instead. */}
        <View style={last && styles.hidden} pointerEvents={last ? 'none' : 'auto'}>
          <Button
            title="Skip"
            variant="quietOnFelt"
            onPress={finish}
            accessibilityElementsHidden={last}
            importantForAccessibility={last ? 'no-hide-descendants' : 'auto'}
          />
        </View>
      </View>
      <Animated.ScrollView
        ref={scrollRef}
        testID="welcome-pager"
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        // Pages take the pager's measured height so their content can center
        // vertically; a horizontal scroller doesn't stretch its children.
        onLayout={(e) => setPagerHeight(e.nativeEvent.layout.height)}
        style={styles.pager}
      >
        {PAGES.map((page, i) => (
          <WelcomePage
            key={page.title}
            page={page}
            index={i}
            width={width}
            height={pagerHeight}
            current={i === index}
            scrollX={scrollX}
            parallax={!reduceMotion}
          />
        ))}
      </Animated.ScrollView>
      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + spacing.xl,
            paddingLeft: insets.left + spacing.xl,
            paddingRight: insets.right + spacing.xl,
          },
        ]}
      >
        <View
          style={styles.dots}
          accessible
          accessibilityLabel={`Page ${index + 1} of ${PAGES.length}`}
        >
          {PAGES.map((page, i) => (
            <Dot key={page.title} index={i} width={width} scrollX={scrollX} />
          ))}
        </View>
        <View style={styles.cta}>
          <Button title={last ? 'Get started' : 'Next'} variant="ivory" block onPress={next} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingTop: spacing.sm },
  hidden: { opacity: 0 },
  pager: { flex: 1 },
  pageContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    gap: spacing.xxl,
  },
  art: { alignItems: 'center', justifyContent: 'center', minHeight: 150 },
  artRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center' },
  copy: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    alignItems: 'center',
    gap: spacing.lg,
  },
  body: { maxWidth: 360 },
  ornament: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ornamentLine: { width: 36, height: 1, opacity: 0.7 },
  ornamentDiamond: { width: 7, height: 7, borderWidth: 1, transform: [{ rotate: '45deg' }] },
  footer: { gap: spacing.xl, alignItems: 'center' },
  dots: { flexDirection: 'row', gap: spacing.sm, height: 8, alignItems: 'center' },
  dot: { height: 8, borderRadius: 4 },
  cta: { width: '100%', maxWidth: 420 },
});
