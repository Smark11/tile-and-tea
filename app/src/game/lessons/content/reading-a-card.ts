import type { Lesson } from '../types';

import { EVENS_LINE, LIKE_FIVES_LINE, WINDS_LINE } from './cardLines';
import { bam, crak, dot, EAST, FLOWER, GREEN, NORTH, of, RED, SOAP, SOUTH, WEST } from './tiles';

/** Lesson 3: how a line on a card describes a hand. */
export const readingACard: Lesson = {
  id: 'reading-a-card',
  title: 'Reading a card',
  summary: 'How each line on a card describes a hand.',
  minutes: 5,
  steps: [
    {
      kind: 'text',
      id: 'the-card',
      title: 'The card lists every winning hand',
      body:
        'In American Mah Jongg you can’t win with just any 14 tiles. You win by completing one of the hands printed on a card, and each line on the card is one hand.\n\nClubs play from a new card every year. Here you’ll learn on the Tile & Tea practice card, written by us. Cards are written the same way from year to year, so what you learn here carries over.',
    },
    {
      kind: 'tiles',
      id: 'a-line-is-a-hand',
      title: 'Each character is one tile',
      body:
        'Numbers are suit tiles, and F is a Flower. Repeats show the size of a group: 444 is a pung of 4s, and 8888 is a kong of 8s. Spaces separate the groups.\n\nCount the characters and you always get 14. Here is this line laid out in Dots.',
      card: EVENS_LINE,
      tiles: [...of(3, FLOWER), ...of(2, dot(2)), ...of(3, dot(4)), ...of(2, dot(6)), ...of(4, dot(8))],
      groups: [3, 2, 3, 2, 4],
      caption: 'Three Flowers, two 2 Dots, three 4 Dots, two 6 Dots, four 8 Dots',
    },
    {
      kind: 'tap',
      id: 'tiles-on-the-line',
      prompt: 'Playing this line in Dots, tap every tile it uses.',
      card: EVENS_LINE,
      choices: [
        { tile: FLOWER, correct: true },
        { tile: dot(3) },
        { tile: dot(2), correct: true },
        { tile: bam(4) },
        { tile: dot(4), correct: true },
        { tile: dot(6), correct: true },
        { tile: crak(8) },
        { tile: dot(8), correct: true },
      ],
      hint: 'The line uses Flowers and four even numbers, all from the same suit.',
      explanation:
        'Flowers, then 2, 4, 6, and 8 Dots. The 3 Dot isn’t on the line, and the 4 Bam and 8 Crak are the right numbers in the wrong suit.',
    },
    {
      kind: 'tiles',
      id: 'colors-are-suits',
      title: 'Colors show suits',
      body:
        'A color doesn’t name a suit. It tells you which groups share one. Everything printed in one color comes from the same suit, and each color is a different suit. You decide which suit goes with which color.\n\nEach color also has its own mark under the group, a circle, a diamond, or a square, so you can tell them apart without color. This line uses all three, played here as Bams, then Craks, then Dots.',
      card: LIKE_FIVES_LINE,
      tiles: [...of(2, bam(5)), ...of(3, GREEN), ...of(2, crak(5)), ...of(3, RED), ...of(4, dot(5))],
      groups: [2, 3, 2, 3, 4],
      caption: 'Two 5 Bams, three Green Dragons, two 5 Craks, three Red Dragons, four 5 Dots',
    },
    {
      kind: 'tiles',
      id: 'dragon-partners',
      title: 'Each suit has a Dragon',
      body:
        'D means a Dragon. Printed in a suit’s color, it means that suit’s own Dragon: Green goes with Bams, Red with Craks, and Soap with Dots.',
      tiles: [GREEN, bam(5), RED, crak(5), SOAP, dot(5)],
      groups: [2, 2, 2],
      caption: 'Green Dragon with Bams, Red Dragon with Craks, Soap with Dots',
    },
    {
      kind: 'tap',
      id: 'crak-dragon',
      prompt: 'You play the first color as Craks. Which Dragon fills its DDD?',
      card: LIKE_FIVES_LINE,
      choices: [{ tile: GREEN }, { tile: SOAP }, { tile: RED, correct: true }, { tile: NORTH }],
      hint: 'Each suit has a Dragon partner. Which one goes with Craks?',
      explanation: 'Red is the Craks’ Dragon, so a DDD in the Crak color is a pung of Red Dragons.',
    },
    {
      kind: 'tap',
      id: 'which-dragons',
      prompt: 'Played as Bams, Craks, then Dots, tap every Dragon this line uses.',
      card: LIKE_FIVES_LINE,
      choices: [{ tile: GREEN, correct: true }, { tile: RED, correct: true }, { tile: SOAP }, { tile: NORTH }],
      hint: 'Look at which colors have a DDD, and which one ends with 5555 instead.',
      explanation:
        'The Bam color has a pung of Green Dragons and the Crak color has a pung of Reds. The Dot color is only a kong of 5s, so no Soap.',
    },
    {
      kind: 'text',
      id: 'fine-print',
      title: 'Read the fine print',
      body:
        'Some lines carry a note. “Any like number” means every number on the line is the same, and you pick which one. That line could just as well be played with 8s instead of 5s.\n\nYou’ll also see notes like “Any 3 consecutive numbers,” where the line shows one example and you choose the run.',
    },
    {
      kind: 'tiles',
      id: 'letters-and-zero',
      title: 'Letters, and a zero',
      body:
        'N, E, W, and S are the Winds. F is a Flower.\n\nOne more: a year line uses 0, and the Soap plays the zero. That’s why the Soap does double duty as a Dragon and as a 0.',
      tiles: [crak(2), SOAP, crak(2), crak(7)],
      caption: '2 Crak, Soap, 2 Crak, 7 Crak: the year 2027 in tiles',
    },
    {
      kind: 'tiles',
      id: 'x-or-c',
      title: 'X or C, and the value',
      body:
        'The end of a line tells you two things.\n\nX means you may expose: call other players’ discards to finish a pung, kong, or quint, and lay it face up. C means concealed: you build the whole hand on your rack, and the only discard you may call is your last tile, for Mah Jongg.\n\nThe number is what the hand is worth. Harder hands pay more.',
      card: WINDS_LINE,
      tiles: [...of(2, FLOWER), ...of(3, NORTH), ...of(2, EAST), ...of(3, WEST), ...of(4, SOUTH)],
      groups: [2, 3, 2, 3, 4],
      caption: 'Two Flowers, three Norths, two Easts, three Wests, four Souths',
    },
    {
      kind: 'tap',
      id: 'find-the-pairs',
      prompt: 'Tap every tile this line needs exactly a pair of.',
      card: WINDS_LINE,
      choices: [
        { tile: NORTH },
        { tile: EAST, correct: true },
        { tile: WEST },
        { tile: FLOWER, correct: true },
        { tile: SOUTH },
        { tile: SOAP },
      ],
      hint: 'A pair is printed as two of the same letter.',
      explanation: 'FF and EE are the pairs. NNN and WWW are pungs, SSSS is a kong, and there’s no Soap on this line.',
    },
    {
      kind: 'text',
      id: 'wrap-up',
      title: 'Three looks at every line',
      body:
        'First the groups: what each character is, and how many. Then the colors: which groups share a suit. Then the end: X or C, and what it pays.\n\nNext you’ll learn exactly where Jokers can help you finish a line.',
    },
  ],
};
