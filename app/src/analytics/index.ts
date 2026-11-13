import { usePathname } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { createAnalytics } from './analytics';
import { readDoNotTrack, resolveAnalyticsConfig } from './config';
import { loadProvider } from './provider';

export type { AnalyticsEventName, AnalyticsEvents } from './events';

const analytics = createAnalytics({
  resolveConfig: () =>
    resolveAnalyticsConfig({
      // Expo inlines EXPO_PUBLIC_* variables at build time.
      key: process.env.EXPO_PUBLIC_POSTHOG_KEY,
      host: process.env.EXPO_PUBLIC_POSTHOG_HOST,
      platform: Platform.OS,
      dev: __DEV__,
      test: process.env.NODE_ENV === 'test',
      browser: typeof window !== 'undefined' && typeof document !== 'undefined',
      doNotTrack: readDoNotTrack({
        navigator: typeof navigator === 'undefined' ? undefined : navigator,
        // Old Safari and IE put the flag on window; TypeScript's DOM types omit it.
        window: typeof window === 'undefined' ? undefined : (window as { doNotTrack?: string | null }),
      }),
    }),
  loadClient: loadProvider,
  currentUrl: () => (typeof location === 'undefined' ? undefined : location.href),
});

/**
 * Record a product event (see events.ts and docs/ANALYTICS.md). A silent
 * no-op in development, tests, native, without a PostHog key, and for
 * visitors with Do Not Track on.
 */
export const track = analytics.track;

/** Record a page view for an app path. useScreenTracking calls this for you. */
export const screen = analytics.screen;

/** Sends a page view whenever the Expo Router path changes. Mount once, at the root. */
export function useScreenTracking() {
  const pathname = usePathname();
  useEffect(() => {
    screen(pathname);
  }, [pathname]);
}
