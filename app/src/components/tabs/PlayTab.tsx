import { router } from 'expo-router';

import { OpponentPicker } from '@/components/play/OpponentPicker';
import { LEVEL_INFO } from '@/components/play/levels';
import { FeltHero } from '@/components/shell/Preview';
import { TabScreen } from '@/components/shell/TabScreen';
import type { TileKind } from '@/game/tiles';
import { usePreferences } from '@/state/preferences';

// The four winds in turn order: play passes East, South, West, North.
const HERO_TILES: readonly TileKind[] = [
  { type: 'wind', wind: 'E' },
  { type: 'wind', wind: 'S' },
  { type: 'wind', wind: 'W' },
  { type: 'wind', wind: 'N' },
];

export function PlayTab() {
  const level = usePreferences((s) => s.opponents);
  const setLevel = usePreferences((s) => s.setOpponents);
  return (
    <TabScreen eyebrow="Play" title="Take a seat">
      <FeltHero
        tiles={HERO_TILES}
        tilesLabel="The four winds: East, South, West, and North"
        title="A full game, at your pace"
        body="Sit down with three computer players: the Charleston, draws and discards, all the way to Mah Jongg."
        action={{
          title: `Start a ${LEVEL_INFO[level].name} game`,
          onPress: () => router.push({ pathname: '/game', params: { level } }),
        }}
      />
      <OpponentPicker value={level} onChange={setLevel} />
    </TabScreen>
  );
}
