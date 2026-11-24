import { moveIndexes, openScenario, scenarioAnswer, scenarioById, scenarioReducer, SCENARIO_STEPS, startScenario } from '..';

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
