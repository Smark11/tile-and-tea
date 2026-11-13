// "Name that hand": a finished Mah Jongg is laid out on the felt, and the
// player picks the card line it makes from three that look alike. It trains
// the core card-reading move: mapping a line's suit colors, its printed 1s and
// its Jokers onto real tiles.
//
// Every question is built from the practice card (never any other card), and
// the matcher checks it: the answer completes the tiles, and no distractor does.

import { CURRENT_CARD, findMahJongg, handDistance, matchHand, variantsOf, type Hand, type PracticeCard } from '../../card';
import { PRINTED_X } from '../../card/notation';
import { SUIT_VARS, type SuitVar } from '../../card/types';
import { createRng, shuffle, type Rng } from '../../rng';
import { copiesOf, SUIT_DRAGON, tileKey, type Suit, type TileKind } from '../../tiles';
import type { Drill, DrillEvaluation, DrillQuestion } from '../types';
import { capitalize, COUNT_WORDS, groupName, handById, handLabel, list, plural, SUIT_PLURAL } from './words';

export type NameTheHandData = {
  /** The tiles, in printed order (each unit's real tiles, then its Jokers). */
  readonly tiles: readonly TileKind[];
  /** The hand each choice shows, by id. */
  readonly handIds: readonly string[];
  /** Index of the line the tiles make. */
  readonly answer: number;
};

const CHOICES = 3;
/** Extra Jokers sprinkled into pungs and bigger, beyond any a quint needs. */
const EXTRA_JOKERS = [0, 0, 1, 1, 2] as const;

const ORDINAL: Record<SuitVar, string> = { a: 'first', b: 'second', c: 'third' };

function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)];
}

type DealtUnit = { kind: TileKind; count: number; jokers: number };

/**
 * One variant of `hand` as real tiles. Jokers go only into groups of three or
 * more, each group keeps at least one real tile (so it can be read), and no
 * tile is used more often than a set holds.
 */
function dealHand(hand: Hand, rng: Rng): DealtUnit[] {
  const variant = pick(variantsOf(hand), rng);
  const units: DealtUnit[] = variant.units.map((u) => ({ kind: u.kind, count: u.count, jokers: 0 }));
  // Jokers a set forces: a quint of a number needs one, and so does any tile used past its copies.
  const used = new Map<string, number>();
  for (const unit of units) {
    const key = tileKey(unit.kind);
    const have = copiesOf(unit.kind) - (used.get(key) ?? 0);
    unit.jokers = Math.max(0, unit.count - have);
    used.set(key, (used.get(key) ?? 0) + unit.count - unit.jokers);
  }
  for (let extra = pick(EXTRA_JOKERS, rng); extra > 0; extra--) {
    const room = units.filter((u) => u.count >= 3 && u.jokers < u.count - 1);
    if (room.length === 0) break;
    pick(room, rng).jokers++;
  }
  return units;
}

/** What the felt shows, read aloud in place of fourteen tile names. */
function caption(units: readonly DealtUnit[]): string {
  return units
    .map((u) => {
      const name = groupName(u.kind, u.count);
      if (u.jokers === 0) return capitalize(name);
      return `${capitalize(name)} with ${COUNT_WORDS[u.jokers]} ${u.jokers === 1 ? 'Joker' : 'Jokers'}`;
    })
    .join('; ');
}

/**
 * The lines most easily mistaken for the answer: hands from the same section
 * first, then the hands these tiles come closest to. None of them may be made
 * by the tiles too.
 */
function distractors(answer: Hand, tiles: readonly TileKind[], made: ReadonlySet<string>, rng: Rng, card: PracticeCard): Hand[] {
  const ranked = card.hands
    .filter((h) => !made.has(h.id))
    .map((hand) => {
      const reach = handDistance(hand, { concealed: tiles });
      return { hand, same: hand.category === answer.category ? 0 : 1, away: reach.tilesAway ?? 99 };
    })
    .sort((a, b) => a.same - b.same || a.away - b.away);
  // A little variety: two of the four most alike.
  return shuffle(ranked.slice(0, 4), rng)
    .slice(0, CHOICES - 1)
    .map((r) => r.hand);
}

export function generateNameTheHand(seed: number, card: PracticeCard = CURRENT_CARD): DrillQuestion<NameTheHandData> {
  const rng = createRng(seed);
  const hand = pick(card.hands, rng);
  const units = dealHand(hand, rng);
  const tiles: TileKind[] = units.flatMap((u) => [
    ...Array.from({ length: u.count - u.jokers }, () => u.kind),
    ...Array.from({ length: u.jokers }, (): TileKind => ({ type: 'joker' })),
  ]);
  const made = new Set(findMahJongg({ concealed: tiles }, card).map((m) => m.hand.id));
  if (!made.has(hand.id)) throw new Error(`Dealt tiles don't make ${hand.id}`);

  const hands = shuffle([hand, ...distractors(hand, tiles, made, rng, card)], rng);
  // Tiles sit in the hand's printed groups, so "2027" reads as one group.
  const groups: number[] = [];
  let unit = 0;
  for (const group of hand.groups) {
    groups.push(group.units.reduce((sum) => sum + units[unit++].count, 0));
  }
  return {
    seed,
    key: `${hand.id}|${tiles.map(tileKey).sort().join(',')}`,
    prompt: 'Which hand do these tiles make?',
    scene: { tiles, groups, caption: caption(units) },
    choices: hands.map((h) => ({ kind: 'line', line: h.line, label: handLabel(h, card) })),
    picks: 1,
    data: { tiles, handIds: hands.map((h) => h.id), answer: hands.indexOf(hand) },
  };
}

/** The suit variables a hand uses for numbers, and those it uses for Dragons. */
function suitRoles(hand: Hand): { numbers: Set<SuitVar>; dragons: Set<SuitVar> } {
  const numbers = new Set<SuitVar>();
  const dragons = new Set<SuitVar>();
  for (const group of hand.groups) {
    for (const { tile } of group.units) {
      if (tile.type === 'number' || tile.type === 'numberVar') numbers.add(tile.suit);
      if (tile.type === 'dragonOf') dragons.add(tile.suit);
    }
  }
  return { numbers, dragons };
}

/** "the first suit is Craks and the second suit is Dots", for the suits that carry numbers. */
function suitSentence(vars: ReadonlySet<SuitVar>, suits: Partial<Record<SuitVar, Suit>>): string | null {
  const used = SUIT_VARS.filter((v) => vars.has(v) && suits[v]);
  if (used.length === 0) return null;
  if (used.length === 1) return `its suit is ${SUIT_PLURAL[suits[used[0]] as Suit]}`;
  return list(used.map((v) => `the ${ORDINAL[v]} suit is ${SUIT_PLURAL[suits[v] as Suit]}`));
}

/** Which Dragons the tiles use, and how they tie to the suits. */
function dragonSentence(hand: Hand, suits: Partial<Record<SuitVar, Suit>>): string | null {
  const { numbers, dragons } = suitRoles(hand);
  const used = SUIT_VARS.filter((v) => dragons.has(v) && suits[v]);
  if (used.length === 0) return null;
  const dragonOf = (v: SuitVar) => plural({ type: 'dragon', dragon: SUIT_DRAGON[suits[v] as Suit] });
  if (numbers.size === 0) {
    return `With no numbers to match, the Dragons are yours to choose: here, ${list(used.map(dragonOf))}.`;
  }
  const pairs = (vars: SuitVar[]) => list(vars.map((v) => `${dragonOf(v)} with ${SUIT_PLURAL[suits[v] as Suit]}`));
  const partnered = used.filter((v) => numbers.has(v));
  const others = used.filter((v) => !numbers.has(v));
  const sentences: string[] = [];
  if (partnered.length > 0) sentences.push(`Each Dragon goes with its own suit: ${pairs(partnered)}.`);
  if (others.length > 0) {
    sentences.push(
      `${partnered.length > 0 ? 'The other' : 'The'} Dragons belong to the ${others.length === 1 ? 'suit' : 'suits'} the numbers don’t use: ${pairs(others)}.`,
    );
  }
  return sentences.join(' ');
}

/** Why the answer is the answer: suits, the chosen number, and where Jokers stand in. */
export function explainMatch(hand: Hand, tiles: readonly TileKind[], card: PracticeCard = CURRENT_CARD): string {
  const match = matchHand(hand, { concealed: tiles });
  if (!match) throw new Error(`${hand.id} doesn't match the tiles`);
  const sentences: string[] = [];
  const suits = suitSentence(suitRoles(hand).numbers, match.variant.suits);
  sentences.push(`These tiles make ${handLabel(hand, card)}${suits ? `: ${suits}` : ''}.`);
  const dragons = dragonSentence(hand, match.variant.suits);
  if (dragons) sentences.push(dragons);
  const x = match.variant.x;
  if (x !== null && x !== PRINTED_X && hand.note) {
    sentences.push(
      `The card prints its numbers from ${PRINTED_X}, and the note, “${hand.note},” lets them start at ${x} instead.`,
    );
  }
  const joked = match.units.filter((u) => u.jokers > 0);
  if (joked.length > 0) {
    const where = joked.map((u) => `${u.jokers === 1 ? 'one' : COUNT_WORDS[u.jokers]} in the ${groupName(u.kind, u.count)}`);
    const total = match.jokers;
    sentences.push(
      `${total === 1 ? 'The Joker stands' : 'The Jokers stand'} in for real tiles: ${where.join(' and ')}. A Joker can fill a pung, kong or quint, never a single or a pair.`,
    );
  }
  return sentences.join(' ');
}

/** Why a picked line isn't it: what it would still need from these tiles. */
export function explainMiss(hand: Hand, tiles: readonly TileKind[], card: PracticeCard = CURRENT_CARD): string {
  const reach = handDistance(hand, { concealed: tiles });
  const label = handLabel(hand, card);
  if (reach.tilesAway === null) return `${label} can’t be made from these tiles.`;
  const short = reach.units.filter((u) => u.missing > 0).map((u) => `the ${groupName(u.kind, u.count)}`);
  const missing = short.length > 2 ? `${short.slice(0, 2).join(', ')} and more` : list(short);
  const away = `${reach.tilesAway} ${reach.tilesAway === 1 ? 'tile' : 'tiles'} away`;
  return `Even at its closest, ${label} is ${away} from these tiles: it’s short of ${missing}.`;
}

export function evaluateNameTheHand(
  question: DrillQuestion<NameTheHandData>,
  picked: readonly number[],
  card: PracticeCard = CURRENT_CARD,
): DrillEvaluation {
  const { tiles, handIds, answer } = question.data;
  const choice = picked[0];
  if (picked.length !== 1 || !Number.isInteger(choice) || choice < 0 || choice >= handIds.length) {
    throw new RangeError('Pick exactly one line');
  }
  const why = explainMatch(handById(handIds[answer], card), tiles, card);
  if (choice === answer) {
    return { verdict: 'best', score: 1, best: [answer], title: 'That’s the one', explanation: why };
  }
  return {
    verdict: 'miss',
    score: 0,
    best: [answer],
    title: 'Not quite this line',
    explanation: `${explainMiss(handById(handIds[choice], card), tiles, card)} ${why}`,
  };
}

export const nameTheHand: Drill<NameTheHandData> = {
  id: 'name-the-hand',
  skill: 'card-reading',
  title: 'Name that hand',
  summary: 'A finished hand is on the table. Find its line on the card.',
  icon: { type: 'flower' },
  questionsPerRound: 5,
  generate: (seed) => generateNameTheHand(seed),
  evaluate: (question, picked) => evaluateNameTheHand(question, picked),
};
