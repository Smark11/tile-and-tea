import { router } from 'expo-router';

import { OpponentPicker } from '@/components/play/OpponentPicker';
import { LEVEL_INFO } from '@/components/play/levels';
import { ResumeHero } from '@/components/play/ResumeHero';
import { FeltHero } from '@/components/shell/Preview';
import { TabScreen } from '@/components/shell/TabScreen';
import type { TileKind } from '@/game/tiles';
import { usePreferences } from '@/state/preferences';
import { useRestoredGame } from '@/state/savedGame';

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
  const restored = useRestoredGame();
  return (
    <TabScreen eyebrow="Play" title="Take a seat">
      {restored ? (
        <ResumeHero
          restored={restored}
          newLevel={level}
          // A plain /game sits back down to the saved game.
          onResume={() => router.push('/game')}
          onNewGame={() => router.push({ pathname: '/game', params: { level, new: '1' } })}
        />
      ) : (
        <FeltHero
          tiles={HERO_TILES}
          tilesLabel="The four winds: East, South, West, and North"
          title="A full game, at your pace"
          body="Sit down with three computer players: the Charleston, draws and discards, all the way to Mah Jongg. Leave whenever you like: your game is saved."
          action={{
            title: `Start a ${LEVEL_INFO[level].name} game`,
            onPress: () => router.push({ pathname: '/game', params: { level } }),
          }}
        />
      )}
      <OpponentPicker value={level} onChange={setLevel} />
    </TabScreen>
  );
}
