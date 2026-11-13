// Inks for card lines in lessons. A card is printed paper, so like the tiles
// it looks the same in light and dark mode. The three suit colors are our own
// (teal, amber, plum), and each is paired with a shape mark so color is never
// the only way to tell suits apart. All text inks read at AA on the paper
// (theme.test.ts).
export const cardInks = {
  paper: '#FBF6E9',
  paperShade: '#F1E7CF',
  /** Border inlay around the card. */
  rule: '#C9A24B',
  /** Groups with no suit (Flowers, Winds), and the fine print. */
  plain: '#2B2A26',
  muted: '#5E5747',
  suit1: '#156A5C',
  suit2: '#94540F',
  suit3: '#6A3672',
} as const;

export type CardInkName = keyof typeof cardInks;
