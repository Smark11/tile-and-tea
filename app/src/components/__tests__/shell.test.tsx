import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { Dimensions } from 'react-native';

import { hapticLift, hapticTick } from '@/components/haptics';
import { Welcome } from '@/components/onboarding/Welcome';
import { SettingsSheet } from '@/components/settings/SettingsSheet';
import { TabBar } from '@/components/shell/TabBar';
import { defaultPreferences, usePreferences } from '@/state/preferences';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));

beforeEach(async () => {
  jest.clearAllMocks();
  await act(() => usePreferences.setState(defaultPreferences));
});

describe('haptics', () => {
  it('ticks while the setting is on and stays silent when it is off', async () => {
    hapticTick();
    hapticLift();
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).toHaveBeenCalledWith('light');

    jest.clearAllMocks();
    await act(() => usePreferences.getState().setHaptics(false));
    hapticTick();
    hapticLift();
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });
});

describe('TabBar', () => {
  const routes = [
    { key: 'index-1', name: 'index', title: 'Learn' },
    { key: 'train-1', name: 'train', title: 'Train' },
    { key: 'play-1', name: 'play', title: 'Play' },
    { key: 'progress-1', name: 'progress', title: 'Progress' },
  ];

  async function renderBar(index = 0, defaultPrevented = false) {
    const props = {
      state: { index, routes: routes.map(({ key, name }) => ({ key, name })) },
      descriptors: Object.fromEntries(routes.map((r) => [r.key, { options: { title: r.title } }])),
      emitter: { emit: jest.fn(() => ({ defaultPrevented })) },
      navigateToTab: jest.fn(),
      insets: { top: 0, bottom: 34, left: 0, right: 0 },
    };
    return { props, ...(await render(<TabBar {...(props as unknown as BottomTabBarProps)} />)) };
  }

  it('shows four labelled tabs with the current one selected', async () => {
    await renderBar(2);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.props.accessibilityLabel)).toEqual(['Learn', 'Train', 'Play', 'Progress']);
    expect(screen.getByRole('tab', { name: 'Play', selected: true })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Learn', selected: false })).toBeOnTheScreen();
    expect(screen.getByText('Progress')).toBeOnTheScreen();
  });

  it('navigates to another tab with a haptic tick', async () => {
    const { props } = await renderBar(0);
    await fireEvent.press(screen.getByRole('tab', { name: 'Train' }));
    expect(props.emitter.emit).toHaveBeenCalledWith({
      type: 'tabPress',
      target: 'train-1',
      canPreventDefault: true,
    });
    expect(props.navigateToTab).toHaveBeenCalledWith('train-1');
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  });

  it('does not navigate to the tab already showing, or when a listener prevents it', async () => {
    const first = await renderBar(0);
    await fireEvent.press(screen.getByRole('tab', { name: 'Learn' }));
    expect(first.props.navigateToTab).not.toHaveBeenCalled();
    await first.unmount();

    const second = await renderBar(0, true);
    await fireEvent.press(screen.getByRole('tab', { name: 'Play' }));
    expect(second.props.navigateToTab).not.toHaveBeenCalled();
  });
});

describe('Welcome', () => {
  const { width } = Dimensions.get('window');

  it('steps through three pages with Next, then Get started finishes onboarding', async () => {
    await render(<Welcome />);
    expect(screen.getByRole('header', { name: 'Welcome to the parlor' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Page 1 of 3')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByLabelText('Page 2 of 3')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByLabelText('Page 3 of 3')).toBeOnTheScreen();
    expect(usePreferences.getState().onboarded).toBe(false);

    await fireEvent.press(screen.getByRole('button', { name: 'Get started' }));
    expect(usePreferences.getState().onboarded).toBe(true);
  });

  it('follows a swipe to the last page', async () => {
    await render(<Welcome />);
    await fireEvent.scroll(screen.getByTestId('welcome-pager'), {
      nativeEvent: { contentOffset: { x: width * 2, y: 0 } },
    });
    expect(screen.getByLabelText('Page 3 of 3')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Get started' })).toBeOnTheScreen();
  });

  it('lets a player skip straight to the app', async () => {
    await render(<Welcome />);
    await fireEvent.press(screen.getByRole('button', { name: 'Skip' }));
    expect(usePreferences.getState().onboarded).toBe(true);
  });

  it('reads only the current page to screen readers', async () => {
    await render(<Welcome />);
    // Off-screen pages are hidden from the accessibility tree.
    expect(screen.getByRole('header', { name: 'Welcome to the parlor' })).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: 'Learn by doing' })).toBeNull();
    expect(screen.getByRole('header', { name: 'Learn by doing', includeHiddenElements: true })).toBeTruthy();
  });

  it('describes each illustration instead of reading tile by tile', async () => {
    await render(<Welcome />);
    expect(
      screen.getByRole('image', {
        name: 'Three tiles fanned in a hand: a Red Dragon, a joker, and a One of Bamboo',
      }),
    ).toBeOnTheScreen();
  });
});

describe('SettingsSheet', () => {
  it('toggles haptics', async () => {
    await render(<SettingsSheet />);
    const toggle = screen.getByRole('switch', { name: 'Haptics' });
    expect(toggle.props.value).toBe(true);
    await fireEvent(toggle, 'valueChange', false);
    expect(usePreferences.getState().haptics).toBe(false);
  });

  it('lists planned settings as coming soon rather than as controls', async () => {
    await render(<SettingsSheet />);
    expect(screen.getByLabelText(/^Tile sounds, coming soon\./)).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Large tiles, coming soon\./)).toBeOnTheScreen();
    expect(screen.getAllByRole('switch')).toHaveLength(1);
  });

  it('replays the welcome tour and closes with Done', async () => {
    const { router } = jest.requireMock('expo-router');
    await act(() => usePreferences.getState().completeOnboarding());
    await render(<SettingsSheet />);
    await fireEvent.press(screen.getByRole('button', { name: 'Replay the welcome tour' }));
    expect(usePreferences.getState().onboarded).toBe(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(router.back).toHaveBeenCalled();
  });
});
