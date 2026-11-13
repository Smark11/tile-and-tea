import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';

import { track } from '@/analytics';
import { parseSeed } from '@/components/drill/DrillScreen';
import { randomSeed } from '@/components/drill/DrillPlayer';
import { useWideStage } from '@/components/shell/useWideStage';
import { isBotLevel, type BotLevel } from '@/game/bots';
import {
  DEMO_TABLE_SEED,
  DEMO_TABLES,
  isDemoTable,
  restoreGame,
  SAVED_GAME_VERSION,
  type DemoTable,
  type RestoredGame,
} from '@/game/table';
import { usePreferences, usePreferencesHydrated } from '@/state/preferences';
import { useSavedGame, useSavedGameHydrated } from '@/state/savedGame';
import { useTheme } from '@/theme';

import { GameTable } from './GameTable';
import type { TableProgress } from './useTableGame';

const noopSubscribe = () => () => {};

/** Back where the player came from, or to the Play tab. */
function leaveTable() {
  if (router.canGoBack()) router.back();
  else router.replace('/play');
}

/** What the screen sat down to: a saved game, or a deal. */
export type Sitting =
  | { kind: 'resume'; restored: RestoredGame }
  /** `replaces`: a saved game this deal ends, reported abandoned once the table opens. */
  | { kind: 'deal'; seed: number; level: BotLevel; replaces?: RestoredGame }
  | { kind: 'demo'; demo: DemoTable; level: BotLevel };

export type GameParams = { seed?: string; demo?: string; level?: string; new?: string };

/**
 * Picks the sitting for a visit to /game. A saved game is resumed unless the
 * link asks for something else: a `?seed=`, `?new=1`, or a `?level=` other
 * than the saved game's. So a plain /game (the Play tab's Resume, or a web
 * reload mid-game) always brings the player back to their game.
 */
export function chooseSitting(params: GameParams, saved: unknown, preferred: BotLevel): Sitting {
  const linked = isBotLevel(params.level) ? params.level : null;
  const level = linked ?? preferred;
  if (isDemoTable(params.demo)) return { kind: 'demo', demo: params.demo, level };
  const seed = parseSeed(params.seed);
  const restored = seed === null && params.new === undefined ? restoreGame(saved) : null;
  if (restored && (linked === null || linked === restored.saved.level)) return { kind: 'resume', restored };
  return { kind: 'deal', seed: seed ?? randomSeed(), level, replaces: restoreGame(saved) ?? undefined };
}

/**
 * The /game screen: resumes the saved game, or deals one (the `?seed=` one)
 * and seats the player as East, against bots of the `?level=` given or the
 * one chosen on the Play tab. Every move is saved, so the player can leave
 * and come back. `?demo=yours|open|theirs|call|swap` freezes a mid-game
 * table instead, for the screenshots; "Deal again" from there starts a real game.
 */
export function GameScreen() {
  const { colors } = useTheme();
  useWideStage();
  const params = useLocalSearchParams<GameParams>();
  const preferred = usePreferences((s) => s.opponents);
  const preferencesReady = usePreferencesHydrated();
  const savedReady = useSavedGameHydrated();
  const save = useSavedGame((s) => s.save);
  const clear = useSavedGame((s) => s.clear);
  // The static web page can't know the random deal, so it renders the felt
  // only, and the table appears once the page is live.
  const live = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  // Chosen once, when the page is live and storage has loaded, so the bots
  // never change level (nor `game_started` report the wrong one) mid-game.
  const [sitting, setSitting] = useState<Sitting | null>(null);
  const ready = live && savedReady && (preferencesReady || isBotLevel(params.level));
  if (ready && sitting === null) setSitting(chooseSitting(params, useSavedGame.getState().game, preferred));

  useEffect(() => {
    if (sitting?.kind !== 'deal') return;
    if (sitting.replaces) track('game_finished', { opponents: sitting.replaces.saved.level, result: 'abandoned' });
  }, [sitting]);
  // Once dealt, a reload should come back to this game, not deal another.
  const oneShot = params.new !== undefined || params.seed !== undefined;
  useEffect(() => {
    if (sitting && oneShot) router.setParams({ new: undefined, seed: undefined });
  }, [sitting, oneShot]);

  const level = sitting?.kind === 'resume' ? sitting.restored.saved.level : (sitting?.level ?? preferred);
  const seed = sitting?.kind === 'resume' ? sitting.restored.saved.seed : sitting?.kind === 'deal' ? sitting.seed : 0;
  const you = sitting?.kind === 'resume' ? sitting.restored.saved.you : 0;
  const initial = useMemo(() => (sitting?.kind === 'demo' ? DEMO_TABLES[sitting.demo]() : undefined), [sitting]);
  const onProgress = useCallback(
    ({ actions, order, ended }: TableProgress) => {
      if (ended) clear();
      else save({ version: SAVED_GAME_VERSION, seed, you, level, actions, order, savedAt: Date.now() });
    },
    [clear, save, seed, you, level],
  );

  if (!sitting) return <View style={[styles.fill, { backgroundColor: colors.felt }]} />;
  // "Deal again" at the end of a game (whose save is already cleared) or from a demo table.
  const newGame = () =>
    setSitting({
      kind: 'deal',
      seed: randomSeed(),
      level,
      replaces: restoreGame(useSavedGame.getState().game) ?? undefined,
    });
  const demo = sitting.kind === 'demo';
  return (
    <GameTable
      key={sitting.kind === 'demo' ? `demo-${sitting.demo}` : `${sitting.kind}-${seed}`}
      seed={demo ? DEMO_TABLE_SEED : seed}
      you={you}
      initial={initial}
      resume={sitting.kind === 'resume' ? sitting.restored : undefined}
      autoplay={!demo}
      level={level}
      onLeave={leaveTable}
      onNewGame={newGame}
      onProgress={demo ? undefined : onProgress}
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
