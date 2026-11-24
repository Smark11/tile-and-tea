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
  principle: 'C1',
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
  principle: 'C2',
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
  principle: 'H1',
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
  principle: 'H2',
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
  principle: 'H3',
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
  principle: 'T1',
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
  principle: 'T2',
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

const keepDoorsOpen: Scenario = {
  id: 'keep-doors-open',
  title: 'Keep doors open',
  summary: 'Three passes keep your closest hand. Only one keeps your backups too.',
  stage: 'charleston',
  principle: 'C3',
  skill: 'charleston',
  icon: crak(5),
  story:
    'An odd-numbered deal: a run of Craks from 1 to 9 with the 5 and the 7 doubled, a pair of 3 Dots, and a 7 Bam. Three even tiles sit among them: a 4 Bam, an 8 Bam and an 8 Dot.\n\n13579 #4 wants just one 5 Crak and one 7 Crak, so the second copies look spare. Do you pass them, or the evens?',
  prompt: 'First Charleston. Which three do you pass right?',
  setup: {
    kind: 'charleston',
    rack: [bam(4), bam(7), bam(8), crak(1), crak(3), crak(5), crak(5), crak(7), crak(7), crak(9), dot(3), dot(3), dot(8)],
  },
  move: { tiles: [bam(4), bam(8), dot(8)] },
  strategy: {
    principle: 'On the early passes, keep the tiles that hold your backup hands.',
    body:
      'Pass the evens and 13579 #4 stays six tiles away, the same as if you passed a spare 5 or 7 Crak. The difference is what else stays alive. Those doubled Craks start the 555 and 777 of 13579 #1 (11 333 555 777 999 in one suit) and two pairs of Singles & Pairs #2 (11 33 55 77 99 with a pair of Dragons in each other suit), and the evens touch neither. Keep the pairs, and two more hands sit one tile behind your closest. Pass one, and you’re down to a single plan.\n\nThe Charleston and the first draws change racks fast. A player with three live hands can follow whichever one the wall feeds. A player with one is stuck when it stalls. In our simulator, keeping backup hands won about five more games in a hundred at a Club table, though we couldn’t measure a difference in points, nor at Beginner or Shark tables. So treat it as the tie-break it is: never give up a tile of your closest hand for a backup, but when two passes keep your closest hand equally close, take the one that keeps more doors open.',
    checklist: [
      'Find the passes that keep your closest hand where it is.',
      'Among those, count the other hands each one keeps within a tile.',
      'Pass the tiles no hand wants before you split a pair some backup needs.',
      'By the last pass, usually commit: backups matter most early.',
    ],
  },
};

const bigHandsNeedRealTiles: Scenario = {
  id: 'big-hands-need-real-tiles',
  title: 'Fifty points, one tile further',
  summary: 'The pairs hand pays double and is only a tile behind. Count again.',
  stage: 'hand-choice',
  principle: 'H1',
  skill: 'hand-choice',
  icon: NORTH,
  story:
    'You came out of the Charleston with a wall of Winds: three Norths, two Easts, a West and two Souths. Two Jokers came with them, plus a 1 Crak and a pair of 5 Craks.\n\nWinds & Dragons #1 pays 25. Singles & Pairs #1 (NN EE WW SS and three pairs in a run) pays 50, and it’s only one tile further. Which hand do you go for?',
  prompt: 'Which hand do you go for?',
  setup: {
    kind: 'best-hand',
    rack: [crak(1), crak(5), crak(5), NORTH, NORTH, NORTH, EAST, EAST, WEST, SOUTH, SOUTH, JOKER, JOKER],
    handIds: ['pairs-1', 'honors-1', 'year-3', 'like-2'],
  },
  move: { handId: 'honors-1' },
  strategy: {
    principle: 'Count tiles, not points. A richer hand one tile further is still further.',
    body:
      'Winds & Dragons #1 (NNN EEEE WWWW SSS) is four tiles away, and your two Jokers are already working in it, filling two seats in its kongs. Singles & Pairs #1 is five away, and it needs every one of those five to be an exact tile, since a Joker never fills a pair. Your Jokers would sit there doing nothing.\n\nIt’s tempting to think 50 points is worth a tile. It isn’t. We tested exactly that in our simulator: a player who counts every 10 points over 25 as a tile nearer finishes 11 to 25 fewer hands in a hundred, at every table, and loses 18 to 35 points a game. The big hands it does finish don’t come close to paying for the ones it doesn’t.\n\nGo for the closest hand. If the pairs hand gets closer later, the wall will show you.',
    checklist: [
      'Count each hand’s missing tiles, with your Jokers filling pung and kong seats only.',
      'Take the lowest count, whatever the hand pays.',
      'Treat a concealed or Singles & Pairs hand as further than it looks when you hold Jokers.',
      'Switch only when the other hand is now closer, not just richer.',
    ],
  },
};

const exposuresCountToo: Scenario = {
  id: 'exposures-count-too',
  title: 'Exposures count as gone too',
  summary: 'No 5 Bam in the pile looks like plenty left. Look at the exposures.',
  stage: 'table',
  principle: 'T1',
  skill: 'discards',
  icon: bam(5),
  story:
    'You’re building Consecutive Run #3 (pairs of 3, 4 and 5 in one suit, four Norths, four Souths): pairs of 3 and 4 Bams, a 5 Bam waiting for its partner, all four Norths and two Souths. You’ve just drawn.\n\nThe pile shows no 5 Bam at all, so it feels like there’s plenty of time. But the player on your left has exposed a pung of 5 Bams, all three of them real.',
  prompt: 'Which tile do you throw?',
  setup: {
    kind: 'discard',
    data: {
      rack: [bam(3), bam(3), bam(4), bam(4), bam(5), crak(7), crak(8), dot(4), NORTH, NORTH, NORTH, NORTH, SOUTH, SOUTH],
      discards: [WEST, crak(1), dot(9), GREEN, bam(7), crak(3), dot(1), EAST, FLOWER],
      exposures: [{ seat: 'left', groups: [[bam(5), bam(5), bam(5)], [dot(5), dot(5), dot(5), dot(5)]] }],
    },
  },
  move: { tiles: [bam(5)] },
  strategy: {
    principle: 'Count the exposures as well as the pile. Both are tiles you’ll never draw.',
    body:
      'Your 5 Bam needs a partner, and a Joker can’t be one. There are four 5 Bams: yours, and three in the left player’s pung. None is left to draw, so 3-4-5 in Bams can never be finished, however close it looked.\n\nThe hand isn’t lost, only that version of it. 2-3-4 in Bams uses your 3s and 4s just as well, with all four 2 Bams still unseen. It’s four tiles away, the closest live hand you have, and the 5 Bam plays no part in it. Throw it. It’s a low-risk throw, too: every real 5 Bam is accounted for, so only a player using Jokers, or one waiting on a single 5 Bam, could use it.\n\nPlayers count the pile because it’s in the middle of the table. Exposures are just as gone: judge by the pile here and you’d think three 5 Bams were still out, when in truth none are. In our simulator, counting dead tiles was worth about 6 points a game against Beginners and 4 against Club players. Against Sharks, who count them too, the difference was too small to measure.',
    checklist: [
      'For each single or pair you still need, count the copies in the pile and in every exposure.',
      'Count your own rack too: the copies you hold are gone for everyone else.',
      'When the last copy is gone, look for the same hand in other numbers or suits before you give it up.',
      'Throw the dead tile first: it’s no use to you, and often no use to anyone.',
    ],
  },
};

const stayConcealed: Scenario = {
  id: 'stay-concealed',
  title: 'Not every tile is worth calling',
  summary: 'You can call the 5 Dot. It would cost you your hand.',
  stage: 'table',
  principle: 'T4',
  skill: 'discards',
  icon: dot(5),
  story:
    'Your rack is all pairs: two Norths, two Easts, two Souths, a West, and 5-5 6-6 7 in Dots. That’s Singles & Pairs #1, a concealed hand, two tiles away.\n\nThe player on your left throws a 5 Dot. You hold two, so the table pauses for you. You could call it for a pung.',
  prompt: 'Do you call the 5 Dot?',
  setup: {
    kind: 'call',
    data: {
      rack: [bam(2), dot(5), dot(5), dot(6), dot(6), dot(7), NORTH, NORTH, EAST, EAST, WEST, SOUTH, SOUTH],
      offered: dot(5),
      from: 'left',
      discards: [crak(1), bam(9), GREEN, RED, crak(3)],
      exposures: [],
    },
  },
  move: { action: 'pass' },
  strategy: {
    principle: 'Call a tile only when the exposure brings your hand closer.',
    body:
      'Calling the 5 Dot gives you a pung, but your hand doesn’t want a pung. Singles & Pairs #1 needs the pair of 5s you already have, and it’s concealed: the moment you expose anything, it’s gone. The closest hand that would fit a 5 Dot pung is Like Numbers #2, seven tiles away. Let it go, and you’re still two from 50 points.\n\nA call is never free. It shows the table your hand, it ends every concealed line, and it locks those tiles in. In our simulator, a player who calls any exposure that fits, even when it brings the hand no closer, wins two to four fewer games in a hundred at every table.\n\nBefore you call, ask one question: after this call and a discard, am I closer than I am now? If not, let it go.',
    checklist: [
      'When a tile you could call hits the table, compare your closest hand before and after the call.',
      'A concealed hand ends with any exposure. Count that in.',
      'An exposed pung can’t become a kong later: call for the group your hand prints.',
      'If the call doesn’t bring you closer, let the tile go.',
    ],
  },
};

const callTheKong: Scenario = {
  id: 'call-the-kong',
  title: 'Call for the group your hand needs',
  summary: 'A 9 Crak is up. A pung would cost you; a kong wins the tile.',
  stage: 'table',
  principle: 'T4',
  skill: 'discards',
  icon: crak(9),
  story:
    'You’re two tiles from 13579 #3 (333 5555 in one suit, 777 9999 in another): a pung of 3 Bams, four 5 Bams, a pair of 7 Craks, a pair of 9 Craks and a Joker, plus a North your hand has no use for.\n\nThe player across throws a 9 Crak. You could call it for a pung with your two 9s, or for a kong with your Joker as well.',
  prompt: 'Do you call the 9 Crak?',
  setup: {
    kind: 'call',
    data: {
      rack: [bam(3), bam(3), bam(3), bam(5), bam(5), bam(5), bam(5), crak(7), crak(7), crak(9), crak(9), NORTH, JOKER],
      offered: crak(9),
      from: 'across',
      discards: [EAST, WEST, dot(8), crak(4), bam(1), GREEN, dot(2)],
      exposures: [],
    },
  },
  move: { action: 'kong' },
  strategy: {
    principle: 'When a call brings you closer, take it, and expose exactly the group the hand prints.',
    body:
      'Your hand prints 9999. Call the 9 Crak for a kong, with your two 9s and the Joker, and that group is done: 13579 #3 drops from two tiles away to one. Waiting on the wall for a tile someone just handed you throws away a turn you may not get back.\n\nThe pung is the trap. Expose 999 and it stays a pung: you can’t add to an exposure later, so the 9999 your hand needs is gone, and the closest hand left is eight tiles away.\n\nThis is the other half of “call only when it brings you closer.” In our simulator, the player who calls well (only when it helps) wins two to four more games in a hundred than one who calls whatever fits.',
    checklist: [
      'Find where the tile fits in your closest hand: pung, kong or quint.',
      'Call for that exact size, using real tiles first and Jokers to make up the rest.',
      'Never expose a pung where your hand prints a kong. It can’t grow later.',
      'Count again after the call: you should be a tile closer.',
    ],
  },
};

const takeTheJoker: Scenario = {
  id: 'take-the-joker',
  title: 'Take the Joker',
  summary: 'There’s a Joker in an exposure, and you hold the tile it stands for.',
  stage: 'table',
  principle: 'T5',
  skill: 'discards',
  icon: JOKER,
  story:
    'You’re two tiles from Addition #4 (999 in Bams and Craks, then 1111 and 8888 in Dots): pungs of 9 Bams, 9 Craks, 1 Dots and 8 Dots. You’ve just drawn, and you also hold a 4 Crak and a West that your hand has no use for.\n\nThe player across has exposed a pung of 4 Craks: two real 4s and a Joker.',
  prompt: 'Your turn. Do you swap for the Joker?',
  setup: {
    kind: 'swap',
    data: {
      rack: [bam(9), bam(9), bam(9), crak(4), crak(9), crak(9), crak(9), dot(1), dot(1), dot(1), dot(8), dot(8), dot(8), WEST],
      discards: [NORTH, crak(1), dot(9), GREEN, bam(7), SOUTH, crak(3), dot(2), EAST],
      exposures: [{ seat: 'across', groups: [[crak(4), crak(4), JOKER], [crak(6), crak(6), crak(6), crak(6)]] }],
    },
  },
  move: { action: 'swap-across-0' },
  strategy: {
    principle: 'Swap for an exposed Joker whenever you hold the real tile and it costs your hand nothing.',
    body:
      'On your turn, before you discard, you may give the real tile for any Joker in any exposure. Your 4 Crak was headed for the discard pile anyway. Swap it, and the Joker fills a seat in your 1 Dot or 8 Dot kong: Addition #4 goes from two tiles away to one. Then throw the West.\n\nJokers are the most valuable tiles in the set, and an exposed one is a Joker anyone can claim. In our simulator, swapping whenever it costs nothing won 2 to 12 more games in a hundred, most of all against Beginners, who leave Jokers in their exposures.',
    checklist: [
      'At the start of every turn, scan every exposure, yours included, for Jokers.',
      'If you hold the real tile and your hand doesn’t need it, swap before you discard.',
      'Put the new Joker in a pung, kong or quint seat. It never fills a single or pair.',
      'Do it now: once someone else holds that tile, the Joker is theirs to take.',
    ],
  },
};

const swapTheSpare: Scenario = {
  id: 'swap-the-spare',
  title: 'Swap the spare, not the pair',
  summary: 'Two Jokers on offer. One swap helps; the other only looks like it.',
  stage: 'table',
  principle: 'T5',
  skill: 'discards',
  icon: FLOWER,
  story:
    'You’re two tiles from 2468 #1 (FF, 222 444 in one suit, 666 888 in another): a pair of Flowers, a pung of 2 Bams, two 4 Bams, a pung of 6 Dots and two 8 Dots. You’ve just drawn, and you also hold a 5 Crak and a North.\n\nThere are two Jokers in reach. The player on your left exposed Flowers with a Joker, and the player on your right exposed 5 Craks with a Joker.',
  prompt: 'Your turn. Which Joker, if any, do you take?',
  setup: {
    kind: 'swap',
    data: {
      rack: [bam(2), bam(2), bam(2), bam(4), bam(4), crak(5), dot(6), dot(6), dot(6), dot(8), dot(8), NORTH, FLOWER, FLOWER],
      discards: [WEST, crak(1), dot(9), GREEN, bam(7), SOUTH, crak(3), dot(1), EAST, bam(1)],
      exposures: [
        { seat: 'left', groups: [[FLOWER, FLOWER, FLOWER, JOKER], [SOAP, SOAP, SOAP]] },
        { seat: 'right', groups: [[crak(5), crak(5), JOKER], [bam(9), bam(9), bam(9), bam(9)]] },
      ],
    },
  },
  move: { action: 'swap-right-0' },
  strategy: {
    principle: 'A swap is only free when the tile you give was spare. Never trade away part of a pair.',
    body:
      'Both swaps hand you a Joker that fills your 444 or your 888. But what you give for it matters. The 5 Crak is a spare, so swapping it takes you from two tiles away to one.\n\nThe Flower is half of your FF pair, and a Joker can never fill a pair. Give it up, and the pair needs a real Flower again, so the Joker’s gain is cancelled: you’re still two away, and the trade gains you no ground.\n\nSwapping for exposed Jokers is one of the strongest habits we’ve measured (2 to 12 more wins in a hundred), but only when it costs your hand nothing. Check what the tile was doing before you hand it over.',
    checklist: [
      'List every Joker you could take: you need the exact tile it stands for.',
      'Check what each tile you’d give is doing in your closest hand.',
      'Give a spare, never a tile in a single or pair: a Joker can’t replace it.',
      'With two good swaps, you may take both, one at a time, before you discard.',
    ],
  },
};

export const SCENARIOS: readonly Scenario[] = [
  passWhatTouchesNothing,
  aFlowerIsNotAStray,
  keepDoorsOpen,
  closestBeatsRichest,
  jokersWantBigGroups,
  dragonsHaveSuits,
  bigHandsNeedRealTiles,
  countWhatsGone,
  exposuresCountToo,
  twoExposuresTellAStory,
  stayConcealed,
  callTheKong,
  takeTheJoker,
  swapTheSpare,
];
