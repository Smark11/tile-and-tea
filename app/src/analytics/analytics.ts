import type { AnalyticsConfig } from './config';
import type { AnalyticsEventName, AnalyticsEvents, EventProperties } from './events';

/** What a provider (PostHog on web) has to do for us. */
export type AnalyticsClient = {
  capture: (event: string, properties: EventProperties) => void;
  pageview: (path: string, url: string | undefined) => void;
};

export type AnalyticsDeps = {
  /** The settings to load with, or null to stay silent. Read once, on first use. */
  resolveConfig: () => AnalyticsConfig | null;
  /** Loads the provider. Null or a rejection turns analytics off for the session. */
  loadClient: (config: AnalyticsConfig) => Promise<AnalyticsClient | null>;
  /** The full page URL at the moment of a screen change, if there is one. */
  currentUrl: () => string | undefined;
};

export type Analytics = {
  track: <E extends AnalyticsEventName>(event: E, properties: AnalyticsEvents[E]) => void;
  screen: (path: string) => void;
};

type Pending =
  | { kind: 'event'; event: string; properties: EventProperties }
  | { kind: 'page'; path: string; url: string | undefined };

/** Events held while the provider loads. A first visit sends far fewer. */
export const MAX_PENDING = 50;

/**
 * The analytics pipeline. It does nothing (and loads nothing) until the first
 * event; then, if the config allows, it loads the provider once, holding
 * events until it arrives. Calls never throw: analytics must not break play.
 */
export function createAnalytics({ resolveConfig, loadClient, currentUrl }: AnalyticsDeps): Analytics {
  let state: 'idle' | 'loading' | 'ready' | 'off' = 'idle';
  let client: AnalyticsClient | null = null;
  let pending: Pending[] = [];
  let lastPath: string | undefined;

  const send = (item: Pending) => {
    try {
      if (item.kind === 'event') client?.capture(item.event, item.properties);
      else client?.pageview(item.path, item.url);
    } catch {
      // A provider error loses one event, never the screen.
    }
  };

  const start = () => {
    let config: AnalyticsConfig | null = null;
    try {
      config = resolveConfig();
    } catch {
      config = null;
    }
    if (!config) {
      state = 'off';
      return;
    }
    state = 'loading';
    const off = () => {
      state = 'off';
      pending = [];
    };
    loadClient(config).then((loaded) => {
      if (!loaded) return off();
      client = loaded;
      state = 'ready';
      const queued = pending;
      pending = [];
      queued.forEach(send);
    }, off);
  };

  const enqueue = (item: Pending) => {
    if (state === 'idle') start();
    if (state === 'ready') send(item);
    else if (state === 'loading' && pending.length < MAX_PENDING) pending.push(item);
  };

  return {
    track: (event, properties) => enqueue({ kind: 'event', event, properties }),
    screen: (path) => {
      // Re-renders report the same path again; one visit is one page view.
      if (path === lastPath) return;
      lastPath = path;
      let url: string | undefined;
      try {
        url = currentUrl();
      } catch {
        url = undefined;
      }
      enqueue({ kind: 'page', path, url });
    },
  };
}
