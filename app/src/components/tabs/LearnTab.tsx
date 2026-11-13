import { router } from 'expo-router';

import { FeltHero, PreviewList, type PreviewItem } from '@/components/shell/Preview';
import { TabScreen } from '@/components/shell/TabScreen';
import { LESSON_ORDER, LESSONS, lessonStatus } from '@/game/lessons';
import type { TileKind } from '@/game/tiles';
import { useLessonProgress } from '@/state/lessonProgress';

const HERO_TILES: readonly TileKind[] = [
  { type: 'suited', suit: 'bam', rank: 1 },
  { type: 'suited', suit: 'dot', rank: 5 },
  { type: 'suited', suit: 'crak', rank: 9 },
  { type: 'dragon', dragon: 'red' },
  { type: 'joker' },
];

const LESSON_PREVIEWS: readonly PreviewItem[] = [
  { title: 'Meet the tiles', detail: 'Suits, winds, dragons, flowers, and jokers.' },
  { title: 'Pungs, kongs, quints & pairs', detail: 'The groups every hand is built from.' },
  { title: 'Reading a card', detail: 'How each line on a card describes a hand.' },
  { title: 'Jokers', detail: 'Where a joker can stand in, and where it can’t.' },
  { title: 'The Charleston', detail: 'Passing tiles before the first discard.' },
];

const FIRST = LESSONS[0];

/** The hero's button for lesson 1, matching where the player is with it. */
function firstLessonAction(status: ReturnType<typeof lessonStatus>): string {
  if (status === 'in-progress') return `Continue: ${FIRST.title}`;
  if (status === 'complete') return `Play again: ${FIRST.title}`;
  return `Start lesson 1: ${FIRST.title}`;
}

// The lesson path (M1.2) replaces this hero and preview list.
export function LearnTab() {
  const status = useLessonProgress((s) => lessonStatus(s, LESSON_ORDER, FIRST.id));
  return (
    <TabScreen eyebrow="Learn" title="Your lesson path">
      <FeltHero
        tiles={HERO_TILES}
        tilesLabel="A row of tiles: a bamboo, a dot, a character, a dragon, and a joker"
        title="From your first tile to your first Mah Jongg"
        body={`Short, hands-on lessons, a few minutes each. Lesson 1 takes about ${FIRST.minutes} minutes.`}
        action={{ title: firstLessonAction(status), onPress: () => router.push({ pathname: '/lesson/[id]', params: { id: FIRST.id } }) }}
      />
      <PreviewList heading="First lessons" items={LESSON_PREVIEWS} numbered />
    </TabScreen>
  );
}
