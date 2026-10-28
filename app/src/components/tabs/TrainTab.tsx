import { FeltHero, PreviewList, type PreviewItem } from '@/components/shell/Preview';
import { TabScreen } from '@/components/shell/TabScreen';
import type { TileKind } from '@/game/tiles';

const HERO_TILES: readonly TileKind[] = [
  { type: 'suited', suit: 'dot', rank: 3 },
  { type: 'suited', suit: 'dot', rank: 3 },
  { type: 'suited', suit: 'dot', rank: 3 },
  { type: 'joker' },
];

const DRILLS: readonly PreviewItem[] = [
  { title: 'Best hand', detail: 'Look at a fresh rack and pick the hand to aim for.', tile: { type: 'joker' } },
  { title: 'Charleston', detail: 'Choose three tiles to pass, and see what you kept.', tile: { type: 'wind', wind: 'E' } },
  { title: 'Discards', detail: 'Decide what to let go, and what’s safe to throw.', tile: { type: 'suited', suit: 'crak', rank: 7 } },
];

export function TrainTab() {
  return (
    <TabScreen eyebrow="Train" title="Sharpen your game">
      <FeltHero
        tiles={HERO_TILES}
        tilesLabel="A kong of Three Dots, made with three dots and a joker"
        title="One decision at a time"
        body="Each drill shows a moment from a real game, asks what you’d do, and explains the thinking behind the strongest choice."
      />
      <PreviewList heading="Drills" items={DRILLS} />
    </TabScreen>
  );
}
