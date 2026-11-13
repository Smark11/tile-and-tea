import {
  DRILLS,
  drillForSkill,
  expectedScore,
  isProvisional,
  kFactor,
  levelReached,
  MAX_RATING,
  meterFill,
  meterTicks,
  METER_RANGE,
  MIN_RATING,
  PROVISIONAL_ANSWERS,
  rateAnswer,
  roundChange,
  SKILL_LEVELS,
  skillLevel,
  SKILLS,
  START_RATING,
  type SkillRating,
} from '..';
import { createRng } from '../../rng';

const at = (rating: number, answers = 20, roundStart = rating): SkillRating => ({ rating, answers, roundStart });

/** Plays `n` answers of a fixed score against one level, from a fresh skill. */
function play(n: number, score: number, level: number, start?: SkillRating): SkillRating {
  let r = start;
  for (let i = 0; i < n; i++) r = rateAnswer(r, { score, level, startsRound: i % 5 === 0 });
  return r!;
}

describe('expectedScore', () => {
  it('is a half at equal strength and follows the Elo curve', () => {
    expect(expectedScore(1000, 1000)).toBe(0.5);
    expect(expectedScore(1400, 1000)).toBeCloseTo(10 / 11, 10);
    expect(expectedScore(600, 1000)).toBeCloseTo(1 / 11, 10);
    expect(expectedScore(1100, 1000) + expectedScore(1000, 1100)).toBeCloseTo(1, 12);
  });
});

describe('rateAnswer', () => {
  it('starts an unrated skill at the start rating and counts the answer', () => {
    const r = rateAnswer(undefined, { score: 0.5, level: START_RATING, startsRound: false });
    expect(r).toEqual({ rating: START_RATING, answers: 1, roundStart: START_RATING });
  });

  it('moves by K × (score − expected)', () => {
    const before = at(1000, 3);
    const after = rateAnswer(before, { score: 1, level: 1100, startsRound: false });
    expect(after.rating).toBeCloseTo(1000 + kFactor(3) * (1 - expectedScore(1000, 1100)), 10);
    const miss = rateAnswer(before, { score: 0, level: 1100, startsRound: false });
    expect(miss.rating).toBeCloseTo(1000 - kFactor(3) * expectedScore(1000, 1100), 10);
  });

  it('rewards a best answer on a harder drill more, and costs a miss on an easier one more', () => {
    const before = at(1000);
    const gain = (level: number) => rateAnswer(before, { score: 1, level, startsRound: false }).rating - 1000;
    const loss = (level: number) => 1000 - rateAnswer(before, { score: 0, level, startsRound: false }).rating;
    expect(gain(1100)).toBeGreaterThan(gain(900));
    expect(loss(900)).toBeGreaterThan(loss(1100));
  });

  it('a sound answer (half credit) nudges up against a harder drill and down against an easier one', () => {
    expect(rateAnswer(at(1000), { score: 0.5, level: 1100, startsRound: false }).rating).toBeGreaterThan(1000);
    expect(rateAnswer(at(1000), { score: 0.5, level: 900, startsRound: false }).rating).toBeLessThan(1000);
  });

  it('moves new skills fast and settled ones gently', () => {
    expect(kFactor(0)).toBeGreaterThan(kFactor(PROVISIONAL_ANSWERS));
    expect(kFactor(PROVISIONAL_ANSWERS)).toBeGreaterThan(kFactor(1000));
    for (let n = 1; n < 200; n++) expect(kFactor(n)).toBeLessThanOrEqual(kFactor(n - 1));
    expect(isProvisional(at(1000, PROVISIONAL_ANSWERS - 1))).toBe(true);
    expect(isProvisional(at(1000, PROVISIONAL_ANSWERS))).toBe(false);
  });

  it('measures the round from just before its first answer', () => {
    let r = rateAnswer(at(1000, 20, 950), { score: 1, level: 1000, startsRound: true });
    expect(r.roundStart).toBe(1000);
    r = rateAnswer(r, { score: 1, level: 1000, startsRound: false });
    expect(r.roundStart).toBe(1000);
    expect(roundChange(r)).toBe(Math.round(r.rating) - 1000);
    expect(roundChange(r)).toBeGreaterThan(0);
    expect(roundChange(at(1000.4, 20, 999.6))).toBe(0);
  });

  it('clamps scores to 0–1 and ratings to their range, and refuses non-numbers', () => {
    expect(rateAnswer(at(1000), { score: 3, level: 1000, startsRound: false })).toEqual(
      rateAnswer(at(1000), { score: 1, level: 1000, startsRound: false }),
    );
    expect(rateAnswer(at(MAX_RATING), { score: 1, level: 3000, startsRound: false }).rating).toBe(MAX_RATING);
    expect(rateAnswer(at(MIN_RATING), { score: 0, level: 0, startsRound: false }).rating).toBe(MIN_RATING);
    expect(() => rateAnswer(at(1000), { score: NaN, level: 1000, startsRound: false })).toThrow(RangeError);
    expect(() => rateAnswer(at(1000), { score: 1, level: Infinity, startsRound: false })).toThrow(RangeError);
  });

  it('never mutates the rating it was given', () => {
    const before = Object.freeze(at(1000, 5, 990));
    rateAnswer(before, { score: 1, level: 1000, startsRound: true });
    expect(before).toEqual(at(1000, 5, 990));
  });

  it('settles near where a steady player’s average score is expected', () => {
    // A player who averages 75% on a 1000 drill should settle around 1000 + 400·log10(3) ≈ 1191.
    const rng = createRng('steady-player');
    let r: SkillRating | undefined;
    for (let i = 0; i < 2000; i++) r = rateAnswer(r, { score: rng() < 0.5 ? 1 : 0.5, level: 1000, startsRound: i % 5 === 0 });
    expect(r!.rating).toBeGreaterThan(1191 - 40);
    expect(r!.rating).toBeLessThan(1191 + 40);
  });

  it('climbs for a perfect player and falls for one who always misses, never leaving the range', () => {
    const up = play(300, 1, 1100);
    const down = play(300, 0, 900);
    expect(up.rating).toBeGreaterThan(1450);
    expect(up.rating).toBeLessThanOrEqual(MAX_RATING);
    expect(down.rating).toBeLessThan(700);
    expect(down.rating).toBeGreaterThanOrEqual(MIN_RATING);
  });

  it('a perfect first round lifts a new player one band, not to the top', () => {
    const r = play(5, 1, 900);
    expect(skillLevel(r.rating).id).toBe('steady');
  });
});

describe('levels and meters', () => {
  it('bands run lowest first and cover every rating', () => {
    for (let i = 1; i < SKILL_LEVELS.length; i++) expect(SKILL_LEVELS[i].from).toBeGreaterThan(SKILL_LEVELS[i - 1].from);
    expect(SKILL_LEVELS[0].from).toBe(MIN_RATING);
    expect(skillLevel(MIN_RATING).id).toBe('getting_started');
    expect(skillLevel(START_RATING).id).toBe('finding_feet');
    expect(skillLevel(999.4).id).toBe('finding_feet');
    // Bands go by the rating the player sees.
    expect(skillLevel(999.5).id).toBe('steady');
    expect(skillLevel(MAX_RATING).id).toBe('expert');
    expect(new Set(SKILL_LEVELS.map((l) => l.id)).size).toBe(SKILL_LEVELS.length);
  });

  it('reports a band only when an answer lifts the rating into a higher one', () => {
    expect(levelReached(undefined, at(1200))).toBeNull();
    expect(levelReached(at(995), at(1003))?.id).toBe('steady');
    expect(levelReached(at(1003), at(995))).toBeNull();
    expect(levelReached(at(1003), at(1010))).toBeNull();
  });

  it('fills the meter across its range and marks each band edge inside it', () => {
    expect(meterFill(METER_RANGE.low)).toBe(0);
    expect(meterFill(METER_RANGE.high)).toBe(1);
    expect(meterFill(MIN_RATING)).toBe(0);
    expect(meterFill(MAX_RATING)).toBe(1);
    expect(meterFill(START_RATING)).toBeGreaterThan(0);
    const ticks = meterTicks();
    expect(ticks).toHaveLength(SKILL_LEVELS.length - 1);
    ticks.forEach((t, i) => {
      expect(t).toBeGreaterThan(0);
      expect(t).toBeLessThan(1);
      if (i > 0) expect(t).toBeGreaterThan(ticks[i - 1]);
    });
  });
});

describe('skills and drills', () => {
  it('lists every skill once, and every skill has a drill that trains it', () => {
    expect(new Set(SKILLS.map((s) => s.id)).size).toBe(SKILLS.length);
    for (const skill of SKILLS) expect(drillForSkill(skill.id)?.skill).toBe(skill.id);
    for (const drill of DRILLS) expect(SKILLS.some((s) => s.id === drill.skill)).toBe(true);
  });

  it('gives each drill a level on the rating scale, harder drills higher', () => {
    for (const drill of DRILLS) {
      expect(drill.level).toBeGreaterThanOrEqual(METER_RANGE.low);
      expect(drill.level).toBeLessThanOrEqual(METER_RANGE.high);
    }
    const level = (id: string) => DRILLS.find((d) => d.id === id)!.level;
    expect(level('name-the-hand')).toBeLessThan(level('best-hand'));
    expect(level('best-hand')).toBeLessThan(level('charleston'));
    expect(level('charleston')).toBeLessThan(level('discards'));
  });
});
