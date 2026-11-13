import {
  bestLine,
  buildLessonPath,
  celebrationAnnouncement,
  emptyProgress,
  LESSONS,
  nodeA11yLabel,
  nodeActionTitle,
  pathHeadline,
  pathSummary,
  PLANNED_LESSONS,
  recordCompletion,
  saveSnapshot,
  type Lesson,
  type PlannedLesson,
} from '..';

const at = new Date('2026-11-12T10:00:00Z');
const lesson = (id: string, steps = 4): Lesson => ({
  id,
  title: `Lesson ${id}`,
  summary: `About ${id}.`,
  minutes: 3,
  steps: Array.from({ length: steps }, (_, i) => ({ kind: 'text' as const, id: `s${i}`, title: 'T', body: 'B' })),
});
const WRITTEN = [lesson('a'), lesson('b')];
const PLANNED: PlannedLesson[] = [
  { id: 'c', title: 'Lesson c', summary: 'Soon.' },
  { id: 'd', title: 'Lesson d', summary: 'Later.' },
];
const done = (p = emptyProgress, id: string, firstTry = 1, questions = 1) =>
  recordCompletion(p, id, { firstTry, questions }, at);

describe('buildLessonPath', () => {
  it('starts with lesson 1 open and everything after it locked', () => {
    const nodes = buildLessonPath(emptyProgress, WRITTEN, PLANNED);
    expect(nodes.map((n) => [n.number, n.status, n.current, n.playable])).toEqual([
      [1, 'available', true, true],
      [2, 'locked', false, false],
      [3, 'locked', false, false],
      [4, 'locked', false, false],
    ]);
    expect(nodes[2].after).toBe('Lesson b');
    expect(nodes[0].after).toBeUndefined();
    expect(nodes[2].minutes).toBeUndefined();
  });

  it('moves "current" along as lessons are finished', () => {
    const nodes = buildLessonPath(done(emptyProgress, 'a', 2, 3), WRITTEN, PLANNED);
    expect(nodes.map((n) => n.status)).toEqual(['complete', 'available', 'locked', 'locked']);
    expect(nodes.find((n) => n.current)?.id).toBe('b');
    expect(nodes[0].best).toEqual({ firstTry: 2, questions: 3 });
  });

  it('marks a planned lesson the player has reached as coming soon, never playable', () => {
    const nodes = buildLessonPath(done(done(emptyProgress, 'a'), 'b'), WRITTEN, PLANNED);
    expect(nodes.map((n) => n.status)).toEqual(['complete', 'complete', 'coming-soon', 'locked']);
    expect(nodes.some((n) => n.current)).toBe(false);
    expect(nodes[2].playable).toBe(false);
  });

  it('tracks how far an unfinished lesson got', () => {
    const nodes = buildLessonPath(saveSnapshot(emptyProgress, 'a', { stepIndex: 2, results: {} }), WRITTEN);
    expect(nodes[0]).toMatchObject({ status: 'in-progress', current: true, fraction: 0.5, step: { at: 3, of: 4 } });
    // A stale saved step past the end is clamped.
    const stale = buildLessonPath(saveSnapshot(emptyProgress, 'a', { stepIndex: 40, results: {} }), WRITTEN);
    expect(stale[0].step).toEqual({ at: 4, of: 4 });
  });

  it('keeps the next new lesson current while an old one is being replayed', () => {
    const replaying = saveSnapshot(done(emptyProgress, 'a'), 'a', { stepIndex: 1, results: {} });
    const nodes = buildLessonPath(replaying, WRITTEN, PLANNED);
    expect(nodes[0]).toMatchObject({ status: 'in-progress', completedBefore: true, current: false });
    expect(nodes[1].current).toBe(true);
    expect(nodeActionTitle(nodes[0])).toBe('Continue replay');
  });

  it('drops a planned lesson once a written one has its id', () => {
    const nodes = buildLessonPath(emptyProgress, [...WRITTEN, lesson('c')], PLANNED);
    expect(nodes.map((n) => n.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(nodes[2].minutes).toBe(3);
  });

  it('ships the five first lessons, with the written ones first', () => {
    const nodes = buildLessonPath(emptyProgress, LESSONS);
    expect(nodes).toHaveLength(LESSONS.length + PLANNED_LESSONS.filter((p) => !LESSONS.some((l) => l.id === p.id)).length);
    expect(nodes.map((n) => n.title)).toEqual([
      'Meet the tiles',
      'Pungs, kongs, quints & pairs',
      'Reading a card',
      'Jokers',
      'The Charleston',
    ]);
  });
});

describe('path words', () => {
  it('sums up where the player is', () => {
    expect(pathHeadline(buildLessonPath(emptyProgress, WRITTEN, PLANNED))).toBe(
      '4 short lessons, from your first tile to your first Mah Jongg.',
    );
    expect(pathHeadline(buildLessonPath(done(emptyProgress, 'a'), WRITTEN, PLANNED))).toBe(
      '1 of 4 lessons finished. Next up: Lesson b.',
    );
    expect(pathHeadline(buildLessonPath(done(done(emptyProgress, 'a'), 'b'), WRITTEN, PLANNED))).toBe(
      '2 of 4 lessons finished. Lesson c is on its way.',
    );
    expect(pathHeadline(buildLessonPath(done(done(emptyProgress, 'a'), 'b'), WRITTEN, []))).toBe(
      'You’ve finished all 2 lessons. Beautifully done.',
    );
    expect(pathSummary(buildLessonPath(done(emptyProgress, 'b'), WRITTEN, PLANNED))).toEqual({ finished: 1, total: 4 });
  });

  it('labels every state for screen readers', () => {
    const replaying = saveSnapshot(done(emptyProgress, 'a', 0, 2), 'a', { stepIndex: 0, results: {} });
    const nodes = buildLessonPath(replaying, WRITTEN, PLANNED);
    expect(nodes.map(nodeA11yLabel)).toEqual([
      'Lesson 1, Lesson a. Step 1 of 4. Replay under way.',
      'Lesson 2, Lesson b. About 3 minutes.',
      'Lesson 3, Lesson c. Finish Lesson b to unlock.',
      'Lesson 4, Lesson d. Finish Lesson c to unlock.',
    ]);
    const finished = buildLessonPath(done(done(emptyProgress, 'a', 0, 2), 'b', 0, 0), WRITTEN, PLANNED);
    expect(nodeA11yLabel(finished[0])).toBe('Lesson 1, Lesson a. Finished. 0 of 2 right on the first try.');
    expect(nodeA11yLabel(finished[1])).toBe('Lesson 2, Lesson b. Finished. Every step done.');
    expect(nodeA11yLabel(finished[2])).toBe('Lesson 3, Lesson c. Coming soon. We’re still writing this one.');
    expect(bestLine({ firstTry: 3, questions: 3 })).toBe('3 of 3 right on the first try');
  });

  it('names the button for each state', () => {
    const nodes = buildLessonPath(saveSnapshot(done(emptyProgress, 'a'), 'b', { stepIndex: 1, results: {} }), WRITTEN, []);
    expect(nodes.map(nodeActionTitle)).toEqual(['Play again', 'Continue lesson']);
    expect(nodeActionTitle(buildLessonPath(emptyProgress, WRITTEN)[0])).toBe('Start lesson');
  });

  it('announces what a finish opened up', () => {
    const one = buildLessonPath(done(emptyProgress, 'a'), WRITTEN, PLANNED);
    expect(celebrationAnnouncement(one, 'a')).toBe('Lesson complete: Lesson a. Lesson b is unlocked.');
    const two = buildLessonPath(done(done(emptyProgress, 'a'), 'b'), WRITTEN, PLANNED);
    expect(celebrationAnnouncement(two, 'b')).toBe('Lesson complete: Lesson b. Lesson c is coming soon.');
    const all = buildLessonPath(done(done(emptyProgress, 'a'), 'b'), WRITTEN, []);
    expect(celebrationAnnouncement(all, 'b')).toBe('Lesson complete: Lesson b. That’s the whole path.');
    expect(celebrationAnnouncement(all, 'nope')).toBe('');
  });
});
