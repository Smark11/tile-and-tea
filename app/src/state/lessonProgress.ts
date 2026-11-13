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
    (set) => ({
      ...emptyProgress,
      saveStep: (lessonId, snapshot) => set((s) => saveSnapshot(s, lessonId, snapshot)),
      completeLesson: (lessonId, score, now = new Date()) =>
        set((s) => recordCompletion(s, lessonId, score, now)),
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
