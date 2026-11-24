import {
  dayKey,
  moveIndexes,
  openScenario,
  scenarioAnswer,
  scenarioById,
  scenarioOfTheDay,
  scenarioReducer,
  SCENARIO_STEPS,
  SCENARIOS,
  startScenario,
} from '..';

describe('scenarioOfTheDay', () => {
  const day = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);

  it('is the same all day and changes at local midnight', () => {
    const morning = scenarioOfTheDay(day(2026, 11, 24, 0));
    expect(scenarioOfTheDay(day(2026, 11, 24, 23))).toBe(morning);
    expect(scenarioOfTheDay(day(2026, 11, 25, 0))).not.toBe(morning);
    expect(dayKey(day(2026, 3, 7))).toBe('2026-03-07');
  });

  it('visits every scenario once per cycle, never twice in a row', () => {
    const picks = SCENARIOS.map((_, i) => scenarioOfTheDay(day(2026, 1, 1 + i)));
    expect(new Set(picks).size).toBe(SCENARIOS.length);
    for (let i = 1; i < 60; i++) {
      expect(scenarioOfTheDay(day(2026, 1, i))).not.toBe(scenarioOfTheDay(day(2026, 1, i + 1)));
    }
  });
});

const charleston = scenarioById('pass-what-touches-nothing')!;
const discard = scenarioById('count-whats-gone')!;

describe('scenarioReducer', () => {
  it('walks scene → move → strategy, and only forward once the move is made', () => {
    const reduce = scenarioReducer(charleston);
    let state = startScenario(charleston);
    expect(state.step).toBe('scene');
    expect(SCENARIO_STEPS).toEqual(['scene', 'move', 'strategy']);
    // Taps and continue do nothing on the scene.
    expect(reduce(state, { type: 'tap', index: 0 })).toBe(state);
    expect(reduce(state, { type: 'continue' })).toBe(state);
    state = reduce(state, { type: 'begin' });
    expect(state.step).toBe('move');
    expect(reduce(state, { type: 'begin' })).toBe(state);
    // Can't continue before answering.
    expect(reduce(state, { type: 'continue' })).toBe(state);
    const [a, b, c] = moveIndexes(charleston);
    state = reduce(state, { type: 'tap', index: a });
    state = reduce(state, { type: 'tap', index: b });
    expect(reduce(state, { type: 'check' })).toBe(state);
    state = reduce(state, { type: 'tap', index: c });
    expect(state.round.selected).toEqual([a, b, c].sort((x, y) => x - y));
    expect(scenarioAnswer(state)).toBeNull();
    state = reduce(state, { type: 'check' });
    expect(scenarioAnswer(state)?.evaluation.verdict).toBe('best');
    // Answered: taps are ignored, continue moves on.
    expect(reduce(state, { type: 'tap', index: a })).toBe(state);
    state = reduce(state, { type: 'continue' });
    expect(state.step).toBe('strategy');
    expect(reduce(state, { type: 'continue' })).toBe(state);
    expect(reduce(state, { type: 'tap', index: a })).toBe(state);
    // Restart goes back to a clean scene.
    const again = reduce(state, { type: 'restart' });
    expect(again.step).toBe('scene');
    expect(scenarioAnswer(again)).toBeNull();
  });

  it('answers a one-pick move on the tap', () => {
    const reduce = scenarioReducer(discard);
    let state = reduce(startScenario(discard), { type: 'begin' });
    expect(state.step).toBe('move');
    const [soap] = moveIndexes(discard);
    state = reduce(state, { type: 'tap', index: soap });
    expect(scenarioAnswer(state)?.evaluation.title).toBe('A smart discard');
    expect(scenarioAnswer(state)?.picked).toEqual([soap]);
  });

  it('opens part-way through, with the taught move made for the strategy', () => {
    expect(openScenario(charleston, 'scene').step).toBe('scene');
    const move = openScenario(discard, 'move');
    expect(move.step).toBe('move');
    expect(scenarioAnswer(move)).toBeNull();
    for (const s of [charleston, discard]) {
      const strategy = openScenario(s, 'strategy');
      expect(strategy.step).toBe('strategy');
      expect(scenarioAnswer(strategy)?.evaluation.verdict).toBe('best');
      expect(scenarioAnswer(strategy)?.picked).toEqual(moveIndexes(s).sort((a, b) => a - b));
    }
  });
});
