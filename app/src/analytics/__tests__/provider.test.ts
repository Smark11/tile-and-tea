import { renderHook } from '@testing-library/react-native';

import { DEFAULT_POSTHOG_HOST, type AnalyticsConfig } from '../config';
// Imported by its .web name: Jest resolves the native file by default.
import { loadProvider as loadWebProvider } from '../provider.web';

const posthog = { init: jest.fn(), capture: jest.fn() };
const importPostHog = async () => ({ default: posthog }) as unknown as typeof import('posthog-js');
const loadProvider = (config: AnalyticsConfig) => loadWebProvider(config, importPostHog);

jest.mock('expo-router', () => ({ usePathname: jest.fn(() => '/') }));
jest.mock('../provider', () => ({ loadProvider: jest.fn(async () => null) }));

beforeEach(() => jest.clearAllMocks());

describe('the PostHog web provider', () => {

  it('starts cookieless, honors Do Not Track, and sends only our events', async () => {
    await loadProvider({ key: 'phc_live', host: DEFAULT_POSTHOG_HOST });
    expect(posthog.init).toHaveBeenCalledTimes(1);
    const [key, options] = posthog.init.mock.calls[0];
    expect(key).toBe('phc_live');
    expect(options).toMatchObject({
      api_host: DEFAULT_POSTHOG_HOST,
      persistence: 'memory',
      respect_dnt: true,
      capture_pageview: false,
      autocapture: false,
      disable_session_recording: true,
      disable_surveys: true,
      disable_external_dependency_loading: true,
    });
  });

  it('passes events through and stamps page views with their route', async () => {
    const client = await loadProvider({ key: 'phc_live', host: DEFAULT_POSTHOG_HOST });
    client.capture('drill_answered', { skill: 'discard', correct: true });
    client.pageview('/train', 'https://site.test/train?utm_source=newsletter');
    client.pageview('/play', undefined);
    expect(posthog.capture.mock.calls).toEqual([
      ['drill_answered', { skill: 'discard', correct: true }],
      ['$pageview', { $pathname: '/train', $current_url: 'https://site.test/train?utm_source=newsletter' }],
      ['$pageview', { $pathname: '/play' }],
    ]);
  });
});

describe('the app-wide track() and screen()', () => {
  it('are silent no-ops under tests: nothing is loaded or sent', async () => {
    const { track, screen, useScreenTracking } = jest.requireActual<typeof import('..')>('..');
    const { loadProvider } = jest.requireMock('../provider');
    track('onboarding_completed', { via: 'finished' });
    screen('/train');
    renderHook(() => useScreenTracking());
    await new Promise<void>((r) => setTimeout(r, 0));
    expect(loadProvider).not.toHaveBeenCalled();
    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
  });
});
