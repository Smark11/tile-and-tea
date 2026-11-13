import { copiesOf, tileKey, type TileKind } from '../../tiles';
import {
  canAdvance,
  correctIndexes,
  emptyProgress,
  LESSON_ORDER,
  lessonById,
  lessonPath,
  lessonReducer,
  LESSONS,
  lessonStatus,
  MAX_TRIES,
  recordCompletion,
  reviewTry,
  saveSnapshot,
  scoreSession,
  startSession,
  validateCatalog,
  validateLesson,
  type Lesson,
  type SessionAction,
  type SessionState,
  type TapStep,
} from '..';

const RED: TileKind = { type: 'dragon', dragon: 'red' };
const GREEN: TileKind = { type: 'dragon', dragon: 'green' };
const NORTH: TileKind = { type: 'wind', wind: 'N' };
const JOKER: TileKind = { type: 'joker' };
const bam = (rank: 1 | 2 | 3): TileKind => ({ type: 'suited', suit: 'bam', rank });

/** text → single-answer question → multi-answer question → text. */
const FIXTURE: Lesson = {
  id: 'fixture',
  title: 'Fixture',
  summary: 'A test lesson.',
  minutes: 1,
  steps: [
    { kind: 'text', id: 'intro', title: 'Hello', body: 'Body.' },
    {
      kind: 'tap',
      id: 'one',
      prompt: 'Tap the Joker.',
      choices: [{ tile: bam(1) }, { tile: JOKER, correct: true }, { tile: NORTH }],
      hint: 'It says so.',
      explanation: 'Yes.',
    },
    {
      kind: 'tap',
      id: 'many',
      prompt: 'Tap every Dragon.',
      choices: [{ tile: RED, correct: true }, { tile: NORTH }, { tile: GREEN, correct: true }, { tile: bam(2) }],
      hint: 'Three kinds.',
      explanation: 'Right.',
    },
    { kind: 'text', id: 'outro', title: 'Bye', body: 'Done.' },
  ],
};

function play(actions: SessionAction[], from?: SessionState, lesson: Lesson = FIXTURE): SessionState {
  const reduce = lessonReducer(lesson);
  return actions.reduce(reduce, from ?? startSession(lesson));
}

const NEXT: SessionAction = { type: 'next' };
const tap = (index: number): SessionAction => ({ type: 'tap', index });
const CHECK: SessionAction = { type: 'check' };
const RETRY: SessionAction = { type: 'retry' };

describe('shipped lessons', () => {
  it('all pass validation and have unique ids', () => {
    expect(validateCatalog(LESSONS)).toEqual([]);
    expect(LESSON_ORDER).toEqual(LESSONS.map((l) => l.id));
  });

  it('look up by id and build their path', () => {
    expect(lessonById('meet-the-tiles')?.title).toBe('Meet the tiles');
    expect(lessonById('nope')).toBeUndefined();
    expect(lessonById(undefined)).toBeUndefined();
    expect(lessonPath('meet-the-tiles')).toBe('/lesson/meet-the-tiles');
  });

  it('can each be played to the end by answering every question correctly', () => {
    for (const lesson of LESSONS) {
      const reduce = lessonReducer(lesson);
      let state = startSession(lesson);
      for (const step of lesson.steps) {
        if (step.kind === 'tap') {
          for (const i of correctIndexes(step)) state = reduce(state, tap(i));
          if (state.feedback === 'open') state = reduce(state, CHECK);
          expect(state.feedback).toBe('correct');
        }
        state = reduce(state, NEXT);
      }
      expect(state.complete).toBe(true);
      const score = scoreSession(lesson, state.results);
      expect(score.firstTry).toBe(score.questions);
      expect(score.questions).toBeGreaterThan(0);
    }
  });

  it('only teach true tile counts in Meet the tiles', () => {
    // The lesson says: 152 tiles, four of every suit tile, wind and dragon, 8 Flowers, 8 Jokers.
    expect(copiesOf(bam(1))).toBe(4);
    expect(copiesOf(NORTH)).toBe(4);
    expect(copiesOf(RED)).toBe(4);
    expect(copiesOf({ type: 'flower' })).toBe(8);
    expect(copiesOf(JOKER)).toBe(8);
    const body = lessonById('meet-the-tiles')!.steps.map((s) => ('body' in s ? s.body : '')).join(' ');
    expect(body).toContain('152 tiles');
    expect(body).toContain('8 Flowers and 8 Jokers');
    expect(body).toMatch(/never be used as a single tile or in a pair/);
  });
});

describe('validateLesson', () => {
  const tapStep = (choices: TapStep['choices']): Lesson => ({
    ...FIXTURE,
    steps: [{ kind: 'tap', id: 'q', prompt: 'Tap.', choices, hint: 'h', explanation: 'e' }],
  });

  it('accepts the fixture', () => {
    expect(validateLesson(FIXTURE)).toEqual([]);
  });

  it('catches bad ids, empty fields and duplicate steps', () => {
    const errors = validateLesson({
      id: 'Bad Id',
      title: ' ',
      summary: '',
      minutes: 0,
      steps: [
        { kind: 'text', id: 'a', title: 'T', body: '' },
        { kind: 'text', id: 'a', title: 'T', body: 'B' },
        { kind: 'tiles', id: 'b', title: 'T', body: 'B', tiles: [], caption: '' },
      ],
    });
    expect(errors).toEqual(
      expect.arrayContaining([
        'lesson id "Bad Id" isn\'t URL-safe',
        'Bad Id: missing title',
        'Bad Id: missing summary',
        'Bad Id: minutes must be positive',
        'Bad Id › a: empty text',
        'Bad Id › a: duplicate step id',
        'Bad Id › b: no tiles to show',
        'Bad Id › b: tiles need a caption',
      ]),
    );
  });

  it('rejects an empty lesson', () => {
    expect(validateLesson({ ...FIXTURE, steps: [] })).toContain('fixture: has no steps');
  });

  it('needs at least one right answer and at least one wrong one', () => {
    expect(validateLesson(tapStep([{ tile: RED }, { tile: GREEN }]))).toContain(
      'fixture › q: no correct choice',
    );
    expect(
      validateLesson(tapStep([{ tile: RED, correct: true }, { tile: GREEN, correct: true }])).join(),
    ).toMatch(/every choice is correct/);
    expect(validateLesson(tapStep([{ tile: RED, correct: true }]))).toContain(
      'fixture › q: needs at least 2 choices',
    );
  });

  it('rejects identical tiles that disagree, since the player cannot tell them apart', () => {
    const errors = validateLesson(tapStep([{ tile: RED, correct: true }, { tile: RED }, { tile: NORTH }]));
    expect(errors).toContain(`fixture › q: two ${tileKey(RED)} tiles disagree on whether they're correct`);
    expect(validateLesson(tapStep([{ tile: RED, correct: true }, { tile: RED, correct: true }, { tile: NORTH }]))).toEqual([]);
  });

  it('flags duplicate lesson ids across the catalog', () => {
    expect(validateCatalog([FIXTURE, FIXTURE])).toContain('duplicate lesson id "fixture"');
  });
});

describe('reviewTry', () => {
  const many = FIXTURE.steps[2] as TapStep;

  it('counts missed and extra tiles', () => {
    expect(reviewTry(many, [0, 2])).toEqual({ correct: true, missed: 0, extra: 0 });
    expect(reviewTry(many, [0])).toEqual({ correct: false, missed: 1, extra: 0 });
    expect(reviewTry(many, [0, 1, 2])).toEqual({ correct: false, missed: 0, extra: 1 });
    expect(reviewTry(many, [1, 3])).toEqual({ correct: false, missed: 2, extra: 2 });
    expect(reviewTry(many, [])).toEqual({ correct: false, missed: 2, extra: 0 });
  });
});

describe('lesson session', () => {
  it('starts on the first step with nothing answered', () => {
    const state = startSession(FIXTURE);
    expect(state).toMatchObject({ stepIndex: 0, results: {}, feedback: 'open', complete: false });
    expect(canAdvance(FIXTURE, state)).toBe(true);
  });

  it('blocks Continue on a question until it is answered', () => {
    const state = play([NEXT]);
    expect(state.stepIndex).toBe(1);
    expect(canAdvance(FIXTURE, state)).toBe(false);
    expect(play([NEXT], state).stepIndex).toBe(1);
  });

  it('answers a one-answer question on the first tap', () => {
    const state = play([NEXT, tap(1)]);
    expect(state.feedback).toBe('correct');
    expect(state.selected).toEqual([1]);
    expect(state.results).toEqual({ one: 'first-try' });
    expect(canAdvance(FIXTURE, state)).toBe(true);
  });

  it('gives a hint after a wrong tap, then counts a later right answer as retried', () => {
    const wrong = play([NEXT, tap(0)]);
    expect(wrong).toMatchObject({ feedback: 'retry', misses: 1, selected: [0] });
    expect(wrong.lastTry).toEqual({ correct: false, missed: 1, extra: 1 });
    // Taps are ignored while the hint is up.
    expect(play([tap(1)], wrong)).toBe(wrong);
    const open = play([RETRY], wrong);
    expect(open).toMatchObject({ feedback: 'open', selected: [], lastTry: null });
    const right = play([tap(1)], open);
    expect(right.feedback).toBe('correct');
    expect(right.results.one).toBe('retried');
  });

  it(`shows the answer after ${MAX_TRIES} wrong tries, so nobody gets stuck`, () => {
    const state = play([NEXT, tap(0), RETRY, tap(2)]);
    expect(state.feedback).toBe('revealed');
    expect(state.selected).toEqual([1]);
    expect(state.results.one).toBe('revealed');
    expect(canAdvance(FIXTURE, state)).toBe(true);
  });

  it('toggles picks on a many-answer question and waits for Check', () => {
    const state = play([NEXT, tap(1), NEXT, tap(2), tap(0), tap(3), tap(3)]);
    expect(state.stepIndex).toBe(2);
    expect(state.selected).toEqual([0, 2]);
    expect(state.feedback).toBe('open');
    const checked = play([CHECK], state);
    expect(checked.feedback).toBe('correct');
    expect(checked.results.many).toBe('first-try');
  });

  it('ignores Check with nothing picked, and partial answers count as a miss', () => {
    const atMany = play([NEXT, tap(1), NEXT]);
    expect(play([CHECK], atMany)).toBe(atMany);
    const partial = play([tap(0), CHECK], atMany);
    expect(partial.feedback).toBe('retry');
    expect(partial.lastTry).toEqual({ correct: false, missed: 1, extra: 0 });
  });

  it('ignores taps on text steps, out-of-range choices, and answered questions', () => {
    const start = startSession(FIXTURE);
    expect(play([tap(0)], start)).toBe(start);
    const atOne = play([NEXT]);
    expect(play([tap(-1)], atOne)).toBe(atOne);
    expect(play([tap(3)], atOne)).toBe(atOne);
    const answered = play([tap(1)], atOne);
    expect(play([tap(0)], answered)).toBe(answered);
    expect(play([CHECK], answered)).toBe(answered);
    expect(play([RETRY], answered)).toBe(answered);
  });

  it('goes back to an answered question and shows it answered', () => {
    const state = play([NEXT, tap(0), RETRY, tap(1), NEXT, { type: 'back' }]);
    expect(state).toMatchObject({ stepIndex: 1, feedback: 'correct', selected: [1] });
    expect(state.results.one).toBe('retried');
    expect(play([{ type: 'back' }, { type: 'back' }, { type: 'back' }], state).stepIndex).toBe(0);
  });

  it('a revealed question stays revealed when revisited', () => {
    const state = play([NEXT, tap(0), RETRY, tap(2), NEXT, { type: 'back' }]);
    expect(state).toMatchObject({ feedback: 'revealed', selected: [1] });
  });

  it('completes after the last step, then ignores everything but restart', () => {
    const done = play([NEXT, tap(1), NEXT, tap(0), tap(2), CHECK, NEXT, NEXT]);
    expect(done.complete).toBe(true);
    expect(done.stepIndex).toBe(3);
    expect(canAdvance(FIXTURE, done)).toBe(false);
    expect(play([NEXT, { type: 'back' }], done)).toBe(done);
    expect(scoreSession(FIXTURE, done.results)).toEqual({ firstTry: 2, questions: 2 });
    expect(play([{ type: 'restart' }], done)).toEqual(startSession(FIXTURE));
  });

  it('scores only first-try answers', () => {
    expect(scoreSession(FIXTURE, { one: 'retried', many: 'first-try' })).toEqual({ firstTry: 1, questions: 2 });
    expect(scoreSession(FIXTURE, { one: 'revealed' })).toEqual({ firstTry: 0, questions: 2 });
  });

  it('resumes from a snapshot, dropping stale results and clamping the step', () => {
    const resumed = startSession(FIXTURE, { stepIndex: 2, results: { one: 'first-try', gone: 'retried' } });
    expect(resumed).toMatchObject({ stepIndex: 2, feedback: 'open', results: { one: 'first-try' } });
    expect(startSession(FIXTURE, { stepIndex: 1, results: { one: 'revealed' } }).feedback).toBe('revealed');
    expect(startSession(FIXTURE, { stepIndex: 99, results: {} }).stepIndex).toBe(3);
    expect(startSession(FIXTURE, { stepIndex: -4, results: {} }).stepIndex).toBe(0);
    expect(startSession(FIXTURE, { stepIndex: 1.5, results: {} }).stepIndex).toBe(0);
    expect(startSession(FIXTURE, null).stepIndex).toBe(0);
  });
});

describe('lesson progress', () => {
  const order = ['a', 'b', 'c'];
  const at = new Date('2026-11-12T10:00:00Z');

  it('unlocks lessons in order', () => {
    expect(order.map((id) => lessonStatus(emptyProgress, order, id))).toEqual(['available', 'locked', 'locked']);
    const afterA = recordCompletion(emptyProgress, 'a', { firstTry: 1, questions: 2 }, at);
    expect(order.map((id) => lessonStatus(afterA, order, id))).toEqual(['complete', 'available', 'locked']);
    expect(lessonStatus(afterA, order, 'unknown')).toBe('locked');
  });

  it('marks a started lesson in progress, including a replay of a finished one', () => {
    const started = saveSnapshot(emptyProgress, 'a', { stepIndex: 2, results: {} });
    expect(lessonStatus(started, order, 'a')).toBe('in-progress');
    const replay = saveSnapshot(recordCompletion(started, 'a', { firstTry: 0, questions: 1 }, at), 'a', {
      stepIndex: 1,
      results: {},
    });
    expect(lessonStatus(replay, order, 'a')).toBe('in-progress');
    // The finish still unlocks the next lesson during the replay.
    expect(lessonStatus(replay, order, 'b')).toBe('available');
  });

  it('records a finish, clears the saved place, and keeps the best score', () => {
    const started = saveSnapshot(emptyProgress, 'a', { stepIndex: 2, results: { q: 'first-try' } });
    expect(started.inProgress.a).toEqual({ stepIndex: 2, results: { q: 'first-try' } });
    const once = recordCompletion(started, 'a', { firstTry: 2, questions: 3 }, at);
    expect(once.inProgress).toEqual({});
    expect(once.completed.a).toEqual({
      completedAt: '2026-11-12T10:00:00.000Z',
      timesCompleted: 1,
      best: { firstTry: 2, questions: 3 },
    });
    const later = new Date('2026-11-13T10:00:00Z');
    const worse = recordCompletion(once, 'a', { firstTry: 1, questions: 3 }, later);
    expect(worse.completed.a).toEqual({
      completedAt: '2026-11-13T10:00:00.000Z',
      timesCompleted: 2,
      best: { firstTry: 2, questions: 3 },
    });
    const better = recordCompletion(worse, 'a', { firstTry: 3, questions: 3 }, later);
    expect(better.completed.a.best).toEqual({ firstTry: 3, questions: 3 });
  });

  it('leaves other lessons alone', () => {
    const progress = saveSnapshot(saveSnapshot(emptyProgress, 'a', { stepIndex: 1, results: {} }), 'b', {
      stepIndex: 0,
      results: {},
    });
    const done = recordCompletion(progress, 'a', { firstTry: 0, questions: 0 }, at);
    expect(Object.keys(done.inProgress)).toEqual(['b']);
  });
});
