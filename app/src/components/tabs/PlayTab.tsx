import { router } from 'expo-router';

import { StyleSheet, View } from 'react-native';

import { ComingSoon, FeltHero, PreviewList, type PreviewItem } from '@/components/shell/Preview';
import { TabScreen } from '@/components/shell/TabScreen';
import type { TileKind } from '@/game/tiles';

// The four winds in turn order: play passes East, South, West, North.
const HERO_TILES: readonly TileKind[] = [
  { type: 'wind', wind: 'E' },
  { type: 'wind', wind: 'S' },
  { type: 'wind', wind: 'W' },
  { type: 'wind', wind: 'N' },
];

const OPPONENTS: readonly PreviewItem[] = [
  { title: 'Beginner', detail: 'Learning alongside you. Plays fair, makes mistakes.', tile: { type: 'flower' } },
  { title: 'Club', detail: 'A steady player from a weekly game.', tile: { type: 'dragon', dragon: 'green' } },
  { title: 'Shark', detail: 'Sharp, patient, and hard to beat.', tile: { type: 'dragon', dragon: 'red' } },
];

export function PlayTab() {
  return (
    <TabScreen eyebrow="Play" title="Take a seat">
      <FeltHero
        tiles={HERO_TILES}
        tilesLabel="The four winds: East, South, West, and North"
        title="A full game, at your pace"
        body="Sit down with three friendly computer players: the Charleston, draws and discards, all the way to Mah Jongg."
        action={{ title: 'Start a game', onPress: () => router.push('/game') }}
      />
      {/* Opponent levels arrive with the bots (M4.2); today's table seats friendly stand-ins. */}
      <View style={styles.soon}>
        <ComingSoon />
      </View>
      <PreviewList heading="Opponents" items={OPPONENTS} />
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  soon: { flexDirection: 'row', marginBottom: -8 },
});
