import { useState, useSyncExternalStore } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { Tile, TILE_WIDTHS } from '@/components/tile/Tile';
import type { BotLevel } from '@/game/bots';
import { arrangeRack, savedAgo, savedGameStage, type RestoredGame } from '@/game/table';
import { feltTones, palette, radii, spacing, tileInks } from '@/theme';

import { LEVEL_INFO } from './levels';

// A clock for "Saved 5 min ago". The Play tab stays mounted under the table,
// so the label has to keep time on its own. It ticks every 30 s, and the
// snapshot only changes on a tick.
const CLOCK_TICK_MS = 30_000;
const clockNow = () => Math.floor(Date.now() / CLOCK_TICK_MS) * CLOCK_TICK_MS;
function subscribeClock(onTick: () => void) {
  const id = setInterval(onTick, CLOCK_TICK_MS);
  return () => clearInterval(id);
}

/** Space between the tiles on the little rack. */
const TILE_GAP = spacing.xxs;

/** The player's rack as they left it: every tile, fitted to one row on a felt ledge. */
function SavedRack({ restored }: { restored: RestoredGame }) {
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const { saved, state } = restored;
  const tiles = arrangeRack(saved.order, state.players[saved.you].rack).tiles;
  const tileWidth = Math.min(TILE_WIDTHS.S, Math.floor((width - TILE_GAP * (tiles.length - 1)) / tiles.length));
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.floor(e.nativeEvent.layout.width));
  return (
    <View
      style={styles.rackWrap}
      onLayout={onLayout}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Your rack: ${tiles.length} tiles, just as you left them`}
    >
      {width > 0 && (
        <View style={styles.rackTiles}>
          {tiles.map((tile, i) => (
            <Animated.View
              key={tile.id}
              entering={reduceMotion ? undefined : FadeInDown.delay(80 + i * 28).springify().damping(16)}
            >
              <Tile kind={tile.kind} width={tileWidth} />
            </Animated.View>
          ))}
        </View>
      )}
      <View style={styles.ledge} />
    </View>
  );
}

type ResumeHeroProps = {
  restored: RestoredGame;
  /** The level a new game would seat (the Play tab's choice), which may differ from the saved game's. */
  newLevel: BotLevel;
  onResume: () => void;
  onNewGame: () => void;
};

/**
 * The Play tab's hero while a game is saved: the player's rack as they left
 * it, where the game stands, and Resume. Dealing a new game instead asks
 * once more, since it ends the saved one.
 */
export function ResumeHero({ restored, newLevel, onResume, onNewGame }: ResumeHeroProps) {
  const { saved, state } = restored;
  const now = useSyncExternalStore(subscribeClock, clockNow, clockNow);
  const [confirming, setConfirming] = useState(false);
  const wall = state.wall.length;
  const stage = savedGameStage(state, saved.you);
  return (
    <Card tone="felt" elevation="high" style={styles.hero} testID="play-resume">
      <View style={styles.eyebrowRow}>
        <View style={styles.liveDot} />
        <Text variant="eyebrow" style={{ color: palette.gold }}>
          Game in progress
        </Text>
      </View>
      <SavedRack restored={restored} />
      <View style={styles.copy}>
        <Text variant="title3" color="onFelt">
          Your game is waiting
        </Text>
        <Text color="onFeltMuted">
          {`${stage}, against ${LEVEL_INFO[saved.level].name} opponents. ${wall} ${wall === 1 ? 'tile' : 'tiles'} left in the wall.`}
        </Text>
        <Text variant="caption" color="onFeltMuted">
          {`Saved ${savedAgo(saved.savedAt, now)}`}
        </Text>
      </View>
      <View style={styles.actions}>
        <Button title="Resume game" variant="ivory" block onPress={onResume} />
        {confirming ? (
          <Animated.View entering={FadeIn.duration(220)} style={styles.confirm} testID="play-confirm-new">
            <Text variant="callout" color="onFelt" accessibilityLiveRegion="polite">
              A new deal ends this game for good.
            </Text>
            <View style={styles.confirmButtons}>
              <View style={styles.confirmButton}>
                <Button title="Keep my game" variant="outlineOnFelt" block onPress={() => setConfirming(false)} />
              </View>
              <View style={styles.confirmButton}>
                <Button
                  title={`Deal a new ${LEVEL_INFO[newLevel].name} game`}
                  variant="quietOnFelt"
                  block
                  onPress={onNewGame}
                />
              </View>
            </View>
          </Animated.View>
        ) : (
          <Button title="Start a new game instead" variant="quietOnFelt" block onPress={() => setConfirming(true)} />
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  hero: { gap: spacing.lg, paddingVertical: spacing.xl },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.gold },
  rackWrap: { alignSelf: 'stretch' },
  rackTiles: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: TILE_GAP,
    paddingHorizontal: spacing.xs,
    zIndex: 1,
  },
  // The same jade lip the table's rack stands its tiles on.
  ledge: {
    height: 8,
    marginTop: -5,
    marginHorizontal: spacing.xs,
    borderRadius: 4,
    backgroundColor: tileInks.rackLedge,
    borderTopWidth: 1,
    borderTopColor: tileInks.rackLedgeLight,
    borderBottomWidth: 1,
    borderBottomColor: tileInks.rackLedgeShade,
    boxShadow: '0px 3px 5px rgba(0, 0, 0, 0.35)',
  },
  copy: { gap: spacing.xs },
  actions: { gap: spacing.sm },
  confirm: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: feltTones.panelShade,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: feltTones.panelEdge,
  },
  confirmButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  confirmButton: { flexGrow: 1, flexBasis: 180 },
});
