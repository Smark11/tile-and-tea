import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { LessonPath } from '@/components/lesson/path/LessonPath';
import { LearnTab } from '@/components/tabs/LearnTab';
import { buildLessonPath, emptyProgress, recordCompletion, saveSnapshot, type Lesson } from '@/game/lessons';
import { useLessonProgress } from '@/state/lessonProgress';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
}));
// Focus is an effect that tests can re-run, like coming back to the tab.
let mockRefocus: (() => void) | null = null;
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    router: { push: jest.fn() },
    useFocusEffect: (effect: () => void) => {
      mockRefocus = effect;
      React.useEffect(effect, [effect]);
    },
  };
});

const reanimated = () => jest.requireMock('react-native-reanimated');
const router = () => jest.requireMock('expo-router').router;
const at = new Date('2026-11-12T10:00:00Z');

const lesson = (id: string, title: string): Lesson => ({
  id,
  title,
  summary: `${title} summary.`,
  minutes: 4,
  steps: [
    { kind: 'text', id: 'a', title: 'A', body: 'A.' },
    { kind: 'text', id: 'b', title: 'B', body: 'B.' },
  ],
});
const WRITTEN = [lesson('one', 'First steps'), lesson('two', 'Second steps')];
const PLANNED = [{ id: 'three', title: 'Third steps', summary: 'Still being written.' }];

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  useLessonProgress.setState({ ...emptyProgress, pendingCelebration: null });
  reanimated().useReducedMotion.mockReturnValue(false);
});

describe('LessonPath', () => {
  it('gives the next lesson the big card, and says what waits further on', async () => {
    const nodes = buildLessonPath(emptyProgress, WRITTEN, PLANNED);
    const onOpen = jest.fn();
    await render(<LessonPath nodes={nodes} onOpen={onOpen} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Start lesson: First steps' }));
    expect(onOpen).toHaveBeenCalledWith('one');
    // Locked and planned lessons are read out, but aren't buttons.
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByLabelText('Lesson 2, Second steps. Finish First steps to unlock.')).toBeTruthy();
    expect(screen.getByLabelText('Lesson 3, Third steps. Finish Second steps to unlock.')).toBeTruthy();
  });

  it('lets a finished lesson be played again, and shows a lesson left partway', async () => {
    const progress = saveSnapshot(recordCompletion(emptyProgress, 'one', { firstTry: 2, questions: 3 }, at), 'two', {
      stepIndex: 1,
      results: {},
    });
    const onOpen = jest.fn();
    await render(<LessonPath nodes={buildLessonPath(progress, WRITTEN, PLANNED)} onOpen={onOpen} />);
    const again = screen.getByRole('button', {
      name: 'Lesson 1, First steps. Finished. 2 of 3 right on the first try. Play again.',
    });
    await fireEvent.press(again);
    expect(onOpen).toHaveBeenCalledWith('one');
    expect(screen.getByRole('button', { name: 'Continue lesson: Second steps' })).toBeTruthy();
    expect(screen.getByText('Step 2 of 2')).toBeTruthy();
  });

  it('marks a reached lesson that isn’t written yet as coming soon', async () => {
    const progress = recordCompletion(recordCompletion(emptyProgress, 'one', { firstTry: 1, questions: 1 }, at), 'two', { firstTry: 1, questions: 1 }, at);
    await render(<LessonPath nodes={buildLessonPath(progress, WRITTEN, PLANNED)} onOpen={() => {}} />);
    expect(screen.getByText('Coming soon')).toBeTruthy();
    expect(screen.getByLabelText('Lesson 3, Third steps. Coming soon. We’re still writing this one.')).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('draws the trail once every row has a place', async () => {
    const nodes = buildLessonPath(emptyProgress, WRITTEN, PLANNED);
    await render(<LessonPath nodes={nodes} onOpen={() => {}} />);
    expect(screen.queryByTestId('lesson-trail')).toBeNull();
    for (const [i, node] of nodes.entries()) {
      await fireEvent(screen.getByTestId(`path-node-${node.id}`), 'layout', {
        nativeEvent: { layout: { x: 0, y: i * 200, width: 300, height: 180 } },
      });
    }
    expect(screen.getByTestId('lesson-trail')).toBeTruthy();
  });

  it('celebrates with springs, and holds still under Reduce Motion', async () => {
    const nodes = buildLessonPath(recordCompletion(emptyProgress, 'one', { firstTry: 1, questions: 1 }, at), WRITTEN);
    await render(<LessonPath nodes={nodes} onOpen={() => {}} celebrating="one" />);
    expect(reanimated().withSpring).toHaveBeenCalled();

    reanimated().withSpring.mockClear();
    reanimated().useReducedMotion.mockReturnValue(true);
    await render(<LessonPath nodes={nodes} onOpen={() => {}} celebrating="one" />);
    expect(reanimated().withSpring).not.toHaveBeenCalled();
  });
});

describe('LearnTab', () => {
  it('opens lesson 1 from the path', async () => {
    await render(<LearnTab />);
    await fireEvent.press(screen.getByRole('button', { name: 'Start lesson: Meet the tiles' }));
    expect(router().push).toHaveBeenCalledWith({ pathname: '/lesson/[id]', params: { id: 'meet-the-tiles' } });
  });

  it('follows saved progress: continue, then finished', async () => {
    await render(<LearnTab />);
    await act(() => useLessonProgress.getState().saveStep('meet-the-tiles', { stepIndex: 3, results: {} }));
    expect(screen.getByRole('button', { name: 'Continue lesson: Meet the tiles' })).toBeTruthy();
    await act(() => useLessonProgress.getState().completeLesson('meet-the-tiles', { firstTry: 3, questions: 3 }));
    expect(screen.getByRole('button', { name: /^Lesson 1, Meet the tiles\. Finished\..*Play again\.$/ })).toBeTruthy();
  });

  it('celebrates a first finish once, when the path comes back into view', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await render(<LearnTab />);
    // Finishing happens on the lesson screen, on top of the path.
    await act(() => useLessonProgress.getState().completeLesson('meet-the-tiles', { firstTry: 3, questions: 3 }));
    expect(announce).not.toHaveBeenCalled();

    await act(() => mockRefocus?.());
    const said = 'Lesson complete: Meet the tiles. Pungs, kongs, quints & pairs is coming soon.';
    expect(announce).toHaveBeenCalledWith(said);
    expect(screen.getByText(said)).toBeTruthy();
    expect(useLessonProgress.getState().pendingCelebration).toBeNull();

    // A replay finishing doesn't celebrate again.
    announce.mockClear();
    await act(() => useLessonProgress.getState().completeLesson('meet-the-tiles', { firstTry: 3, questions: 3 }));
    await act(() => mockRefocus?.());
    expect(announce).not.toHaveBeenCalled();
  });
});
