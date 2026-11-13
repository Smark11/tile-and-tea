import type { AnalyticsClient } from './analytics';
import type { AnalyticsConfig } from './config';

/**
 * Native has no analytics provider yet (N.3 adds PostHog React Native behind
 * the same wrapper), so it never loads one. The web build uses provider.web.ts.
 */
export async function loadProvider(_config: AnalyticsConfig): Promise<AnalyticsClient | null> {
  return null;
}
