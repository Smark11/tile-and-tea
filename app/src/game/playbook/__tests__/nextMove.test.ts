import { drillForSkill, SKILLS, START_RATING } from '../../drills';
import { SCENARIOS } from '../../scenarios';
import { principleById } from '..';
import { nextMove, skillsByNeed, type NextMoveInput } from '../nextMove';

const EMPTY: NextMoveInput = { scenarios: {}, ratings: {} };
const played = (verdict: string, ids = SCENARIOS.map((s) => s.id)) => Object.fromEntries(ids.map((id) => [id, { verdict }]));
const rated = (ratings: Partial<Record<(typeof SKILLS)[number]['id'], number>>) =>
  Object.fromEntries(Object.entries(ratings).map(([k, rating]) => [k, { rating }]));

describe('skillsByNeed', () => {
  it('ranks unrated skills at the starting rating, ties in the Progress tab’s order', () => {
    expect(skillsByNeed(EMPTY).map((s) => s.skill)).toEqual(SKILLS.map((s) => s.id));
    const input = { ...EMPTY, ratings: rated({ 'card-reading': 1200, discards: 870, charleston: START_RATING }) };
    expect(skillsByNeed(input).map((s) => s.skill)).toEqual(['discards', 'hand-choice', 'charleston', 'card-reading']);
  });

  it('compares the whole-number ratings the meters show', () => {
    const input = { ...EMPTY, ratings: rated({ 'card-reading': 950.4, 'hand-choice': 949.6, charleston: 2000, discards: 2000 }) };
    // Both show 950, so the list order breaks the tie.
    expect(skillsByNeed(input).map((s) => s.skill).slice(0, 2)).toEqual(['card-reading', 'hand-choice']);
    expect(skillsByNeed(input)[0]).toMatchObject({ rating: 950, level: { id: 'finding_feet' } });
  });
});

describe('nextMove', () => {
  it('starts a new player on the first scenario in the curriculum', () => {
    const move = nextMove(EMPTY);
    expect(move).toMatchObject({ kind: 'scenario', reason: 'new-scenario', scenario: SCENARIOS[0] });
    expect(move.kind === 'scenario' && move.principle).toBe(principleById(SCENARIOS[0].principle));
    expect(move.why).toBe('The Charleston isn’t rated yet, and this scenario is where it starts.');
  });

  it('plays unplayed scenarios first, from the lowest-rated skill that has one', () => {
    const input = {
      scenarios: played('best', ['pass-what-touches-nothing']),
      ratings: rated({ charleston: 1100, 'hand-choice': 980, discards: 870 }),
    };
    const move = nextMove(input);
    expect(move).toMatchObject({ kind: 'scenario', reason: 'new-scenario', scenario: { id: 'count-whats-gone' } });
    expect(move.why).toBe('Discards (Finding your feet, 870) is your lowest-rated skill with a scenario left to play.');
  });

  it('prefers an unplayed scenario to a drill even when the weakest skill has none left', () => {
    // Reading the card has no scenarios; it waits until every scenario is played.
    const discardIds = SCENARIOS.filter((s) => s.skill !== 'charleston').map((s) => s.id);
    const input = { scenarios: played('best', discardIds), ratings: rated({ 'card-reading': 700, charleston: 1300 }) };
    const move = nextMove(input);
    expect(move).toMatchObject({ kind: 'scenario', reason: 'new-scenario', standing: { skill: 'charleston' } });
    expect(move.why).toBe('The Charleston (Sharp, 1300) still has a scenario you haven’t played.');
  });

  it('then replays a scenario on the weakest skill whose last move wasn’t the best', () => {
    const scenarios = { ...played('best'), 'exposures-count-too': { verdict: 'good' }, 'keep-doors-open': { verdict: 'miss' } };
    const input = { scenarios, ratings: rated({ 'card-reading': 1200, 'hand-choice': 1100, charleston: 1050, discards: 990 }) };
    const move = nextMove(input);
    expect(move).toMatchObject({ kind: 'scenario', reason: 'replay-scenario', scenario: { id: 'exposures-count-too' } });
    expect(move.why).toBe('Discards (Finding your feet, 990) is your lowest-rated skill, and your last move here wasn’t the coach’s best.');
    // A missed scenario on a stronger skill waits: the weakest skill's drill comes first.
    const fixed = { ...input, scenarios: { ...scenarios, 'exposures-count-too': { verdict: 'best' } } };
    expect(nextMove(fixed)).toMatchObject({ kind: 'drill', drill: drillForSkill('discards') });
  });

  it('otherwise drills the lowest-rated skill', () => {
    const input = { scenarios: played('best'), ratings: rated({ 'hand-choice': 1180, charleston: 1150, discards: 1001 }) };
    // Reading the card was never rated, so it ranks at the start rating, below Discards.
    expect(nextMove(input)).toMatchObject({ kind: 'drill', reason: 'weakest-drill', drill: drillForSkill('card-reading') });
    expect(nextMove(input).why).toBe('Reading the card isn’t rated yet. A round finds your level.');
    const all = { ...input, ratings: { ...input.ratings, ...rated({ 'card-reading': 1400 }) } };
    expect(nextMove(all)).toMatchObject({ kind: 'drill', drill: drillForSkill('discards'), standing: { rating: 1001 } });
    expect(nextMove(all).why).toBe('Discards (Steady, 1001) is your lowest-rated skill. Every answer here moves it.');
  });

  it('picks what the screenshot fixtures show', () => {
    const fixture = (name: string) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const saves = require(`../../../../scripts/fixtures/${name}.json`);
      return { scenarios: saves['mjc.scenarios'].state.completed, ratings: saves['mjc.drills'].state.ratings };
    };
    // Playbook progress: Discards has no rating yet, so its first unplayed scenario comes first.
    const playbook = nextMove(fixture('playbook-progress'));
    expect(playbook).toMatchObject({ reason: 'new-scenario', scenario: { id: 'count-whats-gone' } });
    expect(playbook.why).toBe('Discards isn’t rated yet, and this scenario is where it starts.');
    // Everything played: Discards (968) is lowest, and its last move in "Exposures count as gone too" was only good.
    const replay = nextMove(fixture('next-move-progress'));
    expect(replay).toMatchObject({ reason: 'replay-scenario', scenario: { id: 'exposures-count-too' } });
    expect(Object.keys(fixture('next-move-progress').scenarios).sort()).toEqual(SCENARIOS.map((s) => s.id).sort());
  });

  it('always lands on something playable, for any mix of progress', () => {
    const verdicts = [undefined, 'best', 'good', 'miss'];
    for (let seed = 0; seed < 200; seed++) {
      const scenarios: Record<string, { verdict: string }> = {};
      SCENARIOS.forEach((s, i) => {
        const v = verdicts[(seed * 7 + i * 3) % 4];
        if (v) scenarios[s.id] = { verdict: v };
      });
      const ratings = rated(Object.fromEntries(SKILLS.map((s, i) => [s.id, 700 + ((seed * 37 + i * 101) % 800)])));
      const move = nextMove({ scenarios, ratings });
      const weakest = skillsByNeed({ scenarios, ratings })[0];
      if (move.kind === 'drill') {
        expect(SCENARIOS.every((s) => scenarios[s.id])).toBe(true);
        expect(move.drill.skill).toBe(weakest.skill);
      } else if (move.reason === 'new-scenario') {
        expect(scenarios[move.scenario.id]).toBeUndefined();
      } else {
        expect(move.scenario.skill).toBe(weakest.skill);
        expect(scenarios[move.scenario.id].verdict).not.toBe('best');
      }
      expect(move.why.length).toBeLessThanOrEqual(110);
    }
  });
});
