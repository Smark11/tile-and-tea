import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { skillMeterLabel } from '@/components/progress/SkillMeters';
import { ProgressTab } from '@/components/tabs/ProgressTab';
import { bestHand, discards, NO_USAGE, SKILLS } from '@/game/drills';
import { useDrillProgress } from '@/state/drillProgress';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));
jest.mock('@/components/shell/TabScreen', () => ({
  TabScreen: ({ children }: { children: React.ReactNode }) => children,
}));

const router = () => jest.requireMock('expo-router').router;
const skill = (id: string) => SKILLS.find((s) => s.id === id)!;

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  useDrillProgress.setState({ usage: NO_USAGE, records: {}, ratings: {} });
});

describe('ProgressTab skill meters', () => {
  it('shows every skill unrated at first, with a way to start', async () => {
    await render(<ProgressTab />);
    for (const s of SKILLS) {
      expect(screen.getByRole('button', { name: new RegExp(`^${s.title}\\. Not rated yet\\.`) })).toBeTruthy();
    }
    expect(screen.getByText('Your story starts here')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Start: Name that hand' }));
    expect(router().push).toHaveBeenCalledWith('/drill/name-the-hand');
  });

  it('shows ratings, bands and the last round’s change, and opens the skill’s drill', async () => {
    useDrillProgress.setState({
      ratings: {
        'hand-choice': { rating: 1162.4, answers: 25, roundStart: 1140 },
        discards: { rating: 880.2, answers: 4, roundStart: 900 },
      },
    });
    await render(<ProgressTab />);
    expect(screen.queryByText('Your story starts here')).toBeNull();

    const hand = screen.getByRole('button', {
      name: 'Choosing a hand. Rating 1162, Confident. Up 22 in your last round. 25 answers.',
    });
    expect(screen.getByText('1162')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Discards. Rating 880, Finding your feet, still settling. Down 20 in your last round. 4 answers.' }),
    ).toBeTruthy();
    expect(screen.getByText('Finding your feet · settling in')).toBeTruthy();

    await fireEvent.press(hand);
    expect(router().push).toHaveBeenCalledWith(`/drill/${bestHand.id}`);
    await fireEvent.press(screen.getByTestId('skill-meter-discards'));
    expect(router().push).toHaveBeenLastCalledWith(`/drill/${discards.id}`);
  });

  it('updates when a rating changes', async () => {
    await render(<ProgressTab />);
    expect(screen.getByRole('button', { name: /^The Charleston\. Not rated yet/ })).toBeTruthy();
    await fireEvent(screen.getByTestId('skill-meter-charleston'), 'pressIn');
    useDrillProgress.getState().rateAnswer('charleston', { score: 1, level: 1050, startsRound: true });
    expect(await screen.findByRole('button', { name: /^The Charleston\. Rating 9\d\d, Finding your feet, still settling\. Up \d+/ })).toBeTruthy();
  });
});

describe('skillMeterLabel', () => {
  it('reads a level round and a single answer naturally', () => {
    expect(
      skillMeterLabel({ skill: skill('card-reading'), drill: bestHand, rating: { rating: 1000, answers: 1, roundStart: 1000 } }),
    ).toBe('Reading the card. Rating 1000, Steady, still settling. Level in your last round. 1 answer.');
  });
});
