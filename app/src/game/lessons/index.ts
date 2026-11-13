import { charleston } from './content/charleston';
import { groups } from './content/groups';
import { jokers } from './content/jokers';
import { meetTheTiles } from './content/meet-the-tiles';
import { readingACard } from './content/reading-a-card';
import type { Lesson } from './types';

export * from './feedback';
export * from './path';
export * from './progress';
export * from './session';
export * from './types';
export * from './validate';

/** Every lesson, in path order. */
export const LESSONS: readonly Lesson[] = [meetTheTiles, groups, readingACard, jokers, charleston];

export const LESSON_ORDER: readonly string[] = LESSONS.map((l) => l.id);

export function lessonById(id: string | undefined): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}

/** The app path that plays a lesson. */
export function lessonPath(id: string): `/lesson/${string}` {
  return `/lesson/${id}`;
}
