import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  emptyProgress,
  recordCompletion,
  saveSnapshot,
  type LessonProgress,
  type LessonScore,
  type SessionSnapshot,
} from '@/game/lessons';

/** AsyncStorage key (localStorage on web). */
export const LESSON_PROGRESS_STORAGE_KEY = 'mjc.lessons';

type LessonProgressStore = LessonProgress & {
  /** Remember where a play-through is, so leaving and coming back resumes it. */
  saveStep: (lessonId: string, snapshot: SessionSnapshot) => void;
  completeLesson: (lessonId: string, score: LessonScore, now?: Date) => void;
  /**
   * A lesson just finished for the first time, waiting for the lesson path to
   * celebrate it. Kept in memory only: a celebration after a relaunch would
   * come out of nowhere.
   */
  pendingCelebration: string | null;
  /** The path takes the pending celebration (clearing it) when it comes into view. */
  takeCelebration: () => string | null;
};

// Hydration from storage is async. Track when it settles, success or failure,
// so a lesson never resumes from (or overwrites saves with) empty progress.
let hydrationSettled = false;
const hydrationListeners = new Set<() => void>();

function settleHydration() {
  hydrationSettled = true;
  hydrationListeners.forEach((listener) => listener());
}

export const useLessonProgress = create<LessonProgressStore>()(
  persist(
    (set, get) => ({
      ...emptyProgress,
      pendingCelebration: null,
      saveStep: (lessonId, snapshot) => set((s) => saveSnapshot(s, lessonId, snapshot)),
      completeLesson: (lessonId, score, now = new Date()) =>
        set((s) => ({
          ...recordCompletion(s, lessonId, score, now),
          // Only a first finish opens something new; replays don't re-celebrate.
          pendingCelebration: s.completed[lessonId] ? s.pendingCelebration : lessonId,
        })),
      takeCelebration: () => {
        const id = get().pendingCelebration;
        if (id) set({ pendingCelebration: null });
        return id;
      },
    }),
    {
      name: LESSON_PROGRESS_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ completed, inProgress }): LessonProgress => ({ completed, inProgress }),
      onRehydrateStorage: () => settleHydration,
    },
  ),
);

function subscribeHydration(listener: () => void) {
  hydrationListeners.add(listener);
  return () => {
    hydrationListeners.delete(listener);
  };
}

export function lessonProgressHydrated(): boolean {
  return hydrationSettled;
}

/** True once saved progress has loaded (or failed to). False during server render. */
export function useLessonProgressHydrated(): boolean {
  return useSyncExternalStore(subscribeHydration, lessonProgressHydrated, () => false);
}
