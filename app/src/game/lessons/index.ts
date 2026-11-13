import { meetTheTiles } from './content/meet-the-tiles';
import type { Lesson } from './types';

export * from './feedback';
export * from './progress';
export * from './session';
export * from './types';
export * from './validate';

/** Every lesson, in path order. */
export const LESSONS: readonly Lesson[] = [meetTheTiles];

export const LESSON_ORDER: readonly string[] = LESSONS.map((l) => l.id);

export function lessonById(id: string | undefined): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}

/** The app path that plays a lesson. */
export function lessonPath(id: string): `/lesson/${string}` {
  return `/lesson/${id}`;
}
