import { fireEvent, render, screen } from '@testing-library/react-native';

import LearnRoute from '@/app/(tabs)/index';
import PlayRoute from '@/app/(tabs)/play';
import ProgressRoute from '@/app/(tabs)/progress';
import TrainRoute from '@/app/(tabs)/train';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

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

  it('marks unbuilt features as coming soon and offers no dead controls', async () => {
    await render(<PlayRoute />);
    expect(screen.getAllByText('Coming soon').length).toBeGreaterThan(0);
    // Only the Settings button is pressable on a placeholder tab.
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('lists the first lessons in order', async () => {
    await render(<LearnRoute />);
    expect(screen.getByLabelText(/^1\. Meet the tiles\./)).toBeOnTheScreen();
    expect(screen.getByLabelText(/^5\. The Charleston\./)).toBeOnTheScreen();
  });
});
