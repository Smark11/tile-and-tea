import {
  DAILY_LIMIT_ENFORCED,
  drillAllowance,
  FREE_ROUNDS_PER_DAY,
  localDay,
  NO_USAGE,
  recordRound,
  roundsToday,
} from '..';

const morning = new Date(2027, 2, 9, 8, 30);
const lateNight = new Date(2027, 2, 9, 23, 59);
const nextDay = new Date(2027, 2, 10, 0, 1);

describe('localDay', () => {
  it('uses the local calendar date, zero-padded', () => {
    expect(localDay(morning)).toBe('2027-03-09');
    expect(localDay(new Date(2027, 11, 31, 23, 59))).toBe('2027-12-31');
    expect(localDay(nextDay)).toBe('2027-03-10');
  });
});

describe('counting rounds', () => {
  it('counts rounds within a day and starts over at local midnight', () => {
    let usage = recordRound(NO_USAGE, morning);
    usage = recordRound(usage, lateNight);
    expect(usage).toEqual({ day: '2027-03-09', rounds: 2 });
    expect(roundsToday(usage, lateNight)).toBe(2);
    expect(roundsToday(usage, nextDay)).toBe(0);
    expect(recordRound(usage, nextDay)).toEqual({ day: '2027-03-10', rounds: 1 });
  });
});

describe('drillAllowance', () => {
  const used = (rounds: number) => ({ day: localDay(morning), rounds });

  it('gives free players three rounds a day', () => {
    expect(FREE_ROUNDS_PER_DAY).toBe(3);
    expect(drillAllowance(NO_USAGE, morning, { enforced: true })).toEqual({ limit: 3, used: 0, remaining: 3, canStart: true });
    expect(drillAllowance(used(2), morning, { enforced: true })).toMatchObject({ remaining: 1, canStart: true });
    expect(drillAllowance(used(3), morning, { enforced: true })).toMatchObject({ remaining: 0, canStart: false });
    expect(drillAllowance(used(5), morning, { enforced: true })).toMatchObject({ used: 5, remaining: 0, canStart: false });
    // A new day brings the full allowance back.
    expect(drillAllowance(used(3), nextDay, { enforced: true })).toMatchObject({ used: 0, remaining: 3, canStart: true });
  });

  it('never blocks an unlimited player', () => {
    expect(drillAllowance(used(9), morning, { enforced: true, unlimited: true }).canStart).toBe(true);
  });

  it('is not enforced yet', () => {
    expect(DAILY_LIMIT_ENFORCED).toBe(false);
    expect(drillAllowance(used(9), morning)).toMatchObject({ remaining: 0, canStart: true });
  });
});
