import type { TileKind } from '../../tiles';
import {
  feedbackMessage,
  lessonReducer,
  startSession,
  type Lesson,
  type SessionAction,
  type SessionState,
  type TapStep,
} from '..';

const RED: TileKind = { type: 'dragon', dragon: 'red' };
const GREEN: TileKind = { type: 'dragon', dragon: 'green' };
const NORTH: TileKind = { type: 'wind', wind: 'N' };
const JOKER: TileKind = { type: 'joker' };
const ONE_BAM: TileKind = { type: 'suited', suit: 'bam', rank: 1 };

const one: TapStep = {
  kind: 'tap',
  id: 'one',
  prompt: 'Tap the Joker.',
  choices: [{ tile: ONE_BAM }, { tile: JOKER, correct: true }, { tile: NORTH }],
  hint: 'It says so.',
  explanation: 'Yes.',
};
const many: TapStep = {
  kind: 'tap',
  id: 'many',
  prompt: 'Tap every Dragon.',
  choices: [{ tile: RED, correct: true }, { tile: NORTH }, { tile: GREEN, correct: true }, { tile: ONE_BAM }],
  hint: 'Two kinds here.',
  explanation: 'Right.',
};
const lesson = (step: TapStep): Lesson => ({ id: 'l', title: 'L', summary: 'S', minutes: 1, steps: [step] });

function play(step: TapStep, actions: SessionAction[]): SessionState {
  const l = lesson(step);
  return actions.reduce(lessonReducer(l), startSession(l));
}
const tap = (index: number): SessionAction => ({ type: 'tap', index });
const CHECK: SessionAction = { type: 'check' };
const RETRY: SessionAction = { type: 'retry' };

describe('feedbackMessage', () => {
  it('says nothing while the question is open', () => {
    expect(feedbackMessage(one, play(one, []))).toBeNull();
  });

  it('cheers a right answer with the explanation', () => {
    expect(feedbackMessage(one, play(one, [tap(1)]))).toEqual({ tone: 'correct', title: 'Nice!', body: 'Yes.' });
    expect(feedbackMessage(one, play(one, [tap(0), RETRY, tap(1)]))?.title).toBe('There it is!');
  });

  it('nudges with the hint and never says "wrong"', () => {
    const msg = feedbackMessage(one, play(one, [tap(0)]));
    expect(msg).toEqual({ tone: 'retry', title: 'Not quite', body: 'It says so.' });
    expect(JSON.stringify(msg)).not.toMatch(/wrong/i);
  });

  it('says how many were found, or how many picks don’t belong, on a many-answer question', () => {
    expect(feedbackMessage(many, play(many, [tap(0), CHECK]))?.body).toBe('Close! You found 1 of 2. Two kinds here.');
    expect(feedbackMessage(many, play(many, [tap(0), tap(2), tap(1), CHECK]))?.body).toBe(
      'One tile you picked doesn’t belong. Two kinds here.',
    );
    expect(feedbackMessage(many, play(many, [tap(1), tap(3), CHECK]))?.body).toBe(
      '2 tiles you picked don’t belong. Two kinds here.',
    );
  });

  it('reveals the answer with the explanation', () => {
    expect(feedbackMessage(one, play(one, [tap(0), RETRY, tap(2)]))).toEqual({
      tone: 'revealed',
      title: 'Here’s the answer',
      body: 'Yes.',
    });
  });
});
