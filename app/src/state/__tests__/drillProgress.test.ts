import AsyncStorage from '@react-native-async-storage/async-storage';
import { waitFor } from '@testing-library/react-native';

import { NO_USAGE, rateAnswer } from '@/game/drills';

import { DRILL_PROGRESS_STORAGE_KEY, useDrillProgress } from '../drillProgress';

async function saved() {
  const raw = await AsyncStorage.getItem(DRILL_PROGRESS_STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  useDrillProgress.setState({ usage: NO_USAGE, records: {}, ratings: {} });
});

describe('drill progress ratings', () => {
  it('rates answers per skill and reports the rating before and after', () => {
    const first = useDrillProgress.getState().rateAnswer('discards', { score: 1, level: 1100, startsRound: true });
    expect(first.before).toBeUndefined();
    expect(first.after).toEqual(rateAnswer(undefined, { score: 1, level: 1100, startsRound: true }));
    const second = useDrillProgress.getState().rateAnswer('discards', { score: 0, level: 1100, startsRound: false });
    expect(second.before).toEqual(first.after);
    expect(useDrillProgress.getState().ratings).toEqual({ discards: second.after });
  });

  it('persists ratings with usage and records, as version 2', async () => {
    const { after } = useDrillProgress.getState().rateAnswer('charleston', { score: 0.5, level: 1050, startsRound: true });
    await waitFor(async () =>
      expect(await saved()).toEqual({ state: { usage: NO_USAGE, records: {}, ratings: { charleston: after } }, version: 2 }),
    );
  });

  it('keeps a version 1 save and starts it unrated', async () => {
    const usage = { day: '2026-11-12', rounds: 2 };
    const records = { charleston: { rounds: 3, bestScore: 0.8 } };
    await AsyncStorage.setItem(DRILL_PROGRESS_STORAGE_KEY, JSON.stringify({ state: { usage, records }, version: 1 }));
    await useDrillProgress.persist.rehydrate();
    const state = useDrillProgress.getState();
    expect(state.usage).toEqual(usage);
    expect(state.records).toEqual(records);
    expect(state.ratings).toEqual({});
  });
});
