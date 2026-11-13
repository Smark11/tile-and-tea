import {
  canCheck,
  currentAnswer,
  currentQuestion,
  dealRound,
  isSoundAnswer,
  questionSeed,
  roundReducer,
  scoreRound,
  startRound,
  type Drill,
  type RoundAction,
  type RoundState,
} from '..';

// A toy drill: the seed picks a number 0–9; the player picks `picks` of four
// tiles. Choice 0 is best, choice 1 is good, the rest miss.
function toyDrill(picks: number, questionsPerRound = 3, distinct = 10): Drill<{ n: number }> {
  return {
    id: 'toy',
    skill: 'discards',
    title: 'Toy',
    summary: 'A toy drill.',
    icon: { type: 'joker' },
    questionsPerRound,
    generate: (seed) => {
      const n = seed % distinct;
      return {
        seed,
        key: `n${n}`,
        prompt: `Question ${n}`,
        scene: { tiles: [{ type: 'joker' }], caption: 'A Joker' },
        choices: ([1, 2, 3, 4] as const).map((rank) => ({ kind: 'tile', tile: { type: 'suited', suit: 'dot', rank } }) as const),
        picks,
        data: { n },
      };
    },
    evaluate: (_q, picked) => {
      const verdict = picked.includes(0) ? 'best' : picked.includes(1) ? 'good' : 'miss';
      return {
        verdict,
        score: verdict === 'best' ? 1 : verdict === 'good' ? 0.5 : 0,
        best: [0],
        title: verdict,
        explanation: `You picked ${picked.join(',')}`,
      };
    },
  };
}

function run(drill: Drill<{ n: number }>, state: RoundState, ...actions: RoundAction[]): RoundState {
  const reduce = roundReducer(drill);
  return actions.reduce(reduce, state);
}

describe('dealing', () => {
  it('is deterministic in the seed', () => {
    const drill = toyDrill(1);
    expect(dealRound(drill, 42)).toEqual(dealRound(drill, 42));
    expect(questionSeed(42, 0)).toBe(questionSeed(42, 0));
    expect(questionSeed(42, 0)).not.toBe(questionSeed(42, 1));
    expect(questionSeed(42, 0)).not.toBe(questionSeed(43, 0));
  });

  it('deals questionsPerRound questions with no repeats when the drill has enough', () => {
    const drill = toyDrill(1, 8);
    for (let seed = 0; seed < 50; seed++) {
      const keys = dealRound(drill, seed).map((q) => q.key);
      expect(keys).toHaveLength(8);
      expect(new Set(keys).size).toBe(8);
    }
  });

  it('still deals a full round when the drill has fewer distinct questions than the round', () => {
    const questions = dealRound(toyDrill(1, 5, 2), 7);
    expect(questions).toHaveLength(5);
    expect(new Set(questions.map((q) => q.key)).size).toBe(2);
  });

  it('starts at the first question with nothing answered', () => {
    const state = startRound(toyDrill(1), 9);
    expect(state).toMatchObject({ drillId: 'toy', seed: 9, index: 0, selected: [], answers: [], complete: false });
    expect(currentAnswer(state)).toBeNull();
  });
});

describe('one-pick questions', () => {
  const drill = toyDrill(1);
  const start = startRound(drill, 1);

  it('answers on the first tap, once', () => {
    const state = run(drill, start, { type: 'tap', index: 2 });
    expect(currentAnswer(state)).toMatchObject({ picked: [2], evaluation: { verdict: 'miss' } });
    expect(state.selected).toEqual([2]);
    // Later taps don't change the answer.
    expect(run(drill, state, { type: 'tap', index: 0 })).toBe(state);
  });

  it('ignores taps outside the choices', () => {
    for (const index of [-1, 4, 1.5, NaN]) {
      expect(run(drill, start, { type: 'tap', index })).toBe(start);
    }
  });

  it('only moves on once answered, and completes after the last question', () => {
    expect(run(drill, start, { type: 'next' })).toBe(start);
    const second = run(drill, start, { type: 'tap', index: 0 }, { type: 'next' });
    expect(second.index).toBe(1);
    expect(second.selected).toEqual([]);
    expect(currentAnswer(second)).toBeNull();
    const done = run(drill, second, { type: 'tap', index: 1 }, { type: 'next' }, { type: 'tap', index: 3 }, { type: 'next' });
    expect(done.complete).toBe(true);
    expect(done.index).toBe(2);
    // A finished round ignores everything but a restart.
    expect(run(drill, done, { type: 'tap', index: 0 }, { type: 'next' }, { type: 'check' })).toBe(done);
    expect(scoreRound(done)).toEqual({ best: 1, good: 1, miss: 1, questions: 3, score: 0.5 });
  });

  it('never offers Check', () => {
    expect(canCheck(start)).toBe(false);
    expect(run(drill, start, { type: 'check' })).toBe(start);
  });
});

describe('multi-pick questions', () => {
  const drill = toyDrill(3);
  const start = startRound(drill, 5);

  it('toggles picks, sorted, up to the number asked for', () => {
    let state = run(drill, start, { type: 'tap', index: 3 }, { type: 'tap', index: 1 });
    expect(state.selected).toEqual([1, 3]);
    expect(canCheck(state)).toBe(false);
    state = run(drill, state, { type: 'tap', index: 2 });
    expect(state.selected).toEqual([1, 2, 3]);
    expect(canCheck(state)).toBe(true);
    // A fourth pick is refused; un-picking frees a place.
    expect(run(drill, state, { type: 'tap', index: 0 })).toBe(state);
    state = run(drill, state, { type: 'tap', index: 2 }, { type: 'tap', index: 0 });
    expect(state.selected).toEqual([0, 1, 3]);
  });

  it('answers on Check only with a full pick', () => {
    const partial = run(drill, start, { type: 'tap', index: 1 });
    expect(run(drill, partial, { type: 'check' })).toBe(partial);
    const answered = run(drill, partial, { type: 'tap', index: 2 }, { type: 'tap', index: 3 }, { type: 'check' });
    expect(currentAnswer(answered)).toMatchObject({ picked: [1, 2, 3], evaluation: { verdict: 'good' } });
    expect(canCheck(answered)).toBe(false);
    expect(run(drill, answered, { type: 'tap', index: 1 })).toBe(answered);
  });
});

describe('restart and scoring', () => {
  it('restarts with a fresh deal from the new seed', () => {
    const drill = toyDrill(1);
    const done = run(drill, startRound(drill, 1), { type: 'tap', index: 0 }, { type: 'next' });
    expect(run(drill, done, { type: 'restart', seed: 77 })).toEqual(startRound(drill, 77));
  });

  it('scores an empty round as zero', () => {
    expect(scoreRound(startRound(toyDrill(1), 3))).toEqual({ best: 0, good: 0, miss: 0, questions: 3, score: 0 });
  });

  it('counts best and good answers as sound', () => {
    const base = { score: 0, best: [], title: '', explanation: '' };
    expect(isSoundAnswer({ ...base, verdict: 'best' })).toBe(true);
    expect(isSoundAnswer({ ...base, verdict: 'good' })).toBe(true);
    expect(isSoundAnswer({ ...base, verdict: 'miss' })).toBe(false);
  });

  it('never mutates the state it was given', () => {
    const drill = toyDrill(2);
    const start = Object.freeze(startRound(drill, 11));
    expect(() => run(drill, start, { type: 'tap', index: 0 }, { type: 'tap', index: 1 }, { type: 'check' }, { type: 'next' })).not.toThrow();
    expect(currentQuestion(start)).toBe(start.questions[0]);
    expect(start.answers).toEqual([]);
  });
});
