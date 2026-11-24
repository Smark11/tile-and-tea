import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { DrillPlayer } from '@/components/drill/DrillPlayer';
import { DrillScreen, parseSeed } from '@/components/drill/DrillScreen';
import { DrillQuestionView, evaluationMessage, roundLine, roundSummary } from '@/components/drill/DrillViews';
import { TrainTab } from '@/components/tabs/TrainTab';
import {
  bestHand,
  charleston,
  currentAnswer,
  currentQuestion,
  discards,
  localDay,
  nameTheHand,
  NO_USAGE,
  rateAnswer,
  roundReducer,
  startRound,
  type Drill,
  type DrillQuestion,
} from '@/game/drills';
import type { CharlestonData } from '@/game/drills/content/charleston';
import { handLabel } from '@/game/drills/content/words';
import { CURRENT_CARD } from '@/game/card';
import { useDrillProgress } from '@/state/drillProgress';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
}));
let mockParams: { id?: string; seed?: string } = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/analytics', () => ({ track: jest.fn() }));
jest.mock('@/components/shell/TabScreen', () => ({
  TabScreen: ({ children }: { children: React.ReactNode }) => children,
}));

// Two questions; each picks two of three tiles. Picking tile 0 is best, tile 1 alone is sound.
const PAIR_DRILL: Drill<null> = {
  id: 'pairs',
  skill: 'charleston',
  title: 'Pair drill',
  summary: 'For tests.',
  icon: { type: 'joker' },
  questionsPerRound: 2,
  level: 1000,
  generate: (seed) => ({
    seed,
    key: String(seed),
    prompt: `Pick two (${seed % 1000})`,
    scene: { tiles: [{ type: 'flower' }], caption: 'One Flower' },
    choices: ([{ type: 'joker' }, { type: 'flower' }, { type: 'wind', wind: 'E' }] as const).map((tile) => ({ kind: 'tile', tile }) as const),
    picks: 2,
    data: null,
  }),
  evaluate: (_q, picked) =>
    picked.includes(0)
      ? { verdict: 'best', score: 1, best: [0, 1], title: 'Strong pass', explanation: 'Because of reasons.' }
      : { verdict: 'good', score: 0.5, best: [0, 1], title: 'Sound pass', explanation: 'Nearly there.' },
};

const track = () => jest.requireMock('@/analytics').track as jest.Mock;
const router = () => jest.requireMock('expo-router').router;

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  useDrillProgress.setState({ usage: NO_USAGE, records: {}, ratings: {} });
  mockParams = {};
});

describe('DrillPlayer with the Best hand drill', () => {
  it('shows the rack, its own instruction, and grades a pick with the coach’s plan', async () => {
    const q = startRound(bestHand, 77).questions[0];
    await render(<DrillPlayer drill={bestHand} seed={77} />);
    expect(screen.getByRole('header', { name: 'Which hand should this rack go for?' })).toBeTruthy();
    expect(screen.getByText('Tap the line your tiles are closest to.')).toBeTruthy();
    expect(screen.getByLabelText(q.scene.caption)).toBeTruthy();
    const choice = q.choices[0];
    if (choice.kind !== 'line') throw new Error('Best hand offers card lines');
    await fireEvent.press(screen.getByRole('button', { name: new RegExp(`^${choice.label}`) }));
    // The reply reads as short paragraphs: the comparison first, then what the rack uses.
    expect(screen.getByText(/ tiles? away(, the closest on the card|; your pick is \d+)\.$/)).toBeTruthy();
    expect(screen.getByText(/^It uses \d+ of your 13 tiles\./)).toBeTruthy();
    expect(track()).toHaveBeenCalledWith('drill_answered', expect.objectContaining({ skill: 'hand-choice' }));
  });
});

describe('DrillPlayer with card-line choices', () => {
  it('answers on a tap, marks the answer, explains, and counts the round once', async () => {
    const round = startRound(nameTheHand, 4242);
    const q = round.questions[0];
    const { answer, handIds } = q.data as { answer: number; handIds: string[] };
    const wrong = (answer + 1) % 3;
    const label = (i: number) => handLabel(CURRENT_CARD.hands.find((h) => h.id === handIds[i])!);

    await render(<DrillPlayer drill={nameTheHand} seed={4242} />);
    expect(screen.getByRole('header', { name: 'Which hand do these tiles make?' })).toBeTruthy();
    expect(screen.getByText('Tap the line these tiles make.')).toBeTruthy();
    expect(screen.getByText(/Name that hand · Question 1 of 5/)).toBeTruthy();
    // The felt is read as its caption, not fourteen tile names.
    expect(screen.getByLabelText(q.scene.caption)).toBeTruthy();
    expect(screen.queryByTestId('drill-primary')).toBeNull();

    await fireEvent.press(screen.getByTestId(`drill-choice-${wrong}`));
    expect(track()).toHaveBeenCalledWith('drill_answered', { skill: 'card-reading', correct: false });
    expect(useDrillProgress.getState().usage).toEqual({ day: localDay(new Date()), rounds: 1 });
    expect(screen.getByRole('button', { name: new RegExp(`^${label(answer)}, the answer\\.`) })).toBeTruthy();
    expect(screen.getByRole('button', { name: new RegExp(`^${label(wrong)}, your pick\\.`) })).toBeTruthy();
    expect(screen.getByTestId('lesson-feedback').props.accessibilityLabel).toMatch(/^Not quite this line\. Even at its closest/);
    // Answered: further taps do nothing.
    await fireEvent.press(screen.getByTestId(`drill-choice-${answer}`));
    expect(track()).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByTestId('drill-primary'));
    expect(screen.getByText(/Question 2 of 5/)).toBeTruthy();
    const second = round.questions[1].data as { answer: number };
    await fireEvent.press(screen.getByTestId(`drill-choice-${second.answer}`));
    expect(track()).toHaveBeenLastCalledWith('drill_answered', { skill: 'card-reading', correct: true });
    expect(screen.getByText('That’s the one')).toBeTruthy();
    // Still one round counted.
    expect(useDrillProgress.getState().usage.rounds).toBe(1);
  });
});

describe('DrillPlayer with multi-pick tile choices', () => {
  it('needs a full pick before Check, then finishes the round and records it', async () => {
    await render(<DrillPlayer drill={PAIR_DRILL} seed={1} />);
    expect(screen.getByText('Pick 2, then Check.')).toBeTruthy();
    const check = () => screen.getByTestId('drill-primary');
    expect(check().props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(screen.getByTestId('drill-choice-1'));
    await fireEvent.press(screen.getByTestId('drill-choice-2'));
    expect(track()).not.toHaveBeenCalled();
    await fireEvent.press(check());
    expect(screen.getByText('Sound pass')).toBeTruthy();
    expect(track()).toHaveBeenCalledWith('drill_answered', { skill: 'charleston', correct: true });

    await fireEvent.press(screen.getByRole('button', { name: 'Next question' }));
    await fireEvent.press(screen.getByTestId('drill-choice-0'));
    await fireEvent.press(screen.getByTestId('drill-choice-2'));
    await fireEvent.press(screen.getByRole('button', { name: 'Check' }));
    await fireEvent.press(screen.getByRole('button', { name: 'See how you did' }));

    expect(screen.getByTestId('drill-complete')).toBeTruthy();
    expect(screen.getByLabelText('Round results: 1 of 2 spot on, 1 sound')).toBeTruthy();
    expect(useDrillProgress.getState().records.pairs).toEqual({ rounds: 1, bestScore: 0.75 });
    // Both answers moved the drill's skill rating: a sound one, then a best one.
    const sound = rateAnswer(undefined, { score: 0.5, level: PAIR_DRILL.level, startsRound: true });
    expect(useDrillProgress.getState().ratings.charleston).toEqual(
      rateAnswer(sound, { score: 1, level: PAIR_DRILL.level, startsRound: false }),
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Another round' }));
    expect(screen.getByText(/Question 1 of 2/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Close drill' }));
    expect(router().back).toHaveBeenCalled();
  });
});

describe('DrillPlayer skill ratings', () => {
  it('tracks a band reached only on the answer that crosses into it', async () => {
    useDrillProgress.setState({ ratings: { charleston: { rating: 995, answers: 20, roundStart: 990 } } });
    await render(<DrillPlayer drill={PAIR_DRILL} seed={1} />);
    await fireEvent.press(screen.getByTestId('drill-choice-0'));
    await fireEvent.press(screen.getByTestId('drill-choice-1'));
    await fireEvent.press(screen.getByTestId('drill-primary'));
    const after = useDrillProgress.getState().ratings.charleston!;
    expect(after.rating).toBeGreaterThan(1000);
    // The round's change is measured from just before its first answer.
    expect(after.roundStart).toBe(995);
    expect(track()).toHaveBeenCalledWith('skill_level_reached', { skill: 'charleston', level: 'steady' });

    // Another best answer stays in the band, so nothing more is sent.
    await fireEvent.press(screen.getByTestId('drill-primary'));
    await fireEvent.press(screen.getByTestId('drill-choice-0'));
    await fireEvent.press(screen.getByTestId('drill-choice-2'));
    await fireEvent.press(screen.getByTestId('drill-primary'));
    expect(track().mock.calls.filter(([event]) => event === 'skill_level_reached')).toHaveLength(1);
    expect(useDrillProgress.getState().ratings.charleston!.answers).toBe(22);
  });
});

describe('DrillScreen', () => {
  it('plays the drill in the URL, from a linked seed when there is one', async () => {
    mockParams = { id: 'name-the-hand', seed: '4242' };
    await render(<DrillScreen />);
    const first = startRound(nameTheHand, 4242).questions[0];
    expect(screen.getByLabelText(first.scene.caption)).toBeTruthy();
  });

  it('says so kindly when the drill is unknown', async () => {
    mockParams = { id: 'nope' };
    await render(<DrillScreen />);
    expect(screen.getByText('We couldn’t find that drill')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Back to Train' }));
    expect(router().replace).toHaveBeenCalledWith('/train');
  });

  it('accepts only whole 32-bit seeds', () => {
    expect(parseSeed('0')).toBe(0);
    expect(parseSeed(['77', '8'])).toBe(77);
    expect(parseSeed('4294967295')).toBe(4294967295);
    for (const bad of [undefined, '', '-1', '1.5', 'abc', '4294967296', '12345678901']) expect(parseSeed(bad)).toBeNull();
  });
});

describe('TrainTab', () => {
  it('opens a drill from its row, and the first scenario from the hero', async () => {
    await render(<TrainTab />);
    await fireEvent.press(screen.getByRole('button', { name: /^Name that hand\./ }));
    expect(router().push).toHaveBeenCalledWith('/drill/name-the-hand');
    await fireEvent.press(screen.getByRole('button', { name: 'Start: Pass what touches nothing' }));
    expect(router().push).toHaveBeenLastCalledWith('/scenario/pass-what-touches-nothing');
    expect(router().push).toHaveBeenCalledTimes(2);
    await fireEvent.press(screen.getByRole('button', { name: /^Best hand\./ }));
    expect(router().push).toHaveBeenLastCalledWith('/drill/best-hand');
    await fireEvent.press(screen.getByRole('button', { name: /^Charleston\./ }));
    expect(router().push).toHaveBeenLastCalledWith('/drill/charleston');
    await fireEvent.press(screen.getByRole('button', { name: /^Discards\./ }));
    expect(router().push).toHaveBeenLastCalledWith('/drill/discards');
  });
});

describe('Charleston question', () => {
  const drill = { ...charleston, questionsPerRound: 1, generate: () => charleston.generate(62839) };
  const question = charleston.generate(62839) as DrillQuestion<CharlestonData>;
  const rack = question.data.rack;
  const free = rack.flatMap((k, i) => (k.type === 'joker' ? [] : [i]));

  it('locks Jokers, explains why, and shows the hand to aim for after a pass', async () => {
    const reduce = roundReducer(drill);
    let state = startRound(drill, 1);
    const answer = () => currentAnswer(state);
    const view = () => (
      <DrillQuestionView question={currentQuestion(state)} selected={state.selected} answer={answer()} onTap={() => {}} />
    );
    await render(view());
    const joker = rack.findIndex((k) => k.type === 'joker');
    expect(screen.getByTestId(`drill-choice-${joker}`).props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByTestId(`drill-choice-${joker}`).props.accessibilityHint).toBe('Jokers are never passed.');
    expect(screen.getByText('Pick 3 tiles to pass, then Check.')).toBeTruthy();
    expect(screen.queryByTestId('drill-target')).toBeNull();

    for (const i of free.slice(0, 3)) state = reduce(state, { type: 'tap', index: i });
    state = reduce(state, { type: 'check' });
    await render(view());
    // The player's tiles stay raised; the coach's pass is starred; the target line is printed.
    for (const i of free.slice(0, 3)) {
      expect(screen.getByTestId(`drill-choice-${i}`).props.accessibilityState).toMatchObject({ selected: true });
    }
    for (const i of answer()!.evaluation.best) {
      expect(screen.getByTestId(`drill-choice-${i}`).props.accessibilityLabel).toMatch(/, suggested$/);
    }
    expect(screen.getByTestId('drill-tile-key')).toBeTruthy();
    expect(screen.getByTestId('drill-target')).toBeTruthy();
    expect(screen.getByText(answer()!.evaluation.target!.label)).toBeTruthy();
  });
});

describe('Discards question', () => {
  const question = discards.generate(7919 * 3 + 3);

  it('lays out the table, reads it in one stop, and keys the coach’s discard after a tap', async () => {
    const drill = { ...discards, questionsPerRound: 1, generate: () => question };
    const reduce = roundReducer(drill);
    let state = startRound(drill, 1);
    const view = () => (
      <DrillQuestionView question={currentQuestion(state)} selected={state.selected} answer={currentAnswer(state)} onTap={() => {}} />
    );
    await render(view());
    const table = screen.getByTestId('drill-table');
    expect(table.props.accessibilityLabel).toBe(`On the table. ${question.scene.table!.caption}`);
    expect(table.props.accessibilityLabel).toMatch(/has exposed a (pung|kong|quint) of .+ Discarded: /);
    expect(screen.getByText('You’ve just drawn. Tap the tile to discard.')).toBeTruthy();

    const tile = question.choices.findIndex((c) => c.kind === 'tile' && !c.locked);
    state = reduce(state, { type: 'tap', index: tile });
    await render(view());
    expect(screen.getByTestId('drill-tile-key').props.accessibilityLabel).toBe(
      'Gold ring and raised: your discard. Green star: the coach’s discard.',
    );
    expect(screen.getByTestId('drill-target')).toBeTruthy();
  });
});

describe('copy', () => {
  it('maps verdicts onto the feedback panel moods', () => {
    const base = { score: 0, best: [0], title: 'T', explanation: 'E' };
    expect(evaluationMessage({ ...base, verdict: 'best' })).toEqual({ tone: 'correct', title: 'T', body: 'E' });
    // Nearly-best gets its own gold half-star, so "best" and "nearly" never look alike.
    expect(evaluationMessage({ ...base, verdict: 'good' }).tone).toBe('close');
    expect(evaluationMessage({ ...base, verdict: 'miss' }).tone).toBe('revealed');
  });

  it('describes a round warmly, never as a grade', () => {
    const score = (best: number, good: number, miss: number) => ({ best, good, miss, questions: best + good + miss, score: 0 });
    expect(roundLine(score(5, 0, 0))).toMatch(/^All 5 spot on/);
    expect(roundLine(score(3, 2, 0))).toMatch(/^Every answer was sound/);
    expect(roundLine(score(0, 0, 5))).toMatch(/^A tough round/);
    expect(roundLine(score(2, 1, 2))).toMatch(/^2 of 5 spot on/);
    expect(roundSummary(score(2, 1, 2))).toBe('2 of 5 spot on, 1 sound, 2 to learn from');
  });
});
