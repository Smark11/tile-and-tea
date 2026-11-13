// One round of a drill, as a pure reducer. A round deals all its questions up
// front from one seed, so a round can be replayed (or shared) exactly. Unlike a
// lesson question, a drill question is answered once: the coach then explains
// the strongest play, whatever the pick was.

import { createRng } from '../rng';
import type { AnyDrill, DrillEvaluation, DrillQuestion, Verdict } from './types';

/** Re-deals when a seed repeats a question already in the round, up to this many times. */
const MAX_REDEALS = 24;

export type AnsweredQuestion = {
  readonly picked: readonly number[];
  readonly evaluation: DrillEvaluation;
};

export type RoundState = {
  readonly drillId: string;
  readonly seed: number;
  readonly questions: readonly DrillQuestion[];
  /** The question on screen. */
  readonly index: number;
  /** Choice indexes picked on the current question, before Check. */
  readonly selected: readonly number[];
  /** One entry per answered question, in order. */
  readonly answers: readonly AnsweredQuestion[];
  readonly complete: boolean;
};

export type RoundAction =
  /** Tap a choice. On a one-pick question this answers it. */
  | { readonly type: 'tap'; readonly index: number }
  | { readonly type: 'check' }
  | { readonly type: 'next' }
  | { readonly type: 'restart'; readonly seed: number };

/** The seed for question `index` of a round (and its `redeal`-th retry). */
export function questionSeed(roundSeed: number, index: number, redeal = 0): number {
  return Math.floor(createRng(`${roundSeed >>> 0}:${index}:${redeal}`)() * 2 ** 32) >>> 0;
}

/** Deals a round's questions from one seed, never repeating a question when the drill has enough. */
export function dealRound(drill: AnyDrill, seed: number): DrillQuestion[] {
  const questions: DrillQuestion[] = [];
  const keys = new Set<string>();
  for (let i = 0; i < drill.questionsPerRound; i++) {
    let question = drill.generate(questionSeed(seed, i));
    for (let redeal = 1; keys.has(question.key) && redeal <= MAX_REDEALS; redeal++) {
      question = drill.generate(questionSeed(seed, i, redeal));
    }
    keys.add(question.key);
    questions.push(question);
  }
  return questions;
}

export function startRound(drill: AnyDrill, seed: number): RoundState {
  return {
    drillId: drill.id,
    seed: seed >>> 0,
    questions: dealRound(drill, seed),
    index: 0,
    selected: [],
    answers: [],
    complete: false,
  };
}

export function currentQuestion(state: RoundState): DrillQuestion {
  return state.questions[state.index];
}

/** The current question's answer, once it has one. */
export function currentAnswer(state: RoundState): AnsweredQuestion | null {
  return state.answers[state.index] ?? null;
}

/** Whether Check is ready: a multi-pick question with exactly enough picks. */
export function canCheck(state: RoundState): boolean {
  if (state.complete || currentAnswer(state)) return false;
  const question = currentQuestion(state);
  return question.picks > 1 && state.selected.length === question.picks;
}

function answer(drill: AnyDrill, state: RoundState, picked: readonly number[]): RoundState {
  const evaluation = drill.evaluate(currentQuestion(state), picked);
  return { ...state, selected: picked, answers: [...state.answers, { picked, evaluation }] };
}

export function roundReducer(drill: AnyDrill) {
  return (state: RoundState, action: RoundAction): RoundState => {
    if (action.type === 'restart') return startRound(drill, action.seed);
    if (state.complete) return state;
    const question = currentQuestion(state);
    const answered = currentAnswer(state) !== null;

    switch (action.type) {
      case 'tap': {
        if (answered) return state;
        if (!Number.isInteger(action.index) || action.index < 0 || action.index >= question.choices.length) {
          return state;
        }
        if (question.picks === 1) return answer(drill, state, [action.index]);
        if (state.selected.includes(action.index)) {
          return { ...state, selected: state.selected.filter((i) => i !== action.index) };
        }
        // A full pick stays as it is; the player un-picks one to change it.
        if (state.selected.length >= question.picks) return state;
        return { ...state, selected: [...state.selected, action.index].sort((a, b) => a - b) };
      }
      case 'check':
        return canCheck(state) ? answer(drill, state, state.selected) : state;
      case 'next':
        if (!answered) return state;
        if (state.index === state.questions.length - 1) return { ...state, complete: true };
        return { ...state, index: state.index + 1, selected: [] };
    }
  };
}

export type RoundScore = Readonly<Record<Verdict, number>> & {
  readonly questions: number;
  /** Mean evaluation score, 0–1. */
  readonly score: number;
};

export function scoreRound(state: RoundState): RoundScore {
  const counts: Record<Verdict, number> = { best: 0, good: 0, miss: 0 };
  let total = 0;
  for (const { evaluation } of state.answers) {
    counts[evaluation.verdict]++;
    total += evaluation.score;
  }
  return {
    ...counts,
    questions: state.questions.length,
    score: state.answers.length === 0 ? 0 : total / state.answers.length,
  };
}

/** Whether an answer counts as right for reporting: the best play, or a sound one. */
export function isSoundAnswer(evaluation: DrillEvaluation): boolean {
  return evaluation.verdict !== 'miss';
}
