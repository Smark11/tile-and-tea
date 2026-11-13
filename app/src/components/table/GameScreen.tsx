import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';

import { parseSeed } from '@/components/drill/DrillScreen';
import { randomSeed } from '@/components/drill/DrillPlayer';
import { useWideStage } from '@/components/shell/useWideStage';
import { DEMO_TABLE_SEED, DEMO_TABLES, isDemoTable, type DemoTable } from '@/game/table';
import { useTheme } from '@/theme';

import { GameTable } from './GameTable';

const noopSubscribe = () => () => {};

/** Back where the player came from, or to the Play tab. */
function leaveTable() {
  if (router.canGoBack()) router.back();
  else router.replace('/play');
}

/**
 * The /game screen: deals a game (or the `?seed=` one) and seats the player
 * as East. `?demo=yours|open|theirs` freezes a mid-game table instead, for
 * the screenshots; "Deal again" from there starts a real game.
 */
export function GameScreen() {
  const { colors } = useTheme();
  useWideStage();
  const params = useLocalSearchParams<{ seed?: string; demo?: string }>();
  const [demo, setDemo] = useState<DemoTable | null>(() => (isDemoTable(params.demo) ? params.demo : null));
  const [seed, setSeed] = useState(() => parseSeed(params.seed) ?? randomSeed());
  const initial = useMemo(() => (demo ? DEMO_TABLES[demo]() : undefined), [demo]);
  // The static web page can't know the random deal, so it renders the felt
  // only, and the table appears once the page is live.
  const live = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  if (!live) return <View style={[styles.fill, { backgroundColor: colors.felt }]} />;
  const newGame = () => {
    setDemo(null);
    setSeed(randomSeed());
  };
  return (
    <GameTable
      key={demo ? `demo-${demo}` : seed}
      seed={demo ? DEMO_TABLE_SEED : seed}
      initial={initial}
      autoplay={!demo}
      onLeave={leaveTable}
      onNewGame={newGame}
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
