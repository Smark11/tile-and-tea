// Shared wording for drill explanations: how the coach names tiles, groups
// and hands, so every drill talks about them the same way.

import { CURRENT_CARD, type Hand, type PracticeCard } from '../../card';
import { tileName, type Suit, type TileKind } from '../../tiles';

export const GROUP_NAMES = ['', 'single', 'pair', 'pung', 'kong', 'quint', 'sextet'];
export const SUIT_PLURAL: Record<Suit, string> = { bam: 'Bams', crak: 'Craks', dot: 'Dots' };
export const COUNT_WORDS = ['no', 'one', 'two', 'three', 'four', 'five'];

const NUMBER_WORDS = [...COUNT_WORDS, 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen'];

/** "one", "two" … up to fourteen (a whole hand), then digits. */
export function countWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Flowers", "Norths", "Red Dragons", "Soaps", "3 Bams". */
export function plural(kind: TileKind): string {
  switch (kind.type) {
    case 'suited':
      return `${kind.rank} ${SUIT_PLURAL[kind.suit]}`;
    case 'dragon':
      return kind.dragon === 'white' ? 'Soaps' : `${tileName(kind)} Dragons`;
    default:
      return `${tileName(kind)}s`;
  }
}

/** "pung of 3 Bams", or just "2 Dot" for a lone tile. */
export function groupName(kind: TileKind, count: number): string {
  return count === 1 ? tileName(kind) : `${GROUP_NAMES[count]} of ${plural(kind)}`;
}

/** "a, b and c" (or "a, b or c") */
export function list(items: readonly string[], joiner: 'and' | 'or' = 'and'): string {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} ${joiner} ${items[items.length - 1]}`;
}

/** One tile, spoken: "8 Bam", "Red Dragon", "Soap", "East". */
export function singular(kind: TileKind): string {
  return kind.type === 'dragon' && kind.dragon !== 'white' ? `${tileName(kind)} Dragon` : tileName(kind);
}

/** "an East", "an 8 Bam", "a Soap", "two 3 Dots", "three Flowers". */
export function tileCount(kind: TileKind, n: number): string {
  if (n !== 1) return `${countWord(n)} ${plural(kind)}`;
  const name = singular(kind);
  return `${/^(E|8)/.test(name) ? 'an' : 'a'} ${name}`;
}

/** "1 tile", "6 tiles". */
export function tilesWord(n: number): string {
  return `${n} ${n === 1 ? 'tile' : 'tiles'}`;
}

/** Where a hand sits on the card: "2468 #2". No comma, so it reads cleanly mid-sentence. */
export function handLabel(hand: Hand, card: PracticeCard = CURRENT_CARD): string {
  const section = card.sections.find((s) => s.id === hand.category);
  const n = section ? section.hands.indexOf(hand) + 1 : 0;
  return `${section?.title ?? hand.category} #${n}`;
}

export function handById(id: string, card: PracticeCard = CURRENT_CARD): Hand {
  const hand = card.hands.find((h) => h.id === id);
  if (!hand) throw new RangeError(`No hand ${id} on the card`);
  return hand;
}
