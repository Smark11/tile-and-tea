import type { Lesson } from '../types';

import { EVENS_LINE } from './cardLines';
import { bam, crak, dot, FLOWER, JOKER, NORTH, of, RED, SOAP } from './tiles';

/** Lesson 4: where a Joker can stand in, where it can't, and how to win one back. */
export const jokers: Lesson = {
  id: 'jokers',
  title: 'Jokers',
  summary: 'Where a joker can stand in, and where it can’t.',
  minutes: 4,
  steps: [
    {
      kind: 'text',
      id: 'wild',
      title: 'Eight wild tiles',
      body:
        'There are 8 Jokers in a set, and they’re wild. A Joker can stand in for any tile in a group of three or more: a pung, kong, quint, or sextet.\n\nUsed well, they’re how most hands get finished.',
    },
    {
      kind: 'tiles',
      id: 'joker-groups',
      title: 'Jokers fill groups',
      body: 'Each Joker takes the place of one tile in its group, and a group can hold more than one.',
      tiles: [bam(3), bam(3), JOKER, NORTH, JOKER, JOKER, NORTH],
      groups: [3, 4],
      caption: 'A pung of 3 Bams with one Joker, and a kong of Norths with two Jokers',
    },
    {
      kind: 'tiles',
      id: 'never-pairs',
      title: 'Never a single or a pair',
      body:
        'A Joker can’t be a single tile, and it can’t be part of a pair, not even a pair of Flowers. A Soap and a Joker are not a pair of Soaps.\n\nSo the singles and pairs on a line are the tiles you have to collect for real.',
      tiles: [SOAP, JOKER],
      groups: [2],
      caption: 'A Soap and a Joker, which do not make a pair',
    },
    {
      kind: 'tap',
      id: 'where-jokers-fit',
      prompt: 'Playing this line in Bams, tap every tile a Joker could replace.',
      card: EVENS_LINE,
      choices: [
        { tile: FLOWER, correct: true },
        { tile: bam(2) },
        { tile: bam(4), correct: true },
        { tile: bam(6) },
        { tile: bam(8), correct: true },
      ],
      hint: 'Look for the groups of three or more.',
      explanation:
        'FFF, 444, and 8888 are groups of three or more, so Jokers can fill in there. 22 and 66 are pairs, so they need real 2 and 6 Bams.',
    },
    {
      kind: 'tap',
      id: 'quint-needs-joker',
      prompt: 'Tap the tile that turns this kong into a quint.',
      given: { tiles: of(4, crak(4)), groups: [4], caption: 'A kong of 4 Craks' },
      choices: [{ tile: crak(4) }, { tile: crak(5) }, { tile: JOKER, correct: true }, { tile: dot(4) }],
      hint: 'How many 4 Craks are there in a set?',
      explanation: 'All four 4 Craks are already in the kong, so the fifth tile has to be a Joker.',
    },
    {
      kind: 'text',
      id: 'joker-swap',
      title: 'Winning a Joker back',
      body:
        'When an exposed group on the table holds a Joker, and you hold the real tile it stands for, you may swap: put your tile in its place and take the Joker.\n\nYou can swap from any player’s exposure, your own included. Swap only on your turn, after you draw or call and before you discard. A Joker hidden on someone’s rack can never be taken.',
    },
    {
      kind: 'tiles',
      id: 'swap-picture',
      title: 'A swap in action',
      body: 'Here an exposed pung of 6 Dots holds a Joker. On your turn, your 6 Dot goes into the pung, and the Joker comes to your rack.',
      tiles: [dot(6), JOKER, dot(6), dot(6)],
      groups: [3, 1],
      caption: 'An exposed pung of 6 Dots holding a Joker, and a 6 Dot from your rack',
    },
    {
      kind: 'tap',
      id: 'which-swap',
      prompt: 'It’s your turn. Tap the tile you could trade for that Joker.',
      given: {
        tiles: [crak(9), crak(9), JOKER, crak(9)],
        groups: [4],
        caption: 'Another player’s exposed kong: three 9 Craks and a Joker',
      },
      choices: [{ tile: dot(9) }, { tile: crak(8) }, { tile: crak(9), correct: true }, { tile: RED }],
      hint: 'The Joker is standing in for one tile in particular.',
      explanation: 'The Joker stands for a 9 Crak, so only a 9 Crak can take its place.',
    },
    {
      kind: 'text',
      id: 'treasure-them',
      title: 'Treat Jokers like treasure',
      body:
        'Jokers are precious. Experienced players almost never discard one, and you can never pass one in the Charleston.\n\nWhen you size up a hand, count your Jokers toward its pungs, kongs, and quints, and look at its singles and pairs: those are the tiles you must find for real.',
    },
    {
      kind: 'text',
      id: 'wrap-up',
      title: 'Joker rules in one breath',
      body:
        'Groups of three or more, yes. Singles and pairs, never. Swap one back from any exposure on your turn with the real tile.\n\nNext, the Charleston: how players pass tiles before the game begins.',
    },
  ],
};
