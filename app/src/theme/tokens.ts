import type { TextStyle } from 'react-native';

import type { ColorScheme } from './colors';

/** 4pt grid. */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

/** Minimum touch target (Apple HIG 44pt; we round up for older hands). */
export const minTouchTarget = 48;

/** Widest a column of content gets on tablets and web. */
export const maxContentWidth = 640;

export type Elevation = 'low' | 'medium' | 'high';

// Layered, jade-tinted shadows read as warm daylight instead of grey smudge.
// `boxShadow` works on iOS, Android (new architecture), and web.
export const shadows: Record<ColorScheme, Record<Elevation, string>> = {
  light: {
    low: '0px 1px 2px rgba(15, 61, 51, 0.08), 0px 2px 6px rgba(15, 61, 51, 0.06)',
    medium: '0px 2px 4px rgba(15, 61, 51, 0.06), 0px 8px 24px rgba(15, 61, 51, 0.10)',
    high: '0px 4px 8px rgba(15, 61, 51, 0.08), 0px 18px 40px rgba(15, 61, 51, 0.16)',
  },
  dark: {
    low: '0px 1px 2px rgba(0, 0, 0, 0.40), 0px 2px 6px rgba(0, 0, 0, 0.30)',
    medium: '0px 2px 4px rgba(0, 0, 0, 0.40), 0px 10px 24px rgba(0, 0, 0, 0.45)',
    high: '0px 4px 10px rgba(0, 0, 0, 0.45), 0px 20px 44px rgba(0, 0, 0, 0.55)',
  },
};

/**
 * Each weight is registered as its own family (see fonts.ts) so iOS, Android,
 * and web all pick the exact face without relying on `fontWeight` matching.
 */
export const fontFamilies = {
  serif: 'Fraunces_600SemiBold',
  serifMedium: 'Fraunces_500Medium',
  serifItalic: 'Fraunces_500Medium_Italic',
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemiBold: 'Inter_600SemiBold',
} as const;

export type TypeVariant =
  | 'display'
  | 'title1'
  | 'title2'
  | 'title3'
  | 'headline'
  | 'body'
  | 'bodyEmphasis'
  | 'callout'
  | 'eyebrow'
  | 'caption'
  | 'button';

export type TypeStyle = Pick<
  TextStyle,
  'fontFamily' | 'fontSize' | 'lineHeight' | 'letterSpacing' | 'textTransform'
>;

// Body text never drops below 17pt. Sizes scale with the system text size
// (Dynamic Type / Android font scale); see `maxFontScale` for the caps.
export const typography: Record<TypeVariant, TypeStyle> = {
  display: { fontFamily: fontFamilies.serif, fontSize: 40, lineHeight: 46, letterSpacing: -0.6 },
  title1: { fontFamily: fontFamilies.serif, fontSize: 32, lineHeight: 38, letterSpacing: -0.4 },
  title2: { fontFamily: fontFamilies.serif, fontSize: 26, lineHeight: 32, letterSpacing: -0.2 },
  title3: { fontFamily: fontFamilies.serifMedium, fontSize: 22, lineHeight: 28 },
  headline: { fontFamily: fontFamilies.sansSemiBold, fontSize: 17, lineHeight: 24 },
  body: { fontFamily: fontFamilies.sans, fontSize: 17, lineHeight: 26 },
  bodyEmphasis: { fontFamily: fontFamilies.sansMedium, fontSize: 17, lineHeight: 26 },
  callout: { fontFamily: fontFamilies.serifItalic, fontSize: 19, lineHeight: 28 },
  eyebrow: {
    fontFamily: fontFamilies.sansSemiBold,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  caption: { fontFamily: fontFamilies.sans, fontSize: 15, lineHeight: 20 },
  button: { fontFamily: fontFamilies.sansSemiBold, fontSize: 17, lineHeight: 22, letterSpacing: 0.2 },
};

/**
 * Big headings stop growing at a point so they don't wrap one word per line
 * at the largest accessibility sizes. Body text scales without limit.
 */
export const maxFontScale: Partial<Record<TypeVariant, number>> = {
  display: 1.5,
  title1: 1.6,
  title2: 1.8,
  eyebrow: 2,
};

export const headingVariants: readonly TypeVariant[] = ['display', 'title1', 'title2', 'title3'];
