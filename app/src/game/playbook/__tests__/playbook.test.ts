import { SCENARIOS } from '../../scenarios';
import {
  evidenceWords,
  MASTERY_LEVEL,
  playbookProgress,
  principleById,
  principleProgress,
  PRINCIPLES,
  principlesIn,
  scenariosFor,
  type PlaybookInput,
} from '..';

const EMPTY: PlaybookInput = { scenarios: {}, ratings: {}, lessons: {} };
const T1 = principleById('T1')!;

describe('PRINCIPLES', () => {
  it('has unique ids, grouped by stage in curriculum order', () => {
    expect(new Set(PRINCIPLES.map((p) => p.id)).size).toBe(PRINCIPLES.length);
    expect([...principlesIn('charleston'), ...principlesIn('hand-choice'), ...principlesIn('table')]).toEqual(PRINCIPLES);
  });

  it('finds the playbook row for every scenario, at the scenario’s own stage and skill', () => {
    for (const scenario of SCENARIOS) {
      const principle = principleById(scenario.principle);
      expect(principle).toBeDefined();
      expect(principle!.stage).toBe(scenario.stage);
      expect(principle!.skill).toBe(scenario.skill);
    }
  });

  it('lists a principle’s scenarios from their own principle field', () => {
    expect(scenariosFor(T1).map((s) => s.id)).toEqual(['count-whats-gone', 'exposures-count-too']);
    expect(scenariosFor(principleById('T3')!)).toEqual([]);
  });

  it('keeps every rule to one short line', () => {
    for (const p of PRINCIPLES) expect(p.rule.length).toBeLessThanOrEqual(110);
  });
});

describe('principleProgress', () => {
  it('starts with nothing done', () => {
    const progress = principleProgress(T1, EMPTY);
    expect(progress.mastered).toBe(false);
    expect(progress.steps.map((s) => s.kind)).toEqual(['scenario', 'scenario', 'skill']);
    expect(progress.steps.every((s) => !s.done)).toBe(true);
    expect(progress.steps[2]).toMatchObject({ kind: 'skill', skill: 'discards', level: null });
  });

  const bothBest = { 'count-whats-gone': { verdict: 'best' }, 'exposures-count-too': { verdict: 'best' } };

  it('masters a principle when every scenario was last finished best and the skill is Steady', () => {
    const input = { ...EMPTY, scenarios: bothBest, ratings: { discards: { rating: MASTERY_LEVEL.from } } };
    expect(principleProgress(T1, input).mastered).toBe(true);
  });

  it('needs the skill at Steady, by the whole-number rating the player sees', () => {
    const just = (rating: number) => ({ ...EMPTY, scenarios: bothBest, ratings: { discards: { rating } } });
    expect(principleProgress(T1, just(MASTERY_LEVEL.from - 0.6)).mastered).toBe(false);
    expect(principleProgress(T1, just(MASTERY_LEVEL.from - 0.4)).mastered).toBe(true);
    expect(principleProgress(T1, just(1500)).mastered).toBe(true);
  });

  it('needs the best move, not just a finish, in every scenario', () => {
    const ratings = { discards: { rating: 1200 } };
    const good = { ...bothBest, 'exposures-count-too': { verdict: 'good' } };
    expect(principleProgress(T1, { ...EMPTY, scenarios: good, ratings }).mastered).toBe(false);
    const one = { 'count-whats-gone': { verdict: 'best' } };
    expect(principleProgress(T1, { ...EMPTY, scenarios: one, ratings }).mastered).toBe(false);
  });

  it('needs a teaching lesson finished', () => {
    const c4 = principleById('C4')!;
    const ratings = { charleston: { rating: 1100 } };
    expect(principleProgress(c4, { ...EMPTY, ratings }).mastered).toBe(false);
    expect(principleProgress(c4, { ...EMPTY, ratings, lessons: { charleston: { score: 1 } } }).mastered).toBe(true);
  });

  it('masters a drill-taught principle on the rating alone', () => {
    const t3 = principleById('T3')!;
    expect(principleProgress(t3, { ...EMPTY, ratings: { discards: { rating: 999 } } }).mastered).toBe(false);
    expect(principleProgress(t3, { ...EMPTY, ratings: { discards: { rating: 1000 } } }).mastered).toBe(true);
  });

  it('covers the whole playbook in order', () => {
    expect(playbookProgress(EMPTY).map((p) => p.principle)).toEqual(PRINCIPLES);
  });
});

describe('evidenceWords', () => {
  it('words a measured edge as extra hands per 100 games, where it was measured', () => {
    expect(evidenceWords(principleById('H1')!.evidence)).toEqual({
      tag: 'Measured',
      detail: 'In our simulator, following it won 11 to 25 more hands per 100 games at every bot table we tested.',
    });
    expect(evidenceWords(T1.evidence).detail).toContain('2 to 4 more hands per 100 games against Beginner and Club bots.');
    expect(evidenceWords(principleById('C3')!.evidence).detail).toContain('won 5 more hands per 100 games against Club bots.');
  });

  it('never oversells a tie-break', () => {
    const { tag, detail } = evidenceWords({ kind: 'tie-break' });
    expect(tag).toBe('Tie-break');
    expect(detail).toMatch(/No edge we could measure/);
  });
});

describe('the screenshot progress (scripts/fixtures/playbook-progress.json)', () => {
  it('still shows two mastered principles and several half-done ones', () => {
    // The harness seeds each key into storage, as that store's persisted save,
    // to capture the mastered and half-done playbook states.
    const fixture = require('../../../../scripts/fixtures/playbook-progress.json');
    const progress = playbookProgress({
      scenarios: fixture['mjc.scenarios'].state.completed,
      ratings: fixture['mjc.drills'].state.ratings,
      lessons: {},
    });
    const byId = Object.fromEntries(progress.map((p) => [p.principle.id, p]));
    expect(progress.filter((p) => p.mastered).map((p) => p.principle.id)).toEqual(['C1', 'C3']);
    // C2: Steady skill, but its scenario was finished with a good move, not the best.
    expect(byId.C2.steps.map((s) => s.done)).toEqual([false, true]);
    // H1: a scenario made at its best move, skill still below Steady.
    expect(byId.H1.steps.some((s) => s.done)).toBe(true);
    expect(byId.H1.steps.at(-1)).toMatchObject({ kind: 'skill', done: false, level: { id: 'finding_feet' } });
  });
});
