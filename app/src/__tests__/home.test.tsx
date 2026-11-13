import { fireEvent, render, screen } from '@testing-library/react-native';

import LearnRoute from '@/app/(tabs)/index';
import PlayRoute from '@/app/(tabs)/play';
import ProgressRoute from '@/app/(tabs)/progress';
import TrainRoute from '@/app/(tabs)/train';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (effect: () => void) =>
    jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]),
}));

describe('tab screens', () => {
  it.each([
    ['Learn', LearnRoute, 'Your lesson path'],
    ['Train', TrainRoute, 'Sharpen your game'],
    ['Play', PlayRoute, 'Take a seat'],
    ['Progress', ProgressRoute, 'Your progress'],
  ])('%s shows its title as a header and a Settings button', async (_tab, Route, title) => {
    await render(<Route />);
    expect(screen.getByRole('header', { name: title })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeOnTheScreen();
  });

  it('opens the settings sheet from the header button', async () => {
    const { router } = jest.requireMock('expo-router');
    await render(<LearnRoute />);
    await fireEvent.press(screen.getByRole('button', { name: 'Settings' }));
    expect(router.push).toHaveBeenCalledWith('/settings');
  });

  it('starts a game from the Play tab, and marks the opponent levels as coming soon', async () => {
    const { router } = jest.requireMock('expo-router');
    await render(<PlayRoute />);
    expect(screen.getAllByText('Coming soon').length).toBeGreaterThan(0);
    // Settings and Start a game; the opponent previews aren't dead controls.
    expect(screen.getAllByRole('button')).toHaveLength(2);
    await fireEvent.press(screen.getByRole('button', { name: 'Start a game' }));
    expect(router.push).toHaveBeenCalledWith('/game');
  });

  it('lays out the first lessons in order on the path', async () => {
    await render(<LearnRoute />);
    expect(screen.getByRole('button', { name: 'Start lesson: Meet the tiles' })).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Lesson 5, The Charleston\./)).toBeOnTheScreen();
  });
});
