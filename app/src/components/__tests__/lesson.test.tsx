import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { scoreLine } from '@/components/lesson/LessonComplete';
import { LessonPlayer } from '@/components/lesson/LessonPlayer';
import { LessonScreen } from '@/components/lesson/LessonScreen';
import { fitTileWidth, tilesPerRow } from '@/components/lesson/LessonSteps';
import { emptyProgress, type Lesson } from '@/game/lessons';
import { useLessonProgress } from '@/state/lessonProgress';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));
let mockParams: { id?: string } = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/analytics', () => ({ track: jest.fn() }));

const LESSON: Lesson = {
  id: 'fixture',
  title: 'Fixture lesson',
  summary: 'For tests.',
  minutes: 1,
  steps: [
    { kind: 'text', id: 'intro', title: 'Hello there', body: 'First paragraph.\n\nSecond paragraph.' },
    {
      kind: 'tap',
      id: 'one',
      prompt: 'Tap the Joker.',
      choices: [{ tile: { type: 'flower' } }, { tile: { type: 'joker' }, correct: true }],
      hint: 'Look for the word.',
      explanation: 'Jokers say so.',
    },
    {
      kind: 'tap',
      id: 'many',
      prompt: 'Tap every Dragon.',
      choices: [
        { tile: { type: 'dragon', dragon: 'red' }, correct: true },
        { tile: { type: 'wind', wind: 'N' } },
        { tile: { type: 'dragon', dragon: 'white' }, correct: true },
      ],
      hint: 'Red, Green, and Soap.',
      explanation: 'Both are Dragons.',
    },
  ],
};

const track = () => jest.requireMock('@/analytics').track as jest.Mock;
const router = () => jest.requireMock('expo-router').router;
const press = (name: string | RegExp) => fireEvent.press(screen.getByRole('button', { name }));

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  useLessonProgress.setState(emptyProgress);
  mockParams = {};
});

describe('LessonPlayer', () => {
  it('opens on the first step, tracks the start, and saves each step', async () => {
    await render(<LessonPlayer lesson={LESSON} />);
    expect(screen.getByRole('header', { name: 'Hello there' })).toBeTruthy();
    expect(screen.getByText('Second paragraph.')).toBeTruthy();
    expect(screen.getByRole('progressbar').props.accessibilityValue).toMatchObject({ now: 1, max: 3 });
    expect(track()).toHaveBeenCalledWith('lesson_started', { lesson_id: 'fixture' });
    // No Back on the first step.
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();

    await press('Continue');
    expect(screen.getByText('Tap the Joker.')).toBeTruthy();
    expect(useLessonProgress.getState().inProgress.fixture).toEqual({ stepIndex: 1, results: {} });
  });

  it('nudges after a wrong tap, then cheers the right one', async () => {
    useLessonProgress.getState().saveStep('fixture', { stepIndex: 1, results: {} });
    await render(<LessonPlayer lesson={LESSON} />);
    // A one-answer question has no Continue or Check until it's answered.
    expect(screen.queryByTestId('lesson-primary')).toBeNull();

    await press('Flower');
    expect(screen.getByText('Not quite')).toBeTruthy();
    expect(screen.getByText('Look for the word.')).toBeTruthy();
    await press('Try again');
    expect(screen.queryByText('Not quite')).toBeNull();

    await press('Joker');
    expect(screen.getByText('There it is!')).toBeTruthy();
    expect(screen.getByText('Jokers say so.')).toBeTruthy();
    expect(useLessonProgress.getState().inProgress.fixture.results).toEqual({ one: 'retried' });
    await press('Continue');
    expect(screen.getByText('Tap every Dragon.')).toBeTruthy();
  });

  it('waits for Check on a many-answer question, then finishes and records the lesson', async () => {
    useLessonProgress.getState().saveStep('fixture', { stepIndex: 2, results: { one: 'first-try' } });
    await render(<LessonPlayer lesson={LESSON} />);
    const check = screen.getByRole('button', { name: 'Check' });
    expect(check.props.accessibilityState).toMatchObject({ disabled: true });

    await press('Red Dragon');
    await press('White Dragon, Soap');
    expect(screen.getByRole('button', { name: 'Red Dragon' }).props.accessibilityState).toMatchObject({
      selected: true,
    });
    await press('Check');
    expect(screen.getByText('Nice!')).toBeTruthy();

    await press('Finish');
    expect(screen.getByTestId('lesson-complete')).toBeTruthy();
    expect(screen.getByText('You got all 2 questions right on the first try.')).toBeTruthy();
    expect(track()).toHaveBeenCalledWith('lesson_completed', { lesson_id: 'fixture' });
    const progress = useLessonProgress.getState();
    expect(progress.inProgress.fixture).toBeUndefined();
    expect(progress.completed.fixture).toMatchObject({ timesCompleted: 1, best: { firstTry: 2, questions: 2 } });

    await press('Back to lessons');
    expect(router().back).toHaveBeenCalled();
  });

  it('shows the answer with the coach’s star after two misses', async () => {
    useLessonProgress.getState().saveStep('fixture', { stepIndex: 1, results: {} });
    await render(<LessonPlayer lesson={LESSON} />);
    await press('Flower');
    await press('Try again');
    await press('Flower');
    expect(screen.getByText('Here’s the answer')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Joker, suggested' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
  });

  it('can replay a finished lesson from the start', async () => {
    useLessonProgress.getState().saveStep('fixture', { stepIndex: 2, results: { one: 'revealed' } });
    await render(<LessonPlayer lesson={LESSON} />);
    await press('Red Dragon');
    await press('White Dragon, Soap');
    await press('Check');
    await press('Finish');
    expect(screen.getByText('You got 1 of 2 questions on the first try, and worked out the rest.')).toBeTruthy();
    track().mockClear();
    await press('Go through it again');
    expect(screen.getByText('Hello there')).toBeTruthy();
    expect(track()).toHaveBeenCalledWith('lesson_started', { lesson_id: 'fixture' });
    expect(useLessonProgress.getState().inProgress.fixture).toEqual({ stepIndex: 0, results: {} });
  });

  it('goes back a step and closes to where the player came from', async () => {
    useLessonProgress.getState().saveStep('fixture', { stepIndex: 1, results: {} });
    await render(<LessonPlayer lesson={LESSON} />);
    await press('Back');
    expect(screen.getByText('Hello there')).toBeTruthy();
    await press('Close lesson');
    expect(router().back).toHaveBeenCalled();
    router().canGoBack.mockReturnValueOnce(false);
    await press('Close lesson');
    expect(router().replace).toHaveBeenCalledWith('/');
  });
});

describe('LessonScreen', () => {
  it('plays the lesson named in the URL once progress has loaded', async () => {
    mockParams = { id: 'meet-the-tiles' };
    await act(() => useLessonProgress.persist.rehydrate());
    await render(<LessonScreen />);
    expect(screen.getByText('What’s in the set')).toBeTruthy();
  });

  it('explains a missing lesson and offers a way back', async () => {
    mockParams = { id: 'no-such-lesson' };
    await render(<LessonScreen />);
    expect(screen.getByText('We couldn’t find that lesson')).toBeTruthy();
    await press('Back to lessons');
    expect(router().replace).toHaveBeenCalledWith('/');
  });
});

describe('lesson layout and copy', () => {
  it('balances tiles into rows of up to four', () => {
    expect([1, 3, 4, 5, 6, 7, 8].map(tilesPerRow)).toEqual([1, 3, 4, 3, 3, 4, 4]);
  });

  it('fits tiles to the space, within readable limits', () => {
    expect(fitTileWidth(300, 4)).toBe(66);
    expect(fitTileWidth(2000, 3)).toBe(84);
    expect(fitTileWidth(100, 4)).toBe(44);
  });

  it('describes the score warmly', () => {
    expect(scoreLine({ firstTry: 0, questions: 0 })).toBe('You worked through every step.');
    expect(scoreLine({ firstTry: 1, questions: 1 })).toBe('You got the question right on the first try.');
    expect(scoreLine({ firstTry: 0, questions: 3 })).toBe(
      'You got 0 of 3 questions on the first try, and worked out the rest.',
    );
  });
});
