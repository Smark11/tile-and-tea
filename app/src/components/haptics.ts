import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { usePreferences } from '@/state/preferences';

// Every haptic in the app goes through here so the Settings toggle is honored.
// Reads the store directly (not a hook) so callers keep stable callbacks.
function enabled() {
  return Platform.OS !== 'web' && usePreferences.getState().haptics;
}

/** A light tick: selecting a tile, a tile changing slots, switching tabs. */
export function hapticTick() {
  if (enabled()) void Haptics.selectionAsync();
}

/** A slightly heavier tap: lifting a tile, a long press. */
export function hapticLift() {
  if (enabled()) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}
