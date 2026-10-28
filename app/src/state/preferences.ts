import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** AsyncStorage key. The screenshot harness seeds it too (scripts/screenshots.mjs). */
export const PREFERENCES_STORAGE_KEY = 'mjc.preferences';

export type Preferences = {
  /** The welcome screens have been seen (finished or skipped). */
  onboarded: boolean;
  /** Light haptic ticks on tile and rack interactions. */
  haptics: boolean;
};

type PreferencesStore = Preferences & {
  completeOnboarding: () => void;
  /** Shows the welcome screens again (Settings → Replay the welcome tour). */
  replayOnboarding: () => void;
  setHaptics: (on: boolean) => void;
};

export const defaultPreferences: Preferences = { onboarded: false, haptics: true };

// Hydration from storage is async. Track when it settles, success or failure,
// so the app never sits on the splash screen because storage threw.
let hydrationSettled = false;
const hydrationListeners = new Set<() => void>();

function settleHydration() {
  hydrationSettled = true;
  hydrationListeners.forEach((listener) => listener());
}

export const usePreferences = create<PreferencesStore>()(
  persist(
    (set) => ({
      ...defaultPreferences,
      completeOnboarding: () => set({ onboarded: true }),
      replayOnboarding: () => set({ onboarded: false }),
      setHaptics: (haptics) => set({ haptics }),
    }),
    {
      name: PREFERENCES_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ onboarded, haptics }): Preferences => ({ onboarded, haptics }),
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

/** True once saved preferences have loaded, or failed to and fallen back to defaults. */
export function preferencesHydrated(): boolean {
  return hydrationSettled;
}

/**
 * `preferencesHydrated` as a hook. The server snapshot is false, so a
 * server-rendered web page and its hydration render agree.
 */
export function usePreferencesHydrated(): boolean {
  return useSyncExternalStore(subscribeHydration, preferencesHydrated, () => false);
}
