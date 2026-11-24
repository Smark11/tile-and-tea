import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Verdict } from '@/game/drills';
import { SCENARIOS, type Scenario } from '@/game/scenarios';

/** AsyncStorage key (localStorage on web). */
export const SCENARIO_PROGRESS_STORAGE_KEY = 'mjc.scenarios';

/** What we keep about one finished scenario. */
export type ScenarioRecord = {
  /** How many times the player reached the strategy. */
  readonly plays: number;
  /** The coach's verdict on the most recent move. */
  readonly verdict: Verdict;
  /** When it was last finished, as epoch milliseconds. */
  readonly finishedAt: number;
};

type ScenarioProgress = {
  readonly completed: Readonly<Record<string, ScenarioRecord>>;
};

type ScenarioProgressStore = ScenarioProgress & {
  /** Records reaching a scenario's strategy page; call once per play-through. */
  complete: (scenarioId: string, verdict: Verdict, now?: Date) => void;
};

export const useScenarioProgress = create<ScenarioProgressStore>()(
  persist(
    (set) => ({
      completed: {},
      complete: (scenarioId, verdict, now = new Date()) =>
        set((s) => ({
          completed: {
            ...s.completed,
            [scenarioId]: { plays: (s.completed[scenarioId]?.plays ?? 0) + 1, verdict, finishedAt: now.getTime() },
          },
        })),
    }),
    {
      name: SCENARIO_PROGRESS_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ completed }): ScenarioProgress => ({ completed }),
    },
  ),
);

/** The first scenario not yet finished, in list order; the first of all once every one is done. */
export function nextUnfinished(completed: ScenarioProgress['completed']): Scenario {
  return SCENARIOS.find((s) => !completed[s.id]) ?? SCENARIOS[0];
}
