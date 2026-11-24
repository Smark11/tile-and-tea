// The scenarios, in the order the Train tab lists them: by stage, easiest
// first. Each one is a real table position, written so that the move it
// teaches is the move the coach's engine calls best (content.test.ts proves
// it), followed by the principle behind that move.
//
// Racks are written in rack order (Bams, Craks, Dots, Winds, Dragons, Flowers,
// Jokers), the way the player sees them. Every tile count stays within one set.
// Hand names in the text ("2468 #3") are the practice card's own; see
// game/card/practice-card-2027.ts.

import { bam, crak, dot, EAST, FLOWER, GREEN, JOKER, NORTH, RED, SOAP, SOUTH, WEST } from '../../lessons/content/tiles';
import type { Scenario } from '../types';

const passWhatTouchesNothing: Scenario = {
  id: 'pass-what-touches-nothing',
  title: 'Pass what touches nothing',
  summary: 'Your first pass: three tiles the rack won’t miss.',
  stage: 'charleston',
  skill: 'charleston',
  icon: crak(1),
  story:
    'The deal is done and your rack is sorted: a pair of 5s in every suit, two Flowers, a North, a Red Dragon, and three loose tiles that sit beside nothing: a 9 Bam, a 1 Crak and a 9 Dot.\n\nThe first Charleston starts now, with three tiles to the player on your right.',
  prompt: 'First Charleston. Which three do you pass right?',
  setup: {
    kind: 'charleston',
    rack: [bam(5), bam(5), bam(9), crak(1), crak(5), crak(5), dot(5), dot(5), dot(9), NORTH, RED, FLOWER, FLOWER],
  },
  move: { tiles: [bam(9), crak(1), dot(9)] },
  strategy: {
    principle: 'Pairs are gold. Pass the tiles that touch nothing.',
    body:
      'A pair can only be finished with real tiles: a Joker never stands in a single or a pair. So every pair you hold is work already done, and a pair of 5s in each suit is well on the way to a Like Numbers hand before the first discard.\n\nThe tiles to pass are the ones none of your hands can use. The 9 Bam, the 1 Crak and the 9 Dot sit beside nothing on this rack. Passing a 5 instead would cost Like Numbers #1 a tile. Passing the North or the Red Dragon keeps that hand but quietly drops a second one (Like Numbers #2 wants Winds, #4 wants Dragons), and on the first pass you want several doors open.\n\nThe Charleston is six or more decisions like this one. Players who pass their loose tiles and keep their pairs reach the first discard with a hand that has a direction, and that is where most games are won.',
    checklist: [
      'Sort the rack and find your pairs and groups first.',
      'Mark the tiles that fit none of your two or three closest hands. Those are the pass.',
      'Jokers can’t be passed, and don’t break a pair to make up three.',
      'If you can’t find three loose tiles, pass the ones that serve only your furthest hand.',
    ],
  },
};

const aFlowerIsNotAStray: Scenario = {
  id: 'a-flower-is-not-a-stray',
  title: 'A Flower is not a stray',
  summary: 'One Flower looks lonely. Sixteen hands disagree.',
  stage: 'charleston',
  skill: 'charleston',
  icon: FLOWER,
  story:
    'Your rack leans hard toward 2468: a pung of 2 Bams, a pair of 4 Bams, pairs of 6 and 8 Craks. Three tiles don’t belong: a 3 Crak, a 1 Dot and a 9 Dot.\n\nThere’s also a single Flower, and it’s tempting to pass it out with the odds and ends.',
  prompt: 'First Charleston. Which three do you pass right?',
  setup: {
    kind: 'charleston',
    rack: [bam(2), bam(2), bam(2), bam(4), bam(4), crak(3), crak(6), crak(6), crak(8), crak(8), dot(1), dot(9), FLOWER],
  },
  move: { tiles: [crak(3), dot(1), dot(9)] },
  strategy: {
    principle: 'A lone Flower is worth more than a lone number.',
    body:
      'Sixteen of the forty hands on the practice card use Flowers, and most of those open with a pair of them. 2468 #1 is one: FF 222 444 666 888. With eight Flowers in the set, a single Flower is one easy tile from a pair. A single 3 Crak is one tile from nothing you’re building.\n\nSo the Flower stays and the three true strays go. Pass the Flower and 2468 #1 drops from four tiles away to five, for nothing in return.\n\nThe habit to build: before you pass a Flower, a Wind or a Dragon, check whether your closest hand prints it. Honor tiles look like clutter in a sorted rack, but they hold more hands together than the numbers do.',
    checklist: [
      'Find your closest hand on the card before the first pass.',
      'Keep every tile that hand prints, Flowers included, even as singles.',
      'Pass numbers that fit none of your hands before you pass a Flower.',
      'Later in the Charleston, once your hand clearly has no Flowers in it, they become fair to pass.',
    ],
  },
};

const closestBeatsRichest: Scenario = {
  id: 'closest-beats-richest',
  title: 'Closest beats richest',
  summary: 'A 25-point hand you finish beats a 50-point hand you don’t.',
  stage: 'hand-choice',
  skill: 'hand-choice',
  icon: bam(5),
  story:
    'The Charleston is over and you’re reading your rack against the card. It’s all odd numbers: pungs of 3 and 5 Bams, a pair of 7 Craks and a pung of 9 Craks, plus a 1 Dot and a North on their way out.\n\nThe 50-point Singles & Pairs line jumps out: 1, 3, 5, 7, 9. So does 13579 #4 at 35 points, with its 333 and 777. Which hand do you commit to?',
  prompt: 'Which hand do you go for?',
  setup: {
    kind: 'best-hand',
    rack: [bam(3), bam(3), bam(3), bam(5), bam(5), bam(5), crak(7), crak(7), crak(9), crak(9), crak(9), dot(1), NORTH],
    handIds: ['pairs-2', 'odds-3', 'odds-4', 'odds-1'],
  },
  move: { handId: 'odds-3' },
  strategy: {
    principle: 'Count tiles, not points. The closest hand is the one you’ll finish.',
    body:
      '13579 #3 (333 5555 777 9999 in two suits) is three tiles away, and every gap is in a pung or a kong, so a Joker fills any of them. The 50-point Singles & Pairs hand is ten tiles away, needs seven exact pairs, and can’t use a Joker at all. You will not get there before someone else goes out.\n\nA hand that pays 25 and finishes wins the round. A hand that pays 50 and doesn’t finish pays everyone else. Over a season, the players who win most are the ones who go out most, and that means chasing the hand your rack is already closest to.\n\nThere is a time for the big hands: when the deal and the Charleston hand you most of one. Otherwise take the sure 25 and let the table chase 50s.',
    checklist: [
      'For each candidate line, count the tiles you still need. The lowest count wins.',
      'Count a Joker as filling any pung, kong or quint, never a single or a pair.',
      'Chase a Singles & Pairs hand only when the Charleston has already handed you most of it.',
      'Switch hands only when a different line is now closer than the one you chose.',
    ],
  },
};

const jokersWantBigGroups: Scenario = {
  id: 'jokers-want-big-groups',
  title: 'Jokers want big groups',
  summary: 'Two Jokers in hand. Which hand lets them work?',
  stage: 'hand-choice',
  skill: 'hand-choice',
  icon: JOKER,
  story:
    'You came out of the Charleston with two Jokers, a pung of 3 Bams, pairs of 3 Craks and 3 Dots, and three Winds: North, East and West. A Flower tags along.\n\nEvery Like Numbers line fits the 3s. Which one makes the most of your Jokers?',
  prompt: 'Which hand do you go for?',
  setup: {
    kind: 'best-hand',
    rack: [bam(3), bam(3), bam(3), crak(3), crak(3), dot(3), dot(3), NORTH, EAST, WEST, FLOWER, JOKER, JOKER],
    handIds: ['like-1', 'like-2', 'like-4', 'pairs-1'],
  },
  move: { handId: 'like-2' },
  strategy: {
    principle: 'Count your Jokers into the distance, then take the closest hand.',
    body:
      'A Joker fills one seat in a group of three or more, and nothing smaller. Like Numbers #2 (NEWS 333 333 3333) has three such groups, and your two Jokers complete the 3 Craks and the 3 Dots on the spot. That leaves a South and one more 3 Dot to find: two tiles away.\n\nLike Numbers #1 (FF 3333 3333 3333) looks richer for Jokers, with five open seats in its kongs. But it needs a second Flower and four more 3s, and your two Jokers cover only two of them: four tiles away. Like Numbers #4 can use your Jokers too, but it wants six Dragons you don’t hold, which leaves it five away. The Singles & Pairs line needs real tiles everywhere, so your Jokers do nothing for it at all.\n\nSo don’t count seats; count tiles, with each Joker taking one gap in a pung, kong or quint. More open seats only matter when two hands come out equally close: then the one with more room for Jokers is easier to finish.',
    checklist: [
      'For each candidate hand, count the tiles still missing.',
      'Take one off for each Joker, but only where the gap is in a pung or bigger, never a single or a pair.',
      'Take the closest hand. Only when two tie, prefer the one with more open pung and kong seats.',
      'Watch exposed Jokers: when you hold the real tile, swap it in on your turn and take the Joker.',
    ],
  },
};

const dragonsHaveSuits: Scenario = {
  id: 'dragons-have-suits',
  title: 'Dragons have suits',
  summary: 'Green goes with Bams, Red with Craks, Soap with Dots. The card counts on it.',
  stage: 'hand-choice',
  skill: 'hand-choice',
  icon: GREEN,
  story:
    'Your rack after the Charleston: a pung of 4 Bams with two Green Dragons, a pung of 8 Craks with two Red Dragons, and three odds and ends: a 1 Dot, a South and a Flower.\n\nOn the card, a D printed in a suit’s color means that suit’s own Dragon.',
  prompt: 'Which hand do you go for?',
  setup: {
    kind: 'best-hand',
    rack: [bam(4), bam(4), bam(4), crak(8), crak(8), crak(8), dot(1), SOUTH, RED, RED, GREEN, GREEN, FLOWER],
    handIds: ['like-4', 'evens-3', 'evens-1', 'honors-2'],
  },
  move: { handId: 'evens-3' },
  strategy: {
    principle: 'Read a Dragon as part of its suit: Green is Bams, Red is Craks, Soap is Dots.',
    body:
      '2468 #3 is printed 4444 DDD in one color and 8888 DDD in another. In Bams and Craks that means four 4 Bams with Green Dragons and four 8 Craks with Red Dragons. Your rack already holds ten of those fourteen tiles, so the line is four away, and every gap is in a kong or a pung where a Joker can help.\n\nLike Numbers #4 also mixes numbers and Dragons, but it wants one number in every suit, and your 4s and 8s don’t match. Winds & Dragons #2 wants kongs of two Dragons with pungs of North and South, so it uses only five of your tiles.\n\nWhenever Dragons land on your rack, ask which suit they belong to and look for the line that prints a D beside that suit’s numbers. Dragons that match your suit are tiles already in place. Dragons that don’t are passes.',
    checklist: [
      'Green Dragon with Bams, Red Dragon with Craks, Soap with Dots.',
      'On a card line, a D takes the color of the numbers it sits beside.',
      'A Dragon that matches your strongest suit stays. One from another suit goes, unless the line prints it.',
      'Soap also plays the zero in year hands, so count it both ways when you read.',
    ],
  },
};

const countWhatsGone: Scenario = {
  id: 'count-whats-gone',
  title: 'Count what’s gone',
  summary: 'The tile you’ve been protecting may already be dead.',
  stage: 'table',
  skill: 'discards',
  icon: SOAP,
  story:
    'Mid-game. You’ve been building 2468 #2 in Bams and Dots: 2 4 6 8 Bams, pungs of 2 and 4 Dots, and a Soap waiting for its pair. You’ve just drawn a 6 Dot.\n\nLook at the discard pile before you throw. Three Soaps are lying in it.',
  prompt: 'Which tile do you throw?',
  setup: {
    kind: 'discard',
    data: {
      rack: [bam(2), bam(4), bam(6), bam(8), crak(6), dot(2), dot(2), dot(2), dot(4), dot(4), dot(4), dot(6), WEST, SOAP],
      discards: [SOAP, NORTH, crak(9), SOAP, bam(1), bam(9), crak(3), SOAP, EAST, dot(1), RED],
      exposures: [{ seat: 'right', groups: [[crak(7), crak(7), crak(7)]] }],
    },
  },
  move: { tiles: [SOAP] },
  strategy: {
    principle: 'Count what’s gone before you count what’s close.',
    body:
      '2468 #2 ends in a pair of Dragons in its second suit, which in Dots means two Soaps. There are four Soaps in the set: you hold one and three are on the table. That pair can never be made, so the hand you’ve been building is dead, however close it looks on your rack.\n\nThe Soap you were protecting is now your freest tile, and 2468 #4 (22 444 66 888 2468) uses almost everything else you hold. It’s four tiles away across Dots, Craks and Bams, and it needs no Soap. Throwing a 2 Bam, a 4 Bam or a 4 Dot instead would pull that live hand a tile further off.\n\nEvery turn, glance at the pile and the exposures for the tiles your singles and pairs still need. The moment the last copy shows up, let the hand go, and let the tile go with it.',
    checklist: [
      'Before each discard, scan the pile and the exposures for the tiles your singles and pairs need.',
      'Four copies of each tile, eight Flowers: when the last one you need is gone, the hand is dead.',
      'Release a dead hand at once. The tiles it was hoarding are usually your safest throws.',
      'Re-read the card for the closest live line, counting only tiles still unseen.',
    ],
  },
};

const twoExposuresTellAStory: Scenario = {
  id: 'two-exposures-tell-a-story',
  title: 'Two exposures tell a story',
  summary: 'Across has a pung of 3 Bams and a kong of 3 Craks. Don’t finish it for them.',
  stage: 'table',
  skill: 'discards',
  icon: dot(3),
  story:
    'You’re two tiles from 2468 #1: FF, 222 and 44 in Bams, 666 and 88 in Dots. You’ve just drawn a 2 Crak, and you also hold a stray 3 Dot.\n\nThe player across has exposed twice: a pung of 3 Bams, then a kong of 3 Craks.',
  prompt: 'Which tile do you throw?',
  setup: {
    kind: 'discard',
    data: {
      rack: [bam(2), bam(2), bam(2), bam(4), bam(4), crak(2), dot(3), dot(6), dot(6), dot(6), dot(8), dot(8), FLOWER, FLOWER],
      discards: [NORTH, WEST, crak(1), dot(9), bam(1), crak(5), dot(7), SOUTH, GREEN, dot(1)],
      exposures: [{ seat: 'across', groups: [[bam(3), bam(3), bam(3)], [crak(3), crak(3), crak(3), crak(3)]] }],
    },
  },
  move: { tiles: [crak(2)] },
  strategy: {
    principle: 'Two exposures narrow a hand to a few lines. Never throw the tile one of them can call.',
    body:
      'One exposure fits many lines. Two tell a story: a pung of 3 Bams and a kong of 3 Craks fit only Like Numbers #2 (NEWS 333 333 3333) and Like Numbers #3 (0000 333 333 3333). Both still need a pung of 3 Dots, so your 3 Dot would be called the moment it touched the table.\n\nThe 2 Crak keeps your hand two tiles away just as well, and neither of those lines has any use for it. Same progress for you, nothing for them. When two throws are equal for your hand, throw the one no exposed hand can use.\n\nThe Winds, the Soaps and the 3 Dots are now hot. Hold them until the game changes, or until your own hand truly needs the room.',
    checklist: [
      'After a player’s second exposure, find the card lines that fit both groups.',
      'List the tiles those lines still need. Those are the hot tiles.',
      'Among throws that keep your hand equally close, choose one no exposed hand can use.',
      'If your only good throw is hot, weigh whether your hand is worth the risk this late.',
    ],
  },
};

export const SCENARIOS: readonly Scenario[] = [
  passWhatTouchesNothing,
  aFlowerIsNotAStray,
  closestBeatsRichest,
  jokersWantBigGroups,
  dragonsHaveSuits,
  countWhatsGone,
  twoExposuresTellAStory,
];
