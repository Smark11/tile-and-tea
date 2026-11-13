import type { TileKind } from '../../tiles';
import type { Lesson } from '../types';

const bam = (rank: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9): TileKind => ({ type: 'suited', suit: 'bam', rank });
const crak = (rank: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9): TileKind => ({ type: 'suited', suit: 'crak', rank });
const dot = (rank: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9): TileKind => ({ type: 'suited', suit: 'dot', rank });
const RED: TileKind = { type: 'dragon', dragon: 'red' };
const GREEN: TileKind = { type: 'dragon', dragon: 'green' };
const SOAP: TileKind = { type: 'dragon', dragon: 'white' };
const FLOWER: TileKind = { type: 'flower' };
const JOKER: TileKind = { type: 'joker' };

/**
 * Lesson 1, first cut: what's in the box. M1.3 grows it into the full
 * 3–6 minute lesson; this version proves the lesson engine end to end.
 */
export const meetTheTiles: Lesson = {
  id: 'meet-the-tiles',
  title: 'Meet the tiles',
  summary: 'Suits, winds, dragons, flowers, and jokers.',
  minutes: 3,
  steps: [
    {
      kind: 'text',
      id: 'welcome',
      title: 'What’s in the set',
      body:
        'An American Mah Jongg set has 152 tiles. Most of them belong to three suits. The rest are Winds, Dragons, Flowers, and Jokers.\n\nIn a few minutes you’ll be able to name every one.',
    },
    {
      kind: 'tiles',
      id: 'three-suits',
      title: 'Three suits',
      body:
        'Bams (bamboo), Craks (characters), and Dots (circles). Each suit runs from 1 to 9, with four of every tile.',
      tiles: [bam(2), crak(5), dot(8)],
      caption: '2 Bam, 5 Crak, 8 Dot',
    },
    {
      kind: 'tap',
      id: 'find-the-dot',
      prompt: 'Tap the Dot.',
      choices: [{ tile: bam(3) }, { tile: crak(4) }, { tile: dot(6), correct: true }, { tile: bam(7) }],
      hint: 'Dots are drawn as round coins, like little circles.',
      explanation: 'That’s the 6 Dot: six round coins. Dots are sometimes called circles.',
    },
    {
      kind: 'tiles',
      id: 'one-bam',
      title: 'The 1 Bam is a bird',
      body:
        'Most sets draw the 1 Bam as a bird instead of a single stick of bamboo. It’s still a Bam, and it counts as a 1.',
      tiles: [bam(1), bam(2), bam(3)],
      caption: '1 Bam, 2 Bam, 3 Bam',
    },
    {
      kind: 'tiles',
      id: 'winds-and-dragons',
      title: 'Winds and Dragons',
      body:
        'There are four Winds: North, East, West, and South. There are three Dragons: Red, Green, and White. Everyone calls the White Dragon “Soap.” There are four of each.',
      tiles: [
        { type: 'wind', wind: 'N' },
        { type: 'wind', wind: 'E' },
        { type: 'wind', wind: 'W' },
        { type: 'wind', wind: 'S' },
        RED,
        GREEN,
        SOAP,
      ],
      caption: 'North, East, West, South, Red Dragon, Green Dragon, Soap',
    },
    {
      kind: 'tap',
      id: 'find-the-dragons',
      prompt: 'Tap every Dragon.',
      choices: [
        { tile: RED, correct: true },
        { tile: { type: 'wind', wind: 'N' } },
        { tile: SOAP, correct: true },
        { tile: bam(5) },
        { tile: GREEN, correct: true },
        { tile: { type: 'wind', wind: 'S' } },
      ],
      hint: 'There are three Dragons: Red, Green, and Soap. The Winds wear a letter in the corner.',
      explanation: 'Red, Green, and Soap are the three Dragons. North and South are Winds, and the 5 Bam is a suit tile.',
    },
    {
      kind: 'tiles',
      id: 'flowers-and-jokers',
      title: 'Flowers and Jokers',
      body:
        'A set has 8 Flowers and 8 Jokers. All Flowers count as the same tile, even when the pictures differ.\n\nA Joker can stand in for any tile in a group of three or more. It can never be used as a single tile or in a pair.',
      tiles: [FLOWER, FLOWER, JOKER, JOKER],
      caption: 'Two Flowers and two Jokers',
    },
    {
      kind: 'tap',
      id: 'find-the-joker',
      prompt: 'Tap the Joker.',
      choices: [{ tile: FLOWER }, { tile: SOAP }, { tile: JOKER, correct: true }, { tile: dot(1) }],
      hint: 'Look for the tile with the word on it.',
      explanation: 'That’s the Joker. Jokers are the most useful tiles in the game, which is why there are rules about where they can go.',
    },
    {
      kind: 'text',
      id: 'wrap-up',
      title: 'You know the tiles',
      body:
        'Suits, Winds, Dragons, Flowers, and Jokers: that’s all 152.\n\nNext you’ll learn how tiles group together into pungs, kongs, quints, and pairs.',
    },
  ],
};
