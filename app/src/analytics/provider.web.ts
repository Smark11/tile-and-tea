import type { AnalyticsClient } from './analytics';
import type { AnalyticsConfig } from './config';

/**
 * PostHog for the web, loaded on demand so visitors without analytics (and
 * the first paint for everyone) never download it.
 *
 * Cookieless: `persistence: 'memory'` keeps the anonymous id in memory only,
 * so nothing is written to cookies or storage and no consent banner is
 * needed. Each page load counts as a new anonymous visitor. Only the events
 * in events.ts are sent: no autocapture, recordings, surveys, heatmaps or
 * remote scripts. PostHog still records the referrer and UTM tags of the
 * landing page, which is all traffic reporting needs.
 */
export async function loadProvider(
  config: AnalyticsConfig,
  // Tests pass a stand-in: Jest can't run a dynamic import.
  importPostHog: () => Promise<Pick<typeof import('posthog-js'), 'default'>> = () => import('posthog-js'),
): Promise<AnalyticsClient> {
  const { default: posthog } = await importPostHog();
  posthog.init(config.key, {
    api_host: config.host,
    persistence: 'memory',
    respect_dnt: true,
    person_profiles: 'identified_only',
    // We send a page view per Expo Router path change ourselves.
    capture_pageview: false,
    capture_pageleave: false,
    autocapture: false,
    rageclick: false,
    capture_dead_clicks: false,
    capture_heatmaps: false,
    capture_exceptions: false,
    capture_performance: false,
    disable_session_recording: true,
    disable_surveys: true,
    disable_external_dependency_loading: true,
    advanced_disable_flags: true,
  });
  return {
    capture: (event, properties) => posthog.capture(event, properties),
    // The URL is read when the route changed, not when a queued view is sent.
    pageview: (path, url) =>
      posthog.capture('$pageview', url ? { $pathname: path, $current_url: url } : { $pathname: path }),
  };
}
