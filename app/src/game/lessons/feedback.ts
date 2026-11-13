// What the coach says after an answer. Encouraging and specific, never
// "WRONG" (docs/PRODUCT.md, feedback tone).

import { correctIndexes, type Feedback, type SessionState } from './session';
import type { TapStep } from './types';

export type FeedbackMessage = {
  /** Which mood the panel takes: a jade check, a gold nudge, or a calm reveal. */
  readonly tone: Exclude<Feedback, 'open'>;
  readonly title: string;
  readonly body: string;
};

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many;
}

/** The message for the current question, or null while it's still open. */
export function feedbackMessage(step: TapStep, state: SessionState): FeedbackMessage | null {
  switch (state.feedback) {
    case 'open':
      return null;
    case 'correct':
      return {
        tone: 'correct',
        title: state.results[step.id] === 'retried' ? 'There it is!' : 'Nice!',
        body: step.explanation,
      };
    case 'revealed':
      return { tone: 'revealed', title: 'Here’s the answer', body: step.explanation };
    case 'retry': {
      const review = state.lastTry;
      const total = correctIndexes(step).length;
      let lead = '';
      if (review && total > 1) {
        if (review.extra > 0) {
          lead = `${plural(review.extra, 'One tile you picked doesn’t', `${review.extra} tiles you picked don’t`)} belong. `;
        } else if (review.missed > 0) {
          lead = `Close! You found ${total - review.missed} of ${total}. `;
        }
      }
      return { tone: 'retry', title: 'Not quite', body: lead + step.hint };
    }
  }
}
