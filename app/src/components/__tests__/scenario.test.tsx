import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ScenarioList } from '@/components/scenario/ScenarioList';
import { ScenarioPlayer } from '@/components/scenario/ScenarioPlayer';
import { parseStep, ScenarioScreen } from '@/components/scenario/ScenarioScreen';
import { TrainTab } from '@/components/tabs/TrainTab';
import { NO_USAGE } from '@/game/drills';
import { moveIndexes, scenarioById, scenarioOfTheDay, SCENARIOS } from '@/game/scenarios';
import { useDrillProgress } from '@/state/drillProgress';
import { nextUnfinished, useScenarioProgress } from '@/state/scenarioProgress';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
}));
let mockParams: { id?: string; step?: string } = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/analytics', () => ({ track: jest.fn() }));
jest.mock('@/components/shell/TabScreen', () => ({
  TabScreen: ({ children }: { children: React.ReactNode }) => children,
}));

const track = () => jest.requireMock('@/analytics').track as jest.Mock;
const router = () => jest.requireMock('expo-router').router;

const charleston = scenarioById('pass-what-touches-nothing')!;
const discard = scenarioById('count-whats-gone')!;
const hand = scenarioById('closest-beats-richest')!;

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  useDrillProgress.setState({ usage: NO_USAGE, records: {}, ratings: {} });
  useScenarioProgress.setState({ completed: {} });
  mockParams = {};
});

describe('ScenarioPlayer', () => {
  it('walks scene → move → strategy for a Charleston pass, recording the finish and the skill', async () => {
    await render(<ScenarioPlayer scenario={charleston} />);
    expect(track()).toHaveBeenCalledWith('scenario_started', { scenario_id: charleston.id });
    expect(screen.getByTestId('scenario-scene')).toBeTruthy();
    expect(screen.getByText(charleston.title)).toBeTruthy();
    expect(screen.getByText(/Three pairs of 5s|a pair of 5s in every suit/)).toBeTruthy();
    // The rack is on the felt as a picture, read by its caption.
    expect(screen.getByLabelText(/^Bams: 5, 5, 9; Craks/)).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Scenario progress' }).props.accessibilityValue.text).toBe('Part 1 of 3');

    await fireEvent.press(screen.getByTestId('scenario-begin'));
    expect(screen.getByTestId('scenario-move')).toBeTruthy();
    expect(screen.getByText(charleston.prompt)).toBeTruthy();
    const check = screen.getByTestId('scenario-check');
    expect(check.props.accessibilityState?.disabled).toBe(true);
    const [a, b, c] = moveIndexes(charleston);
    for (const i of [a, b, c]) await fireEvent.press(screen.getByTestId(`drill-choice-${i}`));
    expect(screen.getByTestId('scenario-check').props.accessibilityState?.disabled).toBe(false);
    await fireEvent.press(screen.getByTestId('scenario-check'));
    expect(screen.getByTestId('lesson-feedback')).toBeTruthy();
    expect(screen.getByText('A clean pass')).toBeTruthy();
    expect(track()).toHaveBeenCalledWith('drill_answered', { skill: 'charleston', correct: true });
    expect(useDrillProgress.getState().ratings.charleston).toBeDefined();
    // Not yet finished.
    expect(useScenarioProgress.getState().completed[charleston.id]).toBeUndefined();

    await fireEvent.press(screen.getByTestId('scenario-continue'));
    expect(screen.getByTestId('scenario-strategy')).toBeTruthy();
    expect(screen.getByText(charleston.strategy.principle)).toBeTruthy();
    expect(screen.getByText('That was your move too.')).toBeTruthy();
    expect(screen.getByLabelText('Pass the 9 Bam, the 1 Crak and the 9 Dot')).toBeTruthy();
    expect(screen.getByLabelText(`1. ${charleston.strategy.checklist[0]}`)).toBeTruthy();
    expect(useScenarioProgress.getState().completed[charleston.id]).toMatchObject({ plays: 1, verdict: 'best' });
    expect(track()).toHaveBeenCalledWith('scenario_completed', { scenario_id: charleston.id, verdict: 'best' });
    expect(screen.getByRole('progressbar', { name: 'Scenario progress' }).props.accessibilityValue.text).toBe('Part 3 of 3');

    // Onward to the next scenario in the list.
    await fireEvent.press(screen.getByTestId('scenario-next'));
    expect(router().replace).toHaveBeenCalledWith('/scenario/a-flower-is-not-a-stray');

    // Playing again restarts at the scene and counts as a new start.
    await fireEvent.press(screen.getByTestId('scenario-again'));
    expect(screen.getByTestId('scenario-scene')).toBeTruthy();
    expect(track().mock.calls.filter(([name]) => name === 'scenario_started')).toHaveLength(2);
  });

  it('answers a one-pick discard on the tap, shows the miss kindly, and still teaches the move', async () => {
    await render(<ScenarioPlayer scenario={discard} step="move" />);
    // A deep link past the scene is not a start.
    expect(track()).not.toHaveBeenCalledWith('scenario_started', expect.anything());
    // A one-pick move has no footer button until the tap.
    expect(screen.queryByTestId('scenario-check')).toBeNull();
    // A 2 Bam costs the live hand a tile.
    await fireEvent.press(screen.getByTestId('drill-choice-0'));
    expect(screen.getByText('A better discard is here')).toBeTruthy();
    expect(screen.getByText(/Throw the Soap instead/)).toBeTruthy();
    expect(track()).toHaveBeenCalledWith('drill_answered', { skill: 'discards', correct: false });
    await fireEvent.press(screen.getByTestId('scenario-continue'));
    expect(screen.getByText('Not your move this time. Now you know the pattern.')).toBeTruthy();
    expect(screen.getByLabelText('Throw the Soap')).toBeTruthy();
    expect(useScenarioProgress.getState().completed[discard.id]).toMatchObject({ verdict: 'miss' });
    expect(track()).toHaveBeenCalledWith('scenario_completed', { scenario_id: discard.id, verdict: 'miss' });
  });

  it('shows a hand move as its card line, and the last scenario leads back to Train', async () => {
    const last = SCENARIOS[SCENARIOS.length - 1];
    await render(<ScenarioPlayer scenario={hand} step="strategy" />);
    expect(screen.getByTestId('scenario-move-line')).toBeTruthy();
    expect(screen.getByText('Aim for 13579 #3')).toBeTruthy();
    await screen.unmount();
    await render(<ScenarioPlayer scenario={last} step="strategy" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Back to Train' }));
    expect(router().back).toHaveBeenCalled();
  });
});

describe('ScenarioScreen', () => {
  it('plays the scenario in the URL from the step it names', async () => {
    mockParams = { id: discard.id, step: 'strategy' };
    await render(<ScenarioScreen />);
    expect(screen.getByTestId('scenario-strategy')).toBeTruthy();
    expect(parseStep('move')).toBe('move');
    expect(parseStep(['strategy'])).toBe('strategy');
    for (const bad of [undefined, '', 'nope']) expect(parseStep(bad)).toBe('scene');
  });

  it('says so kindly when the scenario is unknown', async () => {
    mockParams = { id: 'nope' };
    await render(<ScenarioScreen />);
    expect(screen.getByText('We couldn’t find that scenario')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Back to Train' }));
    expect(router().replace).toHaveBeenCalledWith('/train');
  });
});

describe('ScenarioList and the Train tab', () => {
  it('groups scenarios by stage, marks finished ones, and opens them', async () => {
    const onOpen = jest.fn();
    useScenarioProgress.getState().complete(charleston.id, 'best');
    const { completed } = useScenarioProgress.getState();
    await render(<ScenarioList completed={completed} onOpen={onOpen} />);
    expect(screen.getByLabelText(/^The Charleston\. .* 1 of 3 finished\./)).toBeTruthy();
    expect(screen.getAllByTestId('scenario-done')).toHaveLength(1);
    await fireEvent.press(screen.getByRole('button', { name: /^Pass what touches nothing\. .*\. Finished$/ }));
    expect(onOpen).toHaveBeenCalledWith(charleston);
    await fireEvent.press(screen.getByRole('button', { name: /^Count what’s gone\./ }));
    expect(onOpen).toHaveBeenLastCalledWith(discard);
  });

  it('points the hero at the next unfinished scenario, then at a replay once all are done', async () => {
    useScenarioProgress.getState().complete(charleston.id, 'good');
    expect(nextUnfinished(useScenarioProgress.getState().completed)).toBe(SCENARIOS[1]);
    await render(<TrainTab />);
    await fireEvent.press(screen.getByRole('button', { name: `Start: ${SCENARIOS[1].title}` }));
    expect(router().push).toHaveBeenCalledWith(`/scenario/${SCENARIOS[1].id}`);
    await screen.unmount();
    for (const s of SCENARIOS) useScenarioProgress.getState().complete(s.id, 'best');
    expect(nextUnfinished(useScenarioProgress.getState().completed)).toBe(SCENARIOS[0]);
    await render(<TrainTab />);
    expect(screen.getByRole('button', { name: `Replay: ${SCENARIOS[0].title}` })).toBeTruthy();
    expect(screen.getAllByTestId('scenario-done')).toHaveLength(SCENARIOS.length);
  });
});

describe('table-move scenarios and the scenario of the day', () => {
  it('plays a call as move slips: the offered tile glows on the felt, and the taught move is the coach’s', async () => {
    const call = scenarioById('call-the-kong')!;
    await render(<ScenarioPlayer scenario={call} step="move" />);
    // Drawn on the felt; screen readers hear it in the table's caption.
    expect(screen.getByTestId('drill-offered', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByLabelText(/The player across has just thrown a 9 Crak\.$/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Let it go. Stay concealed and draw from the wall.' })).toBeTruthy();
    // The pung loses the 9999 the hand prints.
    await fireEvent.press(screen.getByRole('button', { name: /^Call it for a pung\./ }));
    expect(screen.getByText('A stronger move is here')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Call it for a kong, the answer\./ })).toBeTruthy();
    await fireEvent.press(screen.getByTestId('scenario-continue'));
    expect(screen.getByText(call.strategy.principle)).toBeTruthy();
    expect(screen.getByLabelText('Call it for a kong')).toBeTruthy();
  });

  it('shows today’s scenario on the Train tab and opens it', async () => {
    const today = scenarioOfTheDay(new Date());
    await render(<TrainTab />);
    expect(screen.getByTestId('scenario-of-the-day')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('scenario-of-the-day-play'));
    expect(router().push).toHaveBeenCalledWith(`/scenario/${today.id}`);
    await screen.unmount();
    useScenarioProgress.getState().complete(today.id, 'best');
    await render(<TrainTab />);
    expect(screen.getByRole('button', { name: 'Play it again' })).toBeTruthy();
  });
});
