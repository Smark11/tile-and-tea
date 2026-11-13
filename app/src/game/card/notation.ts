// The hand notation. A hand is written much as a card prints it, with each
// group's suit spelled out so the computer can read it:
//
//   FF 222:a 444:a 666:b 888:b
//
// Groups are separated by single spaces. Inside a group, each run of one
// character is one unit, so "444" is a pung of 4s and "2027" is four singles.
//
//   1–9      a number in the group's suit
//   x        the number the player chooses; "x+1" in the same group adds one
//            to every x, so "xx:a xxx+1:a xxxx+2:a" is any 3 consecutive numbers
//   D        the Dragon of the group's suit (Green/Bams, Red/Craks, Soap/Dots)
//   0        the Soap, as the zero in a year
//   F        a Flower
//   N E W S  the Winds
//   :a :b :c the group's suit. a, b and c are always three different suits,
//            and the player picks which is which. Groups with a number, x, or D
//            need one; groups of only Flowers, Winds and 0 can't have one.
//
// Every hand is exactly 14 tiles, and uses suit a before b before c.

import { RANKS, type Rank, type TileKind, type Wind } from '../tiles';
import {
  SUIT_VAR_INK,
  SUIT_VARS,
  type CardLine,
  type CardSegment,
  type CategoryId,
  type HandDef,
  type HandGroup,
  type HandUnit,
  type Hand,
  type SuitVar,
  type TileSpec,
} from './types';

export const HAND_TILE_COUNT = 14;

/** The biggest group a hand may ask for: a quint, or the 5 singles of "13579". */
const MAX_UNIT = 5;

/** A hand's notation broke one of the rules above. */
export class HandNotationError extends Error {
  constructor(notation: string, problem: string) {
    super(`${problem} in hand "${notation}"`);
    this.name = 'HandNotationError';
  }
}

const GROUP_PATTERN = /^([0-9xDFNEWS]+)(?:\+([1-8]))?(?::([abc]))?$/;
const WINDS: Record<string, Wind> = { N: 'N', E: 'E', W: 'W', S: 'S' };
const SOAP: TileKind = { type: 'dragon', dragon: 'white' };

function specFor(char: string, suit: SuitVar | undefined, offset: number): TileSpec {
  if (char === 'F') return { type: 'fixed', kind: { type: 'flower' } };
  if (char === '0') return { type: 'fixed', kind: SOAP };
  const wind = WINDS[char];
  if (wind) return { type: 'fixed', kind: { type: 'wind', wind } };
  // The group pattern and the suit check guarantee a suit from here on.
  const s = suit as SuitVar;
  if (char === 'D') return { type: 'dragonOf', suit: s };
  if (char === 'x') return { type: 'numberVar', suit: s, offset };
  return { type: 'number', suit: s, rank: Number(char) as Rank };
}

/** Splits "2027" into runs: 2, 0, 2, 7; and "4444" into one run of four. */
function runs(glyphs: string): { char: string; count: number }[] {
  const out: { char: string; count: number }[] = [];
  for (const char of glyphs) {
    const last = out[out.length - 1];
    if (last && last.char === char) last.count += 1;
    else out.push({ char, count: 1 });
  }
  return out;
}

export function parseGroup(source: string, notation = source): HandGroup {
  const match = GROUP_PATTERN.exec(source);
  if (!match) throw new HandNotationError(notation, `Can't read group "${source}"`);
  const [, glyphs, offsetText, suitText] = match;
  const suit = suitText as SuitVar | undefined;
  const offset = offsetText ? Number(offsetText) : 0;
  const hasX = glyphs.includes('x');
  const needsSuit = /[1-9xD]/.test(glyphs);

  if (offsetText && !hasX) throw new HandNotationError(notation, `"+${offset}" needs an x in "${source}"`);
  if (hasX && /[1-9]/.test(glyphs)) {
    throw new HandNotationError(notation, `Don't mix x with written numbers in "${source}"`);
  }
  if (needsSuit && !suit) throw new HandNotationError(notation, `Group "${source}" needs a suit (:a, :b or :c)`);
  if (!needsSuit && suit) throw new HandNotationError(notation, `Group "${source}" has no suited tile to take :${suit}`);

  const units: HandUnit[] = runs(glyphs).map(({ char, count }) => {
    if (count > MAX_UNIT) throw new HandNotationError(notation, `"${source}" has a group bigger than a quint`);
    return { tile: specFor(char, suit, offset), count };
  });
  return { source, suit, units };
}

/** Reads a hand's notation into groups, or throws a HandNotationError. */
export function parseNotation(notation: string): HandGroup[] {
  if (notation !== notation.trim() || notation.includes('  ') || notation === '') {
    throw new HandNotationError(notation, 'Separate groups with single spaces');
  }
  const groups = notation.split(' ').map((g) => parseGroup(g, notation));

  const tiles = groups.reduce((sum, g) => sum + g.units.reduce((s, u) => s + u.count, 0), 0);
  if (tiles !== HAND_TILE_COUNT) throw new HandNotationError(notation, `Hand has ${tiles} tiles, not 14`);

  const used = new Set(groups.flatMap((g) => (g.suit ? [g.suit] : [])));
  SUIT_VARS.forEach((v, i) => {
    if (used.has(v) && i > 0 && !used.has(SUIT_VARS[i - 1])) {
      throw new HandNotationError(notation, `Suit :${v} is used before :${SUIT_VARS[i - 1]}`);
    }
  });

  const offsets = groups.flatMap((g) => g.units.flatMap((u) => (u.tile.type === 'numberVar' ? [u.tile.offset] : [])));
  if (offsets.length > 0 && !offsets.includes(0)) {
    throw new HandNotationError(notation, 'A hand with x+k must also use x itself');
  }
  return groups;
}

/** The suit variables a hand uses, in order: [], ['a'], ['a', 'b'] or all three. */
export function suitVarsOf(groups: readonly HandGroup[]): SuitVar[] {
  const used = new Set(groups.flatMap((g) => (g.suit ? [g.suit] : [])));
  return SUIT_VARS.filter((v) => used.has(v));
}

/** The largest x offset, so x can run from 1 to 9 minus this. Null with no x. */
export function maxOffsetOf(groups: readonly HandGroup[]): number | null {
  const offsets = groups.flatMap((g) => g.units.flatMap((u) => (u.tile.type === 'numberVar' ? [u.tile.offset] : [])));
  return offsets.length === 0 ? null : Math.max(...offsets);
}

// ---- Printing --------------------------------------------------------------

/**
 * A card prints one example of a hand with a choice in it. We print x as 1,
 * so "Any 3 consecutive numbers" reads 11 222 3333, and let the note say the rest.
 */
export const PRINTED_X = RANKS[0];

function printedChar(spec: TileSpec): string {
  switch (spec.type) {
    case 'number':
      return String(spec.rank);
    case 'numberVar':
      return String(PRINTED_X + spec.offset);
    case 'dragonOf':
      return 'D';
    case 'fixed':
      switch (spec.kind.type) {
        case 'flower':
          return 'F';
        case 'wind':
          return spec.kind.wind;
        default:
          return '0';
      }
  }
}

export function printSegment(group: HandGroup): CardSegment {
  const text = group.units.map((u) => printedChar(u.tile).repeat(u.count)).join('');
  return group.suit ? { text, ink: SUIT_VAR_INK[group.suit] } : { text };
}

// ---- Saying it aloud -------------------------------------------------------

const GROUP_NAMES = ['', 'single', 'pair', 'pung', 'kong', 'quint'];
const ORDINALS: Record<SuitVar, string> = { a: 'first', b: 'second', c: 'third' };
const WIND_NAMES: Record<Wind, string> = { N: 'North', E: 'East', W: 'West', S: 'South' };
const EXTRA_DRAGONS = ['one Dragon', 'a second Dragon', 'a third Dragon'];

type SpeechContext = {
  oneSuit: boolean;
  /** Suits that only appear as Dragons, so "the first suit's Dragon" means nothing. */
  dragonOnly: SuitVar[];
};

/** A tile's name when it stands alone in a run of singles, like "2027". */
function singleName(spec: TileSpec, ctx: SpeechContext): string {
  if (spec.type === 'fixed') {
    if (spec.kind.type === 'wind') return WIND_NAMES[spec.kind.wind];
    if (spec.kind.type === 'flower') return 'Flower';
    return 'Soap';
  }
  if (spec.type === 'dragonOf') return dragonName(spec.suit, ctx);
  return printedChar(spec);
}

function dragonName(suit: SuitVar, ctx: SpeechContext): string {
  const extra = ctx.dragonOnly.indexOf(suit);
  if (extra >= 0) return EXTRA_DRAGONS[extra];
  return ctx.oneSuit ? 'the matching Dragon' : `the ${ORDINALS[suit]} suit’s Dragon`;
}

/** "pung of 4s", "kong of North", "pair of the first suit's Dragon". */
function setPhrase(unit: HandUnit, ctx: SpeechContext): string {
  const size = GROUP_NAMES[unit.count];
  const { tile } = unit;
  if (tile.type === 'dragonOf') return `${size} of ${dragonName(tile.suit, ctx)}`;
  if (tile.type === 'fixed') {
    if (tile.kind.type === 'flower') return `${size} of Flowers`;
    if (tile.kind.type === 'wind') return `${size} of ${WIND_NAMES[tile.kind.wind]}`;
    return `${size} of Soaps`;
  }
  return `${size} of ${printedChar(tile)}s`;
}

function groupSentence(group: HandGroup, ctx: SpeechContext): string {
  const words =
    group.units.length === 1 && group.units[0].count > 1
      ? setPhrase(group.units[0], ctx)
      : group.units.map((u) => Array(u.count).fill(singleName(u.tile, ctx)).join(', ')).join(', ');
  const numbered = group.units.some((u) => u.tile.type === 'number' || u.tile.type === 'numberVar');
  const where = group.suit && numbered && !ctx.oneSuit ? ` in the ${ORDINALS[group.suit]} suit` : '';
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}${where}.`;
}

/** The whole line in words, for screen readers. */
export function speakHand(groups: readonly HandGroup[], def: Pick<HandDef, 'note' | 'concealed' | 'value'>): string {
  const suits = suitVarsOf(groups);
  const numberedSuits = new Set(
    groups.filter((g) => g.units.some((u) => u.tile.type !== 'dragonOf' && u.tile.type !== 'fixed')).map((g) => g.suit),
  );
  const ctx: SpeechContext = {
    oneSuit: numberedSuits.size === 1,
    dragonOnly: suits.filter((s) => !numberedSuits.has(s)),
  };
  const parts = groups.map((g) => groupSentence(g, ctx));
  if (ctx.oneSuit) parts.push('All numbers in one suit.');
  if (def.note) parts.push(`${def.note}.`);
  parts.push(def.concealed ? `Concealed, worth ${def.value}.` : `Exposed hand allowed, worth ${def.value}.`);
  return parts.join(' ');
}

// ---- A whole hand ----------------------------------------------------------

export function toCardLine(groups: readonly HandGroup[], def: Pick<HandDef, 'note' | 'concealed' | 'value'>): CardLine {
  return {
    segments: groups.map(printSegment),
    ...(def.note ? { note: def.note } : {}),
    concealed: def.concealed,
    value: def.value,
    spoken: speakHand(groups, def),
  };
}

export function parseHand(def: HandDef, category: CategoryId): Hand {
  const groups = parseNotation(def.notation);
  return { ...def, category, groups, line: toCardLine(groups, def) };
}
