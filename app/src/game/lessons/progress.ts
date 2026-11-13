// Saved lesson progress, as pure data and pure updates. The persisted store
// (src/state/lessonProgress.ts) wraps these; the lesson path (M1.2) reads
// lessonStatus to draw each node.

import type { LessonScore, SessionSnapshot } from './session';

export type LessonRecord = {
  /** ISO time of the most recent finish. */
  readonly completedAt: string;
  readonly timesCompleted: number;
  /** The best first-try score across finishes. */
  readonly best: LessonScore;
};

export type LessonProgress = {
  readonly completed: Readonly<Record<string, LessonRecord>>;
  /** Where an unfinished play-through left off, by lesson id. */
  readonly inProgress: Readonly<Record<string, SessionSnapshot>>;
};

export const emptyProgress: LessonProgress = { completed: {}, inProgress: {} };

/**
 * - `locked`: the lesson before it isn't finished yet.
 * - `available`: ready to start.
 * - `in-progress`: started and not finished (a replay of a finished lesson
 *   counts too, so the path can offer "Continue").
 * - `complete`: finished at least once, with no replay under way.
 */
export type LessonStatus = 'locked' | 'available' | 'in-progress' | 'complete';

export function saveSnapshot(
  progress: LessonProgress,
  lessonId: string,
  snapshot: SessionSnapshot,
): LessonProgress {
  return {
    ...progress,
    inProgress: {
      ...progress.inProgress,
      [lessonId]: { stepIndex: snapshot.stepIndex, results: snapshot.results },
    },
  };
}

function better(a: LessonScore, b: LessonScore): LessonScore {
  // Compare as fractions, since a revised lesson may have more questions.
  const fa = a.questions === 0 ? 1 : a.firstTry / a.questions;
  const fb = b.questions === 0 ? 1 : b.firstTry / b.questions;
  return fb > fa ? b : a;
}

/** Records a finish and clears the saved place, so the next visit starts at the top. */
export function recordCompletion(
  progress: LessonProgress,
  lessonId: string,
  score: LessonScore,
  now: Date,
): LessonProgress {
  const previous = progress.completed[lessonId];
  const { [lessonId]: _finished, ...inProgress } = progress.inProgress;
  return {
    inProgress,
    completed: {
      ...progress.completed,
      [lessonId]: {
        completedAt: now.toISOString(),
        timesCompleted: (previous?.timesCompleted ?? 0) + 1,
        best: previous ? better(previous.best, score) : score,
      },
    },
  };
}

/** Lessons unlock in order: each opens when the one before it is finished. */
export function lessonStatus(
  progress: LessonProgress,
  order: readonly string[],
  lessonId: string,
): LessonStatus {
  const index = order.indexOf(lessonId);
  if (index === -1) return 'locked';
  if (progress.inProgress[lessonId]) return 'in-progress';
  if (progress.completed[lessonId]) return 'complete';
  if (index === 0 || progress.completed[order[index - 1]]) return 'available';
  return 'locked';
}
