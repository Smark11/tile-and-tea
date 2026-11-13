// One play-through of a lesson, as a pure reducer. The lesson player feeds it
// taps and button presses; the state says what to show. Only `stepIndex` and
// `results` need saving to resume later (see SessionSnapshot).

import type { Lesson, LessonStep, TapStep } from './types';

/** Wrong tries before the answer is shown, so nobody gets stuck. */
export const MAX_TRIES = 2;

/** How a question went: right first time, right after a hint, or shown. */
export type QuestionResult = 'first-try' | 'retried' | 'revealed';

/**
 * Where the current question stands.
 * - `open`: waiting for an answer.
 * - `retry`: a wrong try; the hint shows until the player tries again.
 * - `correct`: found it.
 * - `revealed`: out of tries; the right tiles are highlighted.
 */
export type Feedback = 'open' | 'retry' | 'correct' | 'revealed';

export type SessionSnapshot = {
  readonly stepIndex: number;
  /** Results so far, by step id. */
  readonly results: Readonly<Record<string, QuestionResult>>;
};

export type SessionState = SessionSnapshot & {
  /** Choice indexes the player has picked on the current question. */
  readonly selected: readonly number[];
  readonly feedback: Feedback;
  /** Wrong tries on the current question. */
  readonly misses: number;
  /** What was wrong with the last try (meaningful in `retry`). */
  readonly lastTry: TryReview | null;
  readonly complete: boolean;
};

export type SessionAction =
  /** Tap a choice. On a one-answer question this answers it. */
  | { readonly type: 'tap'; readonly index: number }
  | { readonly type: 'check' }
  | { readonly type: 'retry' }
  | { readonly type: 'next' }
  | { readonly type: 'back' }
  | { readonly type: 'restart' };

/** How a set of picked tiles compares to the answer. */
export type TryReview = {
  readonly correct: boolean;
  /** Right tiles not picked. */
  readonly missed: number;
  /** Wrong tiles picked. */
  readonly extra: number;
};

export function correctIndexes(step: TapStep): number[] {
  return step.choices.flatMap((choice, i) => (choice.correct ? [i] : []));
}

export function isSingleAnswer(step: TapStep): boolean {
  return correctIndexes(step).length === 1;
}

export function reviewTry(step: TapStep, selected: readonly number[]): TryReview {
  const answer = new Set(correctIndexes(step));
  const picked = new Set(selected);
  let missed = 0;
  let extra = 0;
  answer.forEach((i) => {
    if (!picked.has(i)) missed++;
  });
  picked.forEach((i) => {
    if (!answer.has(i)) extra++;
  });
  return { correct: missed === 0 && extra === 0, missed, extra };
}

function clampIndex(lesson: Lesson, index: number): number {
  if (!Number.isInteger(index) || index < 0) return 0;
  return Math.min(index, lesson.steps.length - 1);
}

/**
 * The state for showing step `stepIndex`. A question answered earlier shows
 * as answered; everything else starts fresh.
 */
function enterStep(lesson: Lesson, snapshot: SessionSnapshot): SessionState {
  const stepIndex = clampIndex(lesson, snapshot.stepIndex);
  const step = lesson.steps[stepIndex];
  const base: SessionState = {
    stepIndex,
    results: snapshot.results,
    selected: [],
    feedback: 'open',
    misses: 0,
    lastTry: null,
    complete: false,
  };
  const result = step.kind === 'tap' ? snapshot.results[step.id] : undefined;
  if (step.kind !== 'tap' || !result) return base;
  return {
    ...base,
    selected: correctIndexes(step),
    feedback: result === 'revealed' ? 'revealed' : 'correct',
  };
}

/**
 * A fresh session, or one resumed from a saved snapshot. Saved results for
 * steps the lesson no longer has are dropped, and an out-of-range step (the
 * lesson got shorter) is pulled back into range.
 */
export function startSession(lesson: Lesson, saved?: SessionSnapshot | null): SessionState {
  const ids = new Set(lesson.steps.map((s) => s.id));
  const results: Record<string, QuestionResult> = {};
  for (const [id, result] of Object.entries(saved?.results ?? {})) {
    if (ids.has(id)) results[id] = result;
  }
  return enterStep(lesson, { stepIndex: saved?.stepIndex ?? 0, results });
}

export function currentStep(lesson: Lesson, state: SessionState): LessonStep {
  return lesson.steps[state.stepIndex];
}

/** Whether Continue is available: always, except on an unanswered question. */
export function canAdvance(lesson: Lesson, state: SessionState): boolean {
  if (state.complete) return false;
  const step = currentStep(lesson, state);
  return step.kind !== 'tap' || state.feedback === 'correct' || state.feedback === 'revealed';
}

function answer(lesson: Lesson, state: SessionState, step: TapStep): SessionState {
  if (state.selected.length === 0) return state;
  const review = reviewTry(step, state.selected);
  if (review.correct) {
    const result: QuestionResult = state.misses === 0 ? 'first-try' : 'retried';
    return {
      ...state,
      feedback: 'correct',
      lastTry: review,
      results: { ...state.results, [step.id]: result },
    };
  }
  const misses = state.misses + 1;
  if (misses >= MAX_TRIES) {
    return {
      ...state,
      misses,
      feedback: 'revealed',
      lastTry: review,
      selected: correctIndexes(step),
      results: { ...state.results, [step.id]: 'revealed' },
    };
  }
  return { ...state, misses, feedback: 'retry', lastTry: review };
}

export function lessonReducer(lesson: Lesson) {
  return (state: SessionState, action: SessionAction): SessionState => {
    if (action.type === 'restart') return startSession(lesson);
    if (state.complete) return state;
    const step = currentStep(lesson, state);

    switch (action.type) {
      case 'tap': {
        if (step.kind !== 'tap' || state.feedback !== 'open') return state;
        if (action.index < 0 || action.index >= step.choices.length) return state;
        if (isSingleAnswer(step)) return answer(lesson, { ...state, selected: [action.index] }, step);
        const selected = state.selected.includes(action.index)
          ? state.selected.filter((i) => i !== action.index)
          : [...state.selected, action.index].sort((a, b) => a - b);
        return { ...state, selected };
      }
      case 'check':
        if (step.kind !== 'tap' || state.feedback !== 'open') return state;
        return answer(lesson, state, step);
      case 'retry':
        if (state.feedback !== 'retry') return state;
        return { ...state, feedback: 'open', selected: [], lastTry: null };
      case 'next':
        if (!canAdvance(lesson, state)) return state;
        if (state.stepIndex === lesson.steps.length - 1) return { ...state, complete: true };
        return enterStep(lesson, { stepIndex: state.stepIndex + 1, results: state.results });
      case 'back':
        if (state.stepIndex === 0) return state;
        return enterStep(lesson, { stepIndex: state.stepIndex - 1, results: state.results });
    }
  };
}

export type LessonScore = {
  /** Questions answered right on the first try. */
  readonly firstTry: number;
  readonly questions: number;
};

export function scoreSession(lesson: Lesson, results: SessionSnapshot['results']): LessonScore {
  const questions = lesson.steps.filter((s) => s.kind === 'tap');
  return {
    firstTry: questions.filter((s) => results[s.id] === 'first-try').length,
    questions: questions.length,
  };
}
