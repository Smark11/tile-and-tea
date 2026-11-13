// The Tile & Tea 2027 Practice Card.
//
// Every hand here was written from scratch for this app. None was copied,
// adapted, or "projected" from any National Mah Jongg League card, of any
// year, and the card makes no claim about what any official card holds
// (docs/BUSINESS.md §4). It shares only the generic category names that every
// American Mah Jongg player knows.
//
// Notation: see ./notation.ts. Values: exposed hands pay 25–35, quints (which
// always need Jokers) pay more, and concealed singles-and-pairs hands, which
// can't use a Joker at all, pay the most.
//
// Next year, copy this file to practice-card-2028.ts, write fresh hands, and
// point CURRENT_CARD (./index.ts) at it. Hand ids are only stable within one card.

import type { CardDef } from './types';

export const PRACTICE_CARD_2027: CardDef = {
  year: 2027,
  title: '2027 Practice Card',
  categories: [
    {
      id: 'year',
      title: '2027',
      blurb: 'Hands built from the year: 2s, 7s, and the Soap as the zero.',
      hands: [
        { id: 'year-1', notation: '222:a 0000 222:b 7777:c', note: 'Any 3 suits', concealed: false, value: 25 },
        { id: 'year-2', notation: 'FFFF 2027:a 222:b 777:b', note: 'Any 2 suits', concealed: false, value: 25 },
        { id: 'year-3', notation: '2027:a NNNN EEE SSS', note: 'Any 1 suit', concealed: false, value: 30 },
        { id: 'year-4', notation: 'FF 2027:a 2027:b 2027:c', note: 'The year in all 3 suits', concealed: true, value: 50 },
      ],
    },
    {
      id: 'evens',
      title: '2468',
      blurb: 'Even numbers only.',
      hands: [
        { id: 'evens-1', notation: 'FF 222:a 444:a 666:b 888:b', note: 'Any 2 suits', concealed: false, value: 25 },
        { id: 'evens-2', notation: '2468:a 2222:b 4444:b DD:b', note: 'Any 2 suits', concealed: false, value: 30 },
        { id: 'evens-3', notation: '4444:a DDD:a 8888:b DDD:b', note: 'Any 2 suits, each with its own Dragon', concealed: false, value: 30 },
        { id: 'evens-4', notation: '22:a 444:a 66:b 888:b 2468:c', note: 'Any 3 suits', concealed: false, value: 35 },
      ],
    },
    {
      id: 'like-numbers',
      title: 'Like Numbers',
      blurb: 'One number, chosen by you, in every suit.',
      hands: [
        { id: 'like-1', notation: 'FF xxxx:a xxxx:b xxxx:c', note: 'Any like number', concealed: false, value: 25 },
        { id: 'like-2', notation: 'NEWS xxx:a xxx:b xxxx:c', note: 'Any like number', concealed: false, value: 30 },
        { id: 'like-3', notation: '0000 xxx:a xxx:b xxxx:c', note: 'Any like number', concealed: false, value: 30 },
        { id: 'like-4', notation: 'xxx:a DDD:a xxx:b DDD:b xx:c', note: 'Any like number, with Dragons of the first 2 suits', concealed: false, value: 30 },
      ],
    },
    {
      id: 'addition',
      title: 'Addition',
      blurb: 'Each line is a sum you can lay out in tiles.',
      hands: [
        { id: 'addition-1', notation: 'FF 3333:a 4444:a 7777:a', note: '3 + 4 = 7', concealed: false, value: 25 },
        { id: 'addition-2', notation: '222:a 666:a 8888:a DDDD:a', note: '2 + 6 = 8', concealed: false, value: 30 },
        { id: 'addition-3', notation: 'FF 555:a 777:a 111:b 222:b', note: '5 + 7 = 12, the 12 in a second suit', concealed: false, value: 30 },
        { id: 'addition-4', notation: '999:a 999:b 1111:c 8888:c', note: '9 + 9 = 18, the 18 in the third suit', concealed: false, value: 35 },
      ],
    },
    {
      id: 'quints',
      title: 'Quints',
      blurb: 'Five of one tile. Every suited quint needs at least one Joker.',
      hands: [
        { id: 'quints-1', notation: 'xxxxx:a FFFF xxxxx:b', note: 'Any like number, any 2 suits', concealed: false, value: 40 },
        { id: 'quints-2', notation: 'DDDDD:a NNNN FFFFF', note: 'Any Dragon', concealed: false, value: 40 },
        { id: 'quints-3', notation: '22222:a 0000 77777:b', note: 'Any 2 suits', concealed: false, value: 45 },
        { id: 'quints-4', notation: 'xxxxx:a xxxx+1:b xxxxx+2:a', note: 'Any 3 consecutive numbers, the middle one in a second suit', concealed: false, value: 45 },
      ],
    },
    {
      id: 'runs',
      title: 'Consecutive Run',
      blurb: 'Numbers in a row, starting wherever you like.',
      hands: [
        { id: 'runs-1', notation: 'xxx:a xxxx+1:a xxx+2:a xxxx+3:a', note: 'Any 4 consecutive numbers', concealed: false, value: 25 },
        { id: 'runs-2', notation: 'FF xxxx:a xxxx+1:b xxxx+2:c', note: 'Any 3 consecutive numbers', concealed: false, value: 25 },
        { id: 'runs-3', notation: 'xx:a xx+1:a xx+2:a NNNN SSSS', note: 'Any 3 consecutive numbers', concealed: false, value: 30 },
        { id: 'runs-4', notation: 'xxxx:a DDD:b xxxx+1:a DDD:c', note: 'Any 2 consecutive numbers, with Dragons of the other 2 suits', concealed: false, value: 30 },
      ],
    },
    {
      id: 'odds',
      title: '13579',
      blurb: 'Odd numbers only.',
      hands: [
        { id: 'odds-1', notation: '11:a 333:a 555:a 777:a 999:a', concealed: false, value: 25 },
        { id: 'odds-2', notation: 'FF 1111:a 5555:b 9999:c', note: 'Any 3 suits', concealed: false, value: 25 },
        { id: 'odds-3', notation: '333:a 5555:a 777:b 9999:b', note: 'Any 2 suits', concealed: false, value: 25 },
        { id: 'odds-4', notation: '13579:a 333:b 777:c FFF', note: 'Any 3 suits', concealed: false, value: 35 },
      ],
    },
    {
      id: 'winds-dragons',
      title: 'Winds & Dragons',
      blurb: 'No numbers at all.',
      hands: [
        { id: 'honors-1', notation: 'NNN EEEE WWWW SSS', concealed: false, value: 25 },
        { id: 'honors-2', notation: 'NNN SSS DDDD:a DDDD:b', note: 'Any 2 Dragons', concealed: false, value: 25 },
        { id: 'honors-3', notation: 'EEE WWW DD:a DDD:b DDD:c', note: 'All 3 Dragons', concealed: false, value: 30 },
        { id: 'honors-4', notation: 'FF DDDD:a NEWS DDDD:b', note: 'Any 2 Dragons', concealed: false, value: 30 },
      ],
    },
    {
      id: 'threes',
      title: '369',
      blurb: 'Only 3s, 6s and 9s.',
      hands: [
        { id: 'threes-1', notation: 'FFF 3333:a 666:b 9999:c', note: 'Any 3 suits', concealed: false, value: 25 },
        { id: 'threes-2', notation: '333:a 666:a 9999:a DDDD:a', concealed: false, value: 30 },
        { id: 'threes-3', notation: '33:a 66:a 99:a 3333:b 6666:c', note: 'Any 3 suits', concealed: false, value: 30 },
        { id: 'threes-4', notation: '333:a 666:a 999:a FFFFF', concealed: false, value: 35 },
      ],
    },
    {
      id: 'singles-pairs',
      title: 'Singles & Pairs',
      blurb: 'No pungs, so no Jokers. Always concealed.',
      hands: [
        { id: 'pairs-1', notation: 'NN EE WW SS xx:a xx+1:a xx+2:a', note: 'Any 3 consecutive numbers', concealed: true, value: 50 },
        { id: 'pairs-2', notation: '11:a 33:a 55:a 77:a 99:a DD:b DD:c', note: 'Any 3 suits', concealed: true, value: 50 },
        { id: 'pairs-3', notation: 'FF xx:a xx+1:a xx+2:a xx:b xx+1:b xx+2:b', note: 'Any 3 consecutive numbers in 2 suits', concealed: true, value: 50 },
        { id: 'pairs-4', notation: 'FF 2468:a 2468:b DD:a DD:b', note: 'Any 2 suits, each with its own Dragon', concealed: true, value: 50 },
      ],
    },
  ],
};
