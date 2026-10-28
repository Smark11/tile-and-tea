import { palette } from './palette';

// Inks printed on the tile face. The face is ivory in both color schemes, so
// these never change with light/dark mode. Each one stays at least 4.5:1
// against the face (theme.test.ts), so glyphs read clearly at small sizes.
export const tileInks = {
  /** Bams, Green Dragon, bird plumage. */
  green: '#1D6A4B',
  /** Crak numerals' 萬, Red Dragon, accents. */
  red: '#A8302D',
  /** Dots, Soap frame. */
  blue: '#1E4A7C',
  /** Winds, corner indexes, Crak numerals. */
  ink: palette.ink,
  /** Decorative gold: flower hearts, joker ornament. Not for text. */
  gold: '#B98A2C',
  /** Tile face gradient: lit top-left to shaded bottom-right. */
  faceLight: '#FFFBF2',
  face: palette.ivory,
  faceShade: '#EFE5CD',
  /** Ivory side of the tile, visible below the face. */
  edgeLight: '#E6D9BA',
  edge: palette.tileEdge,
  edgeShade: '#C4B188',
  /** Jade back layer, like the colored backing on a real tile. */
  backLight: palette.jade,
  back: palette.jadeFelt,
  /** Ring around a selected tile (paired with a lift, so color isn't the only cue). */
  selectRing: palette.gold,
  /** Glow around a hinted tile (paired with a star badge). */
  hintGlow: '#4FBF96',
  /** The rack is a lacquered jade object too, so it doesn't change with the scheme. */
  rackTray: '#0A2A23',
  rackTrayInlay: 'rgba(201, 162, 75, 0.45)',
  /** The ledge each tier of tiles stands on. */
  rackLedge: '#16594A',
  rackLedgeLight: '#2A8A70',
  rackLedgeShade: '#0B3A30',
} as const;

export type TileInk = keyof typeof tileInks;
