import type { Lesson } from '../types';

import { EVENS_LINE } from './cardLines';
import { bam, crak, dot, EAST, FLOWER, JOKER, NORTH, SOAP, SOUTH, WEST } from './tiles';

/** Lesson 5: the passes before the first discard. */
export const charleston: Lesson = {
  id: 'charleston',
  title: 'The Charleston',
  summary: 'Passing tiles before the first discard.',
  minutes: 5,
  steps: [
    {
      kind: 'text',
      id: 'why-pass',
      title: 'Trade before you play',
      body:
        'Everyone is dealt 13 tiles, and East gets 14. Before anyone discards, the players pass tiles they don’t want to each other. This is the Charleston, and it’s your best chance to shape your hand.\n\nEvery pass is three tiles, face down. Pass yours before you pick up the ones coming to you.',
    },
    {
      kind: 'text',
      id: 'first-charleston',
      title: 'The first Charleston: right, across, left',
      body:
        'The first Charleston is required, and has three passes.\n\nFirst, pass three tiles to the player on your right. Next, three to the player across from you. Last, three to the player on your left.',
    },
    {
      kind: 'tap',
      id: 'pass-right',
      prompt: 'You sit East. Tap the seat your first pass goes to.',
      given: { tiles: [EAST], caption: 'Your seat: East' },
      choices: [{ tile: NORTH }, { tile: WEST }, { tile: SOUTH, correct: true }],
      hint: 'The first pass goes right, the same way play moves around the table.',
      explanation: 'South sits on East’s right, so your first pass goes to South. West is across from you, and North is on your left.',
    },
    {
      kind: 'text',
      id: 'second-charleston',
      title: 'The second Charleston: left, across, right',
      body:
        'Then comes a second Charleston: the first one in reverse. Pass left, then across, then right.\n\nThe second Charleston is optional. If any player wants to stop after the first, there is no second.',
    },
    {
      kind: 'text',
      id: 'blind-pass',
      title: 'The blind pass',
      body:
        'The last pass of each Charleston (the first left, and the second right) may be blind. Instead of giving up tiles from your rack, you can pass along one, two, or all three of the tiles coming to you without looking at them, and make up the rest from your rack.\n\nIt’s handy when your hand is coming together and you’d rather not break it up.',
    },
    {
      kind: 'text',
      id: 'courtesy-pass',
      title: 'The courtesy pass',
      body:
        'Last of all, you and the player across from you may trade a few more tiles: none, one, two, or three. You each say how many you’d like to pass, and if you disagree, you both pass the smaller number.\n\nThen East discards first, and play begins.',
    },
    {
      kind: 'tap',
      id: 'never-pass',
      prompt: 'Tap the tile you may never pass.',
      choices: [{ tile: FLOWER }, { tile: SOAP }, { tile: JOKER, correct: true }, { tile: bam(1) }],
      hint: 'One tile is so valuable that the rules keep it on your rack.',
      explanation: 'Jokers may never be passed in the Charleston. Flowers, Dragons, and suit tiles can all go.',
    },
    {
      kind: 'tap',
      id: 'choose-a-pass',
      prompt: 'You’re going for this line in Dots. Tap the three tiles to pass.',
      card: EVENS_LINE,
      choices: [
        { tile: dot(4) },
        { tile: bam(9), correct: true },
        { tile: FLOWER },
        { tile: JOKER },
        { tile: NORTH, correct: true },
        { tile: dot(8) },
        { tile: crak(5), correct: true },
        { tile: dot(2) },
      ],
      hint: 'Pass the tiles the line can’t use. One tile here isn’t on the line, but it can’t be passed and you’d want it anyway.',
      explanation:
        'The 9 Bam, North, and 5 Crak have no place on this line. Keep the Flower and the 2, 4, and 8 Dots. The Joker stays too: it can’t be passed, and it could fill your FFF, 444, or 8888.',
    },
    {
      kind: 'text',
      id: 'pass-wisely',
      title: 'Passing wisely',
      body:
        'Early on, pass tiles that fit none of the hands you’re thinking about. Hold on to pairs and to tiles that fit several hands at once, since they keep your options open.\n\nWatch what comes to you, too. A pass can point you toward a better hand than the one you started with.',
    },
    {
      kind: 'text',
      id: 'wrap-up',
      title: 'Ready for the table',
      body:
        'Right, across, left. Then, if everyone agrees, left, across, right. Then a courtesy pass across. Never a Joker.\n\nYou now know the tiles, the groups, the card, the Jokers, and the Charleston: the foundations every game is built on.',
    },
  ],
};
