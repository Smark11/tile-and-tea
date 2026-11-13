import type { Lesson } from '../types';

import { bam, crak, dot, FLOWER, GREEN, JOKER, NORTH, of, SOAP } from './tiles';

/** Lesson 2: the groups every hand is built from. */
export const groups: Lesson = {
  id: 'groups',
  title: 'Pungs, kongs, quints & pairs',
  summary: 'The groups every hand is built from.',
  minutes: 4,
  steps: [
    {
      kind: 'text',
      id: 'building-blocks',
      title: 'Hands are built from groups',
      body:
        'A winning hand is 14 tiles. You don’t collect them one by one at random: you build them into groups of identical tiles.\n\nEach group has a name. Learn five words and you can read any hand.',
    },
    {
      kind: 'tiles',
      id: 'singles-and-pairs',
      title: 'Singles and pairs',
      body:
        'A single is one tile on its own. A pair is two identical tiles.\n\n“Identical” means the same suit and the same number, or the same Wind or Dragon. Two 5 Dots are a pair. A 5 Dot and a 5 Bam are not.',
      tiles: [GREEN, dot(5), dot(5)],
      groups: [1, 2],
      caption: 'A single Green Dragon, and a pair of 5 Dots',
    },
    {
      kind: 'tiles',
      id: 'pung',
      title: 'Pung: three of a kind',
      body: 'Three identical tiles make a pung. It rhymes with “sung.”',
      tiles: of(3, crak(2)),
      groups: [3],
      caption: 'A pung of 2 Craks',
    },
    {
      kind: 'tap',
      id: 'make-a-pung',
      prompt: 'Tap every tile that turns this pair into a pung.',
      given: { tiles: of(2, dot(7)), groups: [2], caption: 'A pair of 7 Dots' },
      choices: [
        { tile: dot(8) },
        { tile: dot(7), correct: true },
        { tile: bam(7) },
        { tile: JOKER, correct: true },
        { tile: crak(7) },
      ],
      hint: 'A pung is three identical tiles, and one tile in the set is allowed to stand in for any of them.',
      explanation:
        'A third 7 Dot makes a pung. So does a Joker: Jokers can fill in for any tile in a group of three or more. The 7 Bam and 7 Crak are the right number but the wrong suit.',
    },
    {
      kind: 'tiles',
      id: 'kong',
      title: 'Kong: four of a kind',
      body: 'Four identical tiles make a kong. Every suit tile, Wind, and Dragon comes four to a set, so a kong can be made of all four real tiles.',
      tiles: of(4, NORTH),
      groups: [4],
      caption: 'A kong of North Winds',
    },
    {
      kind: 'tap',
      id: 'make-a-kong',
      prompt: 'Tap every tile that turns this pung into a kong.',
      given: { tiles: of(3, bam(9)), groups: [3], caption: 'A pung of 9 Bams' },
      choices: [
        { tile: bam(8) },
        { tile: JOKER, correct: true },
        { tile: dot(9) },
        { tile: bam(9), correct: true },
      ],
      hint: 'A kong is four identical tiles. Which tiles match a 9 Bam?',
      explanation: 'The last 9 Bam makes a kong of four real tiles, and a Joker works too. The 8 Bam is one number off, and the 9 Dot is another suit.',
    },
    {
      kind: 'tiles',
      id: 'quint',
      title: 'Quint: five of a kind',
      body:
        'Five identical tiles make a quint. There are only four of each suit tile, Wind, and Dragon, so a quint of them always needs at least one Joker.\n\nFlowers are the exception: there are eight, so five Flowers can be all real.\n\nA few hands even ask for a sextet: six of a kind.',
      tiles: [...of(4, crak(4)), JOKER],
      groups: [5],
      caption: 'A quint: four 4 Craks and a Joker',
    },
    {
      kind: 'tap',
      id: 'pair-the-five',
      prompt: 'Tap the tile that makes a pair with this 5 Dot.',
      given: { tiles: [dot(5)], caption: 'A single 5 Dot' },
      choices: [{ tile: bam(5) }, { tile: JOKER }, { tile: dot(5), correct: true }, { tile: dot(6) }],
      hint: 'A pair is two identical tiles, and the Joker has a rule about pairs.',
      explanation:
        'Only another 5 Dot makes this pair. A Joker can’t, because Jokers are never used in a pair or as a single.',
    },
    {
      kind: 'tiles',
      id: 'honor-groups',
      title: 'Winds, Dragons, and Flowers group too',
      body:
        'Groups aren’t only for numbers. Three Soaps are a pung, just like three 2 Craks.\n\nAny Flower matches any other Flower, even with a different picture, so two Flowers are a pair.',
      tiles: [...of(3, SOAP), FLOWER, FLOWER],
      groups: [3, 2],
      caption: 'A pung of Soaps, and a pair of Flowers',
    },
    {
      kind: 'tap',
      id: 'pair-of-flowers',
      prompt: 'Tap every tile that would make a pair with a Flower.',
      choices: [
        { tile: FLOWER, correct: true },
        { tile: SOAP },
        { tile: JOKER },
        { tile: FLOWER, correct: true },
        { tile: GREEN },
      ],
      hint: 'Flowers all count as the same tile, whatever picture they show.',
      explanation:
        'Both Flowers work, even though their pictures differ. The Joker can’t join a pair, and the Dragons aren’t Flowers.',
    },
    {
      kind: 'text',
      id: 'wrap-up',
      title: 'Five words',
      body:
        'Single, pair, pung, kong, quint. A pung is three, a kong four, a quint five.\n\nJokers can join a pung, kong, quint, or sextet, but never a single or a pair.\n\nNext you’ll see how a card writes these groups down.',
    },
  ],
};
