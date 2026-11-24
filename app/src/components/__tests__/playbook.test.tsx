import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, within } from '@testing-library/react-native';

import { PlaybookLink } from '@/components/playbook/PlaybookLink';
import { parseSource, PlaybookScreen } from '@/components/playbook/PlaybookScreen';
import { NO_USAGE, type Verdict } from '@/game/drills';
import { PRINCIPLES } from '@/game/playbook';
import { useDrillProgress } from '@/state/drillProgress';
import { useLessonProgress } from '@/state/lessonProgress';
import { useScenarioProgress } from '@/state/scenarioProgress';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => false },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/analytics', () => ({ track: jest.fn() }));

const router = () => jest.requireMock('expo-router').router;
const track = () => jest.requireMock('@/analytics').track as jest.Mock;
const finished = (verdict: Verdict) => ({ plays: 1, verdict, finishedAt: 0 });

beforeEach(async () => {
  jest.clearAllMocks();
  mockParams = {};
  await AsyncStorage.clear();
  useDrillProgress.setState({ usage: NO_USAGE, records: {}, ratings: {} });
  useScenarioProgress.setState({ completed: {} });
  useLessonProgress.setState({ completed: {}, inProgress: {} });
});

describe('PlaybookScreen', () => {
  it('lists every principle, in curriculum order, with nothing mastered at first', async () => {
    mockParams = { from: 'train' };
    await render(<PlaybookScreen />);
    expect(track()).toHaveBeenCalledWith('playbook_opened', { from: 'train' });
    expect(track()).toHaveBeenCalledTimes(1);
    const cards = screen.getAllByTestId(/^playbook-principle-/).map((c) => c.props.testID);
    expect(cards).toEqual(PRINCIPLES.map((p) => `playbook-principle-${p.id}`));
    expect(screen.getByLabelText(new RegExp(`^0 of ${PRINCIPLES.length} principles mastered`))).toBeTruthy();
    expect(screen.queryByTestId('playbook-mastered')).toBeNull();
    expect(screen.getByText('Count what’s gone before you count what’s close.')).toBeTruthy();
    expect(screen.getAllByText('In our simulator, following it won 11 to 25 more hands per 100 games at every bot table we tested.')).toHaveLength(1);
  });

  it('marks a principle mastered once its scenarios were finished best and its skill is Steady', async () => {
    useScenarioProgress.setState({
      completed: { 'count-whats-gone': finished('best'), 'exposures-count-too': finished('good') },
    });
    useDrillProgress.setState({ ratings: { discards: { rating: 1010, answers: 30, roundStart: 990 } } });
    await render(<PlaybookScreen />);
    // T3 is taught by the Discards drill alone, so the rating masters it; T1 still needs its second best move.
    expect(within(screen.getByTestId('playbook-principle-T3')).getByTestId('playbook-mastered')).toBeTruthy();
    expect(within(screen.getByTestId('playbook-principle-T1')).queryByTestId('playbook-mastered')).toBeNull();
    expect(within(screen.getByTestId('playbook-principle-T1')).getByText('2 of 3 done')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Exposures count as gone too. Finished. Replay it for the best move' })).toBeTruthy();

    useScenarioProgress.getState().complete('exposures-count-too', 'best');
    expect(await within(screen.getByTestId('playbook-principle-T1')).findByTestId('playbook-mastered')).toBeTruthy();
    expect(screen.getByLabelText(new RegExp(`^2 of ${PRINCIPLES.length} principles mastered`))).toBeTruthy();
  });

  it('rates a shared skill on its first principle and points back there after', async () => {
    await render(<PlaybookScreen />);
    expect(within(screen.getByTestId('playbook-principle-C1')).getByText('Skill not rated yet. Reach Steady to master')).toBeTruthy();
    expect(within(screen.getByTestId('playbook-principle-C2')).getByText('Same skill as C1. Not rated yet')).toBeTruthy();

    useDrillProgress.setState({ ratings: { charleston: { rating: 1010, answers: 30, roundStart: 990 } } });
    expect(await within(screen.getByTestId('playbook-principle-C4')).findByText('Skill: Steady, shared with C1')).toBeTruthy();
    expect(within(screen.getByTestId('playbook-principle-C1')).getByText('Skill: Steady')).toBeTruthy();
  });

  it('opens what teaches a principle', async () => {
    await render(<PlaybookScreen />);
    await fireEvent.press(screen.getByTestId('playbook-scenario-count-whats-gone'));
    expect(router().push).toHaveBeenCalledWith('/scenario/count-whats-gone');
    await fireEvent.press(screen.getByTestId('playbook-lesson-charleston'));
    expect(router().push).toHaveBeenLastCalledWith('/lesson/charleston');
    await fireEvent.press(screen.getAllByTestId('playbook-skill-discards')[0]);
    expect(router().push).toHaveBeenLastCalledWith('/drill/discards');
    expect(screen.getByRole('button', { name: 'Lesson 5: The Charleston. Not finished yet' })).toBeTruthy();
  });

  it('sends a direct visit as a link', () => {
    expect(parseSource(undefined)).toBe('link');
    expect(parseSource('progress')).toBe('progress');
    expect(parseSource(['train'])).toBe('train');
    expect(parseSource('elsewhere')).toBe('link');
  });
});

describe('PlaybookLink', () => {
  it('shows the mastered count and opens the playbook tagged with its tab', async () => {
    useLessonProgress.setState({ completed: { charleston: { score: 1, completedAt: '2026-11-24' } } as never });
    useDrillProgress.setState({ ratings: { charleston: { rating: 1000, answers: 30, roundStart: 990 } } });
    await render(<PlaybookLink from="progress" />);
    const link = screen.getByRole('button', { name: /^Your playbook\. 1 of 13 principles mastered/ });
    await fireEvent.press(link);
    expect(router().push).toHaveBeenCalledWith('/playbook?from=progress');
  });
});
