// The lesson path on the Learn tab, as pure data: which lessons it shows, in
// what order, and what state each node is in. The path also lists lessons
// that are planned but not written yet, so players can see where it leads.

import { lessonStatus, type LessonProgress, type LessonStatus } from './progress';
import type { LessonScore } from './session';
import type { Lesson } from './types';

/** A lesson the path names before its content exists. */
export type PlannedLesson = {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
};

/**
 * Lessons still being written, in path order. When a lesson ships, move it
 * from here into `LESSONS` (keeping the id, since it keys saved progress).
 */
export const PLANNED_LESSONS: readonly PlannedLesson[] = [];

/**
 * A node's state on the path. `coming-soon` is a planned lesson the player
 * has reached: it would be open, but isn't written yet.
 */
export type PathNodeStatus = LessonStatus | 'coming-soon';

export type PathNode = {
  readonly id: string;
  /** 1-based position on the path. */
  readonly number: number;
  readonly title: string;
  readonly summary: string;
  /** Rough length; absent for lessons not written yet. */
  readonly minutes?: number;
  readonly status: PathNodeStatus;
  /** There's a lesson to open (written, and not locked). */
  readonly playable: boolean;
  /** The one lesson the path points the player at next. */
  readonly current: boolean;
  /** Finished at least once (true during a replay, too). */
  readonly completedBefore: boolean;
  /** How far an unfinished play-through got, 0–1. */
  readonly fraction: number;
  /** Step the player is on (1-based) while in progress, for "Step 4 of 9". */
  readonly step?: { readonly at: number; readonly of: number };
  readonly best?: LessonScore;
  /** Title of the lesson before this one, for "Finish X to unlock". */
  readonly after?: string;
};

/**
 * Builds the path: written lessons first, then planned ones not yet written.
 * A planned lesson that shares an id with a written one is dropped.
 */
export function buildLessonPath(
  progress: LessonProgress,
  lessons: readonly Lesson[],
  planned: readonly PlannedLesson[] = PLANNED_LESSONS,
): PathNode[] {
  const written = new Set(lessons.map((l) => l.id));
  const entries: (Lesson | PlannedLesson)[] = [...lessons, ...planned.filter((p) => !written.has(p.id))];
  const order = entries.map((e) => e.id);
  let currentFound = false;

  return entries.map((entry, i) => {
    const lesson = 'steps' in entry ? entry : undefined;
    const base = lessonStatus(progress, order, entry.id);
    const status: PathNodeStatus = !lesson && base !== 'locked' ? 'coming-soon' : base;
    const record = progress.completed[entry.id];
    const saved = lesson ? progress.inProgress[entry.id] : undefined;
    const total = lesson?.steps.length ?? 0;
    const at = saved && total > 0 ? Math.min(Math.max(saved.stepIndex, 0), total - 1) : 0;
    const playable = !!lesson && status !== 'locked';
    // A replay under way doesn't pull the path back: the next new lesson stays current.
    const current =
      !currentFound && playable && (status === 'available' || (status === 'in-progress' && !record));
    if (current) currentFound = true;
    return {
      id: entry.id,
      number: i + 1,
      title: entry.title,
      summary: entry.summary,
      minutes: lesson?.minutes,
      status,
      playable,
      current,
      completedBefore: !!record,
      fraction: saved && total > 0 ? at / total : 0,
      step: saved && total > 0 ? { at: at + 1, of: total } : undefined,
      best: record?.best,
      after: i > 0 ? entries[i - 1].title : undefined,
    };
  });
}

/** Counts for the line above the path. */
export function pathSummary(nodes: readonly PathNode[]): { finished: number; total: number } {
  return { finished: nodes.filter((n) => n.completedBefore).length, total: nodes.length };
}

/** One warm sentence about where the player is on the path. */
export function pathHeadline(nodes: readonly PathNode[]): string {
  const { finished, total } = pathSummary(nodes);
  const current = nodes.find((n) => n.current);
  if (finished === 0) {
    return current ? `${total} short lessons, from your first tile to your first Mah Jongg.` : '';
  }
  if (finished === total) return `You’ve finished all ${total} lessons. Beautifully done.`;
  const done = `${finished} of ${total} lessons finished.`;
  if (current) return `${done} Next up: ${current.title}.`;
  const soon = nodes.find((n) => n.status === 'coming-soon');
  return soon ? `${done} ${soon.title} is on its way.` : done;
}

/** What the node's button or card says it will do. */
export function nodeActionTitle(node: PathNode): string {
  if (node.status === 'in-progress') return node.completedBefore ? 'Continue replay' : 'Continue lesson';
  if (node.status === 'complete') return 'Play again';
  return 'Start lesson';
}

/** First-try score as words, e.g. "3 of 3 right on the first try". */
export function bestLine(best: LessonScore): string {
  if (best.questions === 0) return 'Every step done';
  return `${best.firstTry} of ${best.questions} right on the first try`;
}

/** The node's status, said plainly (for the card and for screen readers). */
export function nodeStatusLine(node: PathNode): string {
  switch (node.status) {
    case 'complete':
      return node.best ? `Finished. ${bestLine(node.best)}.` : 'Finished.';
    case 'in-progress':
      return node.step ? `Step ${node.step.at} of ${node.step.of}.` : 'Under way.';
    case 'available':
      return node.minutes ? `About ${node.minutes} minutes.` : 'Ready to start.';
    case 'coming-soon':
      return 'Coming soon. We’re still writing this one.';
    case 'locked':
      return node.after ? `Finish ${node.after} to unlock.` : 'Locked.';
  }
}

/** The full spoken label for a node: "Lesson 2, Jokers. Finish Meet the tiles to unlock." */
export function nodeA11yLabel(node: PathNode): string {
  const replay = node.status === 'in-progress' && node.completedBefore ? ' Replay under way.' : '';
  return `Lesson ${node.number}, ${node.title}. ${nodeStatusLine(node)}${replay}`;
}

/** The node right after `finishedId`: the one a first finish opens up, if any. */
export function unlockedBy(nodes: readonly PathNode[], finishedId: string): PathNode | undefined {
  const i = nodes.findIndex((n) => n.id === finishedId);
  return i === -1 ? undefined : nodes[i + 1];
}

/** Said aloud when the path celebrates a finish. */
export function celebrationAnnouncement(nodes: readonly PathNode[], finishedId: string): string {
  const finished = nodes.find((n) => n.id === finishedId);
  if (!finished) return '';
  const next = unlockedBy(nodes, finishedId);
  const head = `Lesson complete: ${finished.title}.`;
  if (!next) return `${head} That’s the whole path.`;
  if (next.status === 'coming-soon') return `${head} ${next.title} is coming soon.`;
  if (next.playable) return `${head} ${next.title} is unlocked.`;
  return head;
}
