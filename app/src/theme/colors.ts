import { palette } from './palette';

export type ColorScheme = 'light' | 'dark';

export type ThemeColors = {
  /** Screen background. */
  background: string;
  /** Cards and sheets. */
  surface: string;
  /** Wells, inputs, and recessed areas. */
  surfaceSunken: string;
  /** Hairline borders and dividers. */
  border: string;
  text: string;
  textMuted: string;
  /** Filled primary actions. */
  primary: string;
  primaryPressed: string;
  onPrimary: string;
  /** Jade used as text or an icon on `background` / `surface`. */
  primaryText: string;
  /** The game-table felt and anything placed on it. */
  felt: string;
  onFelt: string;
  onFeltMuted: string;
  /** Thin gold inlay around felt panels, like the edge of a game-table top. */
  feltInlay: string;
  /** Decorative gold (rules, ornaments). Not for body text. */
  gold: string;
  /** Gold that's safe for text on `background` / `surface`. */
  goldText: string;
  danger: string;
  onDanger: string;
  /** Lacquer red used as text on `background` / `surface`. */
  dangerText: string;
  tileFace: string;
  tileEdge: string;
  focusRing: string;
};

const light: ThemeColors = {
  background: '#F6F1E7',
  surface: '#FFFDF8',
  surfaceSunken: '#EDE5D4',
  border: '#E0D5BE',
  text: palette.ink,
  textMuted: '#5A574E',
  primary: palette.jade,
  primaryPressed: '#19644F',
  onPrimary: '#FFFDF8',
  primaryText: '#17654F',
  felt: palette.jadeFelt,
  onFelt: palette.ivory,
  onFeltMuted: '#B9CFC4',
  feltInlay: 'rgba(201, 162, 75, 0.35)',
  gold: palette.gold,
  goldText: '#7D5F18',
  danger: palette.lacquerRed,
  onDanger: '#FFFDF8',
  dangerText: '#A03232',
  tileFace: palette.ivory,
  tileEdge: palette.tileEdge,
  focusRing: palette.gold,
};

const dark: ThemeColors = {
  background: palette.lacquer,
  surface: '#1B201D',
  surfaceSunken: '#0C0E0D',
  border: '#2C3530',
  text: '#F2ECDD',
  textMuted: '#ABA899',
  primary: palette.jade,
  primaryPressed: '#19644F',
  onPrimary: '#FFFDF8',
  primaryText: '#6CC7A8',
  felt: '#0C3029',
  onFelt: palette.ivory,
  onFeltMuted: '#A9C4B8',
  feltInlay: 'rgba(201, 162, 75, 0.30)',
  gold: palette.gold,
  goldText: '#D8B562',
  danger: palette.lacquerRed,
  onDanger: '#FFFDF8',
  dangerText: '#EB8A80',
  tileFace: palette.ivory,
  tileEdge: palette.tileEdge,
  focusRing: palette.gold,
};

export const colors: Record<ColorScheme, ThemeColors> = { light, dark };
