import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMemo, useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { restoreGame, type RestoredGame, type SavedGame } from '@/game/table';

/** AsyncStorage key (localStorage on web). */
export const SAVED_GAME_STORAGE_KEY = 'mjc.game';

type SavedGameStore = {
  /**
   * The game the player left mid-play, as read from storage. Unchecked:
   * read it through `restoreGame` (or `useRestoredGame`), which replays it.
   */
  game: unknown;
  save: (game: SavedGame) => void;
  clear: () => void;
};

// Hydration from storage is async. Track when it settles, success or failure,
// so the table never waits forever on a storage error.
let hydrationSettled = false;
const hydrationListeners = new Set<() => void>();

function settleHydration() {
  hydrationSettled = true;
  hydrationListeners.forEach((listener) => listener());
}

/** At most one game is kept: starting a new one replaces it, and finishing one clears it. */
export const useSavedGame = create<SavedGameStore>()(
  persist(
    (set) => ({
      game: null,
      save: (game) => set({ game }),
      clear: () => set({ game: null }),
    }),
    {
      name: SAVED_GAME_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ game }) => ({ game }),
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

export function savedGameHydrated(): boolean {
  return hydrationSettled;
}

/** True once the saved game has loaded (or failed to). False on the server, so static pages hydrate cleanly. */
export function useSavedGameHydrated(): boolean {
  return useSyncExternalStore(subscribeHydration, savedGameHydrated, () => false);
}

/** The saved game, replayed and checked; null when there's none worth resuming. */
export function useRestoredGame(): RestoredGame | null {
  const game = useSavedGame((s) => s.game);
  return useMemo(() => (game ? restoreGame(game) : null), [game]);
}
