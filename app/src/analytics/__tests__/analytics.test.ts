import { createAnalytics, MAX_PENDING, type AnalyticsClient, type AnalyticsDeps } from '../analytics';
import {
  DEFAULT_POSTHOG_HOST,
  readDoNotTrack,
  resolveAnalyticsConfig,
  resolveHost,
  type AnalyticsEnvironment,
} from '../config';

const CONFIG = { key: 'phc_test', host: DEFAULT_POSTHOG_HOST };

function fakeClient(): jest.Mocked<AnalyticsClient> {
  return { capture: jest.fn(), pageview: jest.fn() };
}

/** A loader the test resolves by hand, to observe events held while loading. */
function deferredLoader(client: AnalyticsClient | null) {
  let resolve!: () => void;
  const loadClient = jest.fn(
    () => new Promise<AnalyticsClient | null>((r) => (resolve = () => r(client))),
  );
  return { loadClient, finish: async () => resolve() };
}

function setup(overrides: Partial<AnalyticsDeps> = {}) {
  const client = fakeClient();
  const deps: AnalyticsDeps = {
    resolveConfig: jest.fn(() => CONFIG),
    loadClient: jest.fn(async () => client),
    currentUrl: jest.fn(() => 'https://tile-and-tea.expo.app/train?utm_source=club'),
    ...overrides,
  };
  return { client, deps, analytics: createAnalytics(deps) };
}

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

describe('resolveAnalyticsConfig', () => {
  const production: AnalyticsEnvironment = {
    key: 'phc_live',
    host: undefined,
    platform: 'web',
    dev: false,
    test: false,
    browser: true,
    doNotTrack: false,
  };

  it('runs only in a production web browser with a key', () => {
    expect(resolveAnalyticsConfig(production)).toEqual({ key: 'phc_live', host: DEFAULT_POSTHOG_HOST });
    expect(resolveAnalyticsConfig({ ...production, key: '  phc_live \n', host: 'https://eu.i.posthog.com/' })).toEqual(
      { key: 'phc_live', host: 'https://eu.i.posthog.com' },
    );
  });

  it.each<[string, Partial<AnalyticsEnvironment>]>([
    ['the key is missing', { key: undefined }],
    ['the key is blank', { key: '   ' }],
    ['in development', { dev: true }],
    ['under tests', { test: true }],
    ['on iOS', { platform: 'ios' }],
    ['on Android', { platform: 'android' }],
    ['while exporting static HTML', { browser: false }],
    ['when the visitor asks not to be tracked', { doNotTrack: true }],
  ])('stays silent when %s', (_, change) => {
    expect(resolveAnalyticsConfig({ ...production, ...change })).toBeNull();
  });

  it('falls back to PostHog US cloud for a missing or malformed host', () => {
    expect(resolveHost(undefined)).toBe(DEFAULT_POSTHOG_HOST);
    expect(resolveHost('')).toBe(DEFAULT_POSTHOG_HOST);
    expect(resolveHost('not a url')).toBe(DEFAULT_POSTHOG_HOST);
    expect(resolveHost('ftp://example.com')).toBe(DEFAULT_POSTHOG_HOST);
    expect(resolveHost('https://stats.example.com/ingest/')).toBe('https://stats.example.com/ingest');
  });
});

describe('readDoNotTrack', () => {
  it('honors Do Not Track in every spelling, and Global Privacy Control', () => {
    expect(readDoNotTrack({ navigator: { doNotTrack: '1' } })).toBe(true);
    expect(readDoNotTrack({ navigator: { msDoNotTrack: '1' } })).toBe(true);
    expect(readDoNotTrack({ navigator: { doNotTrack: 'yes' } })).toBe(true);
    expect(readDoNotTrack({ window: { doNotTrack: '1' } })).toBe(true);
    expect(readDoNotTrack({ navigator: { globalPrivacyControl: true } })).toBe(true);
  });

  it('allows counting when no signal is sent or it is switched off', () => {
    expect(readDoNotTrack({})).toBe(false);
    expect(readDoNotTrack({ navigator: { doNotTrack: '0' }, window: { doNotTrack: null } })).toBe(false);
    expect(readDoNotTrack({ navigator: { doNotTrack: 'unspecified', globalPrivacyControl: false } })).toBe(false);
  });
});

describe('createAnalytics', () => {
  it('is a no-op that loads nothing when the config says off', async () => {
    const { deps, analytics } = setup({ resolveConfig: jest.fn(() => null) });
    analytics.track('onboarding_completed', { via: 'skipped' });
    analytics.screen('/');
    analytics.track('share_clicked', { surface: 'game' });
    await flush();
    expect(deps.resolveConfig).toHaveBeenCalledTimes(1);
    expect(deps.loadClient).not.toHaveBeenCalled();
  });

  it('loads nothing before the first event', () => {
    const { deps } = setup();
    expect(deps.resolveConfig).not.toHaveBeenCalled();
    expect(deps.loadClient).not.toHaveBeenCalled();
  });

  it('sends each event with its exact name and properties', async () => {
    const { client, deps, analytics } = setup();
    analytics.track('onboarding_completed', { via: 'finished' });
    analytics.track('lesson_started', { lesson_id: 'meet-the-tiles' });
    analytics.track('lesson_completed', { lesson_id: 'meet-the-tiles' });
    analytics.track('drill_answered', { skill: 'charleston', correct: false });
    analytics.track('game_started', { opponents: 'beginner' });
    analytics.track('game_finished', { opponents: 'beginner', result: 'wall_game' });
    analytics.track('share_clicked', { surface: 'puzzle' });
    await flush();

    expect(deps.loadClient).toHaveBeenCalledTimes(1);
    expect(deps.loadClient).toHaveBeenCalledWith(CONFIG);
    expect(client.capture.mock.calls).toEqual([
      ['onboarding_completed', { via: 'finished' }],
      ['lesson_started', { lesson_id: 'meet-the-tiles' }],
      ['lesson_completed', { lesson_id: 'meet-the-tiles' }],
      ['drill_answered', { skill: 'charleston', correct: false }],
      ['game_started', { opponents: 'beginner' }],
      ['game_finished', { opponents: 'beginner', result: 'wall_game' }],
      ['share_clicked', { surface: 'puzzle' }],
    ]);
  });

  it('holds events while the provider loads, then sends them in order', async () => {
    const client = fakeClient();
    const { loadClient, finish } = deferredLoader(client);
    const { analytics } = setup({ loadClient });
    analytics.screen('/');
    analytics.track('onboarding_completed', { via: 'skipped' });
    expect(client.capture).not.toHaveBeenCalled();

    await finish();
    await flush();
    expect(client.pageview).toHaveBeenCalledWith('/', 'https://tile-and-tea.expo.app/train?utm_source=club');
    expect(client.capture).toHaveBeenCalledWith('onboarding_completed', { via: 'skipped' });
    expect(client.pageview.mock.invocationCallOrder[0]).toBeLessThan(
      client.capture.mock.invocationCallOrder[0],
    );

    analytics.track('share_clicked', { surface: 'lesson' });
    expect(client.capture).toHaveBeenLastCalledWith('share_clicked', { surface: 'lesson' });
    expect(loadClient).toHaveBeenCalledTimes(1);
  });

  it('records the URL when the route changes, not when a held view is sent', async () => {
    const client = fakeClient();
    const { loadClient, finish } = deferredLoader(client);
    const currentUrl = jest
      .fn()
      .mockReturnValueOnce('https://site.test/?utm_campaign=spring')
      .mockReturnValueOnce('https://site.test/train');
    const { analytics } = setup({ loadClient, currentUrl });
    analytics.screen('/');
    analytics.screen('/train');
    await finish();
    await flush();
    expect(client.pageview.mock.calls).toEqual([
      ['/', 'https://site.test/?utm_campaign=spring'],
      ['/train', 'https://site.test/train'],
    ]);
  });

  it('counts one page view per path change, not per render', async () => {
    const { client, analytics } = setup();
    analytics.screen('/');
    analytics.screen('/');
    analytics.screen('/train');
    analytics.screen('/train');
    analytics.screen('/');
    await flush();
    expect(client.pageview.mock.calls.map(([path]) => path)).toEqual(['/', '/train', '/']);
  });

  it('caps the events held while loading', async () => {
    const client = fakeClient();
    const { loadClient, finish } = deferredLoader(client);
    const { analytics } = setup({ loadClient });
    for (let i = 0; i < MAX_PENDING + 10; i++) analytics.track('lesson_started', { lesson_id: `l${i}` });
    await finish();
    await flush();
    expect(client.capture).toHaveBeenCalledTimes(MAX_PENDING);
  });

  it.each([
    ['the provider is unavailable', jest.fn(async () => null)],
    ['the provider fails to load', jest.fn(() => Promise.reject(new Error('blocked by an ad blocker')))],
  ])('turns itself off for the session when %s', async (_, loadClient) => {
    const { analytics } = setup({ loadClient });
    analytics.track('onboarding_completed', { via: 'finished' });
    await flush();
    expect(() => analytics.track('share_clicked', { surface: 'game' })).not.toThrow();
    expect(() => analytics.screen('/play')).not.toThrow();
    await flush();
    expect(loadClient).toHaveBeenCalledTimes(1);
  });

  it('never throws into the app when the provider or environment does', async () => {
    const client = fakeClient();
    client.capture.mockImplementation(() => {
      throw new Error('network');
    });
    const { analytics } = setup({
      loadClient: jest.fn(async () => client),
      currentUrl: () => {
        throw new Error('no location');
      },
    });
    analytics.track('lesson_started', { lesson_id: 'a' });
    await flush();
    expect(() => analytics.track('lesson_completed', { lesson_id: 'a' })).not.toThrow();
    expect(() => analytics.screen('/')).not.toThrow();
    expect(client.pageview).toHaveBeenCalledWith('/', undefined);

    const broken = setup({
      resolveConfig: () => {
        throw new Error('bad env');
      },
    });
    expect(() => broken.analytics.track('lesson_started', { lesson_id: 'a' })).not.toThrow();
    expect(broken.deps.loadClient).not.toHaveBeenCalled();
  });
});
