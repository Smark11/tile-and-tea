import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  drillAllowance,
  NO_USAGE,
  rateAnswer,
  recordRound,
  type DrillAllowance,
  type DrillUsage,
  type RatedAnswer,
  type RoundScore,
  type SkillId,
  type SkillRating,
} from '@/game/drills';

/** AsyncStorage key (localStorage on web). */
export const DRILL_PROGRESS_STORAGE_KEY = 'mjc.drills';

/** What we keep about one drill. */
export type DrillRecord = {
  readonly rounds: number;
  /** The best round's mean score, 0–1. */
  readonly bestScore: number;
};

export type SkillRatings = Readonly<Partial<Record<SkillId, SkillRating>>>;

type DrillProgress = {
  /** Rounds started today, for the daily free allowance. */
  usage: DrillUsage;
  records: Readonly<Record<string, DrillRecord>>;
  /** One rating per skill practised, moved by every answer. */
  ratings: SkillRatings;
};

type DrillProgressStore = DrillProgress & {
  /** Counts a round against today's allowance. Call once per round, on its first answer. */
  countRound: (now?: Date) => void;
  finishRound: (drillId: string, score: RoundScore) => void;
  /** Moves a skill's rating by one answer, and returns the rating before and after it. */
  rateAnswer: (skill: SkillId, answer: RatedAnswer) => { before: SkillRating | undefined; after: SkillRating };
};

export const useDrillProgress = create<DrillProgressStore>()(
  persist(
    (set, get) => ({
      usage: NO_USAGE,
      records: {},
      ratings: {},
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
      rateAnswer: (skill, answer) => {
        const before = get().ratings[skill];
        const after = rateAnswer(before, answer);
        set((s) => ({ ratings: { ...s.ratings, [skill]: after } }));
        return { before, after };
      },
    }),
    {
      name: DRILL_PROGRESS_STORAGE_KEY,
      // v2 adds `ratings`. A v1 save keeps its usage and records and starts unrated.
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ usage, records, ratings }): DrillProgress => ({ usage, records, ratings }),
      migrate: (saved, version) => {
        const state = (saved ?? {}) as Partial<DrillProgress>;
        return (version < 2 ? { ...state, ratings: {} } : state) as DrillProgressStore;
      },
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
