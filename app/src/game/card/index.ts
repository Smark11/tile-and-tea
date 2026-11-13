import { parseHand } from './notation';
import { PRACTICE_CARD_2027 } from './practice-card-2027';
import type { CardDef, PracticeCard } from './types';

export * from './notation';
export * from './types';
export * from './variants';

/** Parses a card file. Throws a HandNotationError if any hand is miswritten. */
export function buildCard(def: CardDef): PracticeCard {
  const sections = def.categories.map((c) => ({
    id: c.id,
    title: c.title,
    blurb: c.blurb,
    hands: c.hands.map((h) => parseHand(h, c.id)),
  }));
  return { year: def.year, title: def.title, sections, hands: sections.flatMap((s) => s.hands) };
}

/** The card the app plays and teaches with this year. */
export const CURRENT_CARD: PracticeCard = buildCard(PRACTICE_CARD_2027);
