import { FeltHero, PreviewList, type PreviewItem } from '@/components/shell/Preview';
import { TabScreen } from '@/components/shell/TabScreen';
import type { TileKind } from '@/game/tiles';

const HERO_TILES: readonly TileKind[] = [
  { type: 'suited', suit: 'bam', rank: 1 },
  { type: 'suited', suit: 'dot', rank: 5 },
  { type: 'suited', suit: 'crak', rank: 9 },
  { type: 'dragon', dragon: 'red' },
  { type: 'joker' },
];

const LESSONS: readonly PreviewItem[] = [
  { title: 'Meet the tiles', detail: 'Suits, winds, dragons, flowers, and jokers.' },
  { title: 'Pungs, kongs, quints & pairs', detail: 'The groups every hand is built from.' },
  { title: 'Reading a card', detail: 'How each line on a card describes a hand.' },
  { title: 'Jokers', detail: 'Where a joker can stand in, and where it can’t.' },
  { title: 'The Charleston', detail: 'Passing tiles before the first discard.' },
];

export function LearnTab() {
  return (
    <TabScreen eyebrow="Learn" title="Your lesson path">
      <FeltHero
        tiles={HERO_TILES}
        tilesLabel="A row of tiles: a bamboo, a dot, a character, a dragon, and a joker"
        title="From your first tile to your first Mah Jongg"
        body="Short, hands-on lessons, a few minutes each. Tap tiles, try ideas, and learn at your own pace."
      />
      <PreviewList heading="First lessons" items={LESSONS} numbered />
    </TabScreen>
  );
}
