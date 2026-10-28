import { useSyncExternalStore } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

const noopSubscribe = () => () => {};

/**
 * Web pages are server-rendered without knowing the visitor's appearance, so
 * the hydration render must match the server (light). useSyncExternalStore
 * returns the server snapshot while hydrating and the client one after.
 */
export function useColorScheme() {
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const scheme = useSystemColorScheme();
  return hydrated ? scheme : 'light';
}
