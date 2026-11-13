// Card lines the lessons teach with. Each one was written from scratch for
// these lessons, to show one idea clearly. None comes from any published card,
// and they make no claim about what any year's card will hold.

import type { CardLine } from '../types';

/** One suit, with Flowers: groups of every size in a single color. */
export const EVENS_LINE: CardLine = {
  segments: [{ text: 'FFF' }, { text: '22', ink: 1 }, { text: '444', ink: 1 }, { text: '66', ink: 1 }, { text: '8888', ink: 1 }],
  concealed: false,
  value: 25,
  spoken:
    'Pung of Flowers. Then, all in one suit: pair of 2s, pung of 4s, pair of 6s, kong of 8s. Exposed hand allowed, worth 25.',
};

/** Three colors, with Dragons that follow their suit. */
export const LIKE_FIVES_LINE: CardLine = {
  segments: [
    { text: '55', ink: 1 },
    { text: 'DDD', ink: 1 },
    { text: '55', ink: 2 },
    { text: 'DDD', ink: 2 },
    { text: '5555', ink: 3 },
  ],
  note: 'Any like number',
  concealed: false,
  value: 30,
  spoken:
    'In the first suit, pair of 5s and a pung of its Dragon. In the second suit, pair of 5s and a pung of its Dragon. In the third suit, kong of 5s. Any like number. Exposed hand allowed, worth 30.',
};

/** No suits at all, and concealed. */
export const WINDS_LINE: CardLine = {
  segments: [{ text: 'FF' }, { text: 'NNN' }, { text: 'EE' }, { text: 'WWW' }, { text: 'SSSS' }],
  concealed: true,
  value: 35,
  spoken: 'Pair of Flowers, pung of North, pair of East, pung of West, kong of South. Concealed, worth 35.',
};
