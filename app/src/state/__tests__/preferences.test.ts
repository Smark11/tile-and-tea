import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, waitFor } from '@testing-library/react-native';

import {
  defaultPreferences,
  PREFERENCES_STORAGE_KEY,
  usePreferences,
  usePreferencesHydrated,
} from '../preferences';

async function saved() {
  const raw = await AsyncStorage.getItem(PREFERENCES_STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  usePreferences.setState(defaultPreferences);
});

describe('preferences', () => {
  it('starts with the welcome tour unseen and haptics on', () => {
    expect(defaultPreferences).toEqual({ onboarded: false, haptics: true });
  });

  it('finishes and replays onboarding', () => {
    usePreferences.getState().completeOnboarding();
    expect(usePreferences.getState().onboarded).toBe(true);
    usePreferences.getState().replayOnboarding();
    expect(usePreferences.getState().onboarded).toBe(false);
  });

  it('persists only the preference values under its storage key', async () => {
    usePreferences.getState().completeOnboarding();
    usePreferences.getState().setHaptics(false);
    await waitFor(async () =>
      expect(await saved()).toEqual({ state: { onboarded: true, haptics: false }, version: 1 }),
    );
  });

  it('restores saved preferences on rehydrate', async () => {
    await AsyncStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({ state: { onboarded: true, haptics: false }, version: 1 }),
    );
    await usePreferences.persist.rehydrate();
    expect(usePreferences.getState()).toMatchObject({ onboarded: true, haptics: false });
  });

  it('reports hydration through the hook once settled', async () => {
    const { result } = await renderHook(() => usePreferencesHydrated());
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('settles hydration even when the first storage read fails', async () => {
    // A fresh copy of the module, so its very first hydration is the failing one.
    let fresh!: typeof import('../preferences');
    jest.isolateModules(() => {
      /* eslint-disable @typescript-eslint/no-require-imports -- isolateModules needs require */
      const storage = require('@react-native-async-storage/async-storage');
      storage.getItem.mockRejectedValueOnce(new Error('disk full'));
      fresh = require('../preferences');
      /* eslint-enable @typescript-eslint/no-require-imports */
    });
    expect(fresh.preferencesHydrated()).toBe(false);
    await waitFor(() => expect(fresh.preferencesHydrated()).toBe(true));
    // Without saved data a player gets the defaults, so they see the welcome tour
    // instead of a splash screen that never lifts.
    expect(fresh.usePreferences.getState().onboarded).toBe(false);
    expect(fresh.usePreferences.persist.hasHydrated()).toBe(false);
  });
});
