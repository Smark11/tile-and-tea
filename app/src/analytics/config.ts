// Decides whether analytics may run at all. Pure, so the rules are testable:
// analytics only ever runs in a production web build that has a PostHog key,
// for a visitor who hasn't asked not to be tracked.

export const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com';

export type AnalyticsConfig = { key: string; host: string };

export type AnalyticsEnvironment = {
  /** EXPO_PUBLIC_POSTHOG_KEY */
  key: string | undefined;
  /** EXPO_PUBLIC_POSTHOG_HOST */
  host: string | undefined;
  platform: string;
  /** A development build (`__DEV__`), which includes the screenshot harness. */
  dev: boolean;
  /** Running under Jest. */
  test: boolean;
  /** There's a browser window (false while exporting static HTML). */
  browser: boolean;
  /** The visitor sent Do Not Track or Global Privacy Control. */
  doNotTrack: boolean;
};

/** PostHog settings, or null when analytics must stay silent. */
export function resolveAnalyticsConfig(env: AnalyticsEnvironment): AnalyticsConfig | null {
  const key = env.key?.trim();
  if (!key || env.platform !== 'web' || env.dev || env.test || !env.browser || env.doNotTrack) {
    return null;
  }
  return { key, host: resolveHost(env.host) };
}

/** An absolute http(s) origin, or PostHog's US cloud. */
export function resolveHost(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return DEFAULT_POSTHOG_HOST;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return DEFAULT_POSTHOG_HOST;
    return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
  } catch {
    return DEFAULT_POSTHOG_HOST;
  }
}

type PrivacySignals = {
  navigator?: { doNotTrack?: string | null; msDoNotTrack?: string | null; globalPrivacyControl?: boolean };
  window?: { doNotTrack?: string | null };
};

/**
 * True when the browser asks not to be tracked, through Do Not Track (each
 * browser spells it differently) or Global Privacy Control.
 */
export function readDoNotTrack({ navigator, window }: PrivacySignals): boolean {
  const flags = [navigator?.doNotTrack, navigator?.msDoNotTrack, window?.doNotTrack];
  return navigator?.globalPrivacyControl === true || flags.some((f) => f === '1' || f === 'yes');
}
