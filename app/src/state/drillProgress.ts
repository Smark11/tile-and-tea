import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { drillAllowance, NO_USAGE, recordRound, type DrillAllowance, type DrillUsage, type RoundScore } from '@/game/drills';

/** AsyncStorage key (localStorage on web). */
export const DRILL_PROGRESS_STORAGE_KEY = 'mjc.drills';

/** What we keep about one drill. M3.5 adds skill ratings alongside. */
export type DrillRecord = {
  readonly rounds: number;
  /** The best round's mean score, 0–1. */
  readonly bestScore: number;
};

type DrillProgress = {
  /** Rounds started today, for the daily free allowance. */
  usage: DrillUsage;
  records: Readonly<Record<string, DrillRecord>>;
};

type DrillProgressStore = DrillProgress & {
  /** Counts a round against today's allowance. Call once per round, on its first answer. */
  countRound: (now?: Date) => void;
  finishRound: (drillId: string, score: RoundScore) => void;
};

export const useDrillProgress = create<DrillProgressStore>()(
  persist(
    (set) => ({
      usage: NO_USAGE,
      records: {},
      countRound: (now = new Date()) => set((s) => ({ usage: recordRound(s.usage, now) })),
      finishRound: (drillId, score) =>
        set((s) => {
          const before = s.records[drillId];
          return {
            records: {
              ...s.records,
              [drillId]: {
                rounds: (before?.rounds ?? 0) + 1,
                bestScore: Math.max(before?.bestScore ?? 0, score.score),
              },
            },
          };
        }),
    }),
    {
      name: DRILL_PROGRESS_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ usage, records }): DrillProgress => ({ usage, records }),
    },
  ),
);

/**
 * Today's free allowance. Not enforced yet (DAILY_LIMIT_ENFORCED), so nothing
 * reads `canStart` until the paywall lands; it's here so that's a one-line change.
 */
export function currentDrillAllowance(now = new Date()): DrillAllowance {
  return drillAllowance(useDrillProgress.getState().usage, now);
}
